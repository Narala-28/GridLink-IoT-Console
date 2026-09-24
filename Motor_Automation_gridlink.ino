//======================================================================
//          GRIDLINK IOT - HARDWARE VERIFICATION SKETCH
//======================================================================
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

const char* ssid        = "YOUR_WIFI_NAME";
const char* password    = "YOUR_WIFI_PASSWORD";
const char* mqtt_server = "YOUR_GRIDLINK_SERVER_IP"; 
const int   mqtt_port   = 1883;
const char* device_id   = "Smart_Motor_Pump_Automation";

// Relay Pins
#define RELAY_2HP_PIN    17
#define RELAY_6HP_START  27
#define RELAY_6HP_STOP   13

String topic_telemetry = String("gridlink/device/") + device_id + "/telemetry";
String topic_command   = String("gridlink/device/") + device_id + "/command";

WiFiClient espClient;
PubSubClient mqttClient(espClient);

unsigned long lastMqttRetry = 0;
unsigned long lastTelemetry = 0;
unsigned long pulse6HPStart = 0;
bool is6HPPulsing = false;
bool motor2State = false;

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String message;
  for (unsigned int i = 0; i < length; i++) message += (char)payload[i];
  message.trim();

  Serial.println("----------------------------------------");
  Serial.printf("[RX COMMAND]: %s\n", message.c_str());

  StaticJsonDocument<256> doc;
  DeserializationError error = deserializeJson(doc, message);
  if (error) {
    Serial.println("ERR: JSON parse failed");
    return;
  }

  // 2 HP START (v1)
  if (doc.containsKey("v1") && doc["v1"].as<int>() == 1) {
    digitalWrite(RELAY_2HP_PIN, LOW); // Active LOW: Turns Relay ON
    motor2State = true;
    Serial.println(">>> [RELAY 17]: LOW (2 HP RELAY ACTIVATED) <<<");
  }

  // 2 HP STOP (v11)
  if (doc.containsKey("v11") && doc["v11"].as<int>() == 1) {
    digitalWrite(RELAY_2HP_PIN, HIGH); // Turns Relay OFF
    motor2State = false;
    Serial.println(">>> [RELAY 17]: HIGH (2 HP RELAY RELEASED) <<<");
  }

  // 6 HP START (v2 - Momentary Pulse)
  if (doc.containsKey("v2") && doc["v2"].as<int>() == 1) {
    digitalWrite(RELAY_6HP_START, LOW); // Start Pulse ON
    pulse6HPStart = millis();
    is6HPPulsing = true;
    Serial.println(">>> [RELAY 27]: LOW (6 HP START PULSE TRIGGERED) <<<");
  }

  // 6 HP STOP (v12 - Momentary Pulse)
  if (doc.containsKey("v12") && doc["v12"].as<int>() == 1) {
    digitalWrite(RELAY_6HP_STOP, LOW); // Stop Pulse ON
    delay(1000);
    digitalWrite(RELAY_6HP_STOP, HIGH);
    Serial.println(">>> [RELAY 13]: 6 HP STOP PULSE COMPLETED <<<");
  }
}

void reconnect() {
  if (mqttClient.connected()) return;
  unsigned long now = millis();
  if (now - lastMqttRetry > 3000) {
    lastMqttRetry = now;
    Serial.printf("[MQTT] Connecting to %s:1883... ", mqtt_server);
    String clientId = "ESP32_Test_" + String(random(0xffff), HEX);
    if (mqttClient.connect(clientId.c_str())) {
      Serial.println("CONNECTED!");
      mqttClient.subscribe(topic_command.c_str());
      Serial.printf("[MQTT] Subscribed to %s\n", topic_command.c_str());
    } else {
      Serial.printf("FAILED (rc=%d). Check Windows Firewall rule!\n", mqttClient.state());
    }
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n--- BOOTING RELAY TEST RIG ---");

  pinMode(RELAY_2HP_PIN, OUTPUT);
  pinMode(RELAY_6HP_START, OUTPUT);
  pinMode(RELAY_6HP_STOP, OUTPUT);
  
  // High = De-energized for active LOW relay boards
  digitalWrite(RELAY_2HP_PIN, HIGH);
  digitalWrite(RELAY_6HP_START, HIGH);
  digitalWrite(RELAY_6HP_STOP, HIGH);

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  Serial.printf("Connecting to Wi-Fi %s ", ssid);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.printf("\nWiFi Connected! ESP32 IP: %s\n", WiFi.localIP().toString().c_str());

  mqttClient.setServer(mqtt_server, mqtt_port);
  mqttClient.setCallback(mqttCallback);
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    reconnect();
    mqttClient.loop();
  }

  // Handle 1-second pulse for 6 HP Start Relay
  if (is6HPPulsing && (millis() - pulse6HPStart >= 1000)) {
    digitalWrite(RELAY_6HP_START, HIGH);
    is6HPPulsing = false;
    Serial.println(">>> [RELAY 27]: HIGH (6 HP START PULSE RELEASED) <<<");
  }

  // Keep Dashboard Alive with Telemetry Every 3 Seconds
  if (millis() - lastTelemetry > 3000) {
    lastTelemetry = millis();
    if (mqttClient.connected()) {
      StaticJsonDocument<256> doc;
      doc["v1"]  = motor2State ? 1 : 0;
      doc["v15"] = motor2State ? "2HP ON" : "ALL OFF";
      doc["v22"] = 0;
      doc["v23"] = 0;
      char buffer[256];
      serializeJson(doc, buffer);
      mqttClient.publish(topic_telemetry.c_str(), buffer);
    }
  }
}
