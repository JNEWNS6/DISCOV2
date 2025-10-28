window.DISCO_AI = (function(){
  const DEFAULT_BACKEND = "https://disco-backend.example.com"; // baked-in
  async function getSettings() {
    const { discoSettings = {} } = await chrome.storage.local.get("discoSettings");
    // prefer user override, else baked-in default
    return { backendUrl: discoSettings.backendUrl || DEFAULT_BACKEND, apiKey: discoSettings.apiKey || "" };
  }
  function scrapeCodesFromDom() {
    const texts = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    while (walker.nextNode()) {
      const t = walker.currentNode.nodeValue.trim();
      if (t && /\b[A-Z0-9][A-Z0-9\-]{4,14}\b/.test(t)) texts.push(t);
    }
    const pageText = (document.body.innerText || "").toUpperCase();
    const nearby = [];
    const hints = ["CODE","COUPON","PROMO","VOUCHER","DISCOUNT"];
    for (const h of hints) {
      let idx = pageText.indexOf(h);
      while (idx >= 0) {
        nearby.push(...pageText.slice(Math.max(0, idx-120), idx+120).split(/\s+/));
        idx = pageText.indexOf(h, idx+1);
      }
    }
    const tokens = [...texts, ...nearby].map(s => s.toUpperCase()).filter(s => /^[A-Z0-9][A-Z0-9\-]{4,14}$/.test(s));
    const uniq = Array.from(new Set(tokens));
    return uniq.filter(x => !["PROMO","COUPON","VOUCHER","DISCOUNT","CODE","APPLY","SAVE"].includes(x));
  }
  async function rankCodesWithAI(domain, context) {
    const { backendUrl, apiKey } = await getSettings();
    try {
      const resp = await fetch(backendUrl.replace(/\/+$/,"") + "/rank", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(apiKey ? { "Authorization": `Bearer ${apiKey}` } : {}) },
        body: JSON.stringify({ domain, context })
      });
      if (!resp.ok) throw new Error("Bad response: " + resp.status);
      return await resp.json();
    } catch(e) {
      console.warn("[Disco] rank error", e);
      return null;
    }
  }
  async function fetchCodeSuggestions(domain) {
    const { backendUrl, apiKey } = await getSettings();
    try {
      const resp = await fetch(backendUrl.replace(/\/+$/,"") + "/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(apiKey ? { "Authorization": `Bearer ${apiKey}` } : {}) },
        body: JSON.stringify({ domain })
      });
      if (!resp.ok) throw new Error("Bad response: " + resp.status);
      return await resp.json();
    } catch(e) {
      console.warn("[Disco] suggest error", e);
      return null;
    }
  }
  async function postEvent(domain, payload) {
    const { backendUrl, apiKey } = await getSettings();
    try {
      const headers = { "Content-Type": "application/json" };
      if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
      await fetch(backendUrl.replace(/\/+$/,"") + "/event", {
        method: "POST",
        headers,
        body: JSON.stringify({ domain, ...payload })
      });
    } catch (e) {
      console.warn("[Disco] /event failed", e);
    }
  }
  return { getSettings, scrapeCodesFromDom, rankCodesWithAI, fetchCodeSuggestions, postEvent };
})();
