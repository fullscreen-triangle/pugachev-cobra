/**
 * background.js — service worker
 *
 * Stores per-tab state and handles messages from the content script.
 * No network requests here; all manipulation happens in content.js.
 */

const DEFAULT_STATE = {
  enabled: true,
  rate: 7500, // compression rate (playback speed multiplier)
  omega_ms: 13, // integration window in ms
  stats: {
    adsProcessed: 0,
    totalTimeSavedMs: 0,
  },
};

// Persist state in sync storage so it survives browser restarts.
chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.sync.get("zds_state");
  if (!existing.zds_state) {
    await chrome.storage.sync.set({ zds_state: DEFAULT_STATE });
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "GET_STATE") {
    chrome.storage.sync.get("zds_state").then((r) => {
      sendResponse(r.zds_state ?? DEFAULT_STATE);
    });
    return true; // keep channel open for async response
  }

  if (msg.type === "SET_STATE") {
    chrome.storage.sync.set({ zds_state: msg.payload }).then(() => {
      sendResponse({ ok: true });
      // Notify all YouTube tabs of the new state.
      chrome.tabs.query({ url: "*://*.youtube.com/*" }, (tabs) => {
        tabs.forEach((tab) => {
          chrome.tabs
            .sendMessage(tab.id, {
              type: "STATE_UPDATED",
              payload: msg.payload,
            })
            .catch(() => {}); // tab may not have content script yet
        });
      });
    });
    return true;
  }

  if (msg.type === "AD_PROCESSED") {
    // Content script reports a processed ad; update stats.
    chrome.storage.sync.get("zds_state").then((r) => {
      const state = r.zds_state ?? DEFAULT_STATE;
      state.stats.adsProcessed += 1;
      state.stats.totalTimeSavedMs += msg.payload.savedMs ?? 0;
      chrome.storage.sync.set({ zds_state: state });
    });
    return false;
  }
});
