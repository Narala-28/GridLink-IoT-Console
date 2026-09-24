# GridLink IoT Console

### Self-Hosted Industrial IoT & SCADA Platform for ESP32-Based Monitoring, Telemetry and Control

GridLink IoT Console is a self-hosted Industrial IoT and SCADA-oriented platform developed for monitoring, telemetry, visualization and remote control of ESP32-based field devices and electrical systems.

The platform provides a Blynk-style dashboard experience while using its own backend, MQTT infrastructure, database and web interface. It is designed for industrial applications such as substation monitoring, feeder automation, equipment monitoring, motor control and real-time electrical parameter visualization.

---

## 📌 Project Overview

GridLink IoT Console integrates:

- ESP32-based field devices
- RS485 / Modbus RTU communication
- MQTT messaging
- EMQX MQTT broker
- FastAPI backend
- PostgreSQL database
- React + Vite frontend
- Docker / Docker Compose
- Dynamic dashboard widgets
- SCADA-style Single Line Diagram (SLD)
- Feeder monitoring
- Remote control
- Real-time telemetry
- Device management

The objective is to provide a flexible platform where different ESP32 devices and industrial equipment can be connected to a common IoT/SCADA console.

---

## 🏗️ System Architecture

```text
                  ┌──────────────────────────┐
                  │     Electrical / Field   │
                  │       Equipment          │
                  │                          │
                  │ Meters • Relays • Motors │
                  └────────────┬─────────────┘
                               │
                         RS485 / Modbus
                               │
                               ▼
                  ┌──────────────────────────┐
                  │          ESP32           │
                  │      Field Controller    │
                  └────────────┬─────────────┘
                               │
                              MQTT
                               │
                               ▼
                  ┌──────────────────────────┐
                  │       EMQX MQTT Broker   │
                  │                          │
                  │ Telemetry + Commands     │
                  └────────────┬─────────────┘
                               │
                               ▼
                  ┌──────────────────────────┐
                  │      FastAPI Backend     │
                  │                          │
                  │ REST API • MQTT • Logic  │
                  └────────────┬─────────────┘
                               │
                               ▼
                  ┌──────────────────────────┐
                  │       PostgreSQL         │
                  │                          │
                  │ Devices • Telemetry     │
                  │ Configuration • Data    │
                  └────────────┬─────────────┘
                               │
                               ▼
                  ┌──────────────────────────┐
                  │    React GridLink UI     │
                  │                          │
                  │ Dashboard • Widgets      │
                  │ SCADA SLD • Controls     │
                  └──────────────────────────┘
```

---

## ⚡ Main Features

### 1. GridLink IoT Console

The web console provides a centralized interface for connected devices.

Features include:

- Device management
- Device status
- Telemetry visualization
- Dynamic widgets
- Control widgets
- Status indicators
- Gauges
- Charts
- Device health monitoring
- MQTT communication status

---

## 🧩 Dynamic Widget System

GridLink supports a Blynk-style concept of creating dashboards using widgets.

Possible widget types include:

- Gauge
- Numeric display
- LED / status indicator
- Switch
- Button
- Chart
- Telemetry display
- Control widget
- Device status widget

Widgets can be associated with devices and telemetry/control parameters.

This allows the same GridLink platform to be reused for different IoT applications without creating a completely new dashboard for every device.

---

## 🖥️ SCADA Dashboard

One of the major applications of GridLink is electrical substation monitoring.

The project includes a SCADA-style dashboard for a:

### 132/33 kV Substation

The dashboard provides visualization of:

- Incoming supply
- Bus sections
- Power transformers
- 33 kV feeders
- Circuit breakers
- Protection indications
- Feeder status
- Electrical measurements
- Communication status

---

## 🔌 Single Line Diagram (SLD)

GridLink includes a digital Single Line Diagram interface.

The SLD provides a visual representation of the electrical system.

Typical information displayed includes:

- Breaker status
- Feeder status
- Transformer status
- Voltage
- Current
- MW
- MVAR
- Power Factor
- Protection status
- Communication status

Control operations can also be integrated with the SLD.

---

## 📊 Feeder Monitoring

The platform can monitor multiple 33 kV feeders.

| Parameter | Description |
|---|---|
| Voltage | Feeder voltage |
| Current | Feeder current |
| MW | Active power |
| MVAR | Reactive power |
| PF | Power factor |
| Status | Feeder / breaker status |
| Communication | Device communication status |

The architecture can be expanded for additional feeders and substations.

---

## 📡 RS485 / Modbus Communication

ESP32 field devices can communicate with industrial meters using:

```text
RS485
   ↓
Modbus RTU
   ↓
ESP32
   ↓
MQTT
   ↓
GridLink
```

Telemetry firmware provides industrial meter integration.

Parameters can include:

