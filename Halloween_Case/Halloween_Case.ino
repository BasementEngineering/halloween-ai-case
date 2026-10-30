/***************************************************
DFPlayer - A Mini MP3 Player For Arduino
 <https://www.dfrobot.com/product-1121.html>

 ***************************************************
 This example shows the basic function of library for DFPlayer.

 Created 2016-12-07
 By [Angelo qiao](Angelo.qiao@dfrobot.com)

 GNU Lesser General Public License.
 See <http://www.gnu.org/licenses/> for details.
 All above must be included in any redistribution
 ****************************************************/

/***********Notice and Trouble shooting***************
 1.Connection and Diagram can be found here
 <https://www.dfrobot.com/wiki/index.php/DFPlayer_Mini_SKU:DFR0299#Connection_Diagram>
 2.This code is tested on Arduino Uno, Leonardo, Mega boards.
 ****************************************************/

#include "Arduino.h"
#include "DFRobotDFPlayerMini.h"
#include "lights.h"

//INPUTS
#define CASE_BREACHED_PIN 5  //D1
#define VIRUS_VIAL1_PIN 2    //D2
#define KEYPAD_PIN 0         //D3

#define POTI_PIN A0

#define PLAYER_RX 14  //D5
#define PLAYER_TX 12  //D6

// OUTPUTS
#define LED_PIN 2
Lights myLights(LED_PIN);

#include <SoftwareSerial.h>
SoftwareSerial softSerial(/*rx =*/PLAYER_RX, /*tx =*/PLAYER_TX);
#define FPSerial softSerial

DFRobotDFPlayerMini myDFPlayer;

#define ENABLE_AUDIO 1

// State Machine
enum states {
  IDLE,
  CASE_BREACHED,
  CASE_LEFT_OPEN_30S,
  LEFT_OPEN_LONGER,
  HOPELESS_OPEN_LOOP,
  CASE_CLOSED
};

enum voiceLines {
  STARTING_LINE = 1,
  CASE_BREACHED_LINE = 2,
  WRONG_CODE_LINE = 3,
  MOST_IMPORTANTLY_LINE = 4,
  CASE_CLOSED_LINE = 5,
  ACTIVATING_TRACKING_LINE = 6,
  EXPLODING_IN_LINE = 7,
  YOU_GOT_ME_HELP_LINE = 8,
  INSULTS_LINE = 9,
  HELP_OTHER_LINE = 10
};

void setupSoundPlayer() {
  if (ENABLE_AUDIO) {
    Serial.println();
    Serial.println(F("DFRobot DFPlayer Mini Demo"));
    Serial.println(F("Initializing DFPlayer ... (May take 3~5 seconds)"));

    FPSerial.begin(9600);
    delay(500);
    if (!myDFPlayer.begin(FPSerial, /*isACK = */ true, /*doReset = */ true)) {  //Use serial to communicate with mp3.
      Serial.println(F("Unable to begin:"));
      Serial.println(F("1.Please recheck the connection!"));
      Serial.println(F("2.Please insert the SD card!"));
      while (true) {
        delay(0);  // Code to compatible with ESP8266 watch dog.
      }
    }
    myDFPlayer.setTimeOut(500);  //Set serial communictaion time out 500ms

    Serial.println(F("DFPlayer Mini online."));

    myDFPlayer.volume(30);
    myDFPlayer.play(STARTING_LINE);  //Play the first mp3
  }
}

void playSound(int sound) {
  if (ENABLE_AUDIO) {
    myDFPlayer.play(sound);
    delay(10);
  }
}

unsigned long stateEnteredTs = 0;

void printDetail(uint8_t type, int value);

void setupPins() {
  pinMode(CASE_BREACHED_PIN, INPUT_PULLUP);
  pinMode(VIRUS_VIAL1_PIN, INPUT_PULLUP);
  pinMode(KEYPAD_PIN, INPUT_PULLUP);

  pinMode(POTI_PIN, INPUT);
}

