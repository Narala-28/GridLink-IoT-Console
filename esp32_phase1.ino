#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// ===== USER SETTINGS =====
const char* WIFI_SSID = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Use the LAN IP address of the laptop running Docker.
// Example: 192.168.1.10
const char* MQTT_HOST = "192.168.1.10";
const int MQTT_PORT = 1883;

const char* DEVICE_ID = "esp32-test-01";

const int TEST_LED_PIN = 2;
// =========================

WiFiClient espClient;
PubSubClient mqtt(espClient);

String telemetryTopic;
String commandTopic;
String statusTopic;

void connectWiFi() {
  Serial.print("Connecting to Wi-Fi");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.print("Wi-Fi connected. IP: ");
  Serial.println(WiFi.localIP());
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String message;

  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }

  Serial.print("Command received: ");
  Serial.println(message);

  JsonDocument doc;
  DeserializationError error = deserializeJson(doc, message);

  if (error) {
    Serial.println("Invalid JSON command");
    return;
  }

  if (doc["relay"].is<int>() && doc["state"].is<bool>()) {
    int relay = doc["relay"];
    bool state = doc["state"];

    if (relay == 1) {
      digitalWrite(TEST_LED_PIN, state ? HIGH : LOW);
      Serial.println(state ? "TEST LED ON" : "TEST LED OFF");
    }
  }
}

void connectMQTT() {
  while (!mqtt.connected()) {
    Serial.print("Connecting to MQTT... ");

    if (mqtt.connect(DEVICE_ID)) {
      Serial.println("connected");

      mqtt.subscribe(commandTopic.c_str());

      String online = "online";
      mqtt.publish(statusTopic.c_str(), online.c_str(), true);
    } else {
      Serial.print("failed, rc=");
      Serial.println(mqtt.state());
      delay(2000);
    }
  }
}

void publishTelemetry() {
  JsonDocument doc;
  doc["temperature"] = 25.0 + (millis() % 1000) / 100.0;
  doc["rssi"] = WiFi.RSSI();

  String output;
  serializeJson(doc, output);

  mqtt.publish(telemetryTopic.c_str(), output.c_str());

  Serial.print("Telemetry: ");
  Serial.println(output);
}

void setup() {
  Serial.begin(115200);

  pinMode(TEST_LED_PIN, OUTPUT);
  digitalWrite(TEST_LED_PIN, LOW);

  telemetryTopic = "gridlink/device/" + String(DEVICE_ID) + "/telemetry";
  commandTopic = "gridlink/device/" + String(DEVICE_ID) + "/command";
  statusTopic = "gridlink/device/" + String(DEVICE_ID) + "/status";

  connectWiFi();

  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(mqttCallback);
}

void loop() {
  if (!mqtt.connected()) {
    connectMQTT();
  }

  mqtt.loop();

  static unsigned long lastTelemetry = 0;

  if (millis() - lastTelemetry >= 5000) {
    lastTelemetry = millis();
    publishTelemetry();
  }
}
