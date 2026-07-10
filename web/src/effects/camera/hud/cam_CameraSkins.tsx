import React from "react";
import {
  RecBadge, Timecode, Battery,
  FocusReticle, GridLines, Vignette, FilmGrain,
} from "../components/HudPrimitives.js";
import type { CameraUIConfig } from "../../types/index.js";

// ─── Shared skin props ────────────────────────────────────────────────────────

export interface SkinProps {
  config: CameraUIConfig;
  frame:  number;
  fps:    number;
  width:  number;
  height: number;
}

// ══════════════════════════════════════════════════════════════════════════════
// PHONE SKIN  (iOS / Android viewfinder)
// ══════════════════════════════════════════════════════════════════════════════

export const PhoneSkin: React.FC<SkinProps> = ({ config, frame, fps, width, height }) => {
  const mono: React.CSSProperties = {
    fontFamily: "-apple-system, 'SF Pro Display', Helvetica, sans-serif",
    fontSize:   13,
    color:      "#fff",
    textShadow: "0 1px 3px rgba(0,0,0,0.8)",
  };

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
      {/* Top bar */}
      <div style={{
        ...mono, position: "absolute", top: 18, left: 0, right: 0,
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "0 20px",
      }}>
        <RecBadge isRecording={config.isRecording} frame={frame} fps={fps} color="#ff3b30" />
        <Timecode frame={frame} fps={fps} override={config.timecodeOverride} />
        {config.showBattery && <Battery level={config.batteryLevel} />}
      </div>

      {/* Exposure strip (bottom-left) */}
      {config.showExposure && (
        <div style={{
          ...mono, position: "absolute", bottom: 22, left: 20, fontSize: 11,
          display: "flex", flexDirection: "column", gap: 2,
        }}>
          <span>ISO 800</span>
          <span>1/120s</span>
          <span>ƒ/1.8</span>
        </div>
      )}

      {/* Zoom indicator */}
      <div style={{
        ...mono, position: "absolute", bottom: 22, left: "50%",
        transform: "translateX(-50%)", fontSize: 15, fontWeight: 600,
      }}>
        1×
      </div>

      {/* Storage indicator */}
      <div style={{
        ...mono, position: "absolute", bottom: 22, right: 20, fontSize: 11,
        textAlign: "right",
      }}>
        <div>4K · 30fps</div>
        <div style={{ color: "#8e8e93" }}>14:32 left</div>
      </div>

      {/* Focus reticle — animates between two positions */}
      {config.showFocus && (
        <FocusReticle
          x={0.5 + Math.sin(frame * 0.008) * 0.04}
          y={0.5 + Math.cos(frame * 0.006) * 0.03}
          size={Math.min(width, height) * 0.12}
          locked={frame > fps * 1.2}
          color="#fff"
          frame={frame}
        />
      )}

      {/* Exposure slider line */}
      <div style={{
        position: "absolute", right: 68, top: "25%", bottom: "25%",
        width: 1, background: "rgba(255,255,255,0.25)",
      }}>
        <div style={{
          position: "absolute", top: "40%",
          left: -6, width: 13,
          borderTop: "1px solid #ff9500",
        }}>
          <div style={{
            width: 13, height: 13, borderRadius: "50%",
            border: "1.5px solid #ff9500",
            background: "transparent",
            marginTop: -7, marginLeft: -1,
          }} />
        </div>
      </div>

      {config.showGrid   && <GridLines />}
      {config.showVignette && <Vignette strength={0.45} />}
      <FilmGrain intensity={config.grain} frame={frame} />
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// ACTION CAM SKIN  (GoPro-style)
// ══════════════════════════════════════════════════════════════════════════════

export const ActionSkin: React.FC<SkinProps> = ({ config, frame, fps, width, height }) => {
  const mono: React.CSSProperties = {
    fontFamily: "'Courier New', monospace",
    fontSize:   12,
    color:      "#fff",
    textShadow: "0 0 4px rgba(0,0,0,0.9)",
    fontWeight: 700,
  };

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
      {/* Heavy top bar with GoPro-style black band */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 36,
        background: "rgba(0,0,0,0.6)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 12px",
      }}>
        <RecBadge isRecording={config.isRecording} frame={frame} fps={fps} color="#ff3b30" style={mono} />
        <div style={{ ...mono, display: "flex", gap: 14, alignItems: "center" }}>
          <span>4K</span>
          <span>60fps</span>
          <span>WIDE</span>
        </div>
        {config.showBattery && <Battery level={config.batteryLevel} color="#fff" style={mono} />}
      </div>

      {/* Bottom bar */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: 30,
        background: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 12px",
      }}>
        {config.showTimecode && (
          <Timecode frame={frame} fps={fps} style={{ ...mono, fontSize: 11 }} />
        )}
        <span style={{ ...mono, fontSize: 11 }}>PROT ON · EIS ON</span>
        <span style={{ ...mono, fontSize: 11, color: "#4cd964" }}>GPS ●</span>
      </div>

      {/* Wide-angle barrel corners */}
      <div style={{ position: "absolute", inset: 0 }}>
        {[
          { top: 40, left: 8 },  { top: 40, right: 8 },
          { bottom: 34, left: 8 }, { bottom: 34, right: 8 },
        ].map((pos, i) => (
          <div key={i} style={{
            position: "absolute", width: 16, height: 16,
            border: "1.5px solid rgba(255,255,255,0.4)",
            borderRadius: 2,
            ...pos,
          }} />
        ))}
      </div>

      {/* Horizon level indicator */}
      <div style={{
        position: "absolute", bottom: 44, left: "50%",
        transform: "translateX(-50%)",
        display: "flex", alignItems: "center", gap: 4,
      }}>
        <div style={{ width: 30, height: 1, background: "rgba(255,255,255,0.4)" }} />
        <div style={{ width: 6, height: 6, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.6)" }} />
        <div style={{ width: 30, height: 1, background: "rgba(255,255,255,0.4)" }} />
      </div>

      {/* Extreme barrel distortion vignette */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%)",
      }} />
      <FilmGrain intensity={config.grain * 0.6} frame={frame} />
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// BROADCAST / CINEMA SKIN
// ══════════════════════════════════════════════════════════════════════════════