unsigned long lastVolumeUpdate = 0;
void checkVolumeInput() {
  static int lastVolume = 0;

  if (millis() - lastVolumeUpdate > 100) {
    lastVolumeUpdate = millis();
    myDFPlayer.volume(15);
    return;
    int value = analogRead(POTI_PIN);
    int volume = map(value, 0, 1023, 0, 30);

    if (volume != lastVolume) {
      Serial.print("Volume: ");
      Serial.println(volume);
      myDFPlayer.volume(volume);  //Set volume value (0~30).
      lastVolume = volume;
    }
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("System Starting");
  delay(100);
  setupSoundPlayer();
  setupPins();
  myLights.begin();
  Serial.println("Setup Done");
}

void printSystemStatus() {
  Serial.print("Case Breached: ");
  Serial.println(digitalRead(CASE_BREACHED_PIN));
  Serial.print("Virus Vial 1: ");
  Serial.println(digitalRead(VIRUS_VIAL1_PIN));
  Serial.print("Keypad: ");
  Serial.println(digitalRead(KEYPAD_PIN));
  if (myDFPlayer.available()) {
    printDetail(myDFPlayer.readType(), myDFPlayer.read());  //Print the detail message from DFPlayer to handle different errors and states.
  }
}

unsigned long lastLoopUpdate = 0;
void loop() {
  if (millis() - lastLoopUpdate > 1000) {
    lastLoopUpdate = millis();
    printSystemStatus();
  }

  //checkVolumeInput();
  runStateMachine();
  myLights.update();
}

int voiceCounter = 0;

void runStateMachine() {
  static states state = IDLE;
  static unsigned long timer = millis();

  switch (state) {
    case IDLE:
      if (digitalRead(CASE_BREACHED_PIN) == HIGH) {
        timer = millis();
        state = CASE_BREACHED;
        myLights.setState(RED);
        playSound(CASE_BREACHED_LINE);
        Serial.println("Case Breached");
      }
      break;
    case CASE_BREACHED:
      if (digitalRead(CASE_BREACHED_PIN) == LOW) {
        state = IDLE;
        myLights.setState(NONE);

        playSound(CASE_CLOSED_LINE);
        timer = millis();
        Serial.println("Case Closed");
      }
      if (millis() - timer > 10000) {
        state = CASE_LEFT_OPEN_30S;
        myLights.setState(FLASH);
        playSound(ACTIVATING_TRACKING_LINE);
        timer = millis();
        Serial.println("Case left open for 30s");
      }
      break;
    case CASE_LEFT_OPEN_30S:
      if (digitalRead(CASE_BREACHED_PIN) == LOW) {
        state = IDLE;
        myLights.setState(NONE);
        playSound(CASE_CLOSED_LINE);
        timer = millis();
      }
      if (millis() - timer >  10000) {
        state = LEFT_OPEN_LONGER;
        myLights.setState(FLASH);
        playSound(EXPLODING_IN_LINE);
        timer = millis();
        Serial.println("Case left open for longer");
      }
      break;
    case LEFT_OPEN_LONGER:
      if (digitalRead(CASE_BREACHED_PIN) == LOW) {
        state = IDLE;
        myLights.setState(NONE);
        playSound(CASE_CLOSED_LINE);
        timer = millis();
      }
      if (millis() - timer > 21000) {
        state = HOPELESS_OPEN_LOOP;
        myLights.setState(RED);
        playSound(YOU_GOT_ME_HELP_LINE);
        timer = millis();
        Serial.println("Hopeless open loop");
      }

      break;
    case HOPELESS_OPEN_LOOP:
      if (digitalRead(CASE_BREACHED_PIN) == LOW) {
        state = IDLE;
        myLights.setState(NONE);
        playSound(CASE_CLOSED_LINE);
        timer = millis();
      }
      if (millis() - timer > 20000) {
        voiceCounter++;
        if (voiceCounter % 2 == 0) {
          playSound(INSULTS_LINE);
        } else {
          playSound(HELP_OTHER_LINE);
        }
        timer = millis();
      }
      break;
    
    default:
      state = IDLE;
      break;
  }
}

void printDetail(uint8_t type, int value) {
  switch (type) {
    case TimeOut:
      Serial.println(F("Time Out!"));
      break;
    case WrongStack:
      Serial.println(F("Stack Wrong!"));
      break;
    case DFPlayerCardInserted:
      Serial.println(F("Card Inserted!"));
      break;
    case DFPlayerCardRemoved:
      Serial.println(F("Card Removed!"));
      break;
    case DFPlayerCardOnline:
      Serial.println(F("Card Online!"));
      break;
    case DFPlayerUSBInserted:
      Serial.println("USB Inserted!");
      break;
    case DFPlayerUSBRemoved:
      Serial.println("USB Removed!");
      break;
    case DFPlayerPlayFinished:
      Serial.print(F("Number:"));
      Serial.print(value);
      Serial.println(F(" Play Finished!"));
      break;
    case DFPlayerError:
      Serial.print(F("DFPlayerError:"));
      switch (value) {
        case Busy:
          Serial.println(F("Card not found"));
          break;
        case Sleeping:
          Serial.println(F("Sleeping"));
          break;
        case SerialWrongStack:
          Serial.println(F("Get Wrong Stack"));
          break;
        case CheckSumNotMatch:
          Serial.println(F("Check Sum Not Match"));
          break;
        case FileIndexOut:
          Serial.println(F("File Index Out of Bound"));
          break;
        case FileMismatch:
          Serial.println(F("Cannot Find File"));
          break;
        case Advertise:
          Serial.println(F("In Advertise"));
          break;
        default:
          break;
      }
      break;
    default:
      break;
  }
}