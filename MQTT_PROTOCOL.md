# GridLink MQTT Protocol

## Topic convention

Preferred device topic format:

```text
gridlink/device/<device_id>/<message_type>
```

Supported message types:

- `telemetry`
- `command`
- `status`
- `alert`

Examples:

```text
gridlink/device/esp32-test-01/telemetry
gridlink/device/esp32-test-01/command
gridlink/device/esp32-test-01/status
gridlink/device/esp32-test-01/alert
```

The backend also accepts:

```text
gridlink/<device_id>/telemetry
gridlink/<device_id>/status
```

## Telemetry

Telemetry should preferably be JSON:

```json
{
  "temperature": 28.4,
  "rssi": -61
}
```

SCADA-style payload:

```json
{
  "feeder": "132 KV TIRUPATI",
  "voltage": 131.86,
  "current": 325.46,
  "MW": 74.799,
  "MVAR": 11.252,
  "PF": 0.988
}
```

Additional device-specific fields can be added without changing the database schema because telemetry is stored as JSON.

## Commands

Example:

```json
{
  "relay": 1,
  "state": true
}
```

The GridLink console can also send virtual-pin style commands:

```json
{
  "v0": true
}
```

The field firmware should define which command keys it accepts.

## Status

The device can publish:

```text
online
```

or:

```text
offline
```

as the status payload.

Telemetry may also contain a `status` field.

## Alerts

GridLink publishes alerts to:

```text
gridlink/device/<device_id>/alert
```

Example:

```json
{
  "warning": "HIGH_TEMPERATURE",
  "device_id": "esp32-test-01",
  "value": 35.2,
  "unit": "°C",
  "threshold": 30.0
}
```

Current Phase 1 alert examples include high temperature and high power consumption. Production deployments should make thresholds configurable and apply appropriate engineering limits.
