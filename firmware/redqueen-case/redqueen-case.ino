/***************************************************
 Red Queen Case - case controller (ESP32-C3 Super Mini)

 Reads the sensors and drives the case hardware; the web app on the
 phone runs the game and talks to us over Bluetooth LE.
 Wiring: docs/hardware.md. Protocol: firmware/README.md.

 - Nordic UART Service (NUS) named "RedQueenCase", text lines both ways
 - Heartbeat every 2 s, PING -> PONG, advertising restarts after a disconnect
 - Vial detection: two contacts in the holder pull a pin to GND while the vial is in
 - Drawer: DC motor on a DRV8833, limit switches optional, always with a timeout
 - Mist maker (MOSFET) runs when the drawer opens
 - NeoPixels (one chain: 15 inside the case, 8 logo, 5 drawer): the app picks the effect; without the app the case runs
   standalone (seal breaks 7 s after the vial is removed -> red/white blinking
   until the override button opens the drawer)
 - Standby lights: all white while the lid is open (fading in); while it's closed
   the inside is off and only the logo on the outside stays lit
 - Lid reset: closing the lid for LID_RESET_MS closes the drawer, stops the mist and
   hands the lights back to standby (also with the app connected). Opening the lid
   with the vial still out starts the vial countdown again from the beginning.
 - The same commands also work over the USB serial monitor (115200 baud)

 Built for the esp32:esp32 core 2.0.x with "USB CDC On Boot" enabled.
 Library: Adafruit NeoPixel.
 ****************************************************/

#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include "lights.h"

#define DEVICE_NAME "RedQueenCase"
#define FIRMWARE_VERSION "2.7"

// Nordic UART Service
#define NUS_SERVICE_UUID "6E400001-B5A3-F393-E0A9-E50E24DCCA9E"
#define NUS_RX_UUID      "6E400002-B5A3-F393-E0A9-E50E24DCCA9E"  // app -> ESP32 (write)
#define NUS_TX_UUID      "6E400003-B5A3-F393-E0A9-E50E24DCCA9E"  // ESP32 -> app (notify)

// INPUTS (all switches to GND, internal pull-up, LOW = active)
#define DRAWER_CLOSED_PIN 0
#define DRAWER_OPEN_PIN   1
#define OVERRIDE_PIN      9  // also the onboard BOOT button
#define VIAL_PIN          6  // vial contacts, closed (LOW) while the vial is in place
#define LID_PIN           20

// OUTPUTS
#define MIST_PIN       3
#define MOTOR_IN1_PIN  4
#define MOTOR_IN2_PIN  5
#define STATUS_LED_PIN 8  // onboard LED, LOW = on
#define NEOPIXEL_PIN   10

// Which optional switches are wired up.
#define USE_DRAWER_CLOSED_SWITCH true
#define USE_DRAWER_OPEN_SWITCH   true
#define USE_LID_SWITCH           true

// The vial contacts must stay stable this long before a change counts.
#define VIAL_DEBOUNCE_MS 200

// The lid must stay closed this long before it resets the case (a bump does nothing).
#define LID_RESET_MS 1000

// Standalone only: the countdown promises this long to put the vial back ...
#define COUNTDOWN_MS 10000
// ... but the seal breaks "unexpectedly" earlier, and the lights start blinking.
#define SEAL_FAILS_AFTER_MS 7000

// Drawer motor
#define MOTOR_SPEED       200    // PWM duty 0-255
#define DRAWER_OPEN_MS    2500   // run time to open without the "open" switch
#define DRAWER_CLOSE_MS   2500   // run time to close without the "closed" switch
#define DRAWER_TIMEOUT_MS 6000   // stop at the latest after this, even with switches

// Mist maker
#define MIST_DEFAULT_MS 10000
#define MIST_MAX_MS     30000

#define LED_BRIGHTNESS        160
#define HEARTBEAT_INTERVAL_MS 2000
#define DEBOUNCE_MS           30
#define APP_SILENT_MS         10000  // log a warning if the app stops pinging

