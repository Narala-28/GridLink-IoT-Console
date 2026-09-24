# GridLink IoT Console — Frontend

React/Vite web console for the GridLink IoT platform.

## Features

- Device selection and registration
- Dynamic widget creation
- Widget editing and deletion
- Virtual pin/key mapping
- MQTT live telemetry
- MQTT command publishing
- Telemetry history
- Realtime trend charts
- Alert notifications
- 132/33 kV substation SLD
- SCADA feeder matrix
- Voltage/current/MW/MVAR/PF visualization
- Drag-and-drop widget ordering

## Run locally

From this directory:

```bash
npm install
npm run dev
```

Default Vite address:

```text
http://localhost:5173
```

## Configuration

Create `.env` from `.env.example`:

```env
VITE_API_BASE_URL=http://localhost:8000/api
VITE_MQTT_WS_URL=ws://localhost:8083/mqtt
```

The API URL points to the GridLink FastAPI service.

The MQTT WebSocket URL points to the EMQX WebSocket listener.

## Production build

```bash
npm run build
```

Preview the build:

```bash
npm run preview
```

## Main source files

```text
src/
├── App.jsx       # Main console, widgets, MQTT and API integration
├── Dashboard.jsx # Dashboard components
├── ScadaSLD.jsx  # 132/33 kV SLD view
├── App.css
├── index.css
└── main.jsx
```
