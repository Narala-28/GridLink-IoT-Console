/********************************************************************
 * APTRANSCO SCADA FEEDER MONITOR + GRIDLINK IOT INTEGRATION
 *
 * ESP32 + MAX485 + GridLink MQTT Stack
 *
 * RX2   -> GPIO16
 * TX2   -> GPIO17
 * DE/RE -> GPIO4
 *
 * RISH3430 + RISH3450
 ********************************************************************/

#include <Arduino.h>
#include <HardwareSerial.h>
#include <math.h>
#include <string.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

//====================================================================
// WIFI & GRIDLINK MQTT CONFIGURATION
//====================================================================
const char* WIFI_SSID     = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Laptop / Server IP running GridLink Docker stack
const char* MQTT_SERVER   = "YOUR_GRIDLINK_SERVER_IP"; 
const int   MQTT_PORT     = 1883;

const char* DEVICE_ID       = "TEST001";
const char* TELEMETRY_TOPIC = "gridlink/device/TEST001/telemetry";
const char* COMMAND_TOPIC   = "gridlink/device/TEST001/command";
const char* STATUS_TOPIC    = "gridlink/device/TEST001/status";

WiFiClient espClient;
PubSubClient mqtt(espClient);

//====================================================================
// RS485 CONFIGURATION
//====================================================================
#define RS485_RX_PIN    16
#define RS485_TX_PIN    17
#define RS485_DE_RE_PIN  4
#define RS485_BAUD      9600

HardwareSerial RS485(2);
const float SQRT3 = 1.7320508;

//====================================================================
// METER TYPES & FEEDER STRUCTURE
//====================================================================
enum MeterType { RISH3430, RISH3450 };

struct Feeder {
  uint8_t slaveID;
  const char *name;
  MeterType meterType;
  bool online;
  float VRY;
  float IR;
  float MW;
  float MVAR;
  float PF;
};

//====================================================================
// FEEDER LIST (APTRANSCO SUBSTATION FEEDERS)
//====================================================================
Feeder feeders[] = {
  {15, "132/33,50 MVA PTR-I HV",        RISH3430, false, 0, 0, 0, 0, 0},
  {14, "132/33,50 MVA PTR-I LV",        RISH3430, false, 0, 0, 0, 0, 0},
  {13, "132/33,31.5 MVA PTR-II HV",     RISH3450, false, 0, 0, 0, 0, 0},
  {16, "132/33,31.5 MVA PTR-II LV",     RISH3450, false, 0, 0, 0, 0, 0},
  {71, "132/33,31.5MVA PTR-III HV",     RISH3430, false, 0, 0, 0, 0, 0},
  {72, "132/33,31.5MVA PTR-III LV",     RISH3430, false, 0, 0, 0, 0, 0}, 
  {46, "33 KV AMARARAJA INFRA",         RISH3430, false, 0, 0, 0, 0, 0},
  {38, "33 KV YELLAMANDYAM",            RISH3430, false, 0, 0, 0, 0, 0},
  {47, "33 KV GAJULAMANDYAM",           RISH3430, false, 0, 0, 0, 0, 0},
  {37, "33 KV YERPEDU",                 RISH3430, false, 0, 0, 0, 0, 0},
  {30, "33 KV THUKIVAKAM",              RISH3450, false, 0, 0, 0, 0, 0},
  {40, "33 KV KARAKAMBADI",             RISH3430, false, 0, 0, 0, 0, 0},
  {17, "33 KV IN AIRPORT",              RISH3450, false, 0, 0, 0, 0, 0},
  {18, "33 KV MUNAGALAPALEM",           RISH3450, false, 0, 0, 0, 0, 0},
  {11, "33 KV APIIC-I",                 RISH3450, false, 0, 0, 0, 0, 0},
  {34, "33 KV APIIC-II",                RISH3430, false, 0, 0, 0, 0, 0},
  {22, "33 KV POTPL",                   RISH3430, false, 0, 0, 0, 0, 0},
  {19, "33 KV TTE ",                    RISH3430, false, 0, 0, 0, 0, 0},
  {39, "33 KV G.R. PALLI",              RISH3430, false, 0, 0, 0, 0, 0},
  {6,  "132 KV RAILWAY-I",              RISH3450, false, 0, 0, 0, 0, 0},
  {5,  "132 KV RAILWAY-II",             RISH3450, false, 0, 0, 0, 0, 0},
  {4,  "132 KV TIRUPATI",               RISH3450, false, 0, 0, 0, 0, 0},
  {7,  "132 KV GRINDWHEEL",             RISH3450, false, 0, 0, 0, 0, 0},
  {8,  "132 KV PUTTUR-I",               RISH3450, false, 0, 0, 0, 0, 0},
  {9,  "132 KV PUTTUR-II",              RISH3450, false, 0, 0, 0, 0, 0},
  {10, "132 KV SRIKALAHASTHI",          RISH3450, false, 0, 0, 0, 0, 0},
  {61, "132 KV RACHAGUNNERI",          RISH3430, false, 0, 0, 0, 0, 0},
  {64, "132 KV AMARARAJA",             RISH3430, false, 0, 0, 0, 0, 0},
  {63, "132 KV THUKIVAKAM-I",          RISH3430, false, 0, 0, 0, 0, 0},
  {62, "132 KV THUKIVAKAM-II",         RISH3430, false, 0, 0, 0, 0, 0},   
  {44, "5.0 MVAR CAP BANK-I",           RISH3430, false, 0, 0, 0, 0, 0},
  {45, "7.2 MVAR CAP BANK-II",          RISH3430, false, 0, 0, 0, 0, 0}
};