#define MOTOR_PWM_FREQ 20000
#define MOTOR_CH_IN1   0
#define MOTOR_CH_IN2   1

BLEServer *server = nullptr;
BLECharacteristic *txCharacteristic = nullptr;
QueueHandle_t incomingLines;  // lines from BLE, handled in loop()

volatile bool appConnected = false;
volatile bool restartAdvertising = false;
volatile bool sendStateOnConnect = false;

unsigned long heartbeatCounter = 0;
unsigned long lastHeartbeat = 0;
unsigned long lastPing = 0;
bool appSilentReported = false;

Lights lights(NEOPIXEL_PIN, LED_BRIGHTNESS);
bool appControlsLights = false;  // true once the app sent an LED command

/*** Inputs ***/

// Defined before the first function, so Arduino's generated prototypes can use them.
enum DrawerState
{
  DRAWER_UNKNOWN,
  DRAWER_CLOSED,
  DRAWER_OPENING,
  DRAWER_OPEN,
  DRAWER_CLOSING,
  DRAWER_STUCK,
};

const char *const DRAWER_STATE_NAMES[] = {"UNKNOWN", "CLOSED", "OPENING", "OPEN", "CLOSING", "STUCK"};

struct Switch
{
  uint8_t pin;
  bool active;   // debounced state, true = pressed / closed
  bool reading;
  unsigned long changed;
};

Switch drawerClosedSwitch = {DRAWER_CLOSED_PIN};
Switch drawerOpenSwitch = {DRAWER_OPEN_PIN};
Switch overrideButton = {OVERRIDE_PIN};
Switch lidSwitch = {LID_PIN};

void beginSwitch(Switch &sw)
{
  pinMode(sw.pin, INPUT_PULLUP);
  sw.active = sw.reading = digitalRead(sw.pin) == LOW;
  sw.changed = millis();
}

// Returns true when the debounced state changed.
bool updateSwitch(Switch &sw, unsigned long debounceMs = DEBOUNCE_MS)
{
  bool reading = digitalRead(sw.pin) == LOW;
  if (reading != sw.reading)
  {
    sw.reading = reading;
    sw.changed = millis();
  }
  if (millis() - sw.changed > debounceMs && sw.reading != sw.active)
  {
    sw.active = sw.reading;
    return true;
  }
  return false;
}

/*** Vial ***/

// Two contacts in the holder close while the vial is inserted and pull VIAL_PIN to GND.
Switch vialContact = {VIAL_PIN};
bool vialKnown = false;
bool vialInPlace = true;
bool vialSimulated = false;  // SIM:VIAL:x for testing without the vial
unsigned long vialRemovedSince = 0;

void sendLine(const String &line);
void onVialChanged();

void setVial(bool inPlace)
{
  bool changed = !vialKnown || inPlace != vialInPlace;
  vialKnown = true;
  vialInPlace = inPlace;
  if (changed && !inPlace)
  {
    vialRemovedSince = millis();
  }
  if (changed)
  {
    sendLine(vialInPlace ? "VIAL:1" : "VIAL:0");
    onVialChanged();
  }
}

void updateVial()
{
  // Longer debounce than the buttons: the contacts can chatter while the vial is handled.
  bool changed = updateSwitch(vialContact, VIAL_DEBOUNCE_MS);
  if (!vialSimulated && (changed || !vialKnown))
  {
    setVial(vialContact.active);
  }
}

/*** Drawer and mist maker ***/

DrawerState drawerState = DRAWER_UNKNOWN;
unsigned long drawerStarted = 0;
unsigned long mistUntil = 0;
bool mistOn = false;

void setDrawerState(DrawerState state)
{
  drawerState = state;
  sendLine(String("DRAWER:") + DRAWER_STATE_NAMES[state]);
}

void motor(int direction)
{
  if (direction > 0)
  {
    ledcWrite(MOTOR_CH_IN1, MOTOR_SPEED);
    ledcWrite(MOTOR_CH_IN2, 0);
  }
  else if (direction < 0)
  {
    ledcWrite(MOTOR_CH_IN1, 0);
    ledcWrite(MOTOR_CH_IN2, MOTOR_SPEED);
  }
  else
  {
    // Both inputs high = brake.
    ledcWrite(MOTOR_CH_IN1, 255);
    ledcWrite(MOTOR_CH_IN2, 255);
  }
}

