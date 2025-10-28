window.DISCO_AI = (function(){
  const DEFAULT_BACKEND = "https://disco-backend.example.com"; // baked-in
  const CODE_REGEX = /\b[A-Z0-9][A-Z0-9\-]{4,14}\b/g;
  const GENERIC_WORDS = new Set(["PROMO","COUPON","VOUCHER","DISCOUNT","CODE","APPLY","SAVE"]);
  async function getSettings() {
    const { discoSettings = {} } = await chrome.storage.local.get("discoSettings");
    // prefer user override, else baked-in default
    return { backendUrl: discoSettings.backendUrl || DEFAULT_BACKEND, apiKey: discoSettings.apiKey || "" };
  }
  function scrapeCodesFromDom() {
    const body = document.body;
    if (!body) {
      return [];
    }

    const found = new Set();

    function addMatches(str) {
      if (!str) return;
      const upper = str.toUpperCase();
      const matches = upper.match(CODE_REGEX);
      if (!matches) return;
      for (const raw of matches) {
        const token = raw.replace(/[^A-Z0-9\-]/g, "").trim();
        if (token && !GENERIC_WORDS.has(token)) {
          found.add(token);
        }
      }
    }

    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, null);
    while (walker.nextNode()) {
      const value = walker.currentNode.nodeValue;
      if (value && value.length <= 180) {
        addMatches(value);
      }
    }

    const pageText = (body.innerText || "").toUpperCase();
    const hints = ["CODE","COUPON","PROMO","VOUCHER","DISCOUNT"];
    for (const h of hints) {
      let idx = pageText.indexOf(h);
      while (idx >= 0) {
        addMatches(pageText.slice(Math.max(0, idx - 160), idx + 160));
        idx = pageText.indexOf(h, idx + h.length);
      }
    }

    const attrSelectors = [
      "[data-code]",
      "[data-coupon]",
      "[data-promo]",
      "[data-voucher]",
      "[data-clipboard-text]",
      "[data-test-id*='code']",
      "[data-testid*='code']"
    ].join(",");
    try {
      document.querySelectorAll(attrSelectors).forEach(el => {
        const attrs = Array.from(el.attributes || []);
        for (const attr of attrs) {
          if (/coupon|code|promo|voucher|clipboard/i.test(attr.name)) {
            addMatches(attr.value);
          }
        }
      });
    } catch {}

    const textSelectors = [
      "[class*='code']",
      "[class*='coupon']",
      "[class*='promo']",
      "[id*='code']",
      "[id*='coupon']",
      "[id*='promo']",
      "[aria-label*='code']",
      "[aria-label*='coupon']",
      "[aria-label*='promo']"
    ].join(",");
    try {
      document.querySelectorAll(textSelectors).forEach(el => {
        addMatches(el.textContent);
        addMatches(el.getAttribute("title"));
        addMatches(el.getAttribute("aria-label"));
      });
    } catch {}

    const scriptCandidates = Array.from(document.querySelectorAll("script[type='application/json'],script:not([src])"))
      .slice(0, 6);
    for (const script of scriptCandidates) {
      const text = script.textContent;
      if (text && text.length <= 4000) {
        addMatches(text);
      }
    }

    return Array.from(found);
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
