importScripts("icons/discoIcons.js");

console.log("[Disco] sw.js started", new Date().toISOString());

async function ensureDiscoIcons() {
  if (typeof self.getDiscoIconImageData !== "function") return;
  const sizes = [16, 32, 48, 128];
  try {
    const entries = await Promise.all(
      sizes.map(async (size) => {
        try {
          const data = await self.getDiscoIconImageData(size);
          return data ? [size, data] : null;
        } catch (error) {
          console.warn(`[Disco] icon generation failed for ${size}`, error);
          return null;
        }
      })
    );
    const imageData = entries.reduce((acc, entry) => {
      if (!entry) return acc;
      const [size, data] = entry;
      if (Number.isFinite(size) && data) {
        acc[size] = data;
      }
      return acc;
    }, {});
    if (Object.keys(imageData).length) {
      await chrome.action.setIcon({ imageData });
    }
  } catch (error) {
    console.error("[Disco] ensureDiscoIcons failed", error);
  }
}

ensureDiscoIcons();
chrome.runtime.onInstalled.addListener(() => {
  ensureDiscoIcons();
});

if (chrome.runtime.onStartup) {
  chrome.runtime.onStartup.addListener(() => {
    ensureDiscoIcons();
  });
}

chrome.action.onClicked.addListener(async (tab) => {
  try {
    if (!tab?.id) return;
    await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      files: ["adapters.js","ai.js","content.js"]
    });
    await chrome.tabs.sendMessage(tab.id, { type: "DISCO_INIT" });
  } catch (e) {
    console.error("[Disco] executeScript failed", e);
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg?.type === "DISCO_REGISTER_SITE" && msg?.origin && msg?.patterns?.length) {
      const id = `disco-${new URL(msg.origin).host.replace(/[^\w-]/g, "-")}`;
      try {
        await chrome.scripting.unregisterContentScripts({ ids: [id] }).catch(() => {});
        await chrome.scripting.registerContentScripts([{
          id,
          js: ["adapters.js","ai.js","content.js"],
          matches: msg.patterns,
          runAt: "document_idle",
          persistAcrossSessions: true,
          allFrames: true
        }]);
        const allow = await chrome.storage.local.get({ discoSites: {} });
        allow.discoSites[msg.origin] = msg.patterns;
        await chrome.storage.local.set(allow);
        sendResponse({ ok: true });
      } catch (e) {
        console.error("[Disco] registerContentScripts failed", e);
        sendResponse({ ok: false, error: String(e) });
      }
      return;
    }
  })();
  return true;
});
