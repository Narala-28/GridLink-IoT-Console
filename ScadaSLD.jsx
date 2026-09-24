import React, { useState, useEffect } from 'react';
import mqtt from 'mqtt';

// MQTT WebSocket endpoint can be configured through Vite environment variables.
const MQTT_WS_URL =
  import.meta.env.VITE_MQTT_WS_URL || 'ws://localhost:8083/mqtt';

// -----------------------------------------------------------------------------
// Substation Equipment Feed Lists
// -----------------------------------------------------------------------------
const FEEDERS_132KV_LEFT = [
  { id: 'F132_1', slaveID: 6,  name: 'Railway-1' },
  { id: 'F132_2', slaveID: 5,  name: 'Railway-2' },
  { id: 'F132_3', slaveID: 4,  name: 'Tirupati' },
  { id: 'F132_4', slaveID: 7,  name: 'Grind Well Norton' },
  { id: 'F132_5', slaveID: 8,  name: 'Puttur-1' },
  { id: 'F132_6', slaveID: 9,  name: 'Puttur-2' },
];

const FEEDERS_132KV_RIGHT = [
  { id: 'F132_7',  slaveID: 10, name: 'Sri Kalahasti' },
  { id: 'F132_8',  slaveID: 61, name: 'Rachagunneri' },
  { id: 'F132_9',  slaveID: 64, name: 'Amar Raja ' },
  { id: 'F132_10', slaveID: 63, name: 'Thukivakam-1' },
  { id: 'F132_11', slaveID: 62, name: 'Thukivakam-2' },
];

const TRANSFORMERS = [
  { id: 'PTR1', hvKey: 'PTR1_HV', lvKey: 'PTR1_LV', hvSlave: 15, lvSlave: 14, name: 'PTR-1', cap: '50 MVA' },
  { id: 'PTR2', hvKey: 'PTR2_HV', lvKey: 'PTR2_LV', hvSlave: 13, lvSlave: 16, name: 'PTR-2', cap: '31.5 MVA' },
  { id: 'PTR3', hvKey: 'PTR3_HV', lvKey: 'PTR3_LV', hvSlave: 71, lvSlave: 72, name: 'PTR-3', cap: '31.5 MVA' },
];

const FEEDERS_33KV = [
  // --- ESP32 #1 FEEDERS ---
  { id: 'F33_12', slaveID: 19, name: 'TTE' },
  { id: 'F33_13', slaveID: 14, name: 'Wingtech' },
  { id: 'F33_11', slaveID: 22, name: 'POTPL' },
  { id: 'F33_9',  slaveID: 11, name: 'APIIC-1' },
  { id: 'F33_10', slaveID: 34, name: 'APIIC-2' },
  { id: 'F33_15', slaveID: 41, name: 'Kukkaladhoddi' }, // NEW FEEDER ADDED
  { id: 'F33_1',  slaveID: 46, name: 'Amararaja Infra' },
  { id: 'F33_2',  slaveID: 38, name: 'Yellamandyam' },

  // --- ESP32 #2 FEEDERS ---
  { id: 'F33_3',  slaveID: 47, name: 'Gajulamandyam' },
  { id: 'F33_4',  slaveID: 37, name: 'Yerpedu' },
  { id: 'F33_5',  slaveID: 30, name: 'Thukivakam' },
  { id: 'F33_6',  slaveID: 40, name: 'Karakambadi' },
  { id: 'F33_8',  slaveID: 18, name: 'Mangalapalem' },
  { id: 'F33_7',  slaveID: 17, name: 'Intl Airport' },
  { id: 'F33_14', slaveID: 39, name: 'Guravarajapalli' },
  { id: 'CAP_1',  slaveID: 44, name: '5 MVAR Cap 1' },
  { id: 'CAP_2',  slaveID: 45, name: '7.2 MVAR Cap 2' },
];

