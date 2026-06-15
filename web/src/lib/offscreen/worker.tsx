// MEE — Offscreen canvas worker entry point.
// Imported by OffscreenCanvas.tsx via `new Worker(new URL(...), {type:'module'})`.
// The `render` export from @react-three/offscreen takes a React element,
// sets up an R3F root on the OffscreenCanvas, and handles init/resize/dom_events
// messages from the main thread.

import React from 'react';
import { render } from '@react-three/offscreen';

// Default scene — a simple rotating box so the worker is always valid.
// Real usage: the main thread passes props through the Canvas `props` message
// and the scene is replaced by the consumer's children via the fallback prop.
function DefaultScene() {
  return (
    <>
      <ambientLight />
      <pointLight position={[10, 10, 5]} />
    </>
  );
}

render(<DefaultScene />);
