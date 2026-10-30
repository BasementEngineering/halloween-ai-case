/***************************************************
 Red Queen Case - BLE test firmware (ESP32-WROOM-32 DevKit)

 Tests the Bluetooth link to the web app before the real
 hardware is wired up:
 - Nordic UART Service (NUS): text lines in both directions
 - Heartbeat to the app every 2 s:   HB:<counter>:<uptime s>
 - BOOT button simulates the vial:   VIAL:0 (removed) / VIAL:1 (in place)
 - App pings us:                     PING -> PONG
 - Restarts advertising after a disconnect, so the app can reconnect
 - Onboard LED: slow blink = waiting for the app, on = connected

 Built for the esp32:esp32 core 2.0.x (built-in BLE library).
 ****************************************************/

#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

#define DEVICE_NAME "RedQueenCase"

// Nordic UART Service
#define NUS_SERVICE_UUID "6E400001-B5A3-F393-E0A9-E50E24DCCA9E"
#define NUS_RX_UUID      "6E400002-B5A3-F393-E0A9-E50E24DCCA9E"  // app -> ESP32 (write)
#define NUS_TX_UUID      "6E400003-B5A3-F393-E0A9-E50E24DCCA9E"  // ESP32 -> app (notify)

// INPUTS
#define VIAL_BUTTON_PIN 0  // BOOT button, LOW while pressed = vial removed

// OUTPUTS
#define LED_PIN 2  // onboard LED

#define HEARTBEAT_INTERVAL_MS 2000
#define DEBOUNCE_MS 30
// Log a warning if the app stops pinging while still connected.
#define APP_SILENT_MS 10000

BLEServer *server = nullptr;
BLECharacteristic *txCharacteristic = nullptr;

volatile bool appConnected = false;
volatile bool restartAdvertising = false;
volatile bool sendStateOnConnect = false;

unsigned long heartbeatCounter = 0;
unsigned long lastHeartbeat = 0;
unsigned long lastPing = 0;
bool appSilentReported = false;

bool vialInPlace = true;

void sendLine(const String &line) {
  Serial.print("-> ");
  Serial.println(line);
  if (!appConnected) {
    return;
  }
  txCharacteristic->setValue(line.c_str());
  txCharacteristic->notify();
}

void handleLine(const String &line) {
  Serial.print("<- ");
  Serial.println(line);
  if (line == "PING") {
    lastPing = millis();
    appSilentReported = false;
    sendLine("PONG");
  }
}

class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer *server) {
    appConnected = true;
    sendStateOnConnect = true;
    lastPing = millis();
    Serial.println("App connected");
  }

  void onDisconnect(BLEServer *server) {
    appConnected = false;
    restartAdvertising = true;
    Serial.println("App disconnected");
  }
};

class RxCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *characteristic) {
    String value = characteristic->getValue().c_str();
    value.trim();
    if (value.length() > 0) {
      handleLine(value);
    }
  }
};

void setupBle() {
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

void checkVialButton() {
  static bool lastReading = true;
  static unsigned long lastChange = 0;

  bool reading = digitalRead(VIAL_BUTTON_PIN) == HIGH;  // HIGH = not pressed = vial in place
  if (reading != lastReading) {
    lastReading = reading;
    lastChange = millis();
  }
  if (millis() - lastChange > DEBOUNCE_MS && reading != vialInPlace) {
    vialInPlace = reading;
    sendLine(vialInPlace ? "VIAL:1" : "VIAL:0");
  }
}

void updateLed() {
  if (appConnected) {
    digitalWrite(LED_PIN, HIGH);
  } else {
    digitalWrite(LED_PIN, (millis() / 500) % 2);
  }
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("Red Queen Case - BLE test firmware");

  pinMode(VIAL_BUTTON_PIN, INPUT_PULLUP);
  pinMode(LED_PIN, OUTPUT);
  vialInPlace = digitalRead(VIAL_BUTTON_PIN) == HIGH;

  setupBle();
}

void loop() {
  // Restart advertising outside the BLE callback, after the stack has cleaned up.
  if (restartAdvertising) {
    restartAdvertising = false;
    delay(500);
    BLEDevice::startAdvertising();
    Serial.println("Advertising again");
  }

  if (sendStateOnConnect) {
    sendStateOnConnect = false;
    delay(200);  // give the app time to subscribe to notifications
    sendLine(vialInPlace ? "VIAL:1" : "VIAL:0");
  }

  if (millis() - lastHeartbeat >= HEARTBEAT_INTERVAL_MS) {
    lastHeartbeat = millis();
    heartbeatCounter++;
    sendLine("HB:" + String(heartbeatCounter) + ":" + String(millis() / 1000));
  }

  if (appConnected && !appSilentReported && millis() - lastPing > APP_SILENT_MS) {
    appSilentReported = true;
    Serial.println("App connected but silent (no PING)");
  }

  checkVialButton();
  updateLed();
  delay(5);
}
