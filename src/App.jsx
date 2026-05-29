import { useState, useEffect, useRef } from "react";

// ─── Boden, Sweden — Stegra plant coordinates ───────────────────────────────
const BODEN_LAT = 65.83;
const BODEN_LON = 21.68;

const C = {
  green: "#2d6a4f",
  greenL: "#52b788",
  greenPale: "#d8f3dc",
  teal: "#1b4332",
  amber: "#e9c46a",
  red: "#e76f51",
  gray: "#6b7280",
  grayLight: "#f3f4f6",
  dark: "#111827",
  border: "#e5e7eb",
};

// ─── Real weather fetch from Open-Meteo (no API key, CORS-safe) ──────────────
async function fetchBodenWeather() {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${BODEN_LAT}&longitude=${BODEN_LON}` +
    `&current=wind_speed_10m,wind_direction_10m,direct_radiation,temperature_2m` +
    `&wind_speed_unit=ms` +
    `&timezone=Europe%2FStockholm`;
  const res = await fetch(url);
  const json = await res.json();
  return json.current;
}

// ─── Simulated plant state ───────────────────────────────────────────────────
function usePlantData() {
  const [plant, setPlant] = useState({
    h2: 142.3,
    grid: 410,
    steel: 1284,
    co2Saved: 3.41,
    lines: [98, 92, 87, 100, 76],
    emHistory: [],
    alerts: [],
  });

  // Real weather state
  const [weather, setWeather] = useState(null);
  const [weatherStatus, setWeatherStatus] = useState("loading"); // loading | ok | error

  // Fetch real weather once on mount, refresh every 10 min
  useEffect(() => {
    const load = async () => {
      try {
        setWeatherStatus("loading");
        const w = await fetchBodenWeather();
        setWeather(w);
        setWeatherStatus("ok");
      } catch {
        setWeatherStatus("error");
      }
    };
    load();
    const t = setInterval(load, 10 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  // Simulated plant tick
  const tick = useRef(0);
  useEffect(() => {
    const interval = setInterval(() => {
      tick.current++;
      setPlant((prev) => {
        const h2 = +(prev.h2 + (Math.random() - 0.5) * 4).toFixed(1);
        const grid = Math.round(Math.min(490, Math.max(320, prev.grid + (Math.random() - 0.5) * 15)));
        const steel = Math.round(prev.steel + Math.random() * 2.5);
        const co2Saved = +(prev.co2Saved + Math.random() * 0.0018).toFixed(4);
        const lines = prev.lines.map((v) =>
          Math.min(100, Math.max(62, Math.round(v + (Math.random() - 0.48) * 3)))
        );

        const alerts = [];
        if (lines[4] < 72) alerts.push({ id: "L5", msg: "Line 5 — reduced throughput detected", level: "warn" });
        if (h2 < 130) alerts.push({ id: "H2", msg: "H₂ flow below nominal (130 kg/min)", level: "error" });

        const emHistory = [...prev.emHistory];
        if (tick.current % 4 === 0) {
          emHistory.push({
            t: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
            trad: +(1.7 + Math.random() * 0.5).toFixed(2),
            green: +(0.018 + Math.random() * 0.018).toFixed(3),
          });
          if (emHistory.length > 14) emHistory.shift();
        }

        return { h2, grid, steel, co2Saved, lines, emHistory, alerts };
      });
    }, 1300);
    return () => clearInterval(interval);
  }, []);

  return { plant, weather, weatherStatus };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Gauge({ value, max = 100, label, unit, color = C.green }) {
  const pct = Math.min(1, value / max);
  const r = 32, cx = 40, cy = 40;
  const toR = (d) => (d * Math.PI) / 180;
  const sA = -210, tA = 240;
  const eA = sA + pct * tA;
  const ts = { x: cx + r * Math.cos(toR(sA)), y: cy + r * Math.sin(toR(sA)) };
  const te = { x: cx + r * Math.cos(toR(sA + tA)), y: cy + r * Math.sin(toR(sA + tA)) };
  const fe = { x: cx + r * Math.cos(toR(eA)), y: cy + r * Math.sin(toR(eA)) };
  const fl = pct * tA > 180 ? 1 : 0;
  const disp = Number.isInteger(value) ? value : value.toFixed(1);
  return (
    <div style={{ textAlign: "center" }}>
      <svg viewBox="0 0 80 70" style={{ width: 85 }}>
        <path d={`M${ts.x.toFixed(1)} ${ts.y.toFixed(1)} A${r} ${r} 0 1 1 ${te.x.toFixed(1)} ${te.y.toFixed(1)}`}
          fill="none" stroke="#e5e7eb" strokeWidth="6" strokeLinecap="round" />
        {pct > 0 && (
          <path d={`M${ts.x.toFixed(1)} ${ts.y.toFixed(1)} A${r} ${r} 0 ${fl} 1 ${fe.x.toFixed(1)} ${fe.y.toFixed(1)}`}
            fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" />
        )}
        <text x="40" y="43" textAnchor="middle" fontSize="11" fontWeight="700" fill={C.dark}>{disp}</text>
        <text x="40" y="54" textAnchor="middle" fontSize="7" fill={C.gray}>{unit}</text>
      </svg>
      <div style={{ fontSize: 10, color: C.gray, marginTop: -2 }}>{label}</div>
    </div>
  );
}

function LineBar({ label, health }) {
  const color = health >= 90 ? C.green : health >= 75 ? C.amber : C.red;
  return (
    <div style={{ marginBottom: 9 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
        <span style={{ color: C.dark, fontWeight: 500 }}>{label}</span>
        <span style={{ color, fontWeight: 600 }}>{health}%</span>
      </div>
      <div style={{ background: C.grayLight, borderRadius: 4, height: 5, overflow: "hidden" }}>
        <div style={{ width: `${health}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.9s ease" }} />
      </div>
    </div>
  );
}