export const BroadcastSkin: React.FC<SkinProps> = ({ config, frame, fps, width, height }) => {
  const mono: React.CSSProperties = {
    fontFamily: "'Courier New', 'Lucida Console', monospace",
    fontSize:   11,
    color:      config.hudColor ?? "#00ff00",
    textShadow: `0 0 6px ${config.hudColor ?? "#00ff00"}`,
    letterSpacing: "0.1em",
  };

  const green = config.hudColor ?? "#00ff00";

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
      {/* Top left: camera ID + REC */}
      <div style={{ position: "absolute", top: 12, left: 14 }}>
        <div style={{ ...mono, fontSize: 10, marginBottom: 2 }}>CAM A  CH01</div>
        <RecBadge
          isRecording={config.isRecording} frame={frame} fps={fps}
          color={green} style={{ ...mono, fontSize: 11 }}
        />
      </div>

      {/* Top right: timecode */}
      {config.showTimecode && (
        <div style={{ position: "absolute", top: 12, right: 14, textAlign: "right" }}>
          <div style={{ ...mono, fontSize: 10, marginBottom: 2 }}>TC</div>
          <Timecode frame={frame} fps={fps} style={{ ...mono, fontSize: 13 }} />
        </div>
      )}

      {/* Safe area markers (90% action, 80% title) */}
      {[0.9, 0.8].map((pct, i) => (
        <div key={i} style={{
          position: "absolute",
          top:    `${(1 - pct) / 2 * 100}%`,
          left:   `${(1 - pct) / 2 * 100}%`,
          right:  `${(1 - pct) / 2 * 100}%`,
          bottom: `${(1 - pct) / 2 * 100}%`,
          border: `1px dashed rgba(0,255,0,${i === 0 ? 0.25 : 0.12})`,
          pointerEvents: "none",
        }} />
      ))}

      {/* Centre cross */}
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)" }}>
        <div style={{ position: "relative", width: 20, height: 20 }}>
          <div style={{ position: "absolute", top: 9, left: 0, right: 0, height: 1, background: `rgba(0,255,0,0.4)` }} />
          <div style={{ position: "absolute", left: 9, top: 0, bottom: 0, width: 1, background: `rgba(0,255,0,0.4)` }} />
        </div>
      </div>

      {/* Exposure / iris bottom left */}
      {config.showExposure && (
        <div style={{ position: "absolute", bottom: 14, left: 14 }}>
          <div style={mono}>IRIS  F5.6</div>
          <div style={mono}>ISO   800</div>
          <div style={mono}>SHTR  1/50</div>
          <div style={mono}>WB    5600K</div>
        </div>
      )}

      {/* Waveform placeholder bottom right */}
      <div style={{ position: "absolute", bottom: 14, right: 14, textAlign: "right" }}>
        {config.showBattery && <Battery level={config.batteryLevel} color={green} style={{ ...mono, justifyContent: "flex-end" }} />}
        <div style={{ ...mono, marginTop: 4 }}>CLIP 0047</div>
        <div style={mono}>SSD  ██████░░ 78%</div>
      </div>

      {/* Focus box */}
      {config.showFocus && (
        <FocusReticle
          x={0.5} y={0.45}
          size={Math.min(width, height) * 0.18}
          locked={true}
          color={green}
          frame={frame}
        />
      )}

      {config.showGrid && <GridLines color={`rgba(0,255,0,0.15)`} />}
      {config.showVignette && <Vignette strength={0.35} />}
      <FilmGrain intensity={config.grain} frame={frame} />
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// CCTV SKIN
// ══════════════════════════════════════════════════════════════════════════════

