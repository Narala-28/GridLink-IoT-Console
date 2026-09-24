# GridLink Phase 1 — Test Procedure

This procedure verifies the complete development path:

```text
ESP32 → MQTT/EMQX → FastAPI → PostgreSQL → React Console
```

## 1. Start Docker

From the project root:

```bash
docker compose up -d --build
```

Verify:

```bash
docker compose ps
```

Expected services:

- `gridlink-postgres`
- `gridlink-emqx`
- `gridlink-api`

## 2. Verify API

Open:

```text
http://localhost:8000/health
```

Expected:

```json
{"status":"ok","service":"gridlink-api"}
```

API documentation:

```text
http://localhost:8000/docs
```

## 3. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open the Vite URL, normally:

```text
http://localhost:5173
```

## 4. Configure ESP32

Edit:

```text
firmware/esp32_phase1/esp32_phase1.ino
```

Set:

- `WIFI_SSID`
- `WIFI_PASSWORD`
- `MQTT_HOST`
- `DEVICE_ID`

`MQTT_HOST` must be the LAN IPv4 address of the computer running EMQX when the ESP32 is on another device.

Do not use `localhost` for the ESP32 MQTT broker address.

## 5. Arduino libraries

Install:

- PubSubClient
- ArduinoJson

Upload the sketch and open Serial Monitor at:

```text
115200 baud
```

## 6. Expected result

The ESP32 should:

1. Connect to Wi-Fi.
2. Connect to EMQX.
3. Publish its online status.
4. Publish telemetry periodically.
5. Receive GridLink command messages.

The backend should:

1. Receive MQTT telemetry.
2. Automatically provision the device if necessary.
3. Store telemetry in PostgreSQL.
4. Update device status.
5. Publish configured alert messages when thresholds are exceeded.

The React console should:

1. Show the device.
2. Receive live MQTT telemetry.
3. Display widget values.
4. Display telemetry history.
5. Send control commands.

## 7. Verify MQTT topics

For device `esp32-test-01`:

```text
gridlink/device/esp32-test-01/telemetry
gridlink/device/esp32-test-01/command
gridlink/device/esp32-test-01/status
gridlink/device/esp32-test-01/alert
```