function EmissionsChart({ history }) {
  if (history.length < 2)
    return <div style={{ height: 80, display: "flex", alignItems: "center", justifyContent: "center", color: C.gray, fontSize: 12 }}>Collecting data…</div>;
  const W = 560, H = 80, pad = 10;
  const tradVals = history.map((d) => d.trad);
  const greenVals = history.map((d) => d.green);
  const maxV = Math.max(...tradVals) * 1.15;
  const xStep = (W - pad * 2) / (history.length - 1);
  const yS = (v) => pad + ((maxV - v) / maxV) * (H - pad * 2);
  const pts = (arr) => arr.map((v, i) => `${(pad + i * xStep).toFixed(1)},${yS(v).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", display: "block" }}
      role="img" aria-label="Emissions comparison chart: green H2 route vs traditional blast furnace">
      <polyline points={pts(tradVals)} fill="none" stroke={C.red} strokeWidth="1.5" strokeDasharray="5 3" strokeLinecap="round" />
      <polyline points={pts(greenVals)} fill="none" stroke={C.greenL} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// ─── Real weather card ───────────────────────────────────────────────────────
function WeatherCard({ weather, status }) {
  const card = {
    background: "#fff",
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    padding: "14px 16px",
  };

  // Wind → approximate H2 electrolysis potential (simple linear scale)
  const windPower = weather ? Math.min(100, Math.round((weather.wind_speed_10m / 15) * 100)) : null;
  const solarW = weather ? Math.round(weather.direct_radiation) : null;
  const windDir = weather ? weather.wind_direction_10m : null;
  const temp = weather ? weather.temperature_2m.toFixed(1) : null;

  const compassDir = (deg) => {
    const dirs = ["N","NE","E","SE","S","SW","W","NW"];
    return dirs[Math.round(deg / 45) % 8];
  };

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: C.teal, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          🛰️ Live — Boden Weather
        </div>
        <div style={{ fontSize: 10, color: status === "ok" ? C.green : status === "loading" ? C.amber : C.red, fontWeight: 600 }}>
          {status === "ok" ? "● Real-time" : status === "loading" ? "● Fetching…" : "● Unavailable"}
        </div>
      </div>

      {status === "ok" && weather ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div style={{ background: C.grayLight, borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ fontSize: 10, color: C.gray, marginBottom: 3 }}>Wind speed · {compassDir(windDir)}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: C.dark }}>{weather.wind_speed_10m.toFixed(1)}<span style={{ fontSize: 11, fontWeight: 400, color: C.gray, marginLeft: 3 }}>m/s</span></div>
            </div>
            <div style={{ background: C.grayLight, borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ fontSize: 10, color: C.gray, marginBottom: 3 }}>Solar irradiance</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: C.dark }}>{solarW}<span style={{ fontSize: 11, fontWeight: 400, color: C.gray, marginLeft: 3 }}>W/m²</span></div>
            </div>
          </div>

          <div style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
              <span style={{ color: C.dark }}>Wind → renewable H₂ potential</span>
              <span style={{ color: C.green, fontWeight: 600 }}>{windPower}%</span>
            </div>
            <div style={{ background: C.grayLight, borderRadius: 4, height: 6, overflow: "hidden" }}>
              <div style={{ width: `${windPower}%`, height: "100%", background: C.green, borderRadius: 4, transition: "width 1s ease" }} />
            </div>
          </div>

          <div style={{ fontSize: 10, color: C.gray, display: "flex", justifyContent: "space-between" }}>
            <span>Temperature: {temp}°C</span>
            <span>Source: Open-Meteo API · Boden 65.83°N 21.68°E</span>
          </div>
        </>
      ) : status === "loading" ? (
        <div style={{ fontSize: 12, color: C.gray, textAlign: "center", padding: "20px 0" }}>Fetching live data from Open-Meteo…</div>
      ) : (
        <div style={{ fontSize: 12, color: C.red, textAlign: "center", padding: "20px 0" }}>Could not reach Open-Meteo API. Check connection.</div>
      )}
    </div>
  );
}

// ─── Main App ────────────────────────────────────────────────────────────────
export default function App() {
  const { plant, weather, weatherStatus } = usePlantData();
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const card = {
    background: "#fff",
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    padding: "14px 16px",
  };

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, sans-serif", background: "#f8faf8", minHeight: "100vh", paddingBottom: 32 }}>

      {/* Header */}
      <div style={{ background: C.teal, color: "#fff", padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 10, opacity: 0.65, letterSpacing: "0.1em", textTransform: "uppercase" }}>Stegra · Boden Plant · 65.83°N 21.68°E</div>
          <div style={{ fontSize: 17, fontWeight: 700, marginTop: 2 }}>🌿 Green Steel Operations Dashboard</div>
        </div>
        <div style={{ textAlign: "right", fontSize: 11, opacity: 0.85 }}>
          <div>🟢 Plant data: simulated &nbsp;|&nbsp; 🛰️ Weather: live</div>
          <div style={{ marginTop: 2 }}>{now.toLocaleTimeString("en-GB")} CET</div>
        </div>
      </div>

      <div style={{ padding: "16px 20px" }}>

        {/* Alerts */}
        {plant.alerts.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            {plant.alerts.map((a) => (
              <div key={a.id} style={{
                background: a.level === "error" ? "#fff1f0" : "#fffbeb",
                border: `1px solid ${a.level === "error" ? "#fca5a5" : "#fcd34d"}`,
                borderRadius: 8, padding: "8px 12px", fontSize: 12,
                color: a.level === "error" ? "#991b1b" : "#92400e",
                marginBottom: 6, display: "flex", gap: 8, alignItems: "center"
              }}>
                {a.level === "error" ? "⚠️" : "ℹ️"} {a.msg}
              </div>
            ))}
          </div>
        )}

        {/* KPI row */}
        <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
          {[
            { label: "Steel today", value: plant.steel.toLocaleString(), unit: "t", delta: "↑ accumulating" },
            { label: "CO₂ avoided", value: plant.co2Saved.toFixed(3), unit: "kt", delta: "97.8% vs blast furnace" },
            { label: "H₂ flow rate", value: plant.h2.toFixed(1), unit: "kg/min", delta: plant.h2 >= 130 ? "nominal" : "⚠ below threshold" },
            { label: "Grid draw", value: plant.grid, unit: "MW", delta: "100% fossil-free" },
          ].map((m) => (
            <div key={m.label} style={{ ...card, flex: 1, minWidth: 120 }}>
              <div style={{ fontSize: 10, color: C.gray, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>{m.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: C.dark }}>{m.value}<span style={{ fontSize: 11, fontWeight: 400, color: C.gray, marginLeft: 3 }}>{m.unit}</span></div>
              <div style={{ fontSize: 10, color: C.green, marginTop: 2 }}>{m.delta}</div>
            </div>
          ))}
        </div>

        {/* Middle row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>

          {/* Process gauges */}
          <div style={card}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.teal, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>
              Process gauges <span style={{ fontWeight: 400, color: C.gray }}>(simulated)</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-around" }}>
              <Gauge value={plant.h2} max={200} label="H₂ flow" unit="kg/min" color={C.green} />
              <Gauge value={Math.round((plant.h2 / 200) * 100)} max={100} label="Efficiency" unit="%" color={C.greenL} />
              <Gauge value={Math.min(100, Math.round((plant.grid / 500) * 100))} max={100} label="Grid load" unit="%" color={C.amber} />
            </div>
          </div>

          {/* Production lines */}
          <div style={card}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.teal, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>
              Production line health <span style={{ fontWeight: 400, color: C.gray }}>(simulated)</span>
            </div>
            {plant.lines.map((h, i) => (
              <LineBar key={i} label={`Line ${i + 1}`} health={h} />
            ))}
          </div>
        </div>

        {/* Real weather card — full width */}
        <div style={{ marginBottom: 12 }}>
          <WeatherCard weather={weather} status={weatherStatus} />
        </div>

        {/* Emissions chart */}
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.teal, textTransform: "uppercase", letterSpacing: "0.04em" }}>Emissions comparison <span style={{ fontWeight: 400, color: C.gray }}>(simulated)</span></div>
              <div style={{ fontSize: 10, color: C.gray, marginTop: 2 }}>t CO₂ per tonne of steel — green H₂ route vs traditional blast furnace</div>
            </div>
            <div style={{ background: C.greenPale, borderRadius: 7, padding: "4px 10px", fontSize: 11, color: C.teal, fontWeight: 600 }}>~98% lower CO₂</div>
          </div>
          <EmissionsChart history={plant.emHistory} />
          <div style={{ display: "flex", gap: 20, marginTop: 6, fontSize: 10 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ display: "inline-block", width: 18, height: 0, borderTop: `2px dashed ${C.red}` }} />
              <span style={{ color: C.gray }}>Traditional (~1.9 avg)</span>
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ display: "inline-block", width: 18, height: 2, background: C.greenL, borderRadius: 1 }} />
              <span style={{ color: C.gray }}>Green H₂ route (~0.03 avg)</span>
            </span>
          </div>
        </div>

        {/* Data sources legend */}
        <div style={{ marginTop: 12, padding: "10px 14px", background: "#fff", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 10, color: C.gray }}>
          <strong style={{ color: C.dark }}>Data sources:</strong>&nbsp;
          🛰️ <strong>Wind speed, solar irradiance, temperature</strong> — <a href="https://open-meteo.com" style={{ color: C.green }}>Open-Meteo API</a>, real-time, Boden Sweden (65.83°N 21.68°E) &nbsp;|&nbsp;
          🔬 <strong>All plant metrics</strong> (H₂ flow, steel output, CO₂, line health) — simulated to demonstrate sensor integration patterns
        </div>

        <div style={{ marginTop: 10, fontSize: 10, color: C.gray, textAlign: "center" }}>
          Built by [Your Name] · Green Steel Plant Monitor · Proof-of-concept ·{" "}
          <a href="https://github.com/yourhandle/green-steel-dashboard" style={{ color: C.green }}>View on GitHub</a>
        </div>
      </div>
    </div>
  );
}