export const CCTVSkin: React.FC<SkinProps> = ({ config, frame, fps, width, height }) => {
  const mono: React.CSSProperties = {
    fontFamily: "'Courier New', monospace",
    fontSize:   11,
    color:      "#e0e0e0",
    letterSpacing: "0.05em",
  };

  // Simulate occasional signal dropout
  const dropout = Math.sin(frame * 0.23) > 0.97;

  return (
    <div style={{
      position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden",
      filter: dropout ? "brightness(0.3) contrast(2)" : "none",
      transition: "filter 0.05s",
    }}>
      {/* Scanlines (always on for CCTV) */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "repeating-linear-gradient(0deg, rgba(0,0,0,0.18) 0px, rgba(0,0,0,0.18) 1px, transparent 1px, transparent 2px)",
        backgroundSize: "100% 2px",
      }} />

      {/* Top left: camera label */}
      <div style={{ position: "absolute", top: 8, left: 10 }}>
        <div style={{ ...mono, background: "rgba(0,0,0,0.55)", padding: "1px 6px" }}>
          CAM 04  LOBBY
        </div>
      </div>

      {/* Top right: date + time */}
      <div style={{ position: "absolute", top: 8, right: 10 }}>
        <div style={{ ...mono, background: "rgba(0,0,0,0.55)", padding: "1px 6px", textAlign: "right" }}>
          {formatCCTVDate()}
        </div>
        <div style={{ ...mono, background: "rgba(0,0,0,0.55)", padding: "1px 6px", textAlign: "right", marginTop: 2 }}>
          <Timecode frame={frame} fps={fps} style={{ ...mono, padding: 0, background: "none" }} />
        </div>
      </div>

      {/* Bottom: channel + REC */}
      <div style={{
        position: "absolute", bottom: 8, left: 0, right: 0,
        display: "flex", justifyContent: "space-between",
        padding: "0 10px",
      }}>
        <div style={{ ...mono, background: "rgba(0,0,0,0.55)", padding: "1px 6px" }}>
          CH04  NTSC  D1
        </div>
        <RecBadge
          isRecording={config.isRecording} frame={frame} fps={fps}
          color="#ff3b30"
          style={{ ...mono, background: "rgba(0,0,0,0.55)", padding: "1px 6px" }}
        />
      </div>

      {/* Motion detection box — appears periodically */}
      {frame % (fps * 4) < fps * 1.5 && (
        <div style={{
          position: "absolute", left: "30%", top: "25%",
          width: "40%", height: "50%",
          border: "1px solid rgba(255,200,0,0.7)",
        }}>
          <div style={{
            position: "absolute", top: -12, left: 0,
            ...mono, color: "#ffc800", fontSize: 9,
            background: "rgba(0,0,0,0.6)", padding: "0 3px",
          }}>
            MOTION
          </div>
        </div>
      )}

      {/* Signal quality bar */}
      <div style={{ position: "absolute", bottom: 28, right: 10 }}>
        <div style={{ display: "flex", gap: 1, alignItems: "flex-end" }}>
          {[3,5,7,9,11].map((h, i) => (
            <div key={i} style={{
              width: 3, height: h,
              background: i < 4 ? "#4cd964" : "rgba(255,255,255,0.2)",
            }} />
          ))}
        </div>
      </div>

      {/* Heavy vignette */}
      <Vignette strength={0.65} />

      {/* Noise */}
      <FilmGrain intensity={config.grain * 1.8} frame={frame} />

      {/* Horizontal noise band (rolls up) */}
      <div style={{
        position: "absolute", left: 0, right: 0,
        top: `${((frame * 1.2) % 100)}%`,
        height: 3,
        background: "rgba(255,255,255,0.04)",
        filter: "blur(1px)",
      }} />
    </div>
  );
};

function formatCCTVDate(): string {
  const now = new Date();
  const d   = String(now.getDate()).padStart(2, "0");
  const m   = String(now.getMonth() + 1).padStart(2, "0");
  const y   = now.getFullYear();
  return `${y}-${m}-${d}`;
}
