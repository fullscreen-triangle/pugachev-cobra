import Head from "next/head";
import { useState, useCallback, useEffect } from "react";
import TransitionEffect from "@/components/TransitionEffect";

// ---- default source --------------------------------------------------

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

const HAZE_SOURCE = `scene desert_haze {
  clip("footage/landscape.mp4", at=0s, for=20s)
    |> acts_like("heat haze")
    |> render(motion)

  goal {
    behaviour: "heat haze"
    coherence: >= 0.5
    duration: < 25s
  }
}`;

const EXAMPLES = [
  { label: 'Water Surface', source: DEFAULT_SOURCE },
  { label: 'Drum Skin', source: DRUM_SOURCE },
  { label: 'Heat Haze', source: HAZE_SOURCE },
];

// ---- Diagnostic badge -----------------------------------------------

function DiagBadge({ level }) {
  const styles = {
    error:   'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
    info:    'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  };
  return (
    <span className={`text-xs font-mono px-1.5 py-0.5 rounded uppercase font-bold ${styles[level] ?? styles.info}`}>
      {level}
    </span>
  );
}

// ---- Power meter ----------------------------------------------------

function PowerMeter({ pct }) {
  const color = pct >= 60 ? 'bg-green-500' : pct >= 35 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className="text-xs font-mono w-12 text-right dark:text-light">{pct.toFixed(1)}%</span>
    </div>
  );
}

// ---- Namespace chip --------------------------------------------------

function NSChip({ ns }) {
  const colors = {
    spatial:     'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300',
    photometric: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    temporal:    'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
    acoustic:    'bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[ns] ?? 'bg-gray-100 text-gray-700'}`}>
      {ns}
    </span>
  );
}

// ---- Main component -------------------------------------------------