void setMist(unsigned long durationMs)
{
  durationMs = min(durationMs, (unsigned long)MIST_MAX_MS);
  mistOn = durationMs > 0;
  mistUntil = millis() + durationMs;
  digitalWrite(MIST_PIN, mistOn ? HIGH : LOW);
  sendLine(mistOn ? "MIST:ON" : "MIST:OFF");
}

// Opens the drawer; in the game (and with the override button) the mist comes along.
void openDrawer(bool withMist = true)
{
  if (drawerState == DRAWER_OPEN || drawerState == DRAWER_OPENING)
  {
    return;
  }
  drawerStarted = millis();
  motor(1);
  setDrawerState(DRAWER_OPENING);
  if (withMist)
  {
    setMist(MIST_DEFAULT_MS);
  }
}

void closeDrawer()
{
  if (drawerState == DRAWER_CLOSED || drawerState == DRAWER_CLOSING)
  {
    return;
  }
  drawerStarted = millis();
  motor(-1);
  setDrawerState(DRAWER_CLOSING);
}

// Hardware test: stops the motor wherever the drawer is.
void stopDrawer()
{
  motor(0);
  setDrawerState(drawerStateFromSwitches());
}

void updateDrawer()
{
  unsigned long elapsed = millis() - drawerStarted;
  if (drawerState == DRAWER_OPENING)
  {
    bool reached = USE_DRAWER_OPEN_SWITCH ? drawerOpenSwitch.active : elapsed >= DRAWER_OPEN_MS;
    if (reached || elapsed >= DRAWER_TIMEOUT_MS)
    {
      motor(0);
      setDrawerState(reached ? DRAWER_OPEN : DRAWER_STUCK);
    }
  }
  else if (drawerState == DRAWER_CLOSING)
  {
    bool reached = USE_DRAWER_CLOSED_SWITCH ? drawerClosedSwitch.active : elapsed >= DRAWER_CLOSE_MS;
    if (reached || elapsed >= DRAWER_TIMEOUT_MS)
    {
      motor(0);
      setDrawerState(reached ? DRAWER_CLOSED : DRAWER_STUCK);
    }
  }

  if (mistOn && (long)(millis() - mistUntil) >= 0)
  {
    setMist(0);
  }
}

DrawerState drawerStateFromSwitches()
{
  if (!USE_DRAWER_CLOSED_SWITCH)
  {
    return DRAWER_CLOSED;
  }
  if (drawerClosedSwitch.active)
  {
    return DRAWER_CLOSED;
  }
  if (USE_DRAWER_OPEN_SWITCH && drawerOpenSwitch.active)
  {
    return DRAWER_OPEN;
  }
  return DRAWER_UNKNOWN;
}

/*** Lights ***/

// Without the app (or until it sends an LED command) the case runs the lights
// by itself, purely from the vial: white standby while it's in place, a 10 s red
// countdown once it's removed, red/white blinking when the seal breaks after 7 s.
// Putting the vial back always returns to standby, also after the seal broke.
// While the app is connected it runs the game and sends the effects itself.
bool lidClosed()
{
  return USE_LID_SWITCH && lidSwitch.active;
}

void updateAutoLights()
{
  if (appControlsLights)
  {
    return;
  }
  // A closed lid ends everything: standby lights, which are off while it's closed.
  if (!vialKnown || vialInPlace || lidClosed())
  {
    lights.setEffect(LIGHTS_IDLE);
  }
  else if (millis() - vialRemovedSince >= SEAL_FAILS_AFTER_MS)
  {
    lights.setEffect(LIGHTS_ALERT);
  }
  else if (lights.current() != LIGHTS_COUNTDOWN)
  {
    lights.startCountdown(COUNTDOWN_MS, vialRemovedSince);
  }
}

