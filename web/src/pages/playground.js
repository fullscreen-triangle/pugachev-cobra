import Head from "next/head";
import { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import TransitionEffect from "@/components/TransitionEffect";

// Load heavy preview components client-side only
const VideoTextOverlay = dynamic(() => import("@/components/VideoTextOverlay"), { ssr: false });
const MotionTrail      = dynamic(() => import("@/components/MotionTrail"),      { ssr: false });

// ---- example DSL scripts ---------------------------------------------

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
  clip("/albums/mbende.mp4", at=0s, for=162s)
    |> acts_like("ceremonial dance")
    |> detect(person)
    |> select(person)
    |> apply_to_selection {
         glow(color: "#ff6600", intensity: 0.6)
         draw_skeleton()
       }
    |> chromatic.aberration(amount: 0.3)
    |> degradation.grain(intensity: 0.25)
    |> godrays(sunColor: "#ff8800", samples: 30)
    |> bloom(intensity: 1.2)

  audio("/audio/Benga – Electro West [Dubstep Classic].mp3", at=0s)

  goal {
    behaviour: "ceremonial dance"
    coherence: >= 0.6
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
  { label: 'Mbende',       source: MBENDE_SOURCE  },
  { label: 'Water Surface', source: DEFAULT_SOURCE },
  { label: 'Drum Skin',     source: DRUM_SOURCE    },
];

// ---- helpers ---------------------------------------------------------

function formatSize(kb) {
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
}

function basename(url) { return url.split('/').pop(); }

function snippetFor(file) {
  return file.type === 'audio'
    ? `audio(${JSON.stringify(file.url)}, at=0s)`
    : `clip(${JSON.stringify(file.url)}, at=0s, for=10s)`;
}

// ---- sub-components --------------------------------------------------

function DiagBadge({ level }) {
  const s = {
    error:   'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
    info:    'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  };
  return <span className={`text-xs font-mono px-1.5 py-0.5 rounded uppercase font-bold ${s[level] ?? s.info}`}>{level}</span>;
}

function PowerMeter({ pct }) {
  const color = pct >= 60 ? 'bg-green-500' : pct >= 35 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${Math.min(pct,100)}%` }} />
      </div>
      <span className="text-xs font-mono w-12 text-right dark:text-light">{pct.toFixed(1)}%</span>
    </div>
  );
}

function NSChip({ ns }) {
  const c = {
    spatial:     'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300',
    photometric: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    temporal:    'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
    acoustic:    'bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300',
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c[ns] ?? 'bg-gray-100 text-gray-700'}`}>{ns}</span>;
}

// ---- Media panel -----------------------------------------------------

function MediaIcon({ type }) {
  return type === 'audio'
    ? <svg className="w-4 h-4 flex-shrink-0 text-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z"/></svg>
    : <svg className="w-4 h-4 flex-shrink-0 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.882v6.236a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/></svg>;
}

function MediaPanel({ onInsert, onSelect, selectedUrl }) {
  const [files, setFiles]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/media').then(r => r.json()).then(d => { setFiles(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const visible = files.filter(f =>
    (filter === 'all' || f.type === filter) &&
    (!search || f.name.toLowerCase().includes(search.toLowerCase()))
  );

  const videos = visible.filter(f => f.type === 'video');
  const audios  = visible.filter(f => f.type === 'audio');

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-dark/10 dark:border-light/10">
        <p className="text-xs font-mono font-bold text-dark dark:text-light mb-2">Media</p>
        <input
          type="text" placeholder="search…" value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full text-xs font-mono px-2 py-1 rounded border border-dark/20 dark:border-light/20
                     bg-transparent text-dark dark:text-light placeholder-dark/30 dark:placeholder-light/30
                     focus:outline-none focus:border-primary dark:focus:border-primaryDark mb-2"
        />
        <div className="flex gap-1">
          {['all','video','audio'].map(t => (
            <button key={t} onClick={() => setFilter(t)}
              className={`text-xs px-2 py-0.5 rounded font-mono transition-colors
                ${filter===t ? 'bg-primary dark:bg-primaryDark text-light' : 'text-dark/50 dark:text-light/50 hover:text-dark dark:hover:text-light'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && <p className="px-3 py-4 text-xs font-mono text-dark/40 dark:text-light/40">scanning…</p>}
        {!loading && visible.length === 0 && <p className="px-3 py-4 text-xs font-mono text-dark/40 dark:text-light/40">no files found</p>}

        {videos.length > 0 && (<>
          <p className="px-3 pt-3 pb-1 text-xs font-mono text-dark/40 dark:text-light/40 uppercase tracking-widest">Video · {videos.length}</p>
          {videos.map(f => <MediaRow key={f.url} file={f} onInsert={onInsert} onSelect={onSelect} selected={f.url===selectedUrl} />)}
        </>)}
        {audios.length > 0 && (<>
          <p className="px-3 pt-3 pb-1 text-xs font-mono text-dark/40 dark:text-light/40 uppercase tracking-widest">Audio · {audios.length}</p>
          {audios.map(f => <MediaRow key={f.url} file={f} onInsert={onInsert} onSelect={onSelect} selected={f.url===selectedUrl} />)}
        </>)}
      </div>
    </div>
  );
}

function MediaRow({ file, onInsert, onSelect, selected }) {
  return (
    <div
      className={`group flex items-start gap-2 px-3 py-2 cursor-pointer transition-colors
        ${selected ? 'bg-primary/10 dark:bg-primaryDark/10' : 'hover:bg-dark/5 dark:hover:bg-light/5'}`}
      onClick={() => onSelect(file)}
    >
      <MediaIcon type={file.type} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-mono text-dark dark:text-light truncate leading-tight" title={file.name}>
          {basename(file.url)}
        </p>
        <p className="text-xs text-dark/40 dark:text-light/40 font-mono">{formatSize(file.sizeKb)}</p>
      </div>
      <button
        title="Insert into script"
        onClick={e => { e.stopPropagation(); onInsert(file); }}
        className="opacity-0 group-hover:opacity-100 text-xs px-1.5 py-0.5 rounded
                   bg-primary/10 dark:bg-primaryDark/10 text-primary dark:text-primaryDark
                   hover:bg-primary/20 font-mono transition-opacity flex-shrink-0"
      >
        ←
      </button>
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

  const isVideo = file.type === 'video';
  const isAudio = file.type === 'audio';

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Mode tabs — only for video */}
      {isVideo && (
        <div className="flex border-b border-dark/10 dark:border-light/10 flex-shrink-0">
          {[
            { id: 'plain',  label: 'Video' },
            { id: 'text',   label: 'Text overlay' },
            { id: 'trail',  label: 'Motion trail' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setPreviewMode(tab.id)}
              className={`px-3 py-2 text-xs font-mono border-b-2 transition-colors
                ${previewMode===tab.id
                  ? 'border-primary dark:border-primaryDark text-primary dark:text-primaryDark'
                  : 'border-transparent text-dark/50 dark:text-light/50 hover:text-dark dark:hover:text-light'}`}>
              {tab.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 min-h-0 p-2">
        {isAudio && (
          <div className="flex flex-col gap-3 p-4">
            <p className="text-xs font-mono text-dark dark:text-light truncate">{basename(file.url)}</p>
            <audio src={file.url} controls className="w-full" />
          </div>
        )}

        {isVideo && previewMode === 'plain' && (
          <video src={file.url} controls className="w-full h-full object-contain rounded" />
        )}

        {isVideo && previewMode === 'text' && (
          <VideoTextOverlay videoSrc={file.url} />
        )}

        {isVideo && previewMode === 'trail' && (
          <MotionTrail videoSrc={file.url} mode="pixel" />
        )}
      </div>
    </div>
  );
}

// ---- Main component -------------------------------------------------

export default function Playground() {
  const [source, setSource]         = useState(MBENDE_SOURCE);
  const [result, setResult]         = useState(null);
  const [summary, setSummary]       = useState(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const [compiler, setCompiler]     = useState(null);
  const [mediaPanelOpen, setMediaPanelOpen] = useState(true);
  const [selectedFile, setSelectedFile]     = useState(null);
  const [previewMode, setPreviewMode]       = useState('plain');
  const [rightTab, setRightTab]     = useState('preview'); // 'preview' | 'diagnostics' | 'ir'
  const textareaRef = useRef(null);

  // Load the compiler lazily after first user interaction with the editor,
  // not immediately on mount — keeps initial paint fast.
  const loadCompiler = useCallback(() => {
    if (compiler) return;
    import('../lib/mee/index').then(mod => setCompiler(mod));
  }, [compiler]);

  const runCompile = useCallback(() => {
    if (!compiler) return;
    setIsCompiling(true);
    setTimeout(() => {
      try {
        const res = compiler.compile(source);
        const sum = compiler.summarise(res);
        setResult(res); setSummary(sum);
      } catch (e) {
        setResult({ ok: false, scene: null, ir: null, remotion: null, diagnostics: [{ level: 'error', code: 'InternalError', message: String(e.message) }] });
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

  const handleInsert = useCallback((file) => {
    const snippet = snippetFor(file);
    const ta = textareaRef.current;
    if (!ta) { setSource(prev => prev + '\n  ' + snippet); return; }
    const start = ta.selectionStart;
    const end   = ta.selectionEnd;
    setSource(source.slice(0, start) + snippet + source.slice(end));
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(start + snippet.length, start + snippet.length); });
  }, [source]);

  const handleSelect = useCallback((file) => {
    setSelectedFile(file);
    if (file.type === 'video') setPreviewMode('plain');
    setRightTab('preview');
  }, []);

  const errors   = result?.diagnostics.filter(d => d.level === 'error')   ?? [];
  const warnings = result?.diagnostics.filter(d => d.level === 'warning') ?? [];

  return (
    <>
      <Head>
        <title>MEE Playground</title>
        <meta name="description" content="Media Effect Encoder — behavioural effect chain compiler" />
      </Head>

      <TransitionEffect />

      <div className="w-full min-h-screen bg-light dark:bg-dark flex flex-col">

        {/* Header */}
        <div className="px-4 py-3 border-b border-dark/10 dark:border-light/10 flex items-center justify-between gap-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMediaPanelOpen(o => !o)}
              className={`text-xs font-mono px-2 py-1 rounded border transition-colors
                ${mediaPanelOpen
                  ? 'border-primary dark:border-primaryDark text-primary dark:text-primaryDark'
                  : 'border-dark/20 dark:border-light/20 text-dark/50 dark:text-light/50'}`}
            >
              ◧ Media
            </button>
            <div>
              <h1 className="text-sm font-bold text-dark dark:text-light tracking-tight leading-none">MEE Playground</h1>
              <p className="text-xs text-dark/40 dark:text-light/40 font-mono leading-none mt-0.5">behavioural isomorphism compiler</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {EXAMPLES.map(ex => (
              <button key={ex.label} onClick={() => setSource(ex.source)}
                className="text-xs px-3 py-1.5 rounded border border-dark/20 dark:border-light/20
                           text-dark/70 dark:text-light/70 hover:border-primary dark:hover:border-primaryDark
                           hover:text-primary dark:hover:text-primaryDark transition-colors font-mono">
                {ex.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden" style={{ minHeight: 'calc(100vh - 106px)' }}>

          {/* Media panel */}
          {mediaPanelOpen && (
            <div className="w-56 flex-shrink-0 border-r border-dark/10 dark:border-light/10 overflow-hidden flex flex-col
                            bg-dark/[0.02] dark:bg-light/[0.02]">
              <MediaPanel onInsert={handleInsert} onSelect={handleSelect} selectedUrl={selectedFile?.url} />
            </div>
          )}

          {/* DSL editor */}
          <div className="flex-1 flex flex-col border-r border-dark/10 dark:border-light/10 min-w-0">
            <div className="px-4 py-2 bg-dark/5 dark:bg-light/5 border-b border-dark/10 dark:border-light/10
                            flex items-center justify-between flex-shrink-0">
              <span className="text-xs font-mono text-dark/60 dark:text-light/60">scene.mee</span>
              <div className="flex items-center gap-2">
                {!compiler && <span className="text-xs text-dark/40 dark:text-light/40 font-mono">loading…</span>}
                {isCompiling && <span className="text-xs text-primary dark:text-primaryDark font-mono animate-pulse">compiling…</span>}
                {result && !isCompiling && (
                  <span className={`text-xs font-mono font-bold ${result.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {result.ok ? '✓ ok' : `✗ ${errors.length} error${errors.length!==1?'s':''}`}
                  </span>
                )}
              </div>
            </div>
            <textarea
              ref={textareaRef}
              value={source}
              onChange={e => setSource(e.target.value)}
              onFocus={loadCompiler}
              spellCheck={false}
              className="flex-1 p-4 font-mono text-sm bg-transparent text-dark dark:text-light resize-none focus:outline-none leading-relaxed"
              style={{ tabSize: 2 }}
            />
          </div>

          {/* Right panel — preview + diagnostics */}
          <div className="flex-1 flex flex-col min-w-0">

            {/* Summary bar */}
            {summary && (
              <div className="px-4 py-2 bg-dark/5 dark:bg-light/5 border-b border-dark/10 dark:border-light/10 flex flex-col gap-1.5 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-dark dark:text-light">{summary.sceneName}</span>
                  {summary.coherent
                    ? <span className="text-xs text-green-600 dark:text-green-400 font-mono">✓ coherent</span>
                    : <span className="text-xs text-yellow-600 dark:text-yellow-400 font-mono">⚠ weak</span>}
                </div>
                <PowerMeter pct={summary.compositePowerPct} />
                <div className="flex items-center gap-1.5 flex-wrap">
                  {summary.namespaces.map(ns => <NSChip key={ns} ns={ns} />)}
                  <span className="text-xs text-dark/40 dark:text-light/40 font-mono ml-1">{summary.primitiveCount} primitives</span>
                </div>
              </div>
            )}

            {/* Tab bar */}
            <div className="flex border-b border-dark/10 dark:border-light/10 flex-shrink-0">
              {[
                { id: 'preview',     label: 'Preview' },
                { id: 'diagnostics', label: `Diagnostics${errors.length+warnings.length > 0 ? ` (${errors.length+warnings.length})` : ''}` },
                { id: 'ir',          label: 'IR' },
              ].map(tab => (
                <button key={tab.id} onClick={() => setRightTab(tab.id)}
                  className={`px-4 py-2 text-xs font-mono border-b-2 transition-colors
                    ${rightTab===tab.id
                      ? 'border-primary dark:border-primaryDark text-primary dark:text-primaryDark'
                      : 'border-transparent text-dark/50 dark:text-light/50 hover:text-dark dark:hover:text-light'}`}>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            {rightTab === 'preview' && (
              <PreviewPanel file={selectedFile} previewMode={previewMode} setPreviewMode={setPreviewMode} />
            )}

            {rightTab === 'diagnostics' && (
              <div className="flex-1 overflow-auto p-4 flex flex-col gap-2">
                {(result?.diagnostics ?? []).length === 0 && (
                  <p className="text-xs font-mono text-dark/40 dark:text-light/40">No diagnostics.</p>
                )}
                {(result?.diagnostics ?? []).map((d, i) => (
                  <div key={i} className="flex gap-2 items-start p-2 rounded bg-dark/5 dark:bg-light/5">
                    <DiagBadge level={d.level} />
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-xs font-mono text-dark/50 dark:text-light/50">{d.code}</span>
                      <span className="text-xs text-dark dark:text-light leading-snug">{d.message}</span>
                      {d.line != null && <span className="text-xs font-mono text-dark/30 dark:text-light/30">line {d.line}{d.col!=null?`:${d.col}`:''}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {rightTab === 'ir' && (
              <pre className="flex-1 overflow-auto p-4 text-xs font-mono text-dark/80 dark:text-light/80 leading-relaxed whitespace-pre-wrap">
                {result?.ir ? JSON.stringify(result.ir, null, 2) : '// No IR yet'}
              </pre>
            )}
          </div>
        </div>

        {/* Status bar */}
        <div className="px-6 py-1.5 border-t border-dark/10 dark:border-light/10 flex items-center justify-between
                        text-xs font-mono text-dark/40 dark:text-light/40 flex-shrink-0">
          <div className="flex items-center gap-4">
            <span>MEE v0.1</span>
            {summary && <><span>·</span><span>κ {summary.compositePowerPct}%</span><span>·</span><span>{summary.primitiveCount} primitives</span></>}
          </div>
          <div className="flex items-center gap-4">
            {errors.length   > 0 && <span className="text-red-500">{errors.length} error{errors.length!==1?'s':''}</span>}
            {warnings.length > 0 && <span className="text-yellow-500">{warnings.length} warning{warnings.length!==1?'s':''}</span>}
            {result?.ok && <span className="text-green-500">ready</span>}
          </div>
        </div>
      </div>
    </>
  );
}
