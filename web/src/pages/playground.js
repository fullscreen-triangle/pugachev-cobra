import Head from "next/head";
import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import TransitionEffect from "@/components/TransitionEffect";

const VideoTextOverlay = dynamic(
  () => import("@/components/VideoTextOverlay"),
  { ssr: false }
);
const MotionTrail = dynamic(() => import("@/components/MotionTrail"), {
  ssr: false,
});

// ---- DSL examples ----------------------------------------------------

const DEFAULT_SOURCE = `scene water_reveal {
  clip("footage/product.mp4", at=0s, for=15s)
    |> acts_like("water surface")
    |> brand(product_palette, confidence=0.85)
    |> render(motion)

  goal {
    behaviour: "water surface"
    coherence: >= 0.5
    duration: < 20s
  }

  brand product_palette {
    invariant: "brand blue dominant"
    confidence: 0.85
  }
}`;

const MBENDE_SOURCE = `scene mbende_advert {
  // tracks wired automatically from the timeline below
  // video track → clip, audio track → audio()

  audio(mute_video: true)

  at 0s-5s:  detect(person), boxes()
  at 2s-5s:  text("MBENDE JERUSAREMA", color: "#ffffff", style: scale)
  at 5s-10s: bw()
  every 5s for 0.8s: glitch(intensity: 0.4)

  goal {
    behaviour: "ceremonial dance"
    coherence: >= 0.5
  }
}`;

const DRUM_SOURCE = `scene drum_impact {
  clip("footage/impact.mp4", at=2s, for=8s)
    |> acts_like("drum skin")
    |> compose(
         oscillate(axis=radial, decay=0.3),
         propagate(origin=center, speed=0.8)
       )
    |> render(motion)

  goal {
    behaviour: "drum skin"
    coherence: >= 0.5
  }
}`;

const EXAMPLES = [
  { label: "Mbende", source: MBENDE_SOURCE },
  { label: "Water Surface", source: DEFAULT_SOURCE },
  { label: "Drum Skin", source: DRUM_SOURCE },
];

// ---- constants -------------------------------------------------------

const TRACK_HEIGHT = 48; // px per track lane
const PX_PER_SEC = 60; // px per second on timeline
const MIN_CLIP_SEC = 0.5;

// ---- helpers ---------------------------------------------------------

function formatSize(kb) {
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
}
function basename(url) {
  return url ? url.split("/").pop() : "";
}
function ext(url) {
  return (url || "").split(".").pop().toLowerCase();
}
function colorForType(type) {
  return type === "audio"
    ? "bg-pink-500/80 border-pink-400"
    : "bg-violet-500/80 border-violet-400";
}
function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(1).padStart(4, "0");
  return `${m}:${s}`;
}

// ---- Timeline state --------------------------------------------------

let _nextId = 1;
function makeItem(file, startSec = 0) {
  return {
    id: _nextId++,
    url: file.url,
    name: basename(file.url),
    type: file.type, // 'video' | 'audio'
    startSec,
    durationSec: file.type === "audio" ? 180 : 30, // default durations
    sizeKb: file.sizeKb,
  };
}

// ---- sub-components --------------------------------------------------

function DiagBadge({ level }) {
  const s = {
    error: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
    warning:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
    info: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  };
  return (
    <span
      className={`text-xs font-mono px-1.5 py-0.5 rounded uppercase font-bold ${
        s[level] ?? s.info
      }`}
    >
      {level}
    </span>
  );
}

function PowerMeter({ pct }) {
  const color =
    pct >= 60 ? "bg-green-500" : pct >= 35 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className="text-xs font-mono w-10 text-right dark:text-light">
        {pct.toFixed(1)}%
      </span>
    </div>
  );
}