// The lid has been closed for LID_RESET_MS: the single safe exit. Drawer in, mist off,
// lights back to standby. The app gets LID:0 and ends its game by itself.
bool lidResetDone = false;

void resetFromLid()
{
  Serial.println("Lid closed: reset");
  if (drawerState == DRAWER_OPEN || drawerState == DRAWER_OPENING)
  {
    closeDrawer();
  }
  if (mistOn)
  {
    setMist(0);
  }
  appControlsLights = false;
  updateAutoLights();
}

void onVialChanged()
{
  updateAutoLights();
}

/*** Protocol ***/

void sendLine(const String &line)
{
  Serial.print("-> ");
  Serial.println(line);
  if (!appConnected)
  {
    return;
  }
  txCharacteristic->setValue(line.c_str());
  txCharacteristic->notify();
}

void sendSwitch(const char *name, const Switch &sw)
{
  sendLine(String("SW:") + name + (sw.active ? ":1" : ":0"));
}

// Parses "RRGGBB" (hex). Returns false if it isn't six hex digits.
bool parseColor(const String &text, uint32_t &color)
{
  if (text.length() != 6)
  {
    return false;
  }
  for (unsigned int i = 0; i < 6; i++)
  {
    if (!isHexadecimalDigit(text[i]))
    {
      return false;
    }
  }
  color = strtoul(text.c_str(), nullptr, 16);
  return true;
}

void sendStatus()
{
  sendLine("FW:" FIRMWARE_VERSION);
  if (vialKnown)
  {
    sendLine(vialInPlace ? "VIAL:1" : "VIAL:0");
  }
  sendLine(String("DRAWER:") + DRAWER_STATE_NAMES[drawerState]);
  if (USE_LID_SWITCH)
  {
    sendLine(lidSwitch.active ? "LID:0" : "LID:1");
  }
  sendLine(String("LED:") + LIGHT_EFFECT_NAMES[lights.current()]);
  sendLine("BRIGHTNESS:" + String(lights.brightness()));
  sendLine(mistOn ? "MIST:ON" : "MIST:OFF");
  sendSwitch("CLOSED", drawerClosedSwitch);
  sendSwitch("OPEN", drawerOpenSwitch);
}

void handleLine(String line)
{
  line.trim();
  line.toUpperCase();
  if (line.length() == 0)
  {
    return;
  }
  Serial.print("<- ");
  Serial.println(line);

  if (line == "PING")
  {
    lastPing = millis();
    appSilentReported = false;
    sendLine("PONG");
  }
  else if (line == "STATUS")
  {
    sendStatus();
  }
  else if (line.startsWith("LED:"))
  {
    String name = line.substring(4);
    LightEffect effect;
    if (name == "AUTO")
    {
      appControlsLights = false;
      updateAutoLights();
    }
    else if (name == "COUNTDOWN" || name.startsWith("COUNTDOWN:"))
    {
      // LED:COUNTDOWN runs for 10 s, LED:COUNTDOWN:<s> for <s> seconds.
      unsigned long ms = name.length() > 10 ? name.substring(10).toInt() * 1000UL : COUNTDOWN_MS;
      appControlsLights = true;
      lights.startCountdown(ms, millis());
    }
    else if (name == "BRIGHTNESS" || name.startsWith("BRIGHTNESS:"))
    {
      // LED:BRIGHTNESS:<0-255>, or LED:BRIGHTNESS alone for the default.
      int value = name.length() > 11 ? constrain(name.substring(11).toInt(), 0, 255) : LED_BRIGHTNESS;
      lights.setBrightness(value);
      sendLine("BRIGHTNESS:" + String(value));
    }
    else if (name.startsWith("COLOR:"))
    {
      // LED:COLOR:<INSIDE|LOGO|DRAWER|ALL>:<RRGGBB> switches to the CUSTOM effect.
      int colon = name.indexOf(':', 6);
      String zoneName = colon > 0 ? name.substring(6, colon) : "";
      uint32_t color;
      LightZone zone;
      if (colon > 0 && Lights::parseZone(zoneName, zone) && parseColor(name.substring(colon + 1), color))
      {
        appControlsLights = true;
        lights.setCustomColor(zone, color);
      }
      else
      {
        sendLine("ERR:UNKNOWN:" + line);
      }
    }
    else if (Lights::parse(name, effect))
    {
      appControlsLights = true;
      lights.setEffect(effect);
    }
    else
    {
      sendLine("ERR:UNKNOWN:" + line);
    }
  }
  else if (line == "DRAWER:OPEN")
  {
    openDrawer();
  }
  else if (line == "DRAWER:OPEN:DRY")
  {
    openDrawer(false);  // hardware test: drawer only, no mist
  }
  else if (line == "DRAWER:CLOSE")
  {
    closeDrawer();
  }
  else if (line == "DRAWER:STOP")
  {
    stopDrawer();
  }
  else if (line == "MIST:ON")
  {
    setMist(MIST_DEFAULT_MS);
  }
  else if (line == "MIST:OFF")
  {
    setMist(0);
  }
  else if (line.startsWith("MIST:"))
  {
    setMist(line.substring(5).toInt() * 1000UL);
  }
  else if (line == "SIM:VIAL:0" || line == "SIM:VIAL:1")
  {
    vialSimulated = true;
    setVial(line.endsWith("1"));
  }
  else if (line == "SIM:OFF")
  {
    vialSimulated = false;
    vialKnown = false;
  }
  else
  {
    sendLine("ERR:UNKNOWN:" + line);
  }
}

