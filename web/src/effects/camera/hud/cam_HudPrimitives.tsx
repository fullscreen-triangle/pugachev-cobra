import React from "react";

// ─── RecBadge ─────────────────────────────────────────────────────────────────

interface RecBadgeProps {
  isRecording: boolean;
  frame:       number;
  fps:         number;
  color?:      string;
  style?:      React.CSSProperties;
}

export const RecBadge: React.FC<RecBadgeProps> = ({
  isRecording, frame, fps, color = "#ff3b30", style
}) => {
  // Blink every 30 frames when recording
  const visible = !isRecording || Math.floor(frame / (fps * 0.75)) % 2 === 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, ...style }}>
      <div style={{
        width: 8, height: 8, borderRadius: "50%",
        background: visible ? color : "transparent",
        boxShadow: visible ? `0 0 6px ${color}` : "none",
        transition: "background 0.1s",
      }} />
      <span style={{ color, fontWeight: 700, letterSpacing: "0.12em", fontSize: "inherit" }}>
        {isRecording ? "REC" : "STBY"}
      </span>
    </div>
  );
};

// ─── Timecode ─────────────────────────────────────────────────────────────────

interface TimecodeProps {
  frame:    number;
  fps:      number;
  color?:   string;
  override?: string;
  style?:   React.CSSProperties;
}

export const Timecode: React.FC<TimecodeProps> = ({
  frame, fps, color = "#fff", override, style
}) => {
  const tc = override ?? frameToTimecode(frame, fps);
  return (
    <span style={{ color, fontVariantNumeric: "tabular-nums", letterSpacing: "0.05em", ...style }}>
      {tc}
    </span>
  );
};

function frameToTimecode(frame: number, fps: number): string {
  const totalSecs = Math.floor(frame / fps);
  const f  = frame % fps;
  const s  = totalSecs % 60;
  const m  = Math.floor(totalSecs / 60) % 60;
  const h  = Math.floor(totalSecs / 3600);
  const pad = (n: number, d = 2) => String(n).padStart(d, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}:${pad(f)}`;
}

// ─── Battery ──────────────────────────────────────────────────────────────────

interface BatteryProps {
  level:  number;  // 0–1
  color?: string;
  style?: React.CSSProperties;
}

export const Battery: React.FC<BatteryProps> = ({ level, color = "#fff", style }) => {
  const pct   = Math.round(level * 100);
  const fillC = level < 0.2 ? "#ff3b30" : level < 0.4 ? "#ff9500" : color;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, ...style }}>
      <div style={{
        width: 22, height: 11, border: `1.5px solid ${color}`,
        borderRadius: 2, position: "relative", overflow: "visible",
      }}>
        {/* Terminal nub */}
        <div style={{
          position: "absolute", right: -4, top: "50%",
          transform: "translateY(-50%)",
          width: 3, height: 5, background: color, borderRadius: "0 1px 1px 0",
        }} />
        {/* Fill */}
        <div style={{
          position: "absolute", left: 1, top: 1, bottom: 1,
          width: `calc(${pct}% - 2px)`,
          background: fillC,
          borderRadius: 1,
          transition: "background 0.3s",
        }} />
      </div>
      <span style={{ color, fontSize: "0.85em" }}>{pct}%</span>
    </div>
  );
};

// ─── Focus Reticle ────────────────────────────────────────────────────────────

interface FocusReticleProps {
  x:       number;  // normalised 0-1
  y:       number;
  size?:   number;  // px
  locked?: boolean;
  color?:  string;
  frame?:  number;
  style?:  React.CSSProperties;
}

export const FocusReticle: React.FC<FocusReticleProps> = ({
  x, y, size = 60, locked = true, color = "#fff", frame = 0, style
}) => {
  // Hunting animation: slight size oscillation when not locked
  const huntScale = locked ? 1 : 1 + Math.sin(frame * 0.4) * 0.08;
  const s = size * huntScale;
  const cornerLen = s * 0.22;
  const corners = [
    { top: 0, left: 0,      borderTop: true,  borderLeft: true  },
    { top: 0, right: 0,     borderTop: true,  borderRight: true },
    { bottom: 0, left: 0,   borderBottom: true, borderLeft: true },
    { bottom: 0, right: 0,  borderBottom: true, borderRight: true },
  ];
  return (
    <div style={{
      position: "absolute",
      left: `${x * 100}%`,
      top:  `${y * 100}%`,
      transform: "translate(-50%, -50%)",
      width: s, height: s,
      ...style,
    }}>
      {corners.map((c, i) => (
        <div key={i} style={{
          position: "absolute",
          width: cornerLen, height: cornerLen,
          borderColor: locked ? "#39ff14" : color,
          borderStyle: "solid",
          borderWidth: 0,
          borderTopWidth:    c.borderTop    ? 1.5 : 0,
          borderLeftWidth:   c.borderLeft   ? 1.5 : 0,
          borderRightWidth:  c.borderRight  ? 1.5 : 0,
          borderBottomWidth: c.borderBottom ? 1.5 : 0,
          top:    "top"    in c ? 0 : undefined,
          bottom: "bottom" in c ? 0 : undefined,
          left:   "left"   in c ? 0 : undefined,
          right:  "right"  in c ? 0 : undefined,
          boxShadow: locked ? `0 0 4px #39ff14` : "none",
        }} />
      ))}
      {/* Centre dot */}
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        width: 3, height: 3, borderRadius: "50%",
        background: locked ? "#39ff14" : color,
        transform: "translate(-50%,-50%)",
      }} />
    </div>
  );
};

// ─── Grid lines (rule of thirds) ──────────────────────────────────────────────

export const GridLines: React.FC<{ color?: string }> = ({ color = "rgba(255,255,255,0.2)" }) => (
  <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
    {[1, 2].map(i => (
      <React.Fragment key={i}>
        <div style={{
          position: "absolute", top: 0, bottom: 0,
          left: `${(i / 3) * 100}%`, width: 1, background: color,
        }} />
        <div style={{
          position: "absolute", left: 0, right: 0,
          top: `${(i / 3) * 100}%`, height: 1, background: color,
        }} />
      </React.Fragment>
    ))}
  </div>
);

// ─── Vignette ─────────────────────────────────────────────────────────────────

export const Vignette: React.FC<{ strength?: number }> = ({ strength = 0.5 }) => (
  <div style={{
    position: "absolute", inset: 0, pointerEvents: "none",
    background: `radial-gradient(ellipse at center,
      transparent ${40 - strength * 20}%,
      rgba(0,0,0,${strength * 0.85}) 100%
    )`,
  }} />
);

// ─── Film grain (CSS canvas-based) ───────────────────────────────────────────

export const FilmGrain: React.FC<{ intensity?: number; frame?: number }> = ({
  intensity = 0.15, frame = 0
}) => {
  if (intensity <= 0) return null;
  // Animated via CSS filter + pseudo-random seed per frame
  const seed = (frame * 17 + 31) % 100;
  return (
    <div style={{
      position: "absolute", inset: 0, pointerEvents: "none",
      opacity: intensity,
      backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' seed='${seed}'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
      backgroundSize: "200px 200px",
      mixBlendMode: "overlay",
    }} />
  );
};
