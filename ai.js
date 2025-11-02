window.DISCO_AI = (function(){
  const DEFAULT_BACKEND = "https://disco-backend.example.com"; // baked-in
  const CODE_REGEX = /\b[A-Z0-9][A-Z0-9\-]{4,14}\b/g;
  const GENERIC_WORDS = new Set(["PROMO","COUPON","VOUCHER","DISCOUNT","CODE","APPLY","SAVE"]);
  const KEYWORD_PATTERN = /(CODE|COUPON|PROMO|VOUCHER|DISCOUNT)/i;
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

    try {
      const commentWalker = document.createTreeWalker(body, NodeFilter.SHOW_COMMENT, null);
      while (commentWalker.nextNode()) {
        const comment = commentWalker.currentNode.nodeValue;
        if (comment && comment.length <= 240) {
          addMatches(comment);
        }
      }
    } catch {}

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
        if (el.dataset) {
          for (const [key, value] of Object.entries(el.dataset)) {
            if (!value) continue;
            if (KEYWORD_PATTERN.test(key) || KEYWORD_PATTERN.test(value)) {
              addMatches(value);
            }
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
        const holder = el.closest("label,div,li,p,section,article") || el.parentElement;
        if (holder && holder !== el) {
          addMatches(holder.textContent);
        }
        if (el.dataset) {
          for (const [key, value] of Object.entries(el.dataset)) {
            if (!value) continue;
            if (KEYWORD_PATTERN.test(key) || KEYWORD_PATTERN.test(value)) {
              addMatches(value);
            }
          }
        }
        const siblings = [el.previousElementSibling, el.nextElementSibling];
        for (const sib of siblings) {
          if (!sib) continue;
          addMatches(sib.textContent);
          if (sib.dataset) {
            for (const [key, value] of Object.entries(sib.dataset)) {
              if (!value) continue;
              if (KEYWORD_PATTERN.test(key) || KEYWORD_PATTERN.test(value)) {
                addMatches(value);
              }
            }
          }
        }
      });
    } catch {}

    try {
      const metaCandidates = Array.from(document.querySelectorAll("meta[name],meta[property],meta[itemprop],link[rel],link[href]"))
        .slice(0, 120);
      for (const el of metaCandidates) {
        const attrs = [el.getAttribute("content"), el.getAttribute("href"), el.getAttribute("rel"), el.getAttribute("name"), el.getAttribute("property"), el.getAttribute("itemprop")];
        for (const attr of attrs) {
          if (!attr) continue;
          if (KEYWORD_PATTERN.test(attr)) {
            addMatches(attr);
          }
        }
      }
    } catch {}

    try {
      const inputs = Array.from(document.querySelectorAll("input,textarea,button"))
        .slice(0, 240);
      for (const el of inputs) {
        addMatches(el.value);
        addMatches(el.placeholder);
        addMatches(el.getAttribute("data-original-value"));
        addMatches(el.getAttribute("aria-label"));
        if (el.dataset) {
          for (const [key, value] of Object.entries(el.dataset)) {
            if (!value) continue;
            if (KEYWORD_PATTERN.test(key) || KEYWORD_PATTERN.test(value)) {
              addMatches(value);
            }
          }
        }
      }
    } catch {}

    const scriptCandidates = Array.from(document.querySelectorAll("script[type='application/json'],script:not([src])"))
      .slice(0, 10);
    for (const script of scriptCandidates) {
      const text = script.textContent;
      if (text && text.length <= 4000) {
        addMatches(text);
      }
    }

    try {
      const styleCandidates = Array.from(document.querySelectorAll("style"))
        .slice(0, 8);
      for (const style of styleCandidates) {
        const css = style.textContent;
        if (css && css.length <= 2000) {
          addMatches(css);
        }
      }
    } catch {}

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