- Voltage
- Current
- Active power
- Reactive power
- Power factor
- Communication status

---

## 📬 MQTT Communication

MQTT is used as the main communication layer between field devices and the GridLink platform.

### Telemetry Flow

```text
ESP32
   │
   │ Publish
   ▼
MQTT Broker
   │
   ▼
GridLink Backend
   │
   ▼
Database / Dashboard
```

### Control Flow

```text
GridLink Dashboard
        │
        │ MQTT Command
        ▼
   MQTT Broker
        │
        ▼
      ESP32
        │
        ▼
 Field Device / Relay
```

This provides bidirectional communication between the web console and field devices.

---

## 🧠 FastAPI Backend

The backend is developed using Python and FastAPI.

Responsibilities include:

- REST API
- Device management
- Widget management
- Telemetry processing
- MQTT integration
- Command handling
- Database interaction
- Device configuration

Example API categories:

```text
GET    /api/devices
GET    /api/devices/{device_id}
GET    /api/devices/{device_id}/telemetry

POST   /api/devices
POST   /api/devices/{device_id}/widgets

PUT    /api/devices/{device_id}/widgets/{widget_id}

DELETE /api/devices/{device_id}/widgets/{widget_id}
```

The exact endpoints may evolve as the platform is developed further.

---

## 🗄️ PostgreSQL Database

PostgreSQL is used for persistent application data.

The database can store:

- Devices
- Device configuration
- Widgets
- Telemetry
- Dashboard configuration
- Device status
- Application data

This provides a foundation for:

- Historical trends
- Reports
- Event logging
- Alarm history
- Energy analysis

---

## 🌐 React Frontend

The GridLink web console is developed using:

- React
- Vite
- JavaScript
- CSS

The frontend communicates with the FastAPI backend and MQTT services to provide real-time monitoring and control.

The interface is designed for both general IoT dashboards and electrical SCADA applications.

---

## 🐳 Docker Deployment

GridLink uses Docker / Docker Compose to simplify deployment.

The platform can be organized into multiple services:

```text
Frontend
   │
Backend
   │
PostgreSQL
   │
EMQX
```

Docker makes it easier to reproduce the same environment on another computer or server.

---

## 🔧 ESP32 Firmware

The repository contains multiple ESP32 firmware projects.

### ESP32 Phase 1

Initial GridLink device integration.

```text
firmware/
└── esp32_phase1/
    └── esp32_phase1.ino
```

### SCADA Telemetry Firmware

```text
firmware/
└── scada_telemetry/
    └── Telemetry_readings.ino
```

Functions include:

- RS485 communication
- Modbus RTU
- Meter data acquisition
- Electrical parameter processing
- MQTT telemetry publishing
- GridLink integration

### Motor Automation

```text
firmware/
└── motor_automation/
    └── Motor_Automation_gridlink.ino
```

Functions include:

- MQTT command reception
- ESP32 relay control
- Motor ON/OFF control
- Start pulse
- Stop pulse
- Motor status feedback

---

## 🔐 Configuration

Sensitive configuration should not be committed to GitHub.

Example:

```env
WIFI_SSID=your_wifi_name
WIFI_PASSWORD=your_wifi_password

MQTT_SERVER=your_mqtt_server
MQTT_PORT=1883

DATABASE_URL=your_database_url
```

The repository provides example configuration files such as:

```text
.env.example
```

Actual passwords, API keys and private credentials should remain outside the public repository.

---

## 📁 Repository Structure

```text
GridLink-IoT-Console/
│
├── README.md
├── .gitignore
├── .env.example
├── docker-compose.yml
│
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│
├── frontend/
│   ├── package.json
│   ├── package-lock.json
│   ├── vite.config.js
│   ├── index.html
│   ├── public/
│   └── src/
│
├── firmware/
│   ├── esp32_phase1/
│   │   └── esp32_phase1.ino
│   ├── scada_telemetry/
│   │   └── Telemetry_readings.ino
│   └── motor_automation/
│       └── Motor_Automation_gridlink.ino
│
└── docs/
    ├── ARCHITECTURE.md
    ├── MQTT_PROTOCOL.md
    ├── FIRMWARE_GUIDE.md
    ├── PHASE1_TEST.md
    └── screenshots/
```

---

## 🚀 Getting Started

### Prerequisites

Install:

- Git
- Docker Desktop
- Docker Compose
- Node.js
- npm
- Python
- Arduino IDE for ESP32 firmware development

### Clone Repository

```bash
git clone https://github.com/YOUR_USERNAME/GridLink-IoT-Console.git
cd GridLink-IoT-Console
```

### Docker

Copy the environment template:

```bash
cp .env.example .env
```

Configure the required values and run:

```bash
docker compose up -d
```

Check containers:

