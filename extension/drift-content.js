/**
 * drift-content.js — Interstitial Drift for any page with a <video>
 *
 * Applies the interstitial drift colour transform to every <video> element
 * on the page. The effect targets the gap between the Apple (Display P3,
 * colorsync, EDR tone-mapping) and Microsoft (sRGB passthrough, no mandatory
 * gamut transform) display pipelines.
 *
 * Cinema content (DCI-P3 primaries, mastered for dark room, hot highlights)
 * and desktop content (sRGB, flat, over-bright) are both encoded for a
 * receiver the user's display isn't. The drift pulls both toward the
 * interstitial space — lifting crushed darks from cinema content, reining in
 * blown highlights from desktop content — without "correcting" either, because
 * no correction target is known.
 *
 * Three coupled per-pixel transforms (mirror of chromatic/interstitialDrift.ts):
 *
 *   1. WHITE POINT DRIFT   — D65 → ~6000K shift. Apple corrects back (reads
 *      cool); Windows passes through (reads warm). At drift=0 this is neutral.
 *
 *   2. GAMUT PUSH          — green/cyan nudged toward P3-adjacent primaries.
 *      sRGB clips the pushed values; P3 over-delivers. Neither is the intent.
 *
 *   3. HIGHLIGHT ROLL-OFF  — log shoulder between γ2.2 and PQ-adjacent curve.
 *      The knee sits in the region where the two pipelines diverge most.
 *      Cinema highlights are lifted; desktop highlights are compressed.
 *
 * Implementation:
 *   - A <canvas> is overlaid on each <video> using position:absolute.
 *   - requestAnimationFrame draws the video frame to an offscreen canvas,
 *     applies the transform pixel-by-pixel, then draws the result to the
 *     overlay canvas.
 *   - The video element is made transparent (opacity:0) so only the
 *     processed canvas is visible.
 *   - On disable, the canvas is removed and video opacity is restored.
 *
 * Performance note:
 *   Per-pixel CPU transforms are expensive on large video elements. The loop
 *   skips frames when the tab is not visible (document.hidden). For a 1080p
 *   video at 30fps, expect ~10-15ms per frame on a modern CPU. This is
 *   acceptable for ambient playback; for high-framerate gaming content the
 *   effect should be disabled.
 */

"use strict";

// ── Constants (mirrored from interstitialDrift.ts) ───────────────────────────

const WP_R_GAIN = 0.012;
const WP_B_GAIN = -0.025;
const GP_G_GAIN = 0.045;
const GP_B_GAIN = -0.018;
const GP_R_GAIN = -0.008;

// ── State ────────────────────────────────────────────────────────────────────

let driftState = {
  enabled: false,
  drift: 0.6,
};

// Map from video element -> { canvas, ctx, offscreen, offCtx, rafId, cleanup }
const videoMap = new WeakMap();

// ── Transform ────────────────────────────────────────────────────────────────

function rollOff(v, drift) {
  if (v <= 0) return 0;
  if (v >= 1) return 1;
  const knee = 0.7;
  if (v < knee) return v;
  const above = (v - knee) / (1 - knee);
  const compressed = Math.sqrt(above);
  return knee + (1 - knee) * (above * (1 - drift) + compressed * drift);
}

function applyDrift(imageData, drift) {
  if (drift <= 0) return imageData;
  const d = imageData.data;
  const len = d.length;
  for (let i = 0; i < len; i += 4) {
    let r = d[i] / 255;
    let g = d[i + 1] / 255;
    let b = d[i + 2] / 255;

    // 1. White point drift
    r = Math.max(0, Math.min(1, r + WP_R_GAIN * drift));
    b = Math.max(0, Math.min(1, b + WP_B_GAIN * drift));

    // 2. Gamut push
    r = Math.max(0, Math.min(1, r + GP_R_GAIN * drift));
    g = Math.max(0, Math.min(1, g + GP_G_GAIN * drift));
    b = Math.max(0, Math.min(1, b + GP_B_GAIN * drift));

    // 3. Highlight roll-off
    r = rollOff(r, drift);
    g = rollOff(g, drift);
    b = rollOff(b, drift);

    d[i] = Math.round(r * 255);
    d[i + 1] = Math.round(g * 255);
    d[i + 2] = Math.round(b * 255);
  }
  return imageData;
}

