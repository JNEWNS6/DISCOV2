(() => {
  const LOG = (...a) => console.log("[Disco]", ...a);
  const AD = (window.DISCO_ADAPTERS || {platforms:{}, retailers:[]});
  const AI = window.DISCO_AI;
  const SAVINGS_KEY = "discoSavingsTotal";
  let savingsLoaded = false;
  let totalSavings = 0;

  async function ensureSavingsLoaded() {
    if (savingsLoaded) return totalSavings;
    try {
      const stored = await chrome.storage.local.get(SAVINGS_KEY);
      const raw = stored?.[SAVINGS_KEY];
      const parsed = typeof raw === "number" ? raw : parseFloat(raw);
      if (Number.isFinite(parsed) && parsed > 0) {
        totalSavings = parseFloat(parsed.toFixed(2));
      } else {
        totalSavings = 0;
      }
    } catch {
      totalSavings = 0;
    }
    savingsLoaded = true;
    return totalSavings;
  }

  function formatSavings(amount) {
    const safe = Number.isFinite(amount) && amount > 0 ? amount : 0;
    return `£${safe.toFixed(2)}`;
  }

  function updateTotalDisplay() {
    const el = document.getElementById("disco-total");
    if (el) {
      el.textContent = `Total saved with Disco: ${formatSavings(totalSavings)}`;
    }
  }

  async function incrementSavings(delta) {
    if (!(delta > 0)) return totalSavings;
    await ensureSavingsLoaded();
    totalSavings = parseFloat((totalSavings + delta).toFixed(2));
    try {
      await chrome.storage.local.set({ [SAVINGS_KEY]: totalSavings });
    } catch {}
    updateTotalDisplay();
    return totalSavings;
  }

  async function getTotalSavings() {
    await ensureSavingsLoaded();
    return totalSavings;
  }

  function isCheckoutLike(urlStr = location.href) {
    try {
      const u = new URL(urlStr);
      const path = (u.pathname + " " + (u.hash || "")).toLowerCase();
      const hints = ["checkout","cart","bag","basket","payment","order"];
      return hints.some(s => path.includes(s));
    } catch { return false; }
  }

  function currentRetailer() {
    try {
      const host = location.host;
      for (const r of AD.retailers) {
        if (r.domains.some(d => host === d || host.endsWith("." + d))) return r;
      }
    } catch {}
    return null;
  }

  function selectorsForRetailer(r) {
    const pf = (r && AD.platforms[r.platform]) ? AD.platforms[r.platform] : AD.platforms["generic"];
    return pf || AD.platforms["generic"];
  }

  function $(arr) {
    for (const sel of arr || []) {
      try {
        const el = document.querySelector(sel);
        if (el) return el;
      } catch {}
    }
    return null;
  }

  function setInputValue(el, value) {
    if (!el) return;
    el.focus();
    el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function clickEl(el) { if (el) el.click(); }

  function readTotal(arr) {
    const node = $(arr);
    if (!node) return null;
    const text = (node.innerText || node.textContent || "").replace(/[, ]/g, "");
    const m = text.match(/([£$€])?(\d+(\.\d{1,2})?)/);
    return m ? parseFloat(m[2]) : null;
  }

  function ensureStyles() {
    if (document.getElementById("disco-style")) return;
    const style = document.createElement("style");
    style.id = "disco-style";
    style.textContent = `
      .disco-pill {
        position: fixed; right: 14px; bottom: 14px; z-index: 2147483647;
        padding: 8px 12px; border: 1px solid rgba(0,0,0,0.08); border-radius: 999px;
        background: rgba(255,255,255,0.92); color: #111;
        font: 500 12px/1 system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
        box-shadow: 0 6px 18px rgba(0,0,0,0.12);
        cursor: pointer; backdrop-filter: saturate(140%) blur(6px);
      }
      .disco-pill-badge {
        display:inline-block; margin-left:8px; padding:2px 6px; border-radius:999px; font-size:11px;
        background:#111; color:#fff;
      }
      .disco-modal {
        position: fixed; right: 16px; bottom: 60px; max-width: 360px;
        background: rgba(255,255,255,0.98); color: #111; border-radius: 12px;
        border: 1px solid rgba(0,0,0,0.08); padding: 12px; z-index: 2147483647;
        box-shadow: 0 10px 28px rgba(0,0,0,.18);
      }
      .disco-row { display:flex; gap:8px; align-items:center; flex-wrap: wrap; }
      .disco-title { font-weight:600; margin-bottom:6px; }
      .disco-btn { padding:6px 10px; border-radius:8px; border:1px solid #ddd; background:#fff; cursor:pointer; }
      .disco-list { max-height: 180px; overflow:auto; margin:8px 0; }
      .disco-chip { display:inline-flex; align-items:center; gap:8px; padding:6px 8px; border:1px solid #eee; border-radius:999px; margin:4px 4px 0 0; cursor:pointer; }
      .disco-chip.selected { background:#111; color:#fff; border-color:#111; }
      .disco-total { margin-top: 10px; font-size:13px; font-weight:500; }
      @media (prefers-color-scheme: dark) {
        .disco-pill{ background: rgba(28,28,28,0.9); color: #f2f2f2; border-color: rgba(255,255,255,0.08); }
        .disco-pill-badge{ background:#f2f2f2; color:#111; }
        .disco-modal{ background: rgba(28,28,28,0.98); color: #f2f2f2; border-color: rgba(255,255,255,0.08); }
        .disco-btn{ background:#222; border-color:#333; color:#eee; }
        .disco-chip{ border-color:#333; }
        .disco-chip.selected{ background:#f2f2f2; color:#111; }
      }
    `;
    document.documentElement.appendChild(style);
  }

  function mountPill(count) {
    let pill = document.querySelector(".disco-pill");
    if (!pill) {
      pill = document.createElement("button");
      pill.className = "disco-pill";
      pill.onclick = openModalAndPrefill;
      document.documentElement.appendChild(pill);
    }
    pill.textContent = "Disco codes";
    const badge = document.createElement("span");
    badge.className = "disco-pill-badge";
    badge.textContent = String(count);
    pill.appendChild(badge);
  }

  function openModal() {
    let modal = document.querySelector(".disco-modal");
    if (modal) return modal;
    modal = document.createElement("div");
    modal.className = "disco-modal";
    modal.innerHTML = `
      <div class="disco-title">Disco – Select codes</div>
      <div class="disco-row">
        <button class="disco-btn" id="disco-apply-selected">Apply selected</button>
        <button class="disco-btn" id="disco-apply-best">Apply best</button>
        <button class="disco-btn" id="disco-close">Close</button>
      </div>
      <div class="disco-list" id="disco-list"></div>
      <div class="disco-total" id="disco-total">Total saved with Disco: £0.00</div>
      <div class="disco-row"><small id="disco-status"></small></div>
    `;
    document.documentElement.appendChild(modal);
    modal.querySelector("#disco-close").onclick = () => modal.remove();
    modal.querySelector("#disco-apply-selected").onclick = applySelected;
    modal.querySelector("#disco-apply-best").onclick = applyBest;
    return modal;
  }

  function renderCodes(codes) {
    const list = document.getElementById("disco-list");
    list.innerHTML = "";
    for (const c of codes) {
    const chip = document.createElement("span");
      chip.className = "disco-chip";
      chip.textContent = c;
      chip.onclick = () => chip.classList.toggle("selected");
      list.appendChild(chip);
    }
  }

  function getSelectedCodes() {
    return Array.from(document.querySelectorAll(".disco-chip.selected")).map(el => el.textContent);
  }

  function setStatus(t) {
    const el = document.getElementById("disco-status");
    if (el) el.textContent = t || "";
  }

  async function collectCodes(domain) {
    const { discoCodes = [] } = await chrome.storage.local.get("discoCodes");
    const scraped = AI.scrapeCodesFromDom();
    const suggestedData = await AI.fetchCodeSuggestions(domain);
    const suggested = suggestedData?.codes || [];
    const merged = Array.from(new Set([...discoCodes, ...scraped, ...suggested]));
    const rankData = await AI.rankCodesWithAI(domain, { codes: merged });
    if (rankData?.codes?.length) {
      return rankData.codes.sort((a,b)=> (b.score||0)-(a.score||0)).map(x=>x.code);
    }
    return merged;
  }

  async function tryOne(code, sels) {
    const input = $(sels.coupon);
    if (!input) throw new Error("Coupon field not found");
    const before = readTotal(sels.total);
    setInputValue(input, code);
    clickEl($(sels.apply));
    await new Promise(r => setTimeout(r, 1600));
    const after = readTotal(sels.total);
    const saved = (before!=null && after!=null && after < before) ? (before - after) : 0;
    // log event via baked backend
    const domain = location.hostname.replace(/^www\\./,"");
    AI.postEvent(domain, { code, success: saved > 0, saved, before_total: before, after_total: after });
    if (saved > 0) {
      await incrementSavings(saved);
    }
    return { code, before, after, saved };
  }

  async function applySelected() {
    const codes = getSelectedCodes();
    if (!codes.length) { setStatus("Select at least one code."); return; }
    const sels = selectorsForRetailer(currentRetailer());
    let best = { code:null, saved:0 };
    for (const c of codes) {
      setStatus(`Trying ${c}…`);
      try {
        const res = await tryOne(c, sels);
        if (res.saved > best.saved) best = res;
      } catch(e) { LOG("fail", c, e.message); }
    }
    if (best.code) setStatus(`Best: ${best.code} saved £${best.saved.toFixed(2)} 🎉`);
    else setStatus("No savings found.");
  }

  async function applyBest() {
    const domain = location.hostname.replace(/^www\\./,"");
    setStatus("Ranking codes…");
    const codes = await collectCodes(domain);
    const sels = selectorsForRetailer(currentRetailer());
    for (const c of codes) {
      setStatus(`Trying ${c}…`);
      try {
        const res = await tryOne(c, sels);
        if (res.saved > 0) { setStatus(`Applied ${c} — saved £${res.saved.toFixed(2)} 🎉`); return; }
      } catch(e) { LOG("fail", c, e.message); }
    }
    setStatus("No savings found.");
  }

  async function openModalAndPrefill() {
    const modal = openModal();
    const domain = location.hostname.replace(/^www\\./,"");
    setStatus("Loading codes…");
    const codes = await collectCodes(domain);
    renderCodes(codes);
    setStatus(codes.length ? "Tip: click to select codes" : "No codes found.");
    getTotalSavings().then(updateTotalDisplay);
  }

  async function init() {
    ensureStyles();
    if (!isCheckoutLike()) return;

    const sels = selectorsForRetailer(currentRetailer());
    const field = $(sels.coupon);
    if (!field) return;

    const domain = location.hostname.replace(/^www\\./,"");
    const codes = await collectCodes(domain);
    if (codes.length > 0) {
      mountPill(codes.length);
    }

    const mo = new MutationObserver(async () => {
      if ($(sels.coupon) && !document.querySelector(".disco-pill")) {
        const codes = await collectCodes(domain);
        if (codes.length > 0) mountPill(codes.length);
      }
    });
    mo.observe(document, { childList: true, subtree: true });
  }

  chrome.runtime.onMessage.addListener((m) => { if (m?.type === "DISCO_INIT") init(); });
  try { init(); } catch {}
})();