```bash
docker compose ps
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The development server normally runs at:

```text
http://localhost:5173
```

### Backend

```bash
cd backend
python -m venv venv
```

Windows:

```bash
venv\Scripts\activate
```

Install:

```bash
pip install -r requirements.txt
```

Run:

```bash
uvicorn app.main:app --reload
```

FastAPI documentation:

```text
http://localhost:8000/docs
```

---

## 📡 ESP32 Setup

Open the required firmware in Arduino IDE.

Configure:

- Wi-Fi SSID
- Wi-Fi password
- MQTT broker
- MQTT port
- Device ID
- RS485 pins
- Meter slave ID
- Modbus parameters

Select the appropriate ESP32 board and upload the firmware.

---

## 🔄 Telemetry Data Flow

```text
Electrical Meter
       │
       │ Modbus RTU
       ▼
     RS485
       │
       ▼
     ESP32
       │
       │ MQTT
       ▼
   EMQX Broker
       │
       ▼
 FastAPI Backend
       │
       ├──────────────► PostgreSQL
       │
       ▼
 React GridLink Console
       │
       ▼
 Live Dashboard
```

---

## 🎛️ Control Data Flow

```text
GridLink Dashboard
        │
        │ User command
        ▼
   FastAPI / MQTT
        │
        ▼
    EMQX Broker
        │
        ▼
       ESP32
        │
        ▼
   Relay / Control
        │
        ▼
 Electrical Equipment
```

Status feedback can be returned to GridLink through MQTT telemetry.

---

## 🏭 Industrial Applications

### Electrical Substations

- 132/33 kV substations
- 33 kV feeders
- Transformer monitoring
- Breaker monitoring
- Protection indication
- Electrical measurements

### Industrial IoT

- Motor monitoring
- Motor control
- Equipment monitoring
- Sensor telemetry
- Remote control

### Energy Monitoring

- Voltage
- Current
- MW
- MVAR
- Power factor
- Energy consumption

---

## 📸 Project Screenshots

Screenshots of the GridLink IoT Console can be stored under:

```text
docs/screenshots/
```

Recommended screenshots:

- GridLink dashboard
- SCADA interface
- SLD visualization
- Feeder monitoring
- Widgets
- Device monitoring
- ESP32 integration

---

## 📊 Project Capabilities

| Area | Implementation |
|---|---|
| IoT Dashboard | React |
| Dynamic Widgets | GridLink UI |
| Backend API | FastAPI |
| Database | PostgreSQL |
| Messaging | MQTT |
| MQTT Broker | EMQX |
| Edge Controller | ESP32 |
| Industrial Protocol | RS485 / Modbus RTU |
| Deployment | Docker |
| SCADA Visualization | React SLD |
| Feeder Monitoring | ESP32 + Meter |
| Remote Control | MQTT |
| Motor Automation | ESP32 + Relay |

---

## 🔮 Future Development

Potential extensions include:

- Historical telemetry
- Alarm management
- Event logging
- Energy reports
- User authentication
- Role-based access control
- Advanced device provisioning
- Additional reusable widgets
- Multi-substation dashboards
- Mobile-responsive SCADA interface
- IEC 61850 integration
- SAS integration
- Advanced analytics
- Predictive maintenance
- Automated reporting

---

## 🎯 Project Objective

The primary objective of GridLink IoT Console is to create a flexible, self-hosted IoT and SCADA platform capable of connecting embedded field devices with a centralized monitoring and control interface.

```text
Embedded Systems
       +
Industrial Communication
       +
MQTT
       +
Backend APIs
       +
Database
       +
Web Dashboard
       =
GridLink IoT Console
```

---

## 👨‍💻 Technologies Used

### Hardware

- ESP32
- RS485 interface
- Industrial energy meters
- Relays
- Sensors
- Electrical equipment interfaces

### Software

- Arduino IDE
- Embedded C / C++
- Python
- FastAPI
- React
- Vite
- JavaScript
- PostgreSQL
- MQTT
- EMQX
- Docker
- Git / GitHub

---

## 📌 Project Status

**Development Status: Active Development**

The current implementation includes:

- GridLink web console
- Dynamic widgets
- Device management
- MQTT communication
- FastAPI backend
- PostgreSQL integration
- Docker infrastructure
- ESP32 telemetry
- RS485 / Modbus integration
- SCADA-style SLD
- Feeder monitoring
- Motor automation

---

## 📜 License

This project is currently intended for development, demonstration and engineering use.

License terms can be added according to the intended distribution model.

---

# ⭐ GridLink IoT Console

**A self-hosted Industrial IoT and SCADA platform connecting ESP32 field devices, electrical systems and real-time web dashboards.**

```text
ESP32 → MQTT → FastAPI → PostgreSQL → React
                  ↓
             GridLink IoT
                  ↓
        Monitoring • Control • SCADA
```