function NSChip({ ns }) {
  const c = {
    spatial:
      "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
    photometric:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    temporal:
      "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
    acoustic:
      "bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300",
  };
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
        c[ns] ?? "bg-gray-100 text-gray-700"
      }`}
    >
      {ns}
    </span>
  );
}

function MediaIcon({ type, className = "w-4 h-4 flex-shrink-0" }) {
  return type === "audio" ? (
    <svg
      className={`${className} text-pink-500`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z"
      />
    </svg>
  ) : (
    <svg
      className={`${className} text-violet-500`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 10l4.553-2.069A1 1 0 0121 8.882v6.236a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"
      />
    </svg>
  );
}

// ---- Media bin (left panel) ------------------------------------------

function MediaBin({ onDrop, onPreview, selectedUrl }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    fetch("/api/media")
      .then((r) => r.json())
      .then((d) => {
        setFiles(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const visible = files.filter(
    (f) =>
      (filter === "all" || f.type === filter) &&
      (!search || f.name.toLowerCase().includes(search.toLowerCase()))
  );

  const handleDragStart = (e, file) => {
    e.dataTransfer.setData("mee/file", JSON.stringify(file));
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div className="flex flex-col h-full select-none">
      <div className="px-2 py-2 border-b border-dark/10 dark:border-light/10 space-y-1.5">
        <p className="text-xs font-mono font-bold text-dark dark:text-light px-1">
          Media
        </p>
        <input
          type="text"
          placeholder="search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full text-xs font-mono px-2 py-1 rounded border border-dark/20 dark:border-light/20
                     bg-transparent text-dark dark:text-light placeholder-dark/30 dark:placeholder-light/30
                     focus:outline-none focus:border-primary dark:focus:border-primaryDark"
        />
        <div className="flex gap-1">
          {["all", "video", "audio"].map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`text-xs px-2 py-0.5 rounded font-mono transition-colors
                ${
                  filter === t
                    ? "bg-primary dark:bg-primaryDark text-light"
                    : "text-dark/50 dark:text-light/50 hover:text-dark dark:hover:text-light"
                }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {loading && (
          <p className="px-3 py-4 text-xs font-mono text-dark/40 dark:text-light/40">
            scanning…
          </p>
        )}
        {!loading && visible.length === 0 && (
          <p className="px-3 py-4 text-xs font-mono text-dark/40 dark:text-light/40">
            no files
          </p>
        )}
        {visible.map((f) => (
          <div
            key={f.url}
            draggable
            onDragStart={(e) => handleDragStart(e, f)}
            onClick={() => onPreview(f)}
            className={`group flex items-start gap-1.5 px-2 py-1.5 cursor-grab active:cursor-grabbing transition-colors
              ${
                f.url === selectedUrl
                  ? "bg-primary/10 dark:bg-primaryDark/10"
                  : "hover:bg-dark/5 dark:hover:bg-light/5"
              }`}
          >
            <MediaIcon type={f.type} />
            <div className="flex-1 min-w-0">
              <p
                className="text-xs font-mono text-dark dark:text-light truncate leading-tight"
                title={f.name}
              >
                {basename(f.url)}
              </p>
              <p className="text-xs text-dark/40 dark:text-light/40 font-mono">
                {formatSize(f.sizeKb)}
              </p>
            </div>
            <button
              title="Add to timeline"
              onClick={(e) => {
                e.stopPropagation();
                onDrop(f);
              }}
              className="opacity-0 group-hover:opacity-100 text-xs px-1 py-0.5 rounded font-mono flex-shrink-0
                         bg-primary/10 dark:bg-primaryDark/10 text-primary dark:text-primaryDark transition-opacity"
            >
              +
            </button>
          </div>
        ))}
      </div>

      <div className="px-2 py-1.5 border-t border-dark/10 dark:border-light/10 text-xs font-mono text-dark/30 dark:text-light/30">
        drag to timeline
      </div>
    </div>
  );
}

// ---- Timeline --------------------------------------------------------

const RULER_INTERVAL = 5; // seconds between ruler marks

