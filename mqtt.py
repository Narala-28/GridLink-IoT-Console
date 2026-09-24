import json
import logging
import threading
import paho.mqtt.client as mqtt

from .config import settings
from .database import SessionLocal
from .models import Device, Telemetry

logger = logging.getLogger("gridlink.mqtt")


def on_connect(client, userdata, flags, rc, properties=None):
    """Callback triggered upon successful MQTT broker connection."""
    print(f"[GridLink MQTT] Connected with result code: {rc}")

    # Subscribe to single-level and nested device topics
    client.subscribe("gridlink/+/telemetry")
    client.subscribe("gridlink/+/status")
    client.subscribe("gridlink/device/+/telemetry")
    client.subscribe("gridlink/device/+/status")
    client.subscribe("gridlink/device/+/command")

    print("[GridLink MQTT] Subscribed to device topics.")


def check_and_publish_alerts(client, device_id: str, telemetry_data: dict):
    """Evaluates telemetry data against safety thresholds and publishes alert topics."""
    if not isinstance(telemetry_data, dict):
        return

    alert_topic = f"gridlink/device/{device_id}/alert"

    # 1. High Temperature Alert (> 30.0 °C)
    temp = telemetry_data.get("temp")
    if temp is not None:
        try:
            temp_val = float(temp)
            if temp_val > 30.0:
                alert_payload = {
                    "warning": "HIGH_TEMPERATURE",
                    "device_id": device_id,
                    "value": temp_val,
                    "unit": "°C",
                    "threshold": 30.0,
                }
                print(f"[ALERT] High Temperature Warning for {device_id}: {temp_val}°C!")
                client.publish(alert_topic, json.dumps(alert_payload))
        except (ValueError, TypeError):
            pass

    # 2. High Power Consumption Alert (> 500.0 W)
    power = telemetry_data.get("power")
    if power is not None:
        try:
            power_val = float(power)
            if power_val > 500.0:
                alert_payload = {
                    "warning": "HIGH_POWER_CONSUMPTION",
                    "device_id": device_id,
                    "value": power_val,
                    "unit": "W",
                    "threshold": 500.0,
                }
                print(f"[ALERT] Overpower Warning for {device_id}: {power_val}W!")
                client.publish(alert_topic, json.dumps(alert_payload))
        except (ValueError, TypeError):
            pass


def on_message(client, userdata, msg):
    """Callback triggered when a message is received from EMQX."""
    try:
        raw_payload = msg.payload.decode("utf-8", errors="replace")
    except Exception as err:
        print(f"[GridLink MQTT] Error decoding payload: {err}")
        return

    parts = msg.topic.split("/")

    # Topic Resolution:
    # 3-part topic: gridlink/<device_id>/<type>
    # 4-part topic: gridlink/device/<device_id>/<type>
    if len(parts) == 3 and parts[0] == "gridlink":
        device_id = parts[1]
        message_type = parts[2]
    elif len(parts) == 4 and parts[0] == "gridlink" and parts[1] == "device":
        device_id = parts[2]
        message_type = parts[3]
    else:
        print(f"[GridLink MQTT] Ignoring unsupported topic: {msg.topic}")
        return

    db = SessionLocal()

    try:
        # 1. Fetch or automatically provision device
        device = db.query(Device).filter(Device.device_id == device_id).first()

        if not device:
            device = Device(
                device_id=device_id,
                name=device_id,
                status="offline"
            )
            db.add(device)
            db.flush()

        # 2. Handle Status Messages
        if message_type == "status":
            status_val = raw_payload.strip()
            device.status = status_val
            print(f"[GridLink MQTT] Status update for {device_id}: {status_val}")

        # 3. Handle Telemetry Messages
        elif message_type == "telemetry":
            parsed_data = None
            try:
                parsed_data = json.loads(raw_payload)
            except json.JSONDecodeError:
                print(f"[GridLink MQTT] Warning: Non-JSON telemetry payload from {device_id}")

            # Store payload in PostgreSQL
            db_payload = parsed_data if parsed_data is not None else raw_payload

            telemetry = Telemetry(
                device_id=device_id,
                payload=db_payload
            )
            db.add(telemetry)

            # Extract status override if embedded inside JSON
            if isinstance(parsed_data, dict):
                telemetry_status = parsed_data.get("status")
                if telemetry_status is not None:
                    device.status = str(telemetry_status)

                print(f"[GridLink MQTT] Telemetry received from {device_id}: {parsed_data}")

                # === ALERT CHECK & THRESHOLD LOGIC ===
                check_and_publish_alerts(client, device_id, parsed_data)

        db.commit()

    except Exception as error:
        db.rollback()
        print(f"[GridLink MQTT] Database transaction error: {error}")

    finally:
        db.close()


def start_mqtt():
    """Initializes and runs the MQTT client loop in a background daemon thread."""
    client = mqtt.Client(
        mqtt.CallbackAPIVersion.VERSION2,
        client_id="gridlink-backend-worker"
    )

    if settings.mqtt_username:
        client.username_pw_set(
            settings.mqtt_username,
            settings.mqtt_password
        )

    client.on_connect = on_connect
    client.on_message = on_message

    print(f"[GridLink MQTT] Connecting to broker at {settings.mqtt_host}:{settings.mqtt_port}...")

    client.connect(
        settings.mqtt_host,
        settings.mqtt_port,
        keepalive=60
    )

    thread = threading.Thread(
        target=client.loop_forever,
        daemon=True
    )
    thread.start()

    return client