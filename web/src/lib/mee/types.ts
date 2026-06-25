// ======================================================================
//  MEE — Types
//  Token definitions, AST nodes, IR nodes, and compiler result.
// ======================================================================

// ---- Tokens -----------------------------------------------------------

export type TokenKind =
  | 'IDENT'
  | 'STRING'
  | 'NUMBER'
  | 'TIME'          // e.g. 15s, 2.5s
  | 'DASH'          // - (used in at 0s-5s ranges)
  | 'PIPE'          // |>
  | 'LBRACE'        // {
  | 'RBRACE'        // }
  | 'LPAREN'        // (
  | 'RPAREN'        // )
  | 'COMMA'         // ,
  | 'COLON'         // :
  | 'EQUALS'        // =
  | 'GT'            // >
  | 'LT'            // <
  | 'GTE'           // >=
  | 'LTE'           // <=
  | 'KEYWORD'
  | 'EOF';

export const KEYWORDS = new Set([
  'scene', 'clip', 'acts_like', 'compose', 'render',
  'goal', 'brand', 'dispatch', 'when', 'do', 'play',
  'at', 'for', 'fps', 'aspect', 'duration',
  'behaviour', 'coherence', 'confidence', 'invariant',
  'via', 'emit',
  'detect', 'select', 'apply_to_selection', 'for_each',
  'shader',
  // Timeline extensions
  'audio', 'every', 'mute', 'bw', 'text', 'boxes', 'glitch',
]);

export interface Token {
  kind: TokenKind;
  value: string;
  line: number;
  col: number;
}

// ---- AST --------------------------------------------------------------

export type ASTNode =
  | SceneNode
  | ClipNode
  | ActsLikeNode
  | ComposeNode
  | RenderNode
  | GoalNode
  | BrandNode
  | DispatchNode
  | WhenClauseNode
  | PipelineNode
  | PrimArgNode;

export interface SceneNode {
  kind: 'Scene';
  name: string;
  pipeline: PipelineNode;
  goal: GoalNode | null;
  brands: BrandNode[];
  dispatch: DispatchNode | null;
}

export interface PipelineNode {
  kind: 'Pipeline';
  steps: PipelineStep[];
}

export type PipelineStep =
  | ClipNode
  | AudioNode
  | ActsLikeNode
  | ComposeNode
  | RenderNode
  | DetectNode
  | SelectNode
  | ApplyToSelectionNode
  | ForEachNode
  | ShaderNode
  | SegmentNode
  | PeriodicNode;

export interface ClipNode {
  kind: 'Clip';
  path: string;
  at: number;   // seconds
  for: number;  // seconds
}

// Audio track: audio("/path/to/file.mp3", mute_video: true)
export interface AudioNode {
  kind: 'Audio';
  path: string;
  muteVideo: boolean;
  startFrom: number;  // seconds into the audio file to start
  volume: number;     // 0..1, default 1
}

// Time-ranged segment: at 2s-5s : effect1(), effect2()
export interface SegmentNode {
  kind: 'Segment';
  startSec: number;
  endSec: number;    // -1 means "to end of clip"
  effects: PrimArgNode[];
}

// Periodic effect: every 5s : glitch(intensity: 0.4)
export interface PeriodicNode {
  kind: 'Periodic';
  periodSec: number;
  durationSec: number;  // how long each instance lasts, default = 1s
  effects: PrimArgNode[];
}

export interface ActsLikeNode {
  kind: 'ActsLike';
  description: string;
}

export interface ComposeNode {
  kind: 'Compose';
  effects: PrimArgNode[];
}

export interface PrimArgNode {
  kind: 'PrimArg';
  name: string;                         // primitive name e.g. 'oscillate'
  params: Record<string, string | number>;
}

export interface RenderNode {
  kind: 'Render';
  format: string;
}

export interface GoalNode {
  kind: 'Goal';
  behaviour: string | null;
  coherenceThreshold: number;           // default 0.5
  maxDuration: number | null;           // seconds
}

export interface BrandNode {
  kind: 'Brand';
  name: string;
  invariant: string;
  confidence: number;
}

export interface DispatchNode {
  kind: 'Dispatch';
  clauses: WhenClauseNode[];
}

export interface WhenClauseNode {
  kind: 'WhenClause';
  format: string;
  target: string;
}

// ---- IR ---------------------------------------------------------------

export type IRNode =
  | IRClip
  | IRAudio
  | IRPrim
  | IRCompose
  | IRHole
  | IRDetect
  | IRSelect
  | IRObjectEffect
  | IRShader
  | IRSegment
  | IRPeriodic;

export interface IRClip {
  kind: 'IRClip';
  path: string;
  at: number;
  duration: number;
}

export interface IRAudio {
  kind: 'IRAudio';
  path: string;
  muteVideo: boolean;
  startFrom: number;
  volume: number;
}

// Remotion <Sequence> wrapping effects for a time window
export interface IRSegment {
  kind: 'IRSegment';
  startSec: number;
  endSec: number;
  effects: IRNode[];
}

// Repeated effect instances every N seconds
export interface IRPeriodic {
  kind: 'IRPeriodic';
  periodSec: number;
  durationSec: number;
  effects: IRNode[];
}

export interface IRPrim {
  kind: 'IRPrim';
  primitive: string;
  namespace: Namespace;
  params: Record<string, string | number>;
  power: number;  // estimated catalytic power [0,1]
}

export interface IRCompose {
  kind: 'IRCompose';
  steps: IRNode[];
}

export interface IRHole {
  kind: 'IRHole';
  description: string;   // unresolved behaviour description — error at emit
}

export type Namespace = 'spatial' | 'photometric' | 'temporal' | 'acoustic';

// ---- Compiler result --------------------------------------------------

export interface Diagnostic {
  level: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  line?: number;
  col?: number;
}

export interface CompileResult {
  ok: boolean;
  scene: SceneNode | null;
  ir: IRNode | null;
  remotion: string | null;       // emitted Remotion TSX source
  remotionWorker: string | null; // companion offscreen worker TSX (non-null when cameras present)
  diagnostics: Diagnostic[];
}

// ---- Detection AST nodes ---------------------------------------------

export interface DetectNode {
  kind: 'Detect';
  targets: string[];   // e.g. ['person', 'face']
  minConfidence: number;
}

export interface SelectNode {
  kind: 'Select';
  selector: string;   // selector expression e.g. 'person[0].pose==running'
}

export interface ApplyToSelectionNode {
  kind: 'ApplyToSelection';
  effects: PrimArgNode[];
}

export interface ForEachNode {
  kind: 'ForEach';
  target: string;     // object type to iterate over
  body: PipelineStep[];
}

// ---- Detection IR nodes ----------------------------------------------

export interface IRDetect {
  kind: 'IRDetect';
  targets: string[];
  minConfidence: number;
}

export interface IRSelect {
  kind: 'IRSelect';
  selector: string;
}

export interface IRObjectEffect {
  kind: 'IRObjectEffect';
  effect: string;
  params: Record<string, string | number>;
}

// ---- HuggingFace shader / 3D pipeline steps --------------------------

export type HFModel = 'EXCAI/Diffusion-As-Shader' | 'VideoFrom3D/VideoFrom3D';

export interface ShaderNode {
  kind: 'Shader';
  model: HFModel;
  params: Record<string, string | number>;
}

export interface IRShader {
  kind: 'IRShader';
  model: HFModel;
  params: Record<string, string | number>;
  sourceClip: string;  // filled in by buildIR from nearest IRClip
}