export default function Playground() {
  const [source, setSource] = useState(DEFAULT_SOURCE);
  const [result, setResult] = useState(null);
  const [summary, setSummary] = useState(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const [activeTab, setActiveTab] = useState('remotion'); // 'remotion' | 'ir' | 'diagnostics'
  const [compiler, setCompiler] = useState(null);

  // Dynamically import the compiler (it uses require() internally — keeps Next.js happy)
  useEffect(() => {
    import('../lib/mee/index').then(mod => setCompiler(mod));
  }, []);

  const runCompile = useCallback(() => {
    if (!compiler) return;
    setIsCompiling(true);
    // Defer to next tick so the UI can update the button state first
    setTimeout(() => {
      try {
        const res = compiler.compile(source);
        const sum = compiler.summarise(res);
        setResult(res);
        setSummary(sum);
      } catch (e) {
        setResult({
          ok: false, scene: null, ir: null, remotion: null,
          diagnostics: [{ level: 'error', code: 'InternalError', message: String(e.message) }],
        });
        setSummary(null);
      }
      setIsCompiling(false);
    }, 0);
  }, [source, compiler]);

  // Auto-compile on source change (debounced 600ms)
  useEffect(() => {
    if (!compiler) return;
    const id = setTimeout(runCompile, 600);
    return () => clearTimeout(id);
  }, [source, compiler, runCompile]);

  const errors   = result?.diagnostics.filter(d => d.level === 'error')   ?? [];
  const warnings = result?.diagnostics.filter(d => d.level === 'warning') ?? [];

  return (
    <>
      <Head>
        <title>MEE Playground — Pugachev Cobra</title>
        <meta name="description" content="Media Effect Encoder — behavioural effect chain compiler" />
      </Head>

      <TransitionEffect />

      <div className="w-full min-h-screen bg-light dark:bg-dark flex flex-col">

        {/* ---- Header bar ---- */}
        <div className="px-8 py-4 border-b border-dark/10 dark:border-light/10 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-dark dark:text-light tracking-tight">
              MEE Playground
            </h1>
            <p className="text-xs text-dark/50 dark:text-light/50 font-mono">
              Media Effect Encoder — behavioural isomorphism compiler
            </p>
          </div>
          <div className="flex items-center gap-2">
            {EXAMPLES.map(ex => (
              <button
                key={ex.label}
                onClick={() => setSource(ex.source)}
                className="text-xs px-3 py-1.5 rounded border border-dark/20 dark:border-light/20
                           text-dark/70 dark:text-light/70 hover:border-primary dark:hover:border-primaryDark
                           hover:text-primary dark:hover:text-primaryDark transition-colors font-mono"
              >
                {ex.label}
              </button>
            ))}
          </div>
        </div>

        {/* ---- Main split ---- */}
        <div className="flex flex-1 overflow-hidden" style={{ minHeight: 'calc(100vh - 120px)' }}>

          {/* Left — editor */}
          <div className="w-1/2 flex flex-col border-r border-dark/10 dark:border-light/10">
            <div className="px-4 py-2 bg-dark/5 dark:bg-light/5 border-b border-dark/10 dark:border-light/10
                            flex items-center justify-between">
              <span className="text-xs font-mono text-dark/60 dark:text-light/60">scene.mee</span>
              <div className="flex items-center gap-2">
                {!compiler && (
                  <span className="text-xs text-dark/40 dark:text-light/40 font-mono">loading compiler…</span>
                )}
                {isCompiling && (
                  <span className="text-xs text-primary dark:text-primaryDark font-mono animate-pulse">
                    compiling…
                  </span>
                )}
                {result && !isCompiling && (
                  <span className={`text-xs font-mono font-bold ${result.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {result.ok ? '✓ compiled' : `✗ ${errors.length} error${errors.length !== 1 ? 's' : ''}`}
                  </span>
                )}
              </div>
            </div>

            <textarea
              value={source}
              onChange={e => setSource(e.target.value)}
              spellCheck={false}
              className="flex-1 p-4 font-mono text-sm bg-transparent text-dark dark:text-light
                         resize-none focus:outline-none leading-relaxed"
              style={{ tabSize: 2 }}
            />
          </div>

          {/* Right — output */}
          <div className="w-1/2 flex flex-col">

            {/* Summary bar */}
            {summary && (
              <div className="px-4 py-3 bg-dark/5 dark:bg-light/5 border-b border-dark/10 dark:border-light/10
                              flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-dark dark:text-light">
                    {summary.sceneName}
                  </span>
                  <div className="flex items-center gap-1">
                    {summary.coherent
                      ? <span className="text-xs text-green-600 dark:text-green-400 font-mono">✓ coherent</span>
                      : <span className="text-xs text-yellow-600 dark:text-yellow-400 font-mono">⚠ weak coherence</span>
                    }
                  </div>
                </div>

                <PowerMeter pct={summary.compositePowerPct} />

                <div className="flex items-center gap-1.5 flex-wrap">
                  {summary.namespaces.map(ns => <NSChip key={ns} ns={ns} />)}
                  <span className="text-xs text-dark/40 dark:text-light/40 font-mono ml-1">
                    {summary.primitiveCount} primitive{summary.primitiveCount !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            )}

            {/* Tab bar */}
            <div className="flex border-b border-dark/10 dark:border-light/10">
              {[
                { id: 'remotion', label: 'Remotion TSX' },
                { id: 'ir', label: 'IR' },
                { id: 'diagnostics', label: `Diagnostics${errors.length + warnings.length > 0 ? ` (${errors.length + warnings.length})` : ''}` },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 text-xs font-mono border-b-2 transition-colors
                    ${activeTab === tab.id
                      ? 'border-primary dark:border-primaryDark text-primary dark:text-primaryDark'
                      : 'border-transparent text-dark/50 dark:text-light/50 hover:text-dark dark:hover:text-light'
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-auto">

              {activeTab === 'remotion' && (
                <pre className="p-4 text-xs font-mono text-dark/80 dark:text-light/80 leading-relaxed whitespace-pre-wrap">
                  {result?.remotion ?? (result && !result.ok
                    ? '// Compilation failed — fix errors to see output'
                    : '// Waiting for compiler…'
                  )}
                </pre>
              )}

              {activeTab === 'ir' && (
                <pre className="p-4 text-xs font-mono text-dark/80 dark:text-light/80 leading-relaxed whitespace-pre-wrap">
                  {result?.ir
                    ? JSON.stringify(result.ir, null, 2)
                    : '// No IR — compilation failed or not yet run'
                  }
                </pre>
              )}

              {activeTab === 'diagnostics' && (
                <div className="p-4 flex flex-col gap-2">
                  {(result?.diagnostics ?? []).length === 0 && (
                    <p className="text-xs font-mono text-dark/40 dark:text-light/40">No diagnostics.</p>
                  )}
                  {(result?.diagnostics ?? []).map((d, i) => (
                    <div
                      key={i}
                      className="flex gap-2 items-start p-2 rounded bg-dark/5 dark:bg-light/5"
                    >
                      <DiagBadge level={d.level} />
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-xs font-mono text-dark/50 dark:text-light/50">{d.code}</span>
                        <span className="text-xs text-dark dark:text-light leading-snug">{d.message}</span>
                        {(d.line != null) && (
                          <span className="text-xs font-mono text-dark/30 dark:text-light/30">
                            line {d.line}{d.col != null ? `:${d.col}` : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

            </div>
          </div>
        </div>

        {/* ---- Status bar ---- */}
        <div className="px-6 py-1.5 border-t border-dark/10 dark:border-light/10
                        flex items-center justify-between text-xs font-mono
                        text-dark/40 dark:text-light/40">
          <div className="flex items-center gap-4">
            <span>MEE Compiler v0.1</span>
            {summary && (
              <>
                <span>·</span>
                <span>κ_composite {summary.compositePowerPct}%</span>
                <span>·</span>
                <span>{summary.primitiveCount} primitives</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-4">
            {errors.length > 0 && <span className="text-red-500">{errors.length} error{errors.length !== 1 ? 's' : ''}</span>}
            {warnings.length > 0 && <span className="text-yellow-500">{warnings.length} warning{warnings.length !== 1 ? 's' : ''}</span>}
            {result?.ok && <span className="text-green-500">ready</span>}
          </div>
        </div>

      </div>
    </>
  );
}
