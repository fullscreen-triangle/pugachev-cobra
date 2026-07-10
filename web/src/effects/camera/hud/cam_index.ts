// Compositions
export {
  CameraUIComp,
  TumbleComp,
  CameraLiveComp,
  THROW_UP, DROP, HANDHELD, EARTHQUAKE,
} from "./remotion/compositions.js";

// Physics
export { simulateTumble } from "./physics/tumble.js";

// Skins (if you want to embed them in a custom composition)
export { PhoneSkin, ActionSkin, BroadcastSkin, CCTVSkin } from "./ui/skins/CameraSkins.js";

// HUD primitives (for custom skins)
export {
  RecBadge, Timecode, Battery, FocusReticle, GridLines, Vignette, FilmGrain,
} from "./ui/components/HudPrimitives.js";

// Types
export type {
  CameraStyle,
  CameraUIConfig,
  TumbleConfig,
  TumbleFrame,
  TumbleTimeline,
  FocusPoint,
} from "./types/index.js";
export { DEFAULT_CAMERA_UI, DEFAULT_TUMBLE } from "./types/index.js";