const uint8_t feederCount = sizeof(feeders) / sizeof(feeders[0]);

//====================================================================
// MODBUS CRC & COMM FUNCTIONS
//====================================================================
uint16_t modbusCRC(uint8_t *buffer, uint16_t length) {
  uint16_t crc = 0xFFFF;
  for (uint16_t pos = 0; pos < length; pos++) {
    crc ^= buffer[pos];
    for (uint8_t i = 0; i < 8; i++) {
      if (crc & 0x0001) crc = (crc >> 1) ^ 0xA001;
      else crc >>= 1;
    }
  }
  return crc;
}

void clearRS485() {
  while (RS485.available()) RS485.read();
}

bool readInputRegisters(uint8_t slave, uint16_t startAddress, uint16_t quantity, uint16_t *values) {
  uint8_t request[8];
  request[0] = slave;
  request[1] = 0x04;
  request[2] = highByte(startAddress);
  request[3] = lowByte(startAddress);
  request[4] = highByte(quantity);
  request[5] = lowByte(quantity);

  uint16_t crc = modbusCRC(request, 6);
  request[6] = lowByte(crc);
  request[7] = highByte(crc);

  clearRS485();

  digitalWrite(RS485_DE_RE_PIN, HIGH);
  delayMicroseconds(150);
  RS485.write(request, 8);
  RS485.flush();
  delayMicroseconds(150);
  digitalWrite(RS485_DE_RE_PIN, LOW);

  uint16_t expectedLength = 5 + quantity * 2;
  uint8_t response[100];
  if (expectedLength > sizeof(response)) return false;

  uint16_t index = 0;
  unsigned long startTime = millis();

  while (millis() - startTime < 500) {
    while (RS485.available()) {
      response[index++] = RS485.read();
      if (index >= expectedLength) break;
    }
    if (index >= expectedLength) break;
  }

  if (index < expectedLength || response[0] != slave || response[1] != 0x04 || (response[1] & 0x80) || response[2] != quantity * 2) return false;

  uint16_t receivedCRC = ((uint16_t)response[index - 1] << 8) | response[index - 2];
  uint16_t calculatedCRC = modbusCRC(response, index - 2);
  if (receivedCRC != calculatedCRC) return false;

  for (uint16_t i = 0; i < quantity; i++) {
    values[i] = ((uint16_t)response[3 + i * 2] << 8) | response[4 + i * 2];
  }
  return true;
}

float wordsToFloat(uint16_t highWord, uint16_t lowWord) {
  uint32_t raw = ((uint32_t)highWord << 16) | lowWord;
  float value;
  memcpy(&value, &raw, sizeof(float));
  return value;
}

