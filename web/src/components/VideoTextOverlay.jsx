import { useState, useEffect, useRef, useCallback } from 'react';

// Text transitions keyed to video time.
// Each entry defines the word shown, when it appears, how long, and which animation.
const MBENDE_NARRATIVE = [
  { text: 'MBENDE',     startTime: 0,  duration: 3, transition: 'scale',  fontSize: 180, fontWeight: 900, letterSpacing: 20, color: '#ffffff' },
  { text: 'JERUSAREMA', startTime: 3,  duration: 3, transition: 'slide',  fontSize: 140, fontWeight: 800, letterSpacing: 15, color: '#ffd700' },
  { text: 'ZIMBABWE',   startTime: 6,  duration: 3, transition: 'fade',   fontSize: 160, fontWeight: 900, letterSpacing: 25, color: '#00ff00' },
  { text: 'TRADITION',  startTime: 9,  duration: 3, transition: 'rotate', fontSize: 150, fontWeight: 800, letterSpacing: 18, color: '#ff4444' },
  { text: 'DANCE',      startTime: 12, duration: 3, transition: 'wave',   fontSize: 200, fontWeight: 900, letterSpacing: 30, color: '#ffffff' },
  { text: 'HERITAGE',   startTime: 15, duration: 4, transition: 'glitch', fontSize: 140, fontWeight: 800, letterSpacing: 20, color: '#00ffff' },
];

function smoothstep(t) {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

function getTransitionStyle(effect, progress, isEntering) {
  const t = isEntering ? progress : 1 - progress;
  const e = smoothstep(t);

  const base = {
    fontSize: `${effect.fontSize}px`,
    fontWeight: effect.fontWeight,
    letterSpacing: `${effect.letterSpacing}px`,
    WebkitTextStroke: `2px ${effect.color}`,
    color: 'transparent',
    fontFamily: 'Impact, "Arial Black", sans-serif',
    textTransform: 'uppercase',
  };

  switch (effect.transition) {
    case 'fade':
      return { ...base, opacity: e };
    case 'slide':
      return { ...base, opacity: e, transform: `translateX(${(1 - e) * (isEntering ? -120 : 120)}px)` };
    case 'scale':
      return { ...base, opacity: e, transform: `scale(${0.5 + e * 0.5})` };
    case 'rotate':
      return { ...base, opacity: e, transform: `rotate(${(1 - e) * (isEntering ? -180 : 180)}deg) scale(${0.7 + e * 0.3})` };
    case 'wave': {
      const wave = Math.sin(progress * Math.PI * 3) * (1 - e) * 20;
      return { ...base, opacity: e, transform: `translateY(${wave}px) scale(${0.8 + e * 0.2})` };
    }
    case 'glitch': {
      const gx = (Math.random() - 0.5) * 20 * (1 - e);
      const gy = (Math.random() - 0.5) * 20 * (1 - e);
      return { ...base, opacity: e, transform: `translate(${gx}px,${gy}px)`, filter: `hue-rotate(${(1 - e) * 360}deg)` };
    }
    default:
      return { ...base, opacity: e };
  }
}

export default function VideoTextOverlay({ videoSrc, narrative = MBENDE_NARRATIVE }) {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration]       = useState(0);
  const [playing, setPlaying]         = useState(false);
  const videoRef  = useRef(null);
  const rafRef    = useRef(null);

  const tick = useCallback(() => {
    if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    if (playing) {
      rafRef.current = requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(rafRef.current);
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing, tick]);

  const toggle = () => {
    if (!videoRef.current) return;
    if (playing) { videoRef.current.pause(); setPlaying(false); }
    else         { videoRef.current.play();  setPlaying(true);  }
  };

  const seek = (e) => {
    if (!videoRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct  = (e.clientX - rect.left) / rect.width;
    videoRef.current.currentTime = pct * duration;
  };

  // Find active narrative entry
  const idx = narrative.reduce((best, ef, i) =>
    currentTime >= ef.startTime ? i : best, -1);
  const currentEffect = idx >= 0 ? narrative[idx] : null;
  const nextEffect    = currentEffect ? narrative[idx + 1] : null;

  let progress = 1, isEntering = true;
  if (currentEffect) {
    const elapsed = currentTime - currentEffect.startTime;
    const td = 0.5;
    if (elapsed < td) {
      progress = elapsed / td; isEntering = true;
    } else if (nextEffect && currentTime >= nextEffect.startTime - td) {
      progress = (nextEffect.startTime - currentTime) / td; isEntering = false;
    }
  }

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex flex-col gap-0 h-full bg-black rounded overflow-hidden">
      {/* Video + text overlay */}
      <div className="relative flex-1 bg-black" style={{ minHeight: 0 }}>
        <video
          ref={videoRef}
          src={videoSrc}
          className="w-full h-full object-cover"
          onLoadedMetadata={e => setDuration(e.currentTarget.duration)}
          onEnded={() => setPlaying(false)}
          loop={false}
        />

        {/* Centred text overlay using mix-blend-mode screen (video shows through stroked letters) */}
        {currentEffect && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{ mixBlendMode: 'screen' }}
          >
            <span style={getTransitionStyle(currentEffect, progress, isEntering)}>
              {currentEffect.text}
            </span>
          </div>
        )}

        {/* Play button hint when paused */}
        {!playing && (
          <button
            onClick={toggle}
            className="absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity hover:bg-black/40"
          >
            <svg className="w-16 h-16 text-white opacity-80" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
        )}
      </div>

      {/* Controls */}
      <div className="flex-shrink-0 bg-black/80 px-3 py-2 flex items-center gap-3">
        <button
          onClick={toggle}
          className="text-white hover:text-gray-300 transition-colors flex-shrink-0"
        >
          {playing
            ? <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            : <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          }
        </button>

        {/* Scrub bar */}
        <div
          className="flex-1 h-1.5 bg-white/20 rounded-full cursor-pointer relative"
          onClick={seek}
        >
          <div className="h-full bg-white rounded-full transition-none" style={{ width: `${pct}%` }} />
        </div>

        <span className="text-white/60 text-xs font-mono flex-shrink-0">
          {currentTime.toFixed(1)}s / {duration.toFixed(1)}s
        </span>
      </div>

      {/* Narrative strip — shows which word is active */}
      <div className="flex-shrink-0 bg-black/60 px-3 py-2 flex gap-2 overflow-x-auto">
        {narrative.map((ef, i) => (
          <button
            key={i}
            onClick={() => { if (videoRef.current) videoRef.current.currentTime = ef.startTime; }}
            className={`text-xs font-mono px-2 py-1 rounded flex-shrink-0 transition-colors border
              ${i === idx
                ? 'border-white/60 bg-white/10 text-white'
                : 'border-white/10 text-white/40 hover:text-white/70'}`}
            style={{ borderColor: i === idx ? ef.color : undefined }}
          >
            {ef.text}
          </button>
        ))}
      </div>
    </div>
  );
}
