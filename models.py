import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, JSON, Integer
from sqlalchemy.orm import relationship
from .database import Base

class Device(Base):
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=False)
    status = Column(String, default="offline")
    created_at = Column(DateTime, default=datetime.utcnow)

    widgets = relationship("Widget", back_populates="device", cascade="all, delete-orphan")

class Widget(Base):
    """Stores Blynk-like UI Widgets added by the user."""
    __tablename__ = "widgets"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(String, ForeignKey("devices.device_id"), nullable=False)
    widget_type = Column(String, nullable=False)  # 'switch', 'gauge', 'value'
    label = Column(String, nullable=False)
    pin_key = Column(String, nullable=False)      # e.g., 'v0', 'relay1', 'temp'
    config = Column(JSON, nullable=True)          # e.g., { "min": 0, "max": 100 }

    device = relationship("Device", back_populates="widgets")

class Telemetry(Base):
    __tablename__ = "telemetry"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(String, nullable=False, index=True)
    payload = Column(JSON, nullable=False)
    received_at = Column(DateTime, default=datetime.utcnow)