export default function ScadaSLD() {
  const [telemetry, setTelemetry] = useState({
    '132KV_BUS_V': '132.50',
    '33KV_BUS_V': '33.10',
  });

  const [client, setClient] = useState(null);

  useEffect(() => {
    const initialState = { '132KV_BUS_V': '132.50', '33KV_BUS_V': '33.10' };
    FEEDERS_132KV_LEFT.concat(FEEDERS_132KV_RIGHT).forEach((f) => { initialState[`${f.id}_CB`] = 1; });
    FEEDERS_33KV.forEach((f) => { initialState[`${f.id}_CB`] = 1; });
    TRANSFORMERS.forEach((p) => {
      initialState[`${p.id}_HV_CB`] = 1;
      initialState[`${p.id}_LV_CB`] = 1;
    });
    setTelemetry((prev) => ({ ...initialState, ...prev }));
  }, []);

  useEffect(() => {
    const mqttClient = mqtt.connect(MQTT_WS_URL, {
      clientId: `sld_center_${Math.random().toString(16).substring(2, 8)}`,
    });

    mqttClient.on('connect', () => {
      console.log('SLD Connected to MQTT WebSocket Server');
      mqttClient.subscribe('gridlink/substation/132kv_telemetry');
    });

    mqttClient.on('message', (topic, message) => {
      try {
        const payload = JSON.parse(message.toString());
        setTelemetry((prev) => ({ ...prev, ...payload }));
      } catch (e) {
        console.error('MQTT JSON Parse Error:', e);
      }
    });

    setClient(mqttClient);
    return () => mqttClient.end();
  }, []);

  const handleControlCB = (cbKey, label) => {
    const currentState = telemetry[cbKey] ?? 1;
    const action = currentState === 1 ? 'OPEN / TRIP' : 'CLOSE';
    const confirmed = window.confirm(
      `⚡ SUBSTATION CONTROL ACTION\n\nAre you sure you want to ${action} [${label}]?`
    );

    if (confirmed) {
      const newState = currentState === 1 ? 0 : 1;
      if (client) {
        client.publish(
          'gridlink/substation/command',
          JSON.stringify({ [cbKey]: newState })
        );
      }
      setTelemetry((prev) => ({ ...prev, [cbKey]: newState }));
    }
  };

  const CircuitBreaker = ({ x, y, id, label }) => {
    const isClosed = (telemetry[id] ?? 1) === 1;
    return (
      <g
        transform={`translate(${x}, ${y})`}
        onClick={() => handleControlCB(id, label)}
        style={{ cursor: 'pointer' }}
      >
        <rect
          x="-15"
          y="-15"
          width="30"
          height="30"
          fill={isClosed ? '#ef4444' : '#22c55e'}
          stroke="#ffffff"
          strokeWidth="2.5"
          rx="4"
        />
        <text x="20" y="6" fill="#cbd5e1" fontSize="13" fontWeight="bold">
          {label}
        </text>
      </g>
    );
  };

  const Isolator = ({ x, y }) => (
    <g transform={`translate(${x}, ${y})`}>
      <line x1="-12" y1="12" x2="12" y2="-12" stroke="#e2e8f0" strokeWidth="3" />
      <circle cx="-12" cy="12" r="4" fill="#38bdf8" />
      <circle cx="12" cy="-12" r="4" fill="#38bdf8" />
    </g>
  );

  const TransformerSymbol = ({ x, y, label, cap }) => (
    <g transform={`translate(${x}, ${y})`}>
      <circle cx="0" cy="-20" r="22" fill="none" stroke="#eab308" strokeWidth="4.5" />
      <circle cx="0" cy="20" r="22" fill="none" stroke="#eab308" strokeWidth="4.5" />
      <text x="30" y="-4" fill="#38bdf8" fontSize="16" fontWeight="bold">{label}</text>
      <text x="30" y="18" fill="#cbd5e1" fontSize="14" fontWeight="bold">{cap}</text>
    </g>
  );

  const FeederTelemetryBox = ({ x, y, id, slaveID }) => {
    const a    = telemetry[`${id}_A`]    || telemetry[`S${slaveID}_IR`]   || '--';
    const mw   = telemetry[`${id}_MW`]   || telemetry[`S${slaveID}_MW`]   || '--';
    const mvar = telemetry[`${id}_MVAR`] || telemetry[`S${slaveID}_MVAR`] || '--';

    return (
      <g transform={`translate(${x - 70}, ${y})`}>
        <rect width="170" height="74" fill="#040711" stroke="#38bdf8" strokeWidth="1.8" rx="5" />
        <text x="70" y="22" fill="#4ade80" fontSize="20" fontWeight="bold" textAnchor="middle">
          I-R: {a} A
        </text>
        <text x="70" y="44" fill="#facc15" fontSize="20" fontWeight="bold" textAnchor="middle">
          P: {mw} MW
        </text>
        <text x="70" y="64" fill="#38bdf8" fontSize="20" fontWeight="bold" textAnchor="middle">
          Q: {mvar} MVar
        </text>
      </g>
    );
  };

  const SingleSideTransformerBox = ({ x, y, sideLabel, sideKey, slaveID, strokeColor }) => {
    const a    = telemetry[`${sideKey}_A`]    || telemetry[`S${slaveID}_IR`]   || '--';
    const mw   = telemetry[`${sideKey}_MW`]   || telemetry[`S${slaveID}_MW`]   || '--';
    const mvar = telemetry[`${sideKey}_MVAR`] || telemetry[`S${slaveID}_MVAR`] || '--';

    return (
      <g transform={`translate(${x - 75}, ${y})`}>
        <rect width="240" height="74" fill="#040711" stroke={strokeColor} strokeWidth="1.8" rx="5" />
        <text x="75" y="20" fill="#e2e8f0" fontSize="20" fontWeight="bold" textAnchor="middle">
          {sideLabel}
        </text>
        <text x="75" y="42" fill="#4ade80" fontSize="20" fontWeight="bold" textAnchor="middle">
          I-R: {a} A
        </text>
        <text x="75" y="64" fill="#facc15" fontSize="20" fontWeight="bold" textAnchor="middle">
          P: {mw} MW | Q: {mvar} MVar
        </text>
      </g>
    );
  };

  return (
    <div style={{ backgroundColor: '#0f172a', padding: '10px', borderRadius: '10px', width: '110%', height: 'calc(100vh - 40px)', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <h2 style={{ margin: 0, color: '#38bdf8', fontSize: '24px', fontWeight: 'bold' }}>
          APTRANSCO 132/33 KV LEVEL RENIGUNTA SUBSTATION SCADA
        </h2>
        <div style={{ display: 'flex', gap: '18px', alignItems: 'center' }}>
          <span style={{ backgroundColor: '#ef4444', color: '#fff', padding: '6px 16px', borderRadius: '4px', fontSize: '14px', fontWeight: 'bold' }}>
            ■ CLOSED / ENERGIZED
          </span>
          <span style={{ backgroundColor: '#22c55e', color: '#fff', padding: '6px 16px', borderRadius: '4px', fontSize: '14px', fontWeight: 'bold' }}>
            ■ OPEN / TRIPPED
          </span>
        </div>
      </div>

      <svg
        width="120%"
        height="100%"
        viewBox="0 0 3600 1400"
        preserveAspectRatio="none"
        style={{ backgroundColor: '#000000', borderRadius: '8px', border: '2px solid #334155' }}
      >
        {/* ======================================================= */}
        {/* 132 KV MAIN BUSBAR */}
        {/* ======================================================= */}
        <line x1="20" y1="300" x2="3580" y2="300" stroke="#ef4444" strokeWidth="8" />
        
        <text x="35" y="330" fill="#ef4444" fontSize="22" fontWeight="bold">
          132 KV MAIN BUSBAR (Volts: {telemetry['132KV_BUS_V']} kV)
        </text>

        {/* 132kV LEFT FEEDERS */}
        {FEEDERS_132KV_LEFT.map((f, idx) => {
          const x = 100 + idx * 190;
          return (
            <g key={f.id}>
              <line x1={x} y1="30" x2={x} y2="300" stroke="#3b82f6" strokeWidth="3.5" />
              <text x={x} y={24} fill="#ef4444" fontSize="25" fontWeight="bold" textAnchor="middle">
                {f.name}
              </text>
              <Isolator x={x} y={60} />
              <CircuitBreaker x={x} y={105} id={`${f.id}_CB`} label="CB" />
              <Isolator x={x} y={150} />
              <FeederTelemetryBox x={x} y={180} id={f.id} slaveID={f.slaveID} />
            </g>
          );
        })}

        {/* ======================================================= */}
        {/* TRANSFORMERS IN MIDDLE */}
        {/* ======================================================= */}
        {TRANSFORMERS.map((p, idx) => {
          const x = 1350 + idx * 260;
          return (
            <g key={p.id}>
              <line x1={x} y1="300" x2={x} y2="700" stroke="#eab308" strokeWidth="4.5" />
              
              <Isolator x={x} y={340} />
              <CircuitBreaker x={x} y={375} id={`${p.id}_HV_CB`} label="132kV" />
              
              <SingleSideTransformerBox x={x} y={405} sideLabel={`${p.name} HV Side`} sideKey={p.hvKey} slaveID={p.hvSlave} strokeColor="#38bdf8" />
              
              <TransformerSymbol x={x} y={525} label={p.name} cap={p.cap} />
              
              <SingleSideTransformerBox x={x} y={575} sideLabel={`${p.name} LV Side`} sideKey={p.lvKey} slaveID={p.lvSlave} strokeColor="#4ade80" />
              
              <CircuitBreaker x={x} y={660} id={`${p.id}_LV_CB`} label="33kV" />
              <Isolator x={x} y={690} />
            </g>
          );
        })}

        {/* 132kV RIGHT FEEDERS */}
        {FEEDERS_132KV_RIGHT.map((f, idx) => {
          const x = 2250 + idx * 190;
          return (
            <g key={f.id}>
              <line x1={x} y1="30" x2={x} y2="300" stroke="#3b82f6" strokeWidth="3.5" />
              <text x={x} y={24} fill="#ef4444" fontSize="25" fontWeight="bold" textAnchor="middle">
                {f.name}
              </text>
              <Isolator x={x} y={60} />
              <CircuitBreaker x={x} y={105} id={`${f.id}_CB`} label="CB" />
              <Isolator x={x} y={150} />
              <FeederTelemetryBox x={x} y={180} id={f.id} slaveID={f.slaveID} />
            </g>
          );
        })}

        {/* ======================================================= */}
        {/* 33 KV MAIN BUSBAR */}
        {/* ======================================================= */}
        <line x1="20" y1="700" x2="3580" y2="700" stroke="#ef4444" strokeWidth="8" />
        
        <text x="35" y="680" fill="#ef4444" fontSize="22" fontWeight="bold">
          33 KV MAIN BUSBAR (Volts: {telemetry['33KV_BUS_V']} kV)
        </text>

        {/* 33kV OUTGOING FEEDERS (Includes Kukkaladhoddi) */}
        {FEEDERS_33KV.map((f, idx) => {
          const x = 70 + idx * 200;
          return (
            <g key={f.id}>
              <line x1={x} y1="700" x2={x} y2="1010" stroke="#ef4444" strokeWidth="3.5" />
              <Isolator x={x} y={740} />
              <CircuitBreaker x={x} y={780} id={`${f.id}_CB`} label="CB" />
              <Isolator x={x} y={820} />
              <FeederTelemetryBox x={x} y={850} id={f.id} slaveID={f.slaveID} />
              <text x={x} y={985} fill="#fca5a5" fontSize="22" fontWeight="bold" textAnchor="middle">
                {f.name}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