function TimelineRuler({ totalSec, scrollLeft }) {
  const marks = [];
  for (let s = 0; s <= totalSec; s += RULER_INTERVAL) {
    marks.push(s);
  }
  return (
    <div
      className="relative h-6 flex-shrink-0 border-b border-dark/10 dark:border-light/10"
      style={{ width: totalSec * PX_PER_SEC }}
    >
      {marks.map((s) => (
        <div
          key={s}
          className="absolute top-0 flex flex-col items-center"
          style={{ left: s * PX_PER_SEC }}
        >
          <div className="w-px h-2 bg-dark/20 dark:bg-light/20 mt-1" />
          <span
            className="text-xs font-mono text-dark/40 dark:text-light/40"
            style={{ fontSize: 9 }}
          >
            {formatTime(s)}
          </span>
        </div>
      ))}
    </div>
  );
}

function TrackLane({
  track,
  items,
  onItemMove,
  onItemResize,
  onItemRemove,
  onItemClick,
  selectedId,
  totalSec,
}) {
  const laneRef = useRef(null);
  const dragState = useRef(null); // { itemId, type: 'move'|'resize', startX, startSec }

  const trackItems = items.filter((it) => it.type === track.type);

  const onMouseDown = (e, item, action) => {
    e.stopPropagation();
    dragState.current = {
      itemId: item.id,
      action,
      startX: e.clientX,
      startSec: item.startSec,
      startDuration: item.durationSec,
    };
    const onMove = (me) => {
      if (!dragState.current) return;
      const dx = me.clientX - dragState.current.startX;
      const ds = dx / PX_PER_SEC;
      if (dragState.current.action === "move") {
        const newStart = Math.max(0, dragState.current.startSec + ds);
        onItemMove(item.id, newStart);
      } else {
        const newDur = Math.max(
          MIN_CLIP_SEC,
          dragState.current.startDuration + ds
        );
        onItemResize(item.id, newDur);
      }
    };
    const onUp = () => {
      dragState.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <div
      ref={laneRef}
      className="relative border-b border-dark/10 dark:border-light/10"
      style={{ height: TRACK_HEIGHT, width: totalSec * PX_PER_SEC }}
    >
      {/* lane background grid */}
      {Array.from({ length: Math.ceil(totalSec / RULER_INTERVAL) }).map(
        (_, i) => (
          <div
            key={i}
            className="absolute top-0 bottom-0 border-l border-dark/5 dark:border-light/5"
            style={{ left: i * RULER_INTERVAL * PX_PER_SEC }}
          />
        )
      )}

      {trackItems.map((item) => (
        <div
          key={item.id}
          onClick={() => onItemClick(item)}
          onMouseDown={(e) => onMouseDown(e, item, "move")}
          className={`absolute top-1 rounded border cursor-grab active:cursor-grabbing flex items-center px-2 gap-1
                      ${colorForType(item.type)}
                      ${selectedId === item.id ? "ring-2 ring-white/60" : ""}`}
          style={{
            left: item.startSec * PX_PER_SEC,
            width: Math.max(item.durationSec * PX_PER_SEC - 2, 20),
            height: TRACK_HEIGHT - 8,
          }}
        >
          <MediaIcon
            type={item.type}
            className="w-3 h-3 flex-shrink-0 text-white/80"
          />
          <span className="text-xs font-mono text-white/90 truncate flex-1 leading-tight select-none">
            {item.name}
          </span>
          {/* right-edge resize handle */}
          <div
            className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize rounded-r hover:bg-white/20"
            onMouseDown={(e) => {
              e.stopPropagation();
              onMouseDown(e, item, "resize");
            }}
          />
          {/* remove */}
          <button
            className="absolute top-0.5 right-3 text-white/50 hover:text-white text-xs leading-none"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onItemRemove(item.id);
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

const TRACK_DEFS = [
  { id: "video", label: "Video", type: "video" },
  { id: "audio", label: "Audio", type: "audio" },
];

function Timeline({
  items,
  onAddItem,
  onItemMove,
  onItemResize,
  onItemRemove,
  onItemClick,
  selectedId,
  playheadSec,
  onScrub,
}) {
  const scrollRef = useRef(null);
  const totalSec =
    Math.max(60, ...items.map((it) => it.startSec + it.durationSec)) + 10;

  // Drop zone
  const onDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };
  const onDrop = (e, trackType) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData("mee/file");
    if (!raw) return;
    const file = JSON.parse(raw);
    if (file.type !== trackType) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x =
      e.clientX - rect.left + (scrollRef.current?.scrollLeft ?? 0) - LABEL_W;
    const startSec = Math.max(0, x / PX_PER_SEC);
    onAddItem(file, startSec);
  };

  const LABEL_W = 56; // px for track label column

  const onRulerClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    onScrub(x / PX_PER_SEC);
  };

  return (
    <div className="flex flex-col h-full select-none bg-dark/[0.015] dark:bg-light/[0.015]">
      {/* Header row */}
      <div
        className="flex flex-shrink-0 border-b border-dark/10 dark:border-light/10"
        style={{ height: 24 }}
      >
        <div
          className="flex-shrink-0 border-r border-dark/10 dark:border-light/10"
          style={{ width: LABEL_W }}
        />
        <div className="flex-1 overflow-hidden relative" onClick={onRulerClick}>
          <div className="overflow-x-hidden" ref={scrollRef}>
            <TimelineRuler totalSec={totalSec} />
          </div>
          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 w-px bg-primary dark:bg-primaryDark pointer-events-none z-10"
            style={{ left: playheadSec * PX_PER_SEC }}
          />
        </div>
      </div>

      {/* Track lanes */}
      <div className="flex-1 overflow-auto">
        {TRACK_DEFS.map((track) => (
          <div key={track.id} className="flex" style={{ height: TRACK_HEIGHT }}>
            {/* Label */}
            <div
              className="flex-shrink-0 flex items-center justify-center border-r border-b border-dark/10 dark:border-light/10"
              style={{ width: LABEL_W }}
            >
              <span className="text-xs font-mono text-dark/50 dark:text-light/50 rotate-0">
                {track.label}
              </span>
            </div>
            {/* Drop lane */}
            <div
              className="flex-1 overflow-hidden relative"
              onDragOver={onDragOver}
              onDrop={(e) => onDrop(e, track.type)}
            >
              <TrackLane
                track={track}
                items={items}
                onItemMove={onItemMove}
                onItemResize={onItemResize}
                onItemRemove={onItemRemove}
                onItemClick={onItemClick}
                selectedId={selectedId}
                totalSec={totalSec}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Preview panel ---------------------------------------------------

function PreviewPanel({ file, previewMode, setPreviewMode }) {
  if (!file) {
    return (
      <div className="flex-1 flex items-center justify-center text-dark/30 dark:text-light/30 text-xs font-mono">
        select a file to preview
      </div>
    );
  }

  const isVideo = file.type === "video";
  const isAudio = file.type === "audio";

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {isVideo && (
        <div className="flex border-b border-dark/10 dark:border-light/10 flex-shrink-0">
          {[
            { id: "plain", label: "Video" },
            { id: "text", label: "Text" },
            { id: "trail", label: "Trail" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setPreviewMode(tab.id)}
              className={`px-3 py-1.5 text-xs font-mono border-b-2 transition-colors
                ${
                  previewMode === tab.id
                    ? "border-primary dark:border-primaryDark text-primary dark:text-primaryDark"
                    : "border-transparent text-dark/50 dark:text-light/50 hover:text-dark dark:hover:text-light"
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}
      <div className="flex-1 min-h-0 p-2">
        {isAudio && (
          <div className="flex flex-col gap-3 p-4">
            <p className="text-xs font-mono text-dark dark:text-light truncate">
              {basename(file.url)}
            </p>
            <audio src={file.url} controls className="w-full" />
          </div>
        )}
        {isVideo && previewMode === "plain" && (
          <video
            src={file.url}
            controls
            className="w-full h-full object-contain rounded"
          />
        )}
        {isVideo && previewMode === "text" && (
          <VideoTextOverlay videoSrc={file.url} />
        )}
        {isVideo && previewMode === "trail" && (
          <MotionTrail videoSrc={file.url} mode="pixel" />
        )}
      </div>
    </div>
  );
}

// ---- Main component --------------------------------------------------

export default function Playground() {
  const [source, setSource] = useState(MBENDE_SOURCE);
  const [result, setResult] = useState(null);
  const [summary, setSummary] = useState(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const [compiler, setCompiler] = useState(null);

  // Timeline state
  const [timelineItems, setTimelineItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [playheadSec, setPlayheadSec] = useState(0);

  // Right panel
  const [rightTab, setRightTab] = useState("preview");
  const [previewFile, setPreviewFile] = useState(null);
  const [previewMode, setPreviewMode] = useState("plain");

  const textareaRef = useRef(null);

  // Lazy-load compiler on first editor focus
  const loadCompiler = useCallback(() => {
    if (compiler) return;
    import("../lib/mee/index").then((mod) => setCompiler(mod));
  }, [compiler]);

  const runCompile = useCallback(() => {
    if (!compiler) return;
    setIsCompiling(true);
    setTimeout(() => {
      try {
        const res = compiler.compile(source);
        const sum = compiler.summarise(res);
        setResult(res);
        setSummary(sum);
      } catch (e) {
        setResult({
          ok: false,
          scene: null,
          ir: null,
          remotion: null,
          diagnostics: [
            {
              level: "error",
              code: "InternalError",
              message: String(e.message),
            },
          ],
        });
        setSummary(null);
      }
      setIsCompiling(false);
    }, 0);
  }, [source, compiler]);

  useEffect(() => {
    if (!compiler) return;
    const id = setTimeout(runCompile, 600);
    return () => clearTimeout(id);
  }, [source, compiler, runCompile]);

  // Timeline actions
  const addItem = useCallback((file, startSec = 0) => {
    setTimelineItems((prev) => [...prev, makeItem(file, startSec)]);
  }, []);

  const moveItem = useCallback((id, startSec) => {
    setTimelineItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, startSec } : it))
    );
  }, []);

  const resizeItem = useCallback((id, durationSec) => {
    setTimelineItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, durationSec } : it))
    );
  }, []);

  const removeItem = useCallback((id) => {
    setTimelineItems((prev) => prev.filter((it) => it.id !== id));
    setSelectedItem((prev) => (prev?.id === id ? null : prev));
  }, []);

  const selectItem = useCallback((item) => {
    setSelectedItem(item);
    setPreviewFile({ url: item.url, type: item.type });
    setPreviewMode("plain");
    setRightTab("preview");
  }, []);

  const errors = result?.diagnostics.filter((d) => d.level === "error") ?? [];
  const warnings =
    result?.diagnostics.filter((d) => d.level === "warning") ?? [];

  // Infer scene duration from timeline for display
  const sceneDuration = useMemo(() => {
    if (!timelineItems.length) return null;
    return Math.max(...timelineItems.map((it) => it.startSec + it.durationSec));
  }, [timelineItems]);

  return (
    <>
      <Head>
        <title>MEE Playground</title>
        <meta
          name="description"
          content="Media Effect Encoder — behavioural effect chain compiler"
        />
      </Head>
      <TransitionEffect />

      {/* VS Code–style outer layout: header + body (columns) + bottom (timeline) */}
      <div className="w-full h-screen bg-light dark:bg-dark flex flex-col overflow-hidden">
        {/* ── Title bar ── */}
        <div className="px-4 py-2 border-b border-dark/10 dark:border-light/10 flex items-center justify-between gap-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-bold text-dark dark:text-light tracking-tight">
              MEE Playground
            </h1>
            <span className="text-xs text-dark/30 dark:text-light/30 font-mono hidden sm:inline">
              behavioural isomorphism compiler
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {EXAMPLES.map((ex) => (
              <button
                key={ex.label}
                onClick={() => setSource(ex.source)}
                className="text-xs px-2.5 py-1 rounded border border-dark/20 dark:border-light/20
                           text-dark/70 dark:text-light/70 hover:border-primary dark:hover:border-primaryDark
                           hover:text-primary dark:hover:text-primaryDark transition-colors font-mono"
              >
                {ex.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Three-column body ── */}
        <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
          {/* Left — media bin */}
          <div className="w-52 flex-shrink-0 border-r border-dark/10 dark:border-light/10 flex flex-col overflow-hidden">
            <MediaBin
              onDrop={addItem}
              onPreview={(f) => {
                setPreviewFile(f);
                setPreviewMode("plain");
                setRightTab("preview");
              }}
              selectedUrl={previewFile?.url}
            />
          </div>

          {/* Center — DSL editor */}
          <div className="flex-1 flex flex-col border-r border-dark/10 dark:border-light/10 min-w-0">
            {/* Editor tab bar */}
            <div
              className="px-4 py-1.5 bg-dark/5 dark:bg-light/5 border-b border-dark/10 dark:border-light/10
                            flex items-center justify-between flex-shrink-0"
            >
              <span className="text-xs font-mono text-dark/60 dark:text-light/60">
                scene.mee
              </span>
              <div className="flex items-center gap-2">
                {!compiler && (
                  <span className="text-xs text-dark/40 dark:text-light/40 font-mono">
                    click to load
                  </span>
                )}
                {isCompiling && (
                  <span className="text-xs text-primary dark:text-primaryDark font-mono animate-pulse">
                    compiling…
                  </span>
                )}
                {result && !isCompiling && (
                  <span
                    className={`text-xs font-mono font-bold
                    ${
                      result.ok
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {result.ok ? "✓ ok" : `✗ ${errors.length} err`}
                  </span>
                )}
              </div>
            </div>
            <textarea
              ref={textareaRef}
              value={source}
              onChange={(e) => setSource(e.target.value)}
              onFocus={loadCompiler}
              spellCheck={false}
              className="flex-1 p-4 font-mono text-sm bg-transparent text-dark dark:text-light resize-none focus:outline-none leading-relaxed"
              style={{ tabSize: 2 }}
            />
          </div>

          {/* Right — preview + diagnostics + IR */}
          <div className="w-80 flex-shrink-0 flex flex-col min-w-0">
            {/* Summary bar */}
            {summary && (
              <div className="px-3 py-2 bg-dark/5 dark:bg-light/5 border-b border-dark/10 dark:border-light/10 flex flex-col gap-1 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-dark dark:text-light truncate">
                    {summary.sceneName}
                  </span>
                  {summary.coherent ? (
                    <span className="text-xs text-green-600 dark:text-green-400 font-mono">
                      ✓ coherent
                    </span>
                  ) : (
                    <span className="text-xs text-yellow-600 dark:text-yellow-400 font-mono">
                      ⚠ weak
                    </span>
                  )}
                </div>
                <PowerMeter pct={summary.compositePowerPct} />
                <div className="flex items-center gap-1 flex-wrap">
                  {summary.namespaces.map((ns) => (
                    <NSChip key={ns} ns={ns} />
                  ))}
                  <span className="text-xs text-dark/40 dark:text-light/40 font-mono ml-1">
                    {summary.primitiveCount}p
                  </span>
                </div>
              </div>
            )}

            {/* Tab bar */}
            <div className="flex border-b border-dark/10 dark:border-light/10 flex-shrink-0">
              {[
                { id: "preview", label: "Preview" },
                {
                  id: "diagnostics",
                  label: `Diag${
                    errors.length + warnings.length > 0
                      ? ` (${errors.length + warnings.length})`
                      : ""
                  }`,
                },
                { id: "ir", label: "IR" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setRightTab(tab.id)}
                  className={`flex-1 py-1.5 text-xs font-mono border-b-2 transition-colors
                    ${
                      rightTab === tab.id
                        ? "border-primary dark:border-primaryDark text-primary dark:text-primaryDark"
                        : "border-transparent text-dark/50 dark:text-light/50 hover:text-dark dark:hover:text-light"
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {rightTab === "preview" && (
              <PreviewPanel
                file={previewFile}
                previewMode={previewMode}
                setPreviewMode={setPreviewMode}
              />
            )}
            {rightTab === "diagnostics" && (
              <div className="flex-1 overflow-auto p-3 flex flex-col gap-2">
                {(result?.diagnostics ?? []).length === 0 && (
                  <p className="text-xs font-mono text-dark/40 dark:text-light/40">
                    No diagnostics.
                  </p>
                )}
                {(result?.diagnostics ?? []).map((d, i) => (
                  <div
                    key={i}
                    className="flex gap-2 items-start p-2 rounded bg-dark/5 dark:bg-light/5"
                  >
                    <DiagBadge level={d.level} />
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-xs font-mono text-dark/50 dark:text-light/50">
                        {d.code}
                      </span>
                      <span className="text-xs text-dark dark:text-light leading-snug">
                        {d.message}
                      </span>
                      {d.line != null && (
                        <span className="text-xs font-mono text-dark/30 dark:text-light/30">
                          line {d.line}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {rightTab === "ir" && (
              <pre className="flex-1 overflow-auto p-3 text-xs font-mono text-dark/80 dark:text-light/80 leading-relaxed whitespace-pre-wrap">
                {result?.ir
                  ? JSON.stringify(result.ir, null, 2)
                  : "// No IR yet"}
              </pre>
            )}
          </div>
        </div>

        {/* ── Bottom — Timeline (like VS Code terminal) ── */}
        <div
          className="flex-shrink-0 border-t border-dark/10 dark:border-light/10"
          style={{ height: 160 }}
        >
          {/* Timeline header */}
          <div className="flex items-center justify-between px-3 py-1 bg-dark/5 dark:bg-light/5 border-b border-dark/10 dark:border-light/10">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-bold text-dark/60 dark:text-light/60 uppercase tracking-widest">
                Timeline
              </span>
              {sceneDuration && (
                <span className="text-xs font-mono text-dark/40 dark:text-light/40">
                  {formatTime(sceneDuration)}
                </span>
              )}
              {timelineItems.length > 0 && (
                <span className="text-xs font-mono text-dark/40 dark:text-light/40">
                  {timelineItems.filter((i) => i.type === "video").length}V ·{" "}
                  {timelineItems.filter((i) => i.type === "audio").length}A
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-dark/40 dark:text-light/40">
              {playheadSec > 0 && <span>{formatTime(playheadSec)}</span>}
              {timelineItems.length === 0 && (
                <span>drag media from the left panel</span>
              )}
            </div>
          </div>

          {/* Timeline body */}
          <div style={{ height: 160 - 28 }}>
            <Timeline
              items={timelineItems}
              onAddItem={addItem}
              onItemMove={moveItem}
              onItemResize={resizeItem}
              onItemRemove={removeItem}
              onItemClick={selectItem}
              selectedId={selectedItem?.id}
              playheadSec={playheadSec}
              onScrub={setPlayheadSec}
            />
          </div>
        </div>

        {/* Status bar */}
        <div
          className="px-4 py-1 border-t border-dark/10 dark:border-light/10 flex items-center justify-between
                        text-xs font-mono text-dark/40 dark:text-light/40 flex-shrink-0"
        >
          <div className="flex items-center gap-3">
            <span>MEE v0.1</span>
            {summary && (
              <>
                <span>·</span>
                <span>κ {summary.compositePowerPct}%</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            {errors.length > 0 && (
              <span className="text-red-500">{errors.length} err</span>
            )}
            {warnings.length > 0 && (
              <span className="text-yellow-500">{warnings.length} warn</span>
            )}
            {result?.ok && <span className="text-green-500">ready</span>}
          </div>
        </div>
      </div>
    </>
  );
}
