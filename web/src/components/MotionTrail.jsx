import { useEffect, useRef, useState } from 'react';

// Draws motion trails on a 2D canvas overlay sourced from a video element.
// When skeleton keypoints are provided (from the detection module), trails
// follow the joints. Otherwise falls back to frame-diff pixel trails.

const TRAIL_LENGTH  = 12;   // ghost frames to keep
const TRAIL_ALPHA   = 0.08; // opacity per ghost frame
const JOINT_RADIUS  = 4;

// Joints that get trails when skeleton data is available
const TRAIL_JOINTS = [
  'left_wrist', 'right_wrist',
  'left_ankle', 'right_ankle',
  'left_knee',  'right_knee',
];

function drawSkeletonTrails(ctx, trailBuffer, w, h) {
  ctx.clearRect(0, 0, w, h);
  trailBuffer.forEach((frame, fi) => {
    const alpha = TRAIL_ALPHA * (fi + 1);
    frame.forEach(({ x, y, color }) => {
      ctx.beginPath();
      ctx.arc(x * w, y * h, JOINT_RADIUS + (TRAIL_LENGTH - fi) * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = color.replace('1)', `${alpha})`);
      ctx.fill();
    });
  });
}

function drawPixelTrails(ctx, trailBuffer, w, h) {
  ctx.clearRect(0, 0, w, h);
  trailBuffer.forEach((imageData, fi) => {
    const alpha = TRAIL_ALPHA * (fi + 1);
    ctx.globalAlpha = alpha;
    ctx.putImageData(imageData, 0, 0);
  });
  ctx.globalAlpha = 1;
}

export default function MotionTrail({
  videoSrc,
  skeletons = null,   // array of per-frame skeleton data from detection module
  trailColor = 'rgba(0,200,255,1)',
  mode = 'pixel',     // 'pixel' | 'skeleton'
}) {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);   // render target (shown to user)
  const offRef    = useRef(null);   // offscreen canvas for frame capture
  const trailBuf  = useRef([]);
  const rafRef    = useRef(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;
    offRef.current = document.createElement('canvas');
  }, []);

  const tick = () => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    const off    = offRef.current;
    if (!video || !canvas || !off) { rafRef.current = requestAnimationFrame(tick); return; }

    const w = canvas.width  = video.videoWidth  || canvas.offsetWidth;
    const h = canvas.height = video.videoHeight || canvas.offsetHeight;
    off.width = w; off.height = h;

    const ctx    = canvas.getContext('2d');
    const offCtx = off.getContext('2d');

    if (mode === 'skeleton' && skeletons) {
      const frameIdx = Math.floor((video.currentTime / (video.duration || 1)) * skeletons.length);
      const frame    = skeletons[Math.min(frameIdx, skeletons.length - 1)] || [];
      const joints   = frame.filter(kp => TRAIL_JOINTS.includes(kp.name) && kp.score > 0.3)
                            .map(kp => ({ x: kp.x, y: kp.y, color: trailColor }));

      trailBuf.current.unshift(joints);
      if (trailBuf.current.length > TRAIL_LENGTH) trailBuf.current.pop();

      // Draw video frame first
      ctx.drawImage(video, 0, 0, w, h);
      // Then overlay trails
      drawSkeletonTrails(ctx, trailBuf.current, w, h);
    } else {
      // Pixel diff mode: capture current frame into offscreen, keep ring buffer of ImageData
      offCtx.drawImage(video, 0, 0, w, h);
      const imgData = offCtx.getImageData(0, 0, w, h);

      trailBuf.current.unshift(imgData);
      if (trailBuf.current.length > TRAIL_LENGTH) trailBuf.current.pop();

      // Draw current video frame
      ctx.drawImage(video, 0, 0, w, h);
      // Overlay ghost frames with additive blend
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      drawPixelTrails(ctx, trailBuf.current.slice(1), w, h);
      ctx.restore();
    }

    rafRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    if (playing) {
      rafRef.current = requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(rafRef.current);
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing]); // eslint-disable-line

  const toggle = () => {
    if (!videoRef.current) return;
    if (playing) { videoRef.current.pause(); setPlaying(false); trailBuf.current = []; }
    else         { videoRef.current.play();  setPlaying(true); }
  };

  return (
    <div className="relative w-full h-full bg-black rounded overflow-hidden">
      {/* Hidden source video */}
      <video
        ref={videoRef}
        src={videoSrc}
        className="hidden"
        onEnded={() => { setPlaying(false); trailBuf.current = []; }}
        loop={false}
      />

      {/* Canvas where we render video + trails */}
      <canvas ref={canvasRef} className="w-full h-full object-cover" />

      {/* Play overlay */}
      {!playing && (
        <button
          onClick={toggle}
          className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/50 transition-colors"
        >
          <svg className="w-14 h-14 text-cyan-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
      )}

      {/* Pause button when playing */}
      {playing && (
        <button
          onClick={toggle}
          className="absolute top-3 right-3 bg-black/40 hover:bg-black/60 rounded-full p-2 transition-colors"
        >
          <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
          </svg>
        </button>
      )}

      {/* Mode badge */}
      <div className="absolute bottom-3 left-3 text-xs font-mono text-cyan-400/70 bg-black/50 px-2 py-0.5 rounded">
        trail · {mode}
      </div>
    </div>
  );
}
