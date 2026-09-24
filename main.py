from contextlib import asynccontextmanager
from typing import Any, Dict
import json

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .database import SessionLocal, init_db
from .models import Device, Telemetry, Widget
from .mqtt import start_mqtt
import paho.mqtt.client as mqtt


# ------------------------------------------------------------------------------
# Dependency Injection for Database Sessions
# ------------------------------------------------------------------------------
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ------------------------------------------------------------------------------
# Pydantic Schemas
# ------------------------------------------------------------------------------
class DeviceCreate(BaseModel):
    device_id: str
    name: str


class DeviceCommand(BaseModel):
    command: Dict[str, Any] | str


class WidgetCreate(BaseModel):
    widget_type: str
    label: str
    pin_key: str
    config: Dict[str, Any] = Field(default_factory=dict)


class WidgetUpdate(BaseModel):
    widget_type: str | None = None
    label: str | None = None
    pin_key: str | None = None
    config: Dict[str, Any] | None = None


# ------------------------------------------------------------------------------
# Lifespan Management (Startup/Shutdown)
# ------------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[GridLink] Starting database...")
    init_db()

    print("[GridLink] Starting MQTT subscriber...")
    mqtt_client = start_mqtt()
    app.state.mqtt_client = mqtt_client

    print("[GridLink] Startup complete.")

    yield

    print("[GridLink] Shutting down MQTT...")
    mqtt_client.disconnect()
    print("[GridLink] Shutdown complete.")


# ------------------------------------------------------------------------------
# FastAPI App Core Configuration
# ------------------------------------------------------------------------------
app = FastAPI(
    title="GridLink IoT API",
    version="0.1.0",
    description="Backend for a self-hosted Blynk-style IoT platform.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ------------------------------------------------------------------------------
# System Endpoints
# ------------------------------------------------------------------------------
@app.get("/")
def root():
    return {"service": "GridLink IoT API", "version": "0.1.0"}


@app.get("/health")
def health():
    return {"status": "ok", "service": "gridlink-api"}


# ------------------------------------------------------------------------------
# Device Endpoints
# ------------------------------------------------------------------------------
@app.get("/api/devices")
def get_devices(db: Session = Depends(get_db)):
    devices = db.query(Device).order_by(Device.id).all()

    return [
        {
            "id": str(device.id),
            "device_id": device.device_id,
            "name": device.name,
            "status": device.status,
            "created_at": device.created_at,
        }
        for device in devices
    ]


@app.get("/api/devices/{device_id}")
def get_device(device_id: str, db: Session = Depends(get_db)):
    device = db.query(Device).filter(Device.device_id == device_id).first()

    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found",
        )

    return {
        "id": str(device.id),
        "device_id": device.device_id,
        "name": device.name,
        "status": device.status,
        "created_at": device.created_at,
    }


@app.post("/api/devices", status_code=status.HTTP_201_CREATED)
def create_device(device: DeviceCreate, db: Session = Depends(get_db)):
    existing = db.query(Device).filter(Device.device_id == device.device_id).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Device already exists",
        )

    new_device = Device(
        device_id=device.device_id,
        name=device.name,
        status="offline",
    )

    db.add(new_device)
    db.commit()
    db.refresh(new_device)

    return {
        "id": str(new_device.id),
        "device_id": new_device.device_id,
        "name": new_device.name,
        "status": new_device.status,
        "created_at": new_device.created_at,
    }


@app.get("/api/devices/{device_id}/telemetry")
def get_device_telemetry(device_id: str, limit: int = 20, db: Session = Depends(get_db)):
    telemetry = (
        db.query(Telemetry)
        .filter(Telemetry.device_id == device_id)
        .order_by(Telemetry.id.desc())
        .limit(limit)
        .all()
    )

    return [
        {
            "id": str(item.id),
            "device_id": item.device_id,
            "payload": item.payload,
            "received_at": item.received_at,
        }
        for item in telemetry
    ]


@app.post("/api/devices/{device_id}/command")
def send_device_command(
    device_id: str,
    command: DeviceCommand,
    db: Session = Depends(get_db),
):
    device = db.query(Device).filter(Device.device_id == device_id).first()

    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found",
        )

    topic = f"gridlink/device/{device_id}/command"

    payload = (
        command.command
        if isinstance(command.command, str)
        else json.dumps(command.command)
    )

    result = app.state.mqtt_client.publish(topic, payload)

    if result.rc != mqtt.MQTT_ERR_SUCCESS:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="MQTT command could not be published",
        )

    return {
        "device_id": device_id,
        "topic": topic,
        "command": command.command,
        "status": "sent",
    }


# ------------------------------------------------------------------------------
# Widget Endpoints
# ------------------------------------------------------------------------------
@app.get("/api/devices/{device_id}/widgets")
def get_device_widgets(device_id: str, db: Session = Depends(get_db)):
    widgets = db.query(Widget).filter(Widget.device_id == device_id).all()
    return [
        {
            "id": w.id,
            "device_id": w.device_id,
            "widget_type": w.widget_type,
            "label": w.label,
            "pin_key": w.pin_key,
            "config": w.config,
        }
        for w in widgets
    ]


@app.post("/api/devices/{device_id}/widgets", status_code=status.HTTP_201_CREATED)
def create_device_widget(device_id: str, widget: WidgetCreate, db: Session = Depends(get_db)):
    device = db.query(Device).filter(Device.device_id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    new_widget = Widget(
        device_id=device_id,
        widget_type=widget.widget_type,
        label=widget.label,
        pin_key=widget.pin_key,
        config=widget.config,
    )
    db.add(new_widget)
    db.commit()
    db.refresh(new_widget)

    return {
        "id": new_widget.id,
        "device_id": new_widget.device_id,
        "widget_type": new_widget.widget_type,
        "label": new_widget.label,
        "pin_key": new_widget.pin_key,
        "config": new_widget.config,
    }


@app.put("/api/devices/{device_id}/widgets/{widget_id}")
def update_device_widget(
    device_id: str,
    widget_id: int,
    widget: WidgetUpdate,
    db: Session = Depends(get_db),
):
    existing = (
        db.query(Widget)
        .filter(
            Widget.device_id == device_id,
            Widget.id == widget_id,
        )
        .first()
    )

    if not existing:
        raise HTTPException(status_code=404, detail="Widget not found")

    if widget.widget_type is not None:
        existing.widget_type = widget.widget_type
    if widget.label is not None:
        existing.label = widget.label
    if widget.pin_key is not None:
        existing.pin_key = widget.pin_key
    if widget.config is not None:
        existing.config = widget.config

    db.commit()
    db.refresh(existing)

    return {
        "id": existing.id,
        "device_id": existing.device_id,
        "widget_type": existing.widget_type,
        "label": existing.label,
        "pin_key": existing.pin_key,
        "config": existing.config,
    }


@app.delete("/api/devices/{device_id}/widgets/{widget_id}")
def delete_device_widget(device_id: str, widget_id: int, db: Session = Depends(get_db)):
    widget = db.query(Widget).filter(Widget.device_id == device_id, Widget.id == widget_id).first()
    if not widget:
        raise HTTPException(status_code=404, detail="Widget not found")

    db.delete(widget)
    db.commit()
    return {"status": "deleted", "widget_id": widget_id}
