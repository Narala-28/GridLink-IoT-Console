import React, { useState, useEffect } from 'react';
import mqtt from 'mqtt';
import { Power, Droplets, AlertTriangle, ShieldCheck, Activity } from 'lucide-react';

const MQTT_BROKER =
  import.meta.env.VITE_MQTT_WS_URL || 'ws://localhost:8083/mqtt';

export default function Dashboard() {
  const [client, setClient] = useState(null);
  const [telemetry, setTelemetry] = useState({
    motor2: false,
    motor6: false,
    autoMode: false,
    tankFull: false,
    tankLow: false,
    sumpFull: false,
    sumpDry: false,
    current2HP: "0.00",
    current6HP: "0.00",
    runtime2HP_min: 0,
    runtime6HP_min: 0,
    lastFault: "NONE",
    bypassFloat: false,
    bypassOC: false,
    bypassDryRun: false,
    monitorCurrent: true
  });

  useEffect(() => {
    const mqttClient = mqtt.connect(MQTT_BROKER);

    mqttClient.on('connect', () => {
      console.log("Connected to GridLink MQTT Broker");
      mqttClient.subscribe("gridlink/telemetry/state");
    });

    mqttClient.on('message', (topic, message) => {
      if (topic === "gridlink/telemetry/state") {
        try {
          const data = JSON.parse(message.toString());
          setTelemetry(prev => ({ ...prev, ...data }));
        } catch (e) {
          console.error("Invalid JSON:", e);
        }
      }
    });

    setClient(mqttClient);
    return () => mqttClient.end();
  }, []);

  // Action Dispatchers
  const sendCommand = (topic, message) => {
    if (client) client.publish(topic, message);
  };

  const updateSettings = (key, value) => {
    if (client) {
      const payload = JSON.stringify({ [key]: value });
      client.publish("gridlink/command/settings", payload);
    }
  };

  return (
    <div style={{ padding: '24px', fontFamily: 'sans-serif', background: '#f4f6f8', minHeight: '100vh' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2>GridLink Motor Automation Station</h2>
        <div>
          <button 
            onClick={() => sendCommand("gridlink/command/mode", telemetry.autoMode ? "MANUAL" : "AUTO")}
            style={{ padding: '10px 20px', borderRadius: 8, cursor: 'pointer', background: telemetry.autoMode ? '#10b981' : '#6b7280', color: '#fff', border: 'none' }}
          >
            Mode: {telemetry.autoMode ? "AUTOMATIC" : "MANUAL"}
          </button>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
        
        {/* 2 HP Motor Card */}
        <div style={{ background: '#fff', padding: 20, borderRadius: 12, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          <h3>2 HP Motor (Overhead)</h3>
          <p>Status: <strong>{telemetry.motor2 ? "RUNNING" : "STOPPED"}</strong></p>
          <p>Current: <strong>{telemetry.current2HP} A</strong></p>
          <p>Runtime: <strong>{telemetry.runtime2HP_min} mins</strong></p>
          <div style={{ display: 'flex', gap: 10, marginTop: 15 }}>
            <button onClick={() => sendCommand("gridlink/command/motor2", "START")} style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 6 }}>START</button>
            <button onClick={() => sendCommand("gridlink/command/motor2", "STOP")} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 6 }}>STOP</button>
          </div>
        </div>

        {/* 6 HP Motor Card */}
        <div style={{ background: '#fff', padding: 20, borderRadius: 12, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          <h3>6 HP Motor (Sump)</h3>
          <p>Status: <strong>{telemetry.motor6 ? "RUNNING" : "STOPPED"}</strong></p>
          <p>Current: <strong>{telemetry.current6HP} A</strong></p>
          <p>Runtime: <strong>{telemetry.runtime6HP_min} mins</strong></p>
          <div style={{ display: 'flex', gap: 10, marginTop: 15 }}>
            <button onClick={() => sendCommand("gridlink/command/motor6", "START")} style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 6 }}>START</button>
            <button onClick={() => sendCommand("gridlink/command/motor6", "STOP")} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 6 }}>STOP</button>
          </div>
        </div>

        {/* Water Levels Card */}
        <div style={{ background: '#fff', padding: 20, borderRadius: 12, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          <h3>Water Levels</h3>
          <p>Tank High: <strong>{telemetry.tankFull ? "FULL" : "NORMAL"}</strong></p>
          <p>Tank Low: <strong>{telemetry.tankLow ? "LOW" : "NORMAL"}</strong></p>
          <p>Sump High: <strong>{telemetry.sumpFull ? "FULL" : "NORMAL"}</strong></p>
          <p>Sump Low: <strong>{telemetry.sumpDry ? "DRY" : "NORMAL"}</strong></p>
          <p>Last Fault: <span style={{ color: '#dc2626' }}>{telemetry.lastFault}</span></p>
        </div>

        {/* Bypass Controls Card */}
        <div style={{ background: '#fff', padding: 20, borderRadius: 12, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          <h3>Protection Bypasses</h3>
          <label style={{ display: 'block', marginBottom: 10 }}>
            <input 
              type="checkbox" 
              checked={telemetry.bypassFloat} 
              onChange={e => updateSettings("bypassFloat", e.target.checked)} 
            /> Bypass Float Sensors
          </label>
          <label style={{ display: 'block', marginBottom: 10 }}>
            <input 
              type="checkbox" 
              checked={telemetry.bypassOC} 
              onChange={e => updateSettings("bypassOC", e.target.checked)} 
            /> Bypass Over-Current
          </label>
          <label style={{ display: 'block', marginBottom: 10 }}>
            <input 
              type="checkbox" 
              checked={telemetry.bypassDryRun} 
              onChange={e => updateSettings("bypassDryRun", e.target.checked)} 
            /> Bypass Dry Run
          </label>
          <label style={{ display: 'block' }}>
            <input 
              type="checkbox" 
              checked={telemetry.monitorCurrent} 
              onChange={e => updateSettings("monitorCurrent", e.target.checked)} 
            /> Enable Current Monitoring
          </label>
        </div>

      </div>
    </div>
  );
}
