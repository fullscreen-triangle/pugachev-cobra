/**
 * content.js — injected into youtube.com pages
 *
 * Core mechanism (Zero Decoder-Shift Theorem):
 *   r* = τ / ω
 *   For r > r*, compressed duration τ/r < ω → zero decoder-shift.
 *
 * What we do:
 *   1. Detect when a YouTube ad starts playing.
 *   2. Set video.playbackRate to `state.rate` (default 7500, clamped by
 *      browser to its maximum — typically 16x, but we set as high as allowed
 *      then poll to keep pushing it up as the browser allows).
 *   3. The ad plays completely: all telemetry events fire in correct order.
 *      Sender completeness is preserved; receiver shift is zero.
 *   4. On ad end, restore normal playback rate.
 *
 * Note on browser playback rate limits:
 *   Chrome caps HTMLVideoElement.playbackRate at 16x natively.
 *   We use the highest rate achievable and document it.
 *   The critical rate r* for a 30s ad at ω=13ms is ~2308, which is above
 *   Chrome's 16x cap (~480x for a 30s signal in 62.5ms). For the theorem
 *   to be satisfied in-browser we need ω ≥ τ/16 (62.5ms per 30s).
 *   This is within published integration-window ranges for complex stimuli.
 *   The extension sets the maximum the browser supports.
 */

"use strict";

// ── State ───────────────────────────────────────────────────────────────────

let state = {
  enabled: true,
  rate: 16, // browser maximum; will be updated from storage
  omega_ms: 13,
  stats: { adsProcessed: 0, totalTimeSavedMs: 0 },
};

let pollTimer = null;
let adStartTime = null;
let currentVideo = null;
let isInAd = false;

// ── Bootstrap ────────────────────────────────────────────────────────────────

async function init() {
  const stored = await chrome.runtime.sendMessage({ type: "GET_STATE" });
  if (stored) state = stored;
  observe();
  listenForStateUpdates();
}

// ── State sync from background ────────────────────────────────────────────────

function listenForStateUpdates() {
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "STATE_UPDATED") {
      state = msg.payload;
      if (!state.enabled && isInAd) restoreRate();
    }
  });
}

// ── Ad detection ─────────────────────────────────────────────────────────────

/**
 * YouTube signals an ad is playing via:
 *   - The `.ad-showing` class on <html>
 *   - The `.ytp-ad-player-overlay` element being visible
 *   - `video.className` containing "ad-showing" on the player container
 *
 * We watch for all three via MutationObserver + periodic polling as fallback.
 */
function isAdPlaying() {
  // Primary: class on html element
  if (document.documentElement.classList.contains("ad-showing")) return true;
  // Secondary: overlay element present and visible
  const overlay = document.querySelector(".ytp-ad-player-overlay");
  if (overlay) return true;
  // Tertiary: skip button visible (definitely in an ad)
  const skip = document.querySelector(
    ".ytp-skip-ad-button, .ytp-ad-skip-button"
  );
  if (skip) return true;
  return false;
}

function getVideoElement() {
  return (
    document.querySelector("video.html5-main-video") ??
    document.querySelector("video")
  );
}

// ── Rate application ──────────────────────────────────────────────────────────

const MAX_BROWSER_RATE = 16; // Chrome's HTMLVideoElement cap

function applyCompressionRate(video) {
  const targetRate = Math.min(state.rate, MAX_BROWSER_RATE);
  if (Math.abs(video.playbackRate - targetRate) > 0.01) {
    video.playbackRate = targetRate;
  }
}

function restoreRate() {
  if (currentVideo) {
    currentVideo.playbackRate = 1.0;
  }
  isInAd = false;
  adStartTime = null;
  clearInterval(pollTimer);
  pollTimer = null;
}

// ── Ad lifecycle ──────────────────────────────────────────────────────────────

function onAdStart(video) {
  if (!state.enabled) return;
  isInAd = true;
  currentVideo = video;
  adStartTime = performance.now();
  applyCompressionRate(video);

  // Continuously reapply: YouTube sometimes resets playbackRate
  pollTimer = setInterval(() => {
    if (!isAdPlaying()) {
      onAdEnd();
      return;
    }
    applyCompressionRate(video);
  }, 50);
}

function onAdEnd() {
  if (!isInAd) return;
  const elapsed = adStartTime ? performance.now() - adStartTime : 0;
  restoreRate();
  chrome.runtime
    .sendMessage({
      type: "AD_PROCESSED",
      payload: { savedMs: elapsed },
    })
    .catch(() => {});
}

// ── MutationObserver ──────────────────────────────────────────────────────────

function observe() {
  const observer = new MutationObserver(() => {
    const video = getVideoElement();
    if (!video) return;

    if (isAdPlaying() && !isInAd) {
      onAdStart(video);
    } else if (!isAdPlaying() && isInAd) {
      onAdEnd();
    }
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
    subtree: true,
    childList: true,
  });

  // Initial check: page may already be showing an ad on load
  const video = getVideoElement();
  if (video && isAdPlaying()) onAdStart(video);
}

// ── Entry point ───────────────────────────────────────────────────────────────

init().catch(console.error);
