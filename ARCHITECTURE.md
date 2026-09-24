# GridLink Architecture

## System architecture

```text
┌──────────────────────┐
│ ESP32 / Field Device │
│ Sensors / Relays     │
└──────────┬───────────┘
           │ MQTT
           ▼
┌──────────────────────┐
│ EMQX MQTT Broker     │
│ TCP 1883 / WS 8083   │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ GridLink FastAPI     │
│ REST API + MQTT      │
│ worker               │
└───────┬──────────────┘
        │
        ├──────────────► PostgreSQL
        │                  │
        │                  ├── devices
        │                  ├── widgets
        │                  └── telemetry
        │
        ▼
┌──────────────────────┐
│ React/Vite Console   │
│                     │
│ Devices              │
│ Widgets              │
│ Telemetry            │
│ Alerts               │
│ Charts               │
│ SLD / SCADA          │
└──────────────────────┘
```

## Runtime responsibilities

### ESP32

Publishes telemetry and status and subscribes to device commands.

### EMQX

Provides MQTT message routing for field devices and the browser.

### FastAPI

Provides:

- REST endpoints
- Device registration
- Widget persistence
- Telemetry persistence
- MQTT subscription
- Alert threshold processing
- Command publishing

### PostgreSQL

Persists devices, widget definitions and telemetry JSON payloads.

### React/Vite

Provides the operator/developer console and connects to:

- FastAPI over HTTP
- EMQX over MQTT WebSocket

## SCADA extension

The frontend includes a substation-oriented view for:

- 132 kV feeders
- 33 kV feeders
- Power transformers
- Voltage
- Current
- MW
- MVAR
- Power factor
- Communication status
- Breaker/control widgets

The SCADA screen is a GridLink application layer; actual field control must be connected only after the appropriate protection, interlocking, authorization and commissioning requirements are satisfied.
