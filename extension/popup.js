/**
 * popup.js — Zero Decoder-Shift extension popup
 *
 * Reads and writes state via background.js.
 * Displays theorem values computed from r* = τ/ω.
 */

"use strict";

const TAU_EXAMPLE = 30; // seconds — used for r* display

// ── DOM refs ─────────────────────────────────────────────────────────────────

const toggleEnabled = document.getElementById("toggle-enabled");
const rateSlider = document.getElementById("rate-slider");
const rateInput = document.getElementById("rate-input");
const omegaSlider = document.getElementById("omega-slider");
const omegaInput = document.getElementById("omega-input");
const adsProcessedEl = document.getElementById("ads-processed");
const timeSavedEl = document.getElementById("time-saved");
const rStarEl = document.getElementById("r-star");
const rstarDisplayEl = document.getElementById("rstar-display");
const compressedEl = document.getElementById("compressed-display");
const statusLineEl = document.getElementById("status-line");

// ── State ─────────────────────────────────────────────────────────────────────

let state = null;

async function loadState() {
  state = await chrome.runtime.sendMessage({ type: "GET_STATE" });
  render();
}

async function saveState() {
  await chrome.runtime.sendMessage({ type: "SET_STATE", payload: state });
}

// ── Render ────────────────────────────────────────────────────────────────────

function fmtTime(ms) {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

function computeTheoremValues(rate, omega_ms) {
  const omega_s = omega_ms / 1000;
  const r_star = TAU_EXAMPLE / omega_s;
  const compressed_ms = (TAU_EXAMPLE / rate) * 1000;
  const aboveThreshold = rate > r_star;
  return { r_star, compressed_ms, aboveThreshold };
}

function render() {
  if (!state) return;

  toggleEnabled.checked = state.enabled;

  rateSlider.value = state.rate;
  rateInput.value = state.rate;
  omegaSlider.value = state.omega_ms;
  omegaInput.value = state.omega_ms;

  // Metrics
  adsProcessedEl.textContent = state.stats.adsProcessed.toLocaleString();
  timeSavedEl.textContent = fmtTime(state.stats.totalTimeSavedMs);

  // Theorem display
  const { r_star, compressed_ms, aboveThreshold } = computeTheoremValues(
    state.rate,
    state.omega_ms
  );

  rStarEl.textContent = Math.round(r_star).toLocaleString();
  rstarDisplayEl.textContent = Math.round(r_star).toLocaleString();
  compressedEl.textContent =
    compressed_ms < 1
      ? `${compressed_ms.toFixed(2)} ms`
      : `${compressed_ms.toFixed(1)} ms`;

  if (!state.enabled) {
    statusLineEl.textContent = "extension disabled";
    statusLineEl.className = "status-line warning";
  } else if (aboveThreshold) {
    statusLineEl.textContent = "r > r* → zero decoder-shift guaranteed";
    statusLineEl.className = "status-line";
  } else {
    statusLineEl.textContent = `r ≤ r* — increase rate above ${Math.ceil(
      r_star
    )}`;
    statusLineEl.className = "status-line warning";
  }
}

// ── Event handlers ────────────────────────────────────────────────────────────

toggleEnabled.addEventListener("change", async () => {
  state.enabled = toggleEnabled.checked;
  await saveState();
  render();
});

function syncRate(value) {
  const v = Math.max(1, Math.min(16, parseInt(value, 10) || 1));
  state.rate = v;
  rateSlider.value = v;
  rateInput.value = v;
  render();
}

rateSlider.addEventListener("input", (e) => syncRate(e.target.value));
rateInput.addEventListener("change", (e) => {
  syncRate(e.target.value);
  saveState();
});
rateSlider.addEventListener("change", saveState);

function syncOmega(value) {
  const v = Math.max(5, Math.min(80, parseInt(value, 10) || 13));
  state.omega_ms = v;
  omegaSlider.value = v;
  omegaInput.value = v;
  render();
}

omegaSlider.addEventListener("input", (e) => syncOmega(e.target.value));
omegaInput.addEventListener("change", (e) => {
  syncOmega(e.target.value);
  saveState();
});
omegaSlider.addEventListener("change", saveState);

// ── Drift controls ────────────────────────────────────────────────────────────

const toggleDrift = document.getElementById("toggle-drift");
const driftSlider = document.getElementById("drift-slider");
const driftInput = document.getElementById("drift-input");
const driftBody = document.getElementById("drift-body");
const driftStatus = document.getElementById("drift-status");

let driftState = { enabled: false, drift: 0.6 };

async function loadDriftState() {
  driftState = await chrome.runtime.sendMessage({ type: "GET_DRIFT_STATE" });
  renderDrift();
}

async function saveDriftState() {
  await chrome.runtime.sendMessage({
    type: "SET_DRIFT_STATE",
    payload: driftState,
  });
}

function renderDrift() {
  toggleDrift.checked = driftState.enabled;
  driftSlider.value = driftState.drift;
  driftInput.value = driftState.drift;

  if (driftState.enabled) {
    driftStatus.textContent = `active — drift ${driftState.drift.toFixed(
      2
    )} — applied to all video`;
    driftStatus.className = "drift-status active";
  } else {
    driftStatus.textContent = "off — enable to apply to all video";
    driftStatus.className = "drift-status";
  }
}

toggleDrift.addEventListener("change", async () => {
  driftState.enabled = toggleDrift.checked;
  await saveDriftState();
  renderDrift();
});

function syncDrift(value) {
  const v = Math.max(0, Math.min(1, parseFloat(value) || 0));
  const rounded = Math.round(v * 20) / 20; // snap to 0.05 steps
  driftState.drift = rounded;
  driftSlider.value = rounded;
  driftInput.value = rounded;
  renderDrift();
}

driftSlider.addEventListener("input", (e) => syncDrift(e.target.value));
driftSlider.addEventListener("change", saveDriftState);
driftInput.addEventListener("change", (e) => {
  syncDrift(e.target.value);
  saveDriftState();
});

// ── Boot ──────────────────────────────────────────────────────────────────────

loadState();
loadDriftState();