/*** BLE ***/

class ServerCallbacks : public BLEServerCallbacks
{
  void onConnect(BLEServer *server)
  {
    appConnected = true;
    sendStateOnConnect = true;
    lastPing = millis();
    Serial.println("App connected");
  }

  void onDisconnect(BLEServer *server)
  {
    appConnected = false;
    restartAdvertising = true;
    Serial.println("App disconnected");
  }
};

class RxCallbacks : public BLECharacteristicCallbacks
{
  void onWrite(BLECharacteristic *characteristic)
  {
    char line[64] = {0};
    strncpy(line, characteristic->getValue().c_str(), sizeof(line) - 1);
    xQueueSend(incomingLines, line, 0);
  }
};

void setupBle()
{
  incomingLines = xQueueCreate(8, 64);

  BLEDevice::init(DEVICE_NAME);
  server = BLEDevice::createServer();
  server->setCallbacks(new ServerCallbacks());

  BLEService *service = server->createService(NUS_SERVICE_UUID);

  txCharacteristic = service->createCharacteristic(NUS_TX_UUID, BLECharacteristic::PROPERTY_NOTIFY);
  txCharacteristic->addDescriptor(new BLE2902());

  BLECharacteristic *rxCharacteristic = service->createCharacteristic(
    NUS_RX_UUID, BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR);
  rxCharacteristic->setCallbacks(new RxCallbacks());

  service->start();

  BLEAdvertising *advertising = BLEDevice::getAdvertising();
  advertising->addServiceUUID(NUS_SERVICE_UUID);
  // The 128-bit UUID and the name don't both fit into one advertising packet;
  // with a scan response the name goes there.
  advertising->setScanResponse(true);
  BLEDevice::startAdvertising();
  Serial.println("Advertising as " DEVICE_NAME);
}

void readSerial()
{
  static String buffer;
  while (Serial.available())
  {
    char c = Serial.read();
    if (c == '\n' || c == '\r')
    {
      handleLine(buffer);
      buffer = "";
    }
    else if (buffer.length() < 64)
    {
      buffer += c;
    }
  }
}

void updateStatusLed()
{
  bool on = appConnected || (millis() / 500) % 2;
  digitalWrite(STATUS_LED_PIN, on ? LOW : HIGH);
}

