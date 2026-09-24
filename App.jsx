import React, { useState, useEffect, useRef } from 'react';
import mqtt from 'mqtt';
import {
  Plus,
  RefreshCw,
  Cpu,
  Trash2,
  Pencil,
  Sliders,
  TrendingUp,
  AlertTriangle,
  X,
  Send,
  Thermometer,
  Activity,
  Table,
  GripVertical,
  AlertOctagon,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

import ScadaSLD from './ScadaSLD'; // Integrated SLD Component

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

const MQTT_WS_URL =
  import.meta.env.VITE_MQTT_WS_URL || 'ws://localhost:8083/mqtt';

const COLOR_OPTIONS = [
  { name: 'Royal Blue', hex: '#2563eb' },
  { name: 'Emerald Green', hex: '#16a34a' },
  { name: 'Crimson Red', hex: '#dc2626' },
  { name: 'Amber Yellow', hex: '#d97706' },
  { name: 'Violet Purple', hex: '#9333ea' },
  { name: 'Dark Slate', hex: '#475569' },
];

const UNIT_OPTIONS = [
  { label: 'None / String Message', value: '' },

  // --- Time Units ---
  { label: 's (Seconds)', value: 's' },
  { label: 'min (Minutes)', value: 'min' },
  { label: 'hrs (Hours)', value: 'hrs' },
  { label: 'hh:mm:ss (Auto Time Format)', value: 'time_format' },

  // --- Electrical Units ---
  { label: 'V (Volts)', value: 'V' },
  { label: 'kV (Kilovolts)', value: 'kV' },
  { label: 'W (Watts)', value: 'W' },
  { label: 'kW (Kilowatts)', value: 'kW' },
  { label: 'MW (Megawatts)', value: 'MW' },
  { label: 'VAR (Reactive Power)', value: 'VAR' },
  { label: 'kVAR (kilo-VAR)', value: 'kVAR' },
  { label: 'MVAR (Mega-VAR)', value: 'MVAR' },
  { label: 'A (Amperes)', value: 'A' },
  { label: 'Hz (Frequency)', value: 'Hz' },
  { label: 'PF (Power Factor)', value: 'PF' },
  { label: '°C (Temperature)', value: '°C' },
  { label: '% (Percentage / Level)', value: '%' },
];

// -----------------------------------------------------------------------------
// Telemetry Chart Component (SuperChart)
// -----------------------------------------------------------------------------
function TelemetryChart({ logs, pinKey }) {
  const chartData = logs
    .map((log) => {
      let value = null;
      let parsedPayload = log.payload;

      if (typeof log.payload === 'string') {
        try {
          parsedPayload = JSON.parse(log.payload);
        } catch (e) {
          parsedPayload = null;
        }
      }

      if (typeof parsedPayload === 'object' && parsedPayload !== null) {
        value = parsedPayload[pinKey];
        if (typeof value === 'boolean') {
          value = value ? 1 : 0;
        }
      }

      return {
        time: log.received_at ? new Date(log.received_at).toLocaleTimeString() : '',
        value: value !== undefined && value !== null ? Number(value) : null,
      };
    })
    .reverse();

  return (
    <div style={styles.chartCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <TrendingUp color="#0284c7" size={22} />
          <h3 style={{ margin: 0, color: '#1e293b' }}>Live Data Trend ({pinKey})</h3>
        </div>
      </div>

      <div style={{ width: '100%', height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} />
            <YAxis stroke="#94a3b8" fontSize={12} domain={['auto', 'auto']} />
            <Tooltip
              contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', color: '#fff', border: 'none' }}
              itemStyle={{ color: '#38bdf8' }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#0284c7"
              strokeWidth={3}
              dot={{ r: 4, fill: '#0284c7' }}
              activeDot={{ r: 6 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Input Label Sub-Component
// -----------------------------------------------------------------------------
function InputLabelWidget({ pinKey, onSend }) {
  const [inputText, setInputText] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputText.trim() !== '') {
      onSend(pinKey, inputText);
      setInputText('');
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
      <input
        type="text"
        placeholder="Text..."
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        style={{ ...styles.input, padding: '2px 4px', fontSize: '10px' }}
      />
      <button type="submit" style={{ ...styles.addButton, padding: '2px 6px' }}>
        <Send size={10} />
      </button>
    </form>
  );
}

// -----------------------------------------------------------------------------
// Main Application Component
// -----------------------------------------------------------------------------
export default function App() {
  const [activeTab, setActiveTab] = useState('sld');
  const [client, setClient] = useState(null);
  const [mqttConnected, setMqttConnected] = useState(false);
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('TEST001');
  const [widgets, setWidgets] = useState([]);
  const [telemetry, setTelemetry] = useState({});
  const [scadaFeeders, setScadaFeeders] = useState({});
  const [logs, setLogs] = useState([]);
  const [chartPinKey, setChartPinKey] = useState('MW');
  const [alertBanner, setAlertBanner] = useState(null);

  // Drag and Drop State
  const dragItem = useRef(null);
  const dragOverItem = useRef(null);

  // Modals
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [showAddWidget, setShowAddWidget] = useState(false);
  const [showEditWidget, setShowEditWidget] = useState(false);

  // Form Inputs - Add Widget
  const [newDevId, setNewDevId] = useState('');
  const [newDevName, setNewDevName] = useState('');

  const [wType, setWType] = useState('switch');
  const [wLabel, setWLabel] = useState('');
  const [wPinKey, setWPinKey] = useState('v0');
  const [wUnit, setWUnit] = useState('');
  const [wColor, setWColor] = useState('#2563eb');

  // Form Inputs - Edit Widget
  const [editingWidgetId, setEditingWidgetId] = useState(null);
  const [editLabel, setEditLabel] = useState('');
  const [editPinKey, setEditPinKey] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [editColor, setEditColor] = useState('#2563eb');
  const [editType, setEditType] = useState('switch');

  // --- REST API Calls ---
  const fetchDevices = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/devices`);
      if (res.ok) {
        const data = await res.json();
        setDevices(data);
        if (data.length > 0 && !selectedDeviceId) {
          setSelectedDeviceId(data[0].device_id);
        }
      }
    } catch (err) {
      console.error('Fetch devices error:', err);
    }
  };

  const fetchWidgets = async (devId) => {
    if (!devId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/devices/${devId}/widgets`);
      if (res.ok) {
        const data = await res.json();
        const savedOrder = localStorage.getItem(`gridlink_widget_order_${devId}`);
        if (savedOrder) {
          try {
            const orderIds = JSON.parse(savedOrder);
            const ordered = [...data].sort((a, b) => {
              const idxA = orderIds.indexOf(a.id);
              const idxB = orderIds.indexOf(b.id);
              if (idxA === -1) return 1;
              if (idxB === -1) return -1;
              return idxA - idxB;
            });
            setWidgets(ordered);
            return;
          } catch (e) {
            console.warn('Order restore fallback:', e);
          }
        }
        setWidgets(data);
      }
    } catch (err) {
      console.error('Fetch widgets error:', err);
    }
  };

  const fetchTelemetryHistory = async (devId) => {
    if (!devId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/devices/${devId}/telemetry?limit=50`);
      if (res.ok) {
        const history = await res.json();
        setLogs(history);

        const feederMap = {};
        history.forEach((log) => {
          let p = log.payload;
          if (typeof p === 'string') {
            try { p = JSON.parse(p); } catch (e) { p = {}; }
          }
          if (p && p.feeder) {
            if (!feederMap[p.feeder]) {
              feederMap[p.feeder] = p;
            }
          }
        });
        setScadaFeeders(feederMap);
      }
    } catch (err) {
      console.error('Fetch telemetry history error:', err);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  useEffect(() => {
    if (selectedDeviceId) {
      fetchWidgets(selectedDeviceId);
      fetchTelemetryHistory(selectedDeviceId);
    }
  }, [selectedDeviceId]);

  // --- MQTT Client ---
  useEffect(() => {
    const mqttClient = mqtt.connect(MQTT_WS_URL, {
      clientId: `gridlink_web_${Math.random().toString(16).substring(2, 8)}`,
      keepalive: 60,
    });

    mqttClient.on('connect', () => setMqttConnected(true));
    mqttClient.on('offline', () => setMqttConnected(false));
    mqttClient.on('error', () => setMqttConnected(false));

    mqttClient.on('message', (topic, message) => {
      try {
        const strMsg = message.toString();

        if (topic.endsWith('/alert')) {
          const alertData = JSON.parse(strMsg);
          setAlertBanner(alertData);
          setTimeout(() => setAlertBanner(null), 7000);
          return;
        }

        const payload = JSON.parse(strMsg);
        setTelemetry((prev) => ({ ...prev, ...payload }));

        if (payload && payload.feeder) {
          setScadaFeeders((prev) => ({
            ...prev,
            [payload.feeder]: payload,
          }));
        }

        if (selectedDeviceId) fetchTelemetryHistory(selectedDeviceId);
      } catch (err) {
        console.error('JSON parse error:', err);
      }
    });

    setClient(mqttClient);
    return () => mqttClient.end();
  }, [selectedDeviceId]);

  useEffect(() => {
    if (client && mqttConnected && selectedDeviceId) {
      const tTopic = `gridlink/device/${selectedDeviceId}/telemetry`;
      const fTopic = `gridlink/${selectedDeviceId}/telemetry`;
      const aTopic = `gridlink/device/${selectedDeviceId}/alert`;

      client.subscribe([tTopic, fTopic, aTopic]);
      return () => client.unsubscribe([tTopic, fTopic, aTopic]);
    }
  }, [client, mqttConnected, selectedDeviceId]);

  // --- Drag and Drop Handlers ---
  const handleDragStart = (e, index) => {
    dragItem.current = index;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnter = (e, index) => {
    dragOverItem.current = index;
  };

  const handleDragEnd = () => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    if (dragItem.current === dragOverItem.current) {
      dragItem.current = null;
      dragOverItem.current = null;
      return;
    }

    const updatedWidgets = [...widgets];
    const draggedItemContent = updatedWidgets.splice(dragItem.current, 1)[0];
    updatedWidgets.splice(dragOverItem.current, 0, draggedItemContent);

    dragItem.current = null;
    dragOverItem.current = null;
    setWidgets(updatedWidgets);

    if (selectedDeviceId) {
      const orderIds = updatedWidgets.map((w) => w.id);
      localStorage.setItem(`gridlink_widget_order_${selectedDeviceId}`, JSON.stringify(orderIds));
    }
  };

  // --- Actions ---
  const sendCommand = (pinKey, value) => {
    if (client && mqttConnected) {
      const topic = `gridlink/device/${selectedDeviceId}/command`;
      const payload = JSON.stringify({ [pinKey]: value });
      client.publish(topic, payload);
      setTelemetry((prev) => ({ ...prev, [pinKey]: value }));
    }
  };

  const handleAddDevice = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE_URL}/devices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: newDevId, name: newDevName }),
      });

      if (res.ok) {
        setNewDevId('');
        setNewDevName('');
        setShowAddDevice(false);
        fetchDevices();
      } else {
        const errData = await res.json();
        alert(`Error: ${errData.detail || 'Could not register device'}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddWidget = async (e) => {
    e.preventDefault();
    if (!selectedDeviceId) {
      alert('Please select an active device first!');
      return;
    }

    if (wType !== 'namelabel') {
      const isPinDuplicate = widgets.some(
        (w) => w.pin_key.trim().toLowerCase() === wPinKey.trim().toLowerCase()
      );

      if (isPinDuplicate) {
        alert(`⚠️ Warning: Virtual Pin "${wPinKey}" is already assigned to another widget! Please choose a different pin.`);
        return;
      }
    }

    try {
      const res = await fetch(`${API_BASE_URL}/devices/${selectedDeviceId}/widgets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          widget_type: wType,
          label: wLabel,
          pin_key: wType === 'namelabel' ? 'none' : wPinKey,
          config: { min: 0, max: 255, color: wColor, unit: wUnit.trim() },
        }),
      });

      if (res.ok) {
        setWLabel('');
        setWUnit('');
        setShowAddWidget(false);
        fetchWidgets(selectedDeviceId);
      } else {
        const errData = await res.json();
        alert(`Error: ${errData.detail || 'Failed to add widget'}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Open Edit Modal with Pre-populated Data
  const handleOpenEditModal = (widget) => {
    setEditingWidgetId(widget.id);
    setEditLabel(widget.label || '');
    setEditPinKey(widget.pin_key || '');
    setEditColor(widget.config?.color || '#2563eb');
    setEditUnit(widget.config?.unit || '');
    setEditType(widget.widget_type || 'switch');
    setShowEditWidget(true);
  };

  // Submit Updated Settings to Backend
  const handleUpdateWidget = async (e) => {
    e.preventDefault();
    if (!editingWidgetId) return;

    if (editType !== 'namelabel') {
      const isDuplicate = widgets.some(
        (w) => w.id !== editingWidgetId && w.pin_key.trim().toLowerCase() === editPinKey.trim().toLowerCase()
      );
      if (isDuplicate) {
        alert(`⚠️ Warning: Virtual Pin "${editPinKey}" is already assigned to another widget!`);
        return;
      }
    }

    const payload = {
      label: editLabel,
      pin_key: editType === 'namelabel' ? 'none' : editPinKey,
      config: {
        color: editColor,
        unit: editUnit.trim(),
        min: 0,
        max: 255,
      },
    };

    try {
      const res = await fetch(`${API_BASE_URL}/devices/${selectedDeviceId}/widgets/${editingWidgetId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setShowEditWidget(false);
        setEditingWidgetId(null);
        fetchWidgets(selectedDeviceId);
      } else {
        // Fallback optimistic update
        setWidgets((prev) =>
          prev.map((w) =>
            w.id === editingWidgetId
              ? { ...w, label: editLabel, pin_key: payload.pin_key, config: { ...w.config, ...payload.config } }
              : w
          )
        );
        setShowEditWidget(false);
      }
    } catch (err) {
      console.error('Update widget error:', err);
      setWidgets((prev) =>
        prev.map((w) =>
          w.id === editingWidgetId
            ? { ...w, label: editLabel, pin_key: payload.pin_key, config: { ...w.config, ...payload.config } }
            : w
        )
      );
      setShowEditWidget(false);
    }
  };

  const handleDeleteWidget = async (widgetId) => {
    try {
      await fetch(`${API_BASE_URL}/devices/${selectedDeviceId}/widgets/${widgetId}`, {
        method: 'DELETE',
      });
      fetchWidgets(selectedDeviceId);
    } catch (err) {
      console.error(err);
    }
  };

  // Helper for rendering Value Display with Time, Units, Strings, and Faults
  const renderValueDisplay = (val, unit, customColor) => {
    if (val === undefined || val === null || val === '') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
          <Activity color={customColor} size={16} />
          <span style={styles.metricValue}>-- {unit === 'time_format' ? '' : unit}</span>
        </div>
      );
    }

    // 1. Auto Time Conversion (converts raw seconds into hh:mm:ss or mm:ss)
    if (unit === 'time_format' && !isNaN(val)) {
      const totalSec = Math.floor(Number(val));
      const hrs = Math.floor(totalSec / 3600);
      const mins = Math.floor((totalSec % 3600) / 60);
      const secs = totalSec % 60;

      const formattedTime = hrs > 0 
        ? `${hrs}h ${mins}m ${secs}s` 
        : mins > 0 
        ? `${mins}m ${secs}s` 
        : `${secs}s`;

      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
          <Clock size={16} color={customColor} />
          <span style={{ ...styles.metricValue, fontSize: '15px', color: '#0f172a' }}>
            {formattedTime}
          </span>
        </div>
      );
    }

    const strVal = String(val).trim();
    const upper = strVal.toUpperCase();
    const isFault = upper.includes('TRIP') || upper.includes('FAULT') || upper.includes('ALERT') || upper.includes('OVERCURRENT') || upper.includes('DRY');
    const isNormal = upper === 'NORMAL' || upper === 'OK' || upper === 'HEALTHY' || upper === 'RUNNING';

    // 2. Status or fault string badge
    if (isNaN(val) || unit === '') {
      return (
        <div
          style={{
            marginTop: '4px',
            padding: '4px 6px',
            borderRadius: '5px',
            backgroundColor: isFault ? '#fee2e2' : isNormal ? '#dcfce7' : '#f1f5f9',
            border: `1px solid ${isFault ? '#ef4444' : isNormal ? '#22c55e' : '#cbd5e1'}`,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            minHeight: '26px',
          }}
        >
          {isFault ? (
            <AlertOctagon size={14} color="#dc2626" />
          ) : isNormal ? (
            <CheckCircle2 size={14} color="#16a34a" />
          ) : (
            <Activity size={14} color={customColor} />
          )}
          <span
            style={{
              fontSize: strVal.length > 14 ? '10px' : '11px',
              fontWeight: 'bold',
              color: isFault ? '#b91c1c' : isNormal ? '#15803d' : '#1e293b',
              lineHeight: '1.2',
              wordBreak: 'break-word',
            }}
          >
            {strVal}
          </span>
        </div>
      );
    }

    // 3. Standard numeric value with measurement unit (e.g., 45 s, 12 min, 230 V, 450 W)
    return (
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginTop: '4px' }}>
        <span style={styles.metricValue}>{strVal}</span>
        {unit && <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>{unit}</span>}
      </div>
    );
  };

  const scadaList = Object.values(scadaFeeders).sort((a, b) => (a.slave || 0) - (b.slave || 0));

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Cpu size={28} color="#0284c7" />
          <div>
            <h1 style={styles.title}>GridLink IoT Console</h1>
            <p style={styles.subtitle}>APTRANSCO Substation SCADA</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span
            style={{
              ...styles.badge,
              backgroundColor: mqttConnected ? '#dcfce7' : '#fee2e2',
              color: mqttConnected ? '#15803d' : '#b91c1c',
            }}
          >
            {mqttConnected ? '● Broker Live' : '○ Broker Offline'}
          </span>
          <button style={styles.addButton} onClick={() => setShowAddDevice(true)}>
            <Plus size={14} /> New Device
          </button>
        </div>
      </header>

      {/* VIEW SELECTION TAB BAR */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
        <button
          onClick={() => setActiveTab('sld')}
          style={{
            padding: '8px 16px',
            backgroundColor: activeTab === 'sld' ? '#0284c7' : '#e2e8f0',
            color: activeTab === 'sld' ? '#fff' : '#334155',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 'bold',
            cursor: 'pointer',
            fontSize: '13px',
          }}
        >
          ⚡ 132/33kV Substation SLD
        </button>
        <button
          onClick={() => setActiveTab('dashboard')}
          style={{
            padding: '8px 16px',
            backgroundColor: activeTab === 'dashboard' ? '#0284c7' : '#e2e8f0',
            color: activeTab === 'dashboard' ? '#fff' : '#334155',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 'bold',
            cursor: 'pointer',
            fontSize: '13px',
          }}
        >
          🎛️ Control Dashboard
        </button>
      </div>

      {/* Alert Banner */}
      {alertBanner && (
        <div style={styles.alertBanner}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle color="#dc2626" size={20} />
            <div>
              <strong style={{ color: '#991b1b', fontSize: '14px' }}>
                {alertBanner.warning}: {alertBanner.value} {alertBanner.unit}
              </strong>
              <span style={{ marginLeft: '12px', color: '#7f1d1d', fontSize: '12px' }}>
                (Threshold Exceeded: {alertBanner.threshold} {alertBanner.unit})
              </span>
            </div>
          </div>
          <button style={styles.closeAlertBtn} onClick={() => setAlertBanner(null)}>
            <X size={16} color="#991b1b" />
          </button>
        </div>
      )}

      {/* VIEW SWITCHING LOGIC */}
      {activeTab === 'sld' ? (
        <ScadaSLD />
      ) : (
        <>
          {/* Device Bar */}
          <div style={styles.deviceBar}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontWeight: 'bold', color: '#475569', fontSize: '13px' }}>Active Device:</label>
              <select
                value={selectedDeviceId}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
                style={styles.select}
              >
                {devices.map((dev) => (
                  <option key={dev.id} value={dev.device_id}>
                    {dev.name} ({dev.device_id})
                  </option>
                ))}
                {devices.length === 0 && <option value="TEST001">TEST001</option>}
              </select>
              <button style={styles.iconButton} onClick={fetchDevices} title="Refresh">
                <RefreshCw size={14} />
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <label style={{ fontWeight: 'bold', color: '#475569', fontSize: '13px' }}>Chart Key:</label>
              <input
                type="text"
                value={chartPinKey}
                onChange={(e) => setChartPinKey(e.target.value)}
                placeholder="MW / VRY / temp"
                style={{ ...styles.select, width: '100px' }}
              />
              <button style={styles.widgetButton} onClick={() => setShowAddWidget(true)}>
                <Sliders size={14} /> Add Widget
              </button>
            </div>
          </div>

          {/* DRAGGABLE FLEXBOX WIDGET CANVAS */}
          <div style={styles.flexGridContainer}>
            {widgets.map((w, index) => {
              const val = telemetry[w.pin_key];
              const customColor = w.config?.color || '#2563eb';
              const widgetUnit = w.config?.unit || '';

              return (
                <div
                  key={w.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragEnter={(e) => handleDragEnter(e, index)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => e.preventDefault()}
                  style={{
                    ...styles.compactCard,
                    borderTop: `3px solid ${customColor}`,
                  }}
                >
                  {/* Card Header with Drag Handle, Pin, Edit, and Delete */}
                  <div style={styles.cardHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <GripVertical size={13} color="#94a3b8" style={{ cursor: 'grab' }} />
                      <span style={{ ...styles.pinTag, backgroundColor: `${customColor}20`, color: customColor }}>
                        {w.widget_type === 'namelabel' ? 'static' : w.pin_key}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        style={styles.iconActionBtn}
                        onClick={() => handleOpenEditModal(w)}
                        title="Edit Widget Settings"
                      >
                        <Pencil size={11} color="#0284c7" />
                      </button>
                      <button
                        style={styles.iconActionBtn}
                        onClick={() => handleDeleteWidget(w.id)}
                        title="Remove Widget"
                      >
                        <Trash2 size={11} color="#ef4444" />
                      </button>
                    </div>
                  </div>

                  {w.widget_type === 'namelabel' ? (
                    <div style={{ textAlign: 'center', marginTop: '2px' }}>
                      <h4 style={{ margin: 0, color: customColor, fontSize: '12px' }}>{w.label}</h4>
                    </div>
                  ) : (
                    <h5 style={styles.widgetLabel}>{w.label}</h5>
                  )}

                  {w.widget_type === 'switch' && (
                    <button
                      onClick={() => sendCommand(w.pin_key, !val)}
                      style={{
                        ...styles.switchButton,
                        backgroundColor: val ? customColor : '#64748b',
                      }}
                    >
                      {val ? 'ON' : 'OFF'}
                    </button>
                  )}

                  {w.widget_type === 'button' && (
                    <button
                      onMouseDown={() => sendCommand(w.pin_key, 1)}
                      onMouseUp={() => sendCommand(w.pin_key, 0)}
                      onTouchStart={() => sendCommand(w.pin_key, 1)}
                      onTouchEnd={() => sendCommand(w.pin_key, 0)}
                      style={{
                        ...styles.switchButton,
                        backgroundColor: val ? customColor : '#64748b',
                        userSelect: 'none',
                        touchAction: 'none',
                      }}
                    >
                      {val ? 'HOLD' : 'PRESS'}
                    </button>
                  )}

                  {w.widget_type === 'led' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                      <div
                        style={{
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          backgroundColor: val ? customColor : '#cbd5e1',
                          boxShadow: val ? `0 0 6px ${customColor}` : 'none',
                          transition: 'all 0.3s ease',
                        }}
                      />
                      <span style={{ fontWeight: 'bold', fontSize: '11px', color: val ? customColor : '#64748b' }}>
                        {val ? 'ON' : 'OFF'}
                      </span>
                    </div>
                  )}

                  {w.widget_type === 'inputlabel' && (
                    <InputLabelWidget pinKey={w.pin_key} onSend={sendCommand} />
                  )}

                  {w.widget_type === 'slider' && (
                    <div style={{ marginTop: '2px' }}>
                      <input
                        type="range"
                        min={w.config?.min || 0}
                        max={w.config?.max || 255}
                        value={val !== undefined ? val : 0}
                        onChange={(e) => sendCommand(w.pin_key, Number(e.target.value))}
                        style={{ width: '100%', cursor: 'pointer', accentColor: customColor }}
                      />
                      <div style={{ textAlign: 'center', fontSize: '10px', fontWeight: 'bold', color: '#0f172a' }}>
                        {val !== undefined ? val : 0}
                      </div>
                    </div>
                  )}

                  {w.widget_type === 'gauge' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                      <Thermometer color={customColor} size={16} />
                      <span style={styles.metricValue}>
                        {val !== undefined ? `${val} ${widgetUnit}` : '--'}
                      </span>
                    </div>
                  )}

                  {/* Value Display Widget (Numeric with Units, Auto Time, or String Faults) */}
                  {w.widget_type === 'value' && renderValueDisplay(val, widgetUnit, customColor)}
                </div>
              );
            })}

            {widgets.length === 0 && scadaList.length === 0 && (
              <div style={styles.emptyState}>
                <p style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>
                  No active widgets or SCADA feeds yet. Click <strong>"Add Widget"</strong> to create controls!
                </p>
              </div>
            )}
          </div>

          {/* DYNAMIC SCADA LOG SHEET TABLE */}
          {scadaList.length > 0 && (
            <section style={styles.historySection}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Table color="#0284c7" size={20} />
                  <div>
                    <h2 style={{ margin: 0, color: '#0f172a', fontSize: '18px' }}>APTRANSCO SCADA LOG SHEET</h2>
                    <p style={{ margin: '2px 0 0 0', color: '#64748b', fontSize: '12px' }}>Live Substation Feeder Matrix</p>
                  </div>
                </div>
                <span style={{ backgroundColor: '#dcfce7', color: '#15803d', padding: '4px 10px', borderRadius: '20px', fontWeight: 'bold', fontSize: '12px' }}>
                  ● {scadaList.length} Feeders Online
                </span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={styles.scadaTable}>
                  <thead>
                    <tr>
                      <th style={styles.scadaTh}>FEEDER</th>
                      <th style={styles.scadaThRight}>VRY (kV)</th>
                      <th style={styles.scadaThRight}>IR (A)</th>
                      <th style={styles.scadaThRight}>MW</th>
                      <th style={styles.scadaThRight}>MVAR</th>
                      <th style={styles.scadaThRight}>PF</th>
                      <th style={styles.scadaThCenter}>COMM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scadaList.map((p, idx) => {
                      const isOnline = p.status === 'OK';
                      return (
                        <tr key={p.feeder || idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={styles.scadaTdFeeder}>{p.feeder || '--'}</td>
                          <td style={styles.scadaTdRight}>{p.VRY !== undefined ? Number(p.VRY).toFixed(2) : '--'}</td>
                          <td style={styles.scadaTdRight}>{p.IR !== undefined ? Number(p.IR).toFixed(2) : '--'}</td>
                          <td style={styles.scadaTdRight}>{p.MW !== undefined ? Number(p.MW).toFixed(3) : '--'}</td>
                          <td style={styles.scadaTdRight}>{p.MVAR !== undefined ? Number(p.MVAR).toFixed(3) : '--'}</td>
                          <td style={styles.scadaTdRight}>{p.PF !== undefined ? Number(p.PF).toFixed(3) : '--'}</td>
                          <td style={styles.scadaTdCenter}>
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontWeight: 'bold',
                                fontSize: '11px',
                                backgroundColor: isOnline ? '#dcfce7' : '#fee2e2',
                                color: isOnline ? '#15803d' : '#b91c1c',
                              }}
                            >
                              {p.status || 'FAIL'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* TELEMETRY CHART SECTION */}
          <TelemetryChart logs={logs} pinKey={chartPinKey} />
        </>
      )}

      {/* Modal: Add Device */}
      {showAddDevice && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h3 style={{ marginTop: 0 }}>Register New Device</h3>
            <form onSubmit={handleAddDevice}>
              <label style={styles.label}>Device ID</label>
              <input
                style={styles.input}
                placeholder="e.g. SCADA_LOGSHEET"
                value={newDevId}
                onChange={(e) => setNewDevId(e.target.value)}
                required
              />
              <label style={styles.label}>Device Name</label>
              <input
                style={styles.input}
                placeholder="e.g. Substation Unit 1"
                value={newDevName}
                onChange={(e) => setNewDevName(e.target.value)}
                required
              />
              <div style={styles.modalActions}>
                <button type="button" onClick={() => setShowAddDevice(false)} style={styles.cancelBtn}>
                  Cancel
                </button>
                <button type="submit" style={styles.saveBtn}>Save Device</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Widget */}
      {showAddWidget && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h3 style={{ marginTop: 0 }}>Add Blynk Widget</h3>
            <form onSubmit={handleAddWidget}>
              <label style={styles.label}>Widget Type</label>
              <select style={styles.input} value={wType} onChange={(e) => setWType(e.target.value)}>
                <option value="switch">Switch (Toggle ON/OFF)</option>
                <option value="button">Push Button (Momentary Press)</option>
                <option value="led">LED Indicator</option>
                <option value="namelabel">Name Label (Title / Header)</option>
                <option value="inputlabel">Input Label (Text Entry)</option>
                <option value="slider">Slider (PWM / Speed)</option>
                <option value="gauge">Gauge (Temperature/Power)</option>
                <option value="value">Value Display (Numeric / Time / Fault String)</option>
              </select>

              <label style={styles.label}>Label / Title</label>
              <input
                style={styles.input}
                placeholder="e.g. 2HP Current / Motor Runtime / Fault"
                value={wLabel}
                onChange={(e) => setWLabel(e.target.value)}
                required
              />

              {wType !== 'namelabel' && (
                <>
                  <label style={styles.label}>Datastream / Pin Key</label>
                  <input
                    style={styles.input}
                    placeholder="e.g. v5, runtimeSec, lastFault, IR"
                    value={wPinKey}
                    onChange={(e) => setWPinKey(e.target.value)}
                    required
                  />
                </>
              )}

              {(wType === 'value' || wType === 'gauge') && (
                <>
                  <label style={styles.label}>Measurement Unit / Display Mode</label>
                  <select
                    style={styles.input}
                    value={wUnit}
                    onChange={(e) => setWUnit(e.target.value)}
                  >
                    {UNIT_OPTIONS.map((u) => (
                      <option key={u.label} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </>
              )}

              <label style={styles.label}>Accent Color</label>
              <select style={styles.input} value={wColor} onChange={(e) => setWColor(e.target.value)}>
                {COLOR_OPTIONS.map((c) => (
                  <option key={c.hex} value={c.hex}>
                    {c.name}
                  </option>
                ))}
              </select>

              <div style={styles.modalActions}>
                <button type="button" onClick={() => setShowAddWidget(false)} style={styles.cancelBtn}>
                  Cancel
                </button>
                <button type="submit" style={styles.saveBtn}>Add Widget</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Widget Settings */}
      {showEditWidget && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '16px' }}>Edit Widget Settings</h3>
              <button
                onClick={() => setShowEditWidget(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <X size={16} color="#64748b" />
              </button>
            </div>

            <form onSubmit={handleUpdateWidget}>
              <label style={styles.label}>Label / Title</label>
              <input
                style={styles.input}
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                required
              />

              {editType !== 'namelabel' && (
                <>
                  <label style={styles.label}>Datastream / Pin Key</label>
                  <input
                    style={styles.input}
                    value={editPinKey}
                    onChange={(e) => setEditPinKey(e.target.value)}
                    required
                  />
                </>
              )}

              {(editType === 'value' || editType === 'gauge') && (
                <>
                  <label style={styles.label}>Measurement Unit / Display Mode</label>
                  <select
                    style={styles.input}
                    value={editUnit}
                    onChange={(e) => setEditUnit(e.target.value)}
                  >
                    {UNIT_OPTIONS.map((u) => (
                      <option key={u.label} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </>
              )}

              <label style={styles.label}>Accent Color</label>
              <select style={styles.input} value={editColor} onChange={(e) => setEditColor(e.target.value)}>
                {COLOR_OPTIONS.map((c) => (
                  <option key={c.hex} value={c.hex}>
                    {c.name}
                  </option>
                ))}
              </select>

              <div style={styles.modalActions}>
                <button
                  type="button"
                  onClick={() => setShowEditWidget(false)}
                  style={styles.cancelBtn}
                >
                  Cancel
                </button>
                <button type="submit" style={styles.saveBtn}>
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Styles ---
const styles = {
  container: { padding: '20px', fontFamily: 'system-ui, sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
  title: { margin: 0, fontSize: '22px' },
  subtitle: { margin: '2px 0 0 0', color: '#64748b', fontSize: '12px' },
  badge: { padding: '5px 12px', borderRadius: '20px', fontWeight: 'bold', fontSize: '12px' },
  addButton: { display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#0284c7', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' },
  alertBanner: { backgroundColor: '#fee2e2', border: '1px solid #fca5a5', padding: '10px 14px', borderRadius: '10px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  closeAlertBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: '2px' },
  deviceBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: '8px 14px', borderRadius: '10px', marginBottom: '16px', border: '1px solid #e2e8f0' },
  select: { padding: '5px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' },
  iconButton: { backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '5px', cursor: 'pointer' },
  widgetButton: { display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' },
  
  flexGridContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    marginBottom: '20px',
    alignItems: 'flex-start',
  },
  compactCard: {
    width: '185px',
    minHeight: '105px',
    backgroundColor: '#fff',
    padding: '8px 10px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    userSelect: 'none',
    transition: 'box-shadow 0.2s ease',
  },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  pinTag: { padding: '1px 5px', borderRadius: '3px', fontSize: '10px', fontWeight: 'bold' },
  iconActionBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: '1px', display: 'flex', alignItems: 'center' },
  widgetLabel: { margin: '2px 0 0 0', fontSize: '11px', color: '#334155', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  metricValue: { fontSize: '16px', fontWeight: 'bold', color: '#0f172a' },
  switchButton: { width: '100%', padding: '4px', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '11px' },
  emptyState: { width: '100%', padding: '20px', backgroundColor: '#fff', borderRadius: '10px', border: '1px dashed #cbd5e1', textAlign: 'center' },
  chartCard: { backgroundColor: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px' },
  historySection: { backgroundColor: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px' },
  scadaTable: { width: '100%', borderCollapse: 'collapse', fontFamily: 'monospace, sans-serif' },
  scadaTh: { padding: '8px 10px', textAlign: 'left', backgroundColor: '#f1f5f9', color: '#334155', fontWeight: 'bold', borderBottom: '2px solid #cbd5e1', fontSize: '12px' },
  scadaThRight: { padding: '8px 10px', textAlign: 'right', backgroundColor: '#f1f5f9', color: '#334155', fontWeight: 'bold', borderBottom: '2px solid #cbd5e1', fontSize: '12px' },
  scadaThCenter: { padding: '8px 10px', textAlign: 'center', backgroundColor: '#f1f5f9', color: '#334155', fontWeight: 'bold', borderBottom: '2px solid #cbd5e1', fontSize: '12px' },
  scadaTdFeeder: { padding: '6px 10px', fontWeight: 'bold', color: '#0f172a', fontSize: '12px' },
  scadaTdRight: { padding: '6px 10px', textAlign: 'right', color: '#1e293b', fontSize: '12px' },
  scadaTdCenter: { padding: '6px 10px', textAlign: 'center' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modalContent: { backgroundColor: '#fff', padding: '20px', borderRadius: '12px', width: '100%', maxWidth: '340px' },
  label: { display: 'block', fontSize: '12px', fontWeight: 'bold', margin: '8px 0 4px 0', color: '#334155' },
  input: { width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px' },
  cancelBtn: { padding: '6px 12px', border: 'none', borderRadius: '6px', backgroundColor: '#e2e8f0', cursor: 'pointer', fontSize: '12px' },
  saveBtn: { padding: '6px 12px', border: 'none', borderRadius: '6px', backgroundColor: '#0284c7', color: '#fff', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' },
};
