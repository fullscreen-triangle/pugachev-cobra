import React, { useMemo } from "react";
import type { SpeedUIConfig } from "../types/index.js";

interface SpeedDisplayProps {
  speed:     number;   // 0–100
  direction: number;   // +1 or -1
  config:    SpeedUIConfig;
  frame:     number;
}

// ─── SpeedBar ─────────────────────────────────────────────────────────────────

const SpeedBar: React.FC<SpeedDisplayProps> = ({ speed, direction, config, frame }) => {
  const { color, accentColor, fontFamily, size, label, showDirection } = config;
  const barW  = size * 3;
  const barH  = size * 0.18;
  const pct   = speed / 100;

  // Pulse the accent colour on high speed
  const pulse = speed > 80
    ? `rgba(255,102,0,${0.6 + Math.sin(frame * 0.4) * 0.4})`
    : accentColor;

  return (
    <div style={{ fontFamily, userSelect: "none" }}>
      {/* Label */}
      <div style={{
        fontSize: size * 0.22, color, letterSpacing: "0.2em",
        fontWeight: 700, marginBottom: size * 0.08, opacity: 0.7,
      }}>
        {label}
        {showDirection && (
          <span style={{ marginLeft: 8, color: accentColor }}>
            {direction > 0 ? "→" : "←"}
          </span>
        )}
      </div>

      {/* Bar track */}
      <div style={{
        width: barW, height: barH,
        background: "rgba(255,255,255,0.12)",
        borderRadius: barH / 2,
        overflow: "hidden",
        position: "relative",
      }}>
        {/* Fill */}
        <div style={{
          width: `${pct * 100}%`, height: "100%",
          background: pct > 0.8
            ? `linear-gradient(90deg, ${accentColor}, ${pulse})`
            : `linear-gradient(90deg, ${accentColor}88, ${accentColor})`,
          borderRadius: barH / 2,
          transition: "width 0.06s linear",
          boxShadow: pct > 0.5 ? `0 0 ${pct * 12}px ${accentColor}88` : "none",
        }} />

        {/* Tick marks at 25, 50, 75 */}
        {[0.25, 0.5, 0.75].map(t => (
          <div key={t} style={{
            position: "absolute", top: 0, bottom: 0,
            left: `${t * 100}%`, width: 1,
            background: "rgba(255,255,255,0.15)",
          }} />
        ))}
      </div>

      {/* Numeric value */}
      <div style={{
        fontSize: size * 0.28, color: speed > 80 ? pulse : color,
        fontWeight: 900, marginTop: size * 0.06,
        fontVariantNumeric: "tabular-nums",
        textShadow: speed > 80 ? `0 0 20px ${accentColor}` : "none",
        transition: "color 0.1s",
      }}>
        {Math.round(speed).toString().padStart(3, "\u2007")}
        <span style={{ fontSize: size * 0.15, marginLeft: 4, opacity: 0.6, fontWeight: 400 }}>
          / 100
        </span>
      </div>
    </div>
  );
};

// ─── SpeedDial ────────────────────────────────────────────────────────────────

const SpeedDial: React.FC<SpeedDisplayProps> = ({ speed, config, frame }) => {
  const { accentColor, color, size } = config;
  const r       = size * 0.9;
  const cx      = r + 4;
  const cy      = r + 4;
  const total   = 2 * Math.PI * r;
  const startA  = Math.PI * 0.75;  // 135°
  const sweepA  = Math.PI * 1.5;   // 270° sweep
  const filled  = (speed / 100) * sweepA;
  const pulse   = speed > 80 ? `0 0 ${12 + Math.sin(frame * 0.4) * 6}px ${accentColor}` : "none";

  // SVG arc helpers
  const arc = (angle: number) => ({
    x: cx + r * Math.cos(angle - Math.PI / 2),
    y: cy + r * Math.sin(angle - Math.PI / 2),
  });

  const trackEnd = arc(startA + sweepA);
  const fillEnd  = arc(startA + filled);
  const largeArc = (angle: number) => angle > Math.PI ? 1 : 0;

  const trackD = `M ${arc(startA).x} ${arc(startA).y} A ${r} ${r} 0 ${largeArc(sweepA)} 1 ${trackEnd.x} ${trackEnd.y}`;
  const fillD  = filled > 0.01
    ? `M ${arc(startA).x} ${arc(startA).y} A ${r} ${r} 0 ${largeArc(filled)} 1 ${fillEnd.x} ${fillEnd.y}`
    : "";

  return (
    <div style={{ position: "relative", width: (r + 4) * 2, height: (r + 4) * 2 }}>
      <svg width={(r + 4) * 2} height={(r + 4) * 2} style={{ filter: speed > 80 ? `drop-shadow(${pulse})` : "none" }}>
        <path d={trackD} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={size * 0.12} strokeLinecap="round" />
        {fillD && (
          <path d={fillD} fill="none" stroke={accentColor} strokeWidth={size * 0.12} strokeLinecap="round" />
        )}
      </svg>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        paddingTop: size * 0.3,
      }}>
        <span style={{
          color, fontFamily: config.fontFamily,
          fontSize: size * 0.5, fontWeight: 900,
          fontVariantNumeric: "tabular-nums",
        }}>
          {Math.round(speed)}
        </span>
        <span style={{ color, opacity: 0.5, fontSize: size * 0.18, fontFamily: config.fontFamily }}>
          {config.label}
        </span>
      </div>
    </div>
  );
};

// ─── SpeedDigital ─────────────────────────────────────────────────────────────

const SpeedDigital: React.FC<SpeedDisplayProps> = ({ speed, config, frame }) => {
  const { color, accentColor, fontFamily, size } = config;
  // Flip-style random digits for high speed effect
  const jitter = speed > 85 && frame % 3 === 0
    ? Math.floor(Math.random() * 10)
    : null;

  const displayed = jitter !== null
    ? String(Math.round(speed)).slice(0, -1) + jitter
    : Math.round(speed).toString().padStart(3, "0");

  return (
    <div style={{
      fontFamily: "'Courier New', monospace",
      background: "rgba(0,0,0,0.75)",
      border: `1px solid ${accentColor}55`,
      borderRadius: 4,
      padding: `${size * 0.1}px ${size * 0.2}px`,
      display: "inline-block",
    }}>
      <div style={{
        fontSize: size * 0.18, color, opacity: 0.6,
        letterSpacing: "0.25em", marginBottom: 2,
      }}>
        {config.label}
      </div>
      <div style={{
        fontSize: size * 0.7, color: accentColor,
        fontWeight: 900, letterSpacing: "0.05em",
        fontVariantNumeric: "tabular-nums",
        textShadow: `0 0 20px ${accentColor}88`,
        lineHeight: 1,
      }}>
        {displayed}
      </div>
    </div>
  );
};

// ─── SpeedDisplay (router) ────────────────────────────────────────────────────

export const SpeedDisplay: React.FC<SpeedDisplayProps> = (props) => {
  const { config } = props;

  const positioned: React.CSSProperties = {
    position: "absolute",
    left:     `${config.position.x * 100}%`,
    top:      `${config.position.y * 100}%`,
    pointerEvents: "none",
  };

  return (
    <div style={positioned}>
      {config.style === "bar"         && <SpeedBar    {...props} />}
      {config.style === "dial"        && <SpeedDial   {...props} />}
      {config.style === "digital"     && <SpeedDigital {...props} />}
      {config.style === "bar+digital" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <SpeedBar     {...props} />
          <SpeedDigital {...props} />
        </div>
      )}
    </div>
  );
};
