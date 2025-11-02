importScripts("icons/discoIcons.js");

console.log("[Disco] sw.js started", new Date().toISOString());

async function discoImageDataFromBase64(b64) {
  const response = await fetch(`data:image/png;base64,${b64}`);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const context = canvas.getContext("2d");
  context.drawImage(bitmap, 0, 0);
  return context.getImageData(0, 0, bitmap.width, bitmap.height);
}

async function ensureDiscoIcons() {
  if (!self.DISCO_ICON_BASE64) return;
  try {
    const entries = await Promise.all(
      Object.entries(self.DISCO_ICON_BASE64).map(async ([size, b64]) => [
        Number(size),
        await discoImageDataFromBase64(b64)
      ])
    );
    const imageData = entries.reduce((acc, [size, data]) => {
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