bool readFeeder(Feeder &f) {
  const int MAX_RETRIES = 3;
  uint16_t electrical[8];
  uint16_t power[12];

  for (int attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    delay(50);

    bool firstRead = readInputRegisters(f.slaveID, 0x0000, 8, electrical);
    if (!firstRead) { delay(50); continue; }

    delay(50);

    bool secondRead = readInputRegisters(f.slaveID, 0x0034, 12, power);
    if (!secondRead) { delay(50); continue; }

    float voltage     = wordsToFloat(electrical[0], electrical[1]);
    float current     = wordsToFloat(electrical[6], electrical[7]);
    float activePower = wordsToFloat(power[0], power[1]);
    float reactivePwr = wordsToFloat(power[8], power[9]);
    float pf          = wordsToFloat(power[10], power[11]);

    if (isnan(voltage) || isnan(current) || isnan(activePower) || isnan(reactivePwr) || isnan(pf)) {
      delay(50);
      continue;
    }

    if (f.meterType == RISH3430) {
      f.VRY  = voltage * SQRT3 / 1000.0;
      f.IR   = current;
      f.MW   = activePower / 1000000.0;
      f.MVAR = reactivePwr / 1000000.0;
      f.PF   = pf;
    } else {
      f.VRY  = voltage * SQRT3;
      f.IR   = current;
      f.MW   = activePower;
      f.MVAR = reactivePwr;
      f.PF   = pf;
    }

    if (f.VRY < 0 || f.IR < 0 || f.PF < -1.1 || f.PF > 1.1) {
      delay(50);
      continue;
    }

    f.online = true;
    return true;
  }

  f.online = false;
  return false;
}

//====================================================================
// WIFI & MQTT CONNECTION MANAGEMENT
//====================================================================
void connectWiFi() {
  Serial.print("[WiFi] Connecting to: ");
  Serial.println(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n[WiFi] Connected!");
  Serial.print("[WiFi] ESP32 IP: ");
  Serial.println(WiFi.localIP());
}

void connectMQTT() {
  while (!mqtt.connected()) {
    Serial.print("[GridLink MQTT] Connecting to broker at ");
    Serial.print(MQTT_SERVER);
    Serial.print("... ");

    if (mqtt.connect("ESP32-SCADA-MONITOR", STATUS_TOPIC, 1, true, "offline")) {
      Serial.println("SUCCESS");
      mqtt.subscribe(COMMAND_TOPIC);
      mqtt.publish(STATUS_TOPIC, "online", true);
    } else {
      Serial.print("FAILED, rc=");
      Serial.println(mqtt.state());
      delay(2000);
    }
  }
}

//====================================================================
// PUBLISH SCADA TELEMETRY TO GRIDLINK
//====================================================================
void publishSCADAToGridLink() {
  if (!mqtt.connected()) {
    connectMQTT();
  }

  for (uint8_t i = 0; i < feederCount; i++) {
    Feeder &f = feeders[i];

    StaticJsonDocument<384> doc;
    doc["feeder"] = f.name;
    doc["slave"]  = f.slaveID;
    doc["status"] = f.online ? "OK" : "FAIL";

    if (f.online) {
      doc["VRY"]  = round(f.VRY * 100.0) / 100.0;
      doc["IR"]   = round(f.IR * 100.0) / 100.0;
      doc["MW"]   = round(f.MW * 1000.0) / 1000.0;
      doc["MVAR"] = round(f.MVAR * 1000.0) / 1000.0;
      doc["PF"]   = round(f.PF * 1000.0) / 1000.0;
      
      // Map main PTR/HV feeder metrics to primary virtual pins for instant gauge/chart display
      if (i == 0) {
        doc["v0"]   = f.online;
        doc["temp"] = f.MW * 100.0; // Scaled active power for gauge display
        doc["power"]= f.MW * 1000.0;
      }
    } else {
      doc["VRY"]  = 0.0;
      doc["IR"]   = 0.0;
      doc["MW"]   = 0.0;
      doc["MVAR"] = 0.0;
      doc["PF"]   = 0.0;
    }

    char buffer[384];
    serializeJson(doc, buffer);

    mqtt.publish(TELEMETRY_TOPIC, buffer);
    
    Serial.print("[GridLink Published] ");
    Serial.println(buffer);

    delay(20); // Small interval between individual feeder topics
  }
}

//====================================================================
// SETUP & MAIN LOOP
//====================================================================
void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(RS485_DE_RE_PIN, OUTPUT);
  digitalWrite(RS485_DE_RE_PIN, LOW);

  RS485.begin(RS485_BAUD, SERIAL_8N1, RS485_RX_PIN, RS485_TX_PIN);

  connectWiFi();
  mqtt.setServer(MQTT_SERVER, MQTT_PORT);
  connectMQTT();

  Serial.println("\n[APTRANSCO SCADA] GridLink Telemetry Loop Initiated.");
}

void loop() {
  if (!mqtt.connected()) {
    connectMQTT();
  }
  mqtt.loop();

  // Poll Modbus RTU meters and stream telemetry to GridLink
  for (uint8_t i = 0; i < feederCount; i++) {
    readFeeder(feeders[i]);
  }

  publishSCADAToGridLink();

  delay(2000); // Polling interval
}