void setup()
{
  // Outputs first, so the motor and the mist maker stay off.
  pinMode(MIST_PIN, OUTPUT);
  digitalWrite(MIST_PIN, LOW);
  ledcSetup(MOTOR_CH_IN1, MOTOR_PWM_FREQ, 8);
  ledcSetup(MOTOR_CH_IN2, MOTOR_PWM_FREQ, 8);
  ledcAttachPin(MOTOR_IN1_PIN, MOTOR_CH_IN1);
  ledcAttachPin(MOTOR_IN2_PIN, MOTOR_CH_IN2);
  motor(0);
  pinMode(STATUS_LED_PIN, OUTPUT);

  Serial.begin(115200);
  Serial.setTxTimeoutMs(0);  // don't block when no serial monitor is open
  delay(500);
  Serial.println("Red Queen Case - case controller " FIRMWARE_VERSION);

  beginSwitch(drawerClosedSwitch);
  beginSwitch(drawerOpenSwitch);
  beginSwitch(overrideButton);
  beginSwitch(lidSwitch);
  drawerState = drawerStateFromSwitches();

  lights.begin();
  beginSwitch(vialContact);
  updateAutoLights();

  setupBle();
}

void loop()
{
  // Restart advertising outside the BLE callback, after the stack has cleaned up.
  if (restartAdvertising)
  {
    restartAdvertising = false;
    appControlsLights = false;
    delay(500);
    BLEDevice::startAdvertising();
    Serial.println("Advertising again");
  }

  if (sendStateOnConnect)
  {
    sendStateOnConnect = false;
    delay(200);  // give the app time to subscribe to notifications
    sendStatus();
  }

  char line[64];
  while (xQueueReceive(incomingLines, line, 0) == pdTRUE)
  {
    handleLine(line);
  }
  readSerial();

  if (millis() - lastHeartbeat >= HEARTBEAT_INTERVAL_MS)
  {
    lastHeartbeat = millis();
    heartbeatCounter++;
    sendLine("HB:" + String(heartbeatCounter) + ":" + String(millis() / 1000));
  }

  if (appConnected && !appSilentReported && millis() - lastPing > APP_SILENT_MS)
  {
    appSilentReported = true;
    Serial.println("App connected but silent (no PING)");
  }

  if (updateSwitch(overrideButton) && overrideButton.active)
  {
    sendLine("BTN:OVERRIDE");
    // Works without the app: opens the drawer, or closes it again.
    if (drawerState == DRAWER_OPEN || drawerState == DRAWER_OPENING)
    {
      closeDrawer();
    }
    else
    {
      openDrawer();
    }
  }
  if (updateSwitch(drawerClosedSwitch))
  {
    sendSwitch("CLOSED", drawerClosedSwitch);
  }
  if (updateSwitch(drawerOpenSwitch))
  {
    sendSwitch("OPEN", drawerOpenSwitch);
  }
  if (updateSwitch(lidSwitch) && USE_LID_SWITCH)
  {
    sendLine(lidSwitch.active ? "LID:0" : "LID:1");
    lidResetDone = false;
    // Opened again with the vial still out: the countdown starts over, as if it was just removed.
    if (!lidSwitch.active && vialKnown && !vialInPlace)
    {
      vialRemovedSince = millis();
    }
  }
  if (lidClosed() && !lidResetDone && millis() - lidSwitch.changed >= LID_RESET_MS)
  {
    lidResetDone = true;
    resetFromLid();
  }
  // The switch is closed while the lid is shut. Without a lid switch the lid counts as open.
  lights.setLidOpen(!USE_LID_SWITCH || !lidSwitch.active);
  // The drawer LEDs light the antidote while the drawer is opening, open or closing.
  lights.setDrawerOpen(drawerState == DRAWER_OPENING || drawerState == DRAWER_OPEN || drawerState == DRAWER_CLOSING);

  updateVial();
  updateDrawer();
  updateAutoLights();
  lights.update();
  // Report every effect change, also the automatic ones (countdown -> alert).
  static LightEffect reportedEffect = lights.current();
  if (lights.current() != reportedEffect)
  {
    reportedEffect = lights.current();
    sendLine(String("LED:") + LIGHT_EFFECT_NAMES[reportedEffect]);
  }
  updateStatusLed();
  delay(5);
}