// ── Per-video loop ────────────────────────────────────────────────────────────

function attachToVideo(video) {
  if (videoMap.has(video)) return;

  // Overlay canvas — sits directly over the video
  const canvas = document.createElement("canvas");
  canvas.style.cssText = `
    position: absolute;
    top: 0; left: 0;
    width: 100%; height: 100%;
    pointer-events: none;
    z-index: 2147483646;
  `;

  // Offscreen canvas for pixel read
  const offscreen = document.createElement("canvas");
  const offCtx = offscreen.getContext("2d", { willReadFrequently: true });
  const ctx = canvas.getContext("2d");

  // Position the canvas over the video
  const parent = video.parentElement;
  if (!parent) return;
  const parentStyle = getComputedStyle(parent);
  if (parentStyle.position === "static") parent.style.position = "relative";
  parent.appendChild(canvas);

  // Hide the original video — the canvas is the display
  const origOpacity = video.style.opacity;
  video.style.opacity = "0";

  let rafId = null;

  function loop() {
    if (!driftState.enabled) return;
    if (document.hidden) {
      rafId = requestAnimationFrame(loop);
      return;
    }

    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h || video.readyState < 2) {
      rafId = requestAnimationFrame(loop);
      return;
    }

    // Sync canvas dimensions
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      offscreen.width = w;
      offscreen.height = h;
    }

    // Draw video frame to offscreen, read pixels, transform, draw to overlay
    offCtx.drawImage(video, 0, 0, w, h);
    const imageData = offCtx.getImageData(0, 0, w, h);
    applyDrift(imageData, driftState.drift);
    ctx.putImageData(imageData, 0, 0);

    rafId = requestAnimationFrame(loop);
  }

  function cleanup() {
    if (rafId !== null) cancelAnimationFrame(rafId);
    canvas.remove();
    video.style.opacity = origOpacity;
    videoMap.delete(video);
  }

  videoMap.set(video, {
    canvas,
    cleanup,
    startLoop: () => {
      rafId = requestAnimationFrame(loop);
    },
  });

  if (driftState.enabled) {
    videoMap.get(video).startLoop();
  }
}

function detachFromVideo(video) {
  const entry = videoMap.get(video);
  if (entry) entry.cleanup();
}

// ── Enable / disable ─────────────────────────────────────────────────────────

function enableDrift() {
  document.querySelectorAll("video").forEach(attachToVideo);
  // Re-start loops for already-attached videos
  videoMap.forEach &&
    document.querySelectorAll("video").forEach((v) => {
      const entry = videoMap.get(v);
      if (entry) entry.startLoop();
    });
}

function disableDrift() {
  document.querySelectorAll("video").forEach(detachFromVideo);
}

// ── MutationObserver — pick up dynamically added videos ──────────────────────

const videoObserver = new MutationObserver((mutations) => {
  if (!driftState.enabled) return;
  for (const m of mutations) {
    for (const node of m.addedNodes) {
      if (node.nodeName === "VIDEO") attachToVideo(node);
      if (node.querySelectorAll) {
        node.querySelectorAll("video").forEach(attachToVideo);
      }
    }
  }
});

videoObserver.observe(document.documentElement, {
  childList: true,
  subtree: true,
});

// ── Message bridge ────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "DRIFT_STATE_UPDATED") {
    const prev = driftState.enabled;
    driftState = msg.payload;
    if (driftState.enabled && !prev) enableDrift();
    if (!driftState.enabled && prev) disableDrift();
  }
});

// ── Boot ──────────────────────────────────────────────────────────────────────

async function initDrift() {
  const stored = await chrome.runtime.sendMessage({ type: "GET_DRIFT_STATE" });
  if (stored) driftState = stored;
  if (driftState.enabled) enableDrift();
}

initDrift().catch(console.error);
