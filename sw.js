console.log("[Disco] sw.js started", new Date().toISOString());

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
