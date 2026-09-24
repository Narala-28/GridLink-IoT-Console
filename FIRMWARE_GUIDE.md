# GridLink Firmware Guide

GridLink firmware is organized into three levels:

1. **Platform connectivity** — `esp32_phase1`
2. **SCADA telemetry acquisition** — `scada_telemetry`
3. **Industrial control verification** — `motor_automation`

All sketches communicate with the GridLink platform using MQTT topics based on the device ID.

## Standard topics

```text
gridlink/device/<DEVICE_ID>/telemetry
gridlink/device/<DEVICE_ID>/command
gridlink/device/<DEVICE_ID>/status
```

## SCADA telemetry

The SCADA telemetry firmware reads field meters over RS485/Modbus RTU and publishes feeder measurements to GridLink.

Typical measurements:

- VRY (kV)
- IR (A)
- MW
- MVAR
- PF
- communication status

## Motor automation

The motor automation firmware demonstrates command-to-relay operation through MQTT. The command payload contains virtual-pin style fields such as `v1`, `v2`, `v11` and `v12`.

This allows the GridLink dashboard to act as a custom control interface rather than relying on Blynk.
