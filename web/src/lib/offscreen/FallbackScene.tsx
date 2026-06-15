// MEE — Default fallback scene for when OffscreenCanvas is unsupported.
// Rendered on the main thread via regular @react-three/fiber Canvas.

import React from 'react';
import { Canvas } from '@react-three/fiber';

export default function FallbackScene() {
  return (
    <Canvas>
      <ambientLight />
      <pointLight position={[10, 10, 5]} />
    </Canvas>
  );
}
