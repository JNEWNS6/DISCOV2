(() => {
  const LOG = (...a) => console.log("[Disco]", ...a);
  const AD = (window.DISCO_ADAPTERS || {platforms:{}, retailers:[]});
  const AI = window.DISCO_AI;
  const SAVINGS_KEY = "discoSavingsTotal";
  let savingsLoaded = false;
  let totalSavings = 0;
  let lastPillCount = null;

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

  function normalizeCode(raw) {
    if (!raw) return "";
    const upper = String(raw).toUpperCase().trim();
    return upper.replace(/[^A-Z0-9-]/g, "");
  }

  async function saveManualCode(raw) {
    const code = normalizeCode(raw);
    if (!code) {
      return { code: "", added: false, codes: [] };
    }
    let { discoCodes = [] } = await chrome.storage.local.get("discoCodes");
    discoCodes = Array.isArray(discoCodes) ? discoCodes.filter(Boolean).map(normalizeCode) : [];
    const existed = discoCodes.includes(code);
    const next = discoCodes.filter(existing => existing !== code);
    next.unshift(code);
    try {
      await chrome.storage.local.set({ discoCodes: next });
    } catch {}
    return { code, added: !existed, codes: next };
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
      :root {
        --disco-accent: #6c5ce7;
        --disco-accent-strong: #4e3ecf;
        --disco-accent-soft: #efeaff;
        --disco-accent-text: #ffffff;
        --disco-surface: rgba(255,255,255,0.96);
        --disco-border: rgba(108,92,231,0.24);
        --disco-shadow: rgba(78,62,207,0.25);
      }
      .disco-pill {
        position: fixed; right: 14px; bottom: 14px; z-index: 2147483647;
        padding: 9px 14px; border: 1px solid var(--disco-border); border-radius: 999px;
        background: linear-gradient(135deg, var(--disco-accent) 0%, #8c7bff 100%);
        color: var(--disco-accent-text);
        font: 600 12px/1 system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
        box-shadow: 0 12px 24px var(--disco-shadow);
        cursor: pointer; backdrop-filter: saturate(160%) blur(6px);
        letter-spacing: 0.01em;
        transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
      }
      .disco-pill:hover { transform: translateY(-1px); box-shadow: 0 16px 28px var(--disco-shadow); }
      .disco-pill.disco-pill-empty {
        background: linear-gradient(135deg, rgba(108,92,231,0.16) 0%, rgba(140,123,255,0.26) 100%);
        color: var(--disco-accent);
        border-color: rgba(108,92,231,0.35);
      }
      .disco-pill.disco-pill-empty .disco-pill-badge {
        background: rgba(255,255,255,0.9);
        color: var(--disco-accent);
        border-color: rgba(108,92,231,0.4);
      }
      .disco-pill-label { display:inline-flex; align-items:center; gap:6px; font-size:12px; }
      .disco-pill-badge {
        display:inline-flex; align-items:center; justify-content:center;
        margin-left:10px; padding:2px 8px; border-radius:999px; font-size:11px;
        background: rgba(255,255,255,0.22); color: var(--disco-accent-text);
        border: 1px solid rgba(255,255,255,0.35);
        min-width: 20px;
      }
      .disco-modal {
        position: fixed; right: 16px; bottom: 60px; max-width: 360px;
        background: var(--disco-surface); color: #1a133b; border-radius: 16px;
        border: 1px solid var(--disco-border); padding: 16px; z-index: 2147483647;
        box-shadow: 0 22px 44px var(--disco-shadow);
        backdrop-filter: blur(8px);
      }
      .disco-row { display:flex; gap:8px; align-items:center; flex-wrap: wrap; }
      .disco-title { font-weight:600; margin-bottom:6px; }
      .disco-btn { padding:6px 10px; border-radius:8px; border:1px solid #ddd; background:#fff; cursor:pointer; }
      .disco-input { flex: 1 1 140px; min-width: 0; padding:6px 8px; border-radius:8px; border:1px solid rgba(0,0,0,0.18); font: 500 12px/1.4 system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
      .disco-input:focus { outline: 2px solid rgba(108,92,231,0.55); outline-offset: 1px; border-color: rgba(108,92,231,0.55); }
      .disco-manual-row { width: 100%; margin-top: 6px; }
      .disco-list { max-height: 180px; overflow:auto; margin:8px 0; }
      .disco-chip { display:inline-flex; align-items:center; gap:8px; padding:6px 8px; border:1px solid #eee; border-radius:999px; margin:4px 4px 0 0; cursor:pointer; }
      .disco-chip.selected { background:#111; color:#fff; border-color:#111; }
      .disco-total { margin-top: 10px; font-size:13px; font-weight:500; }
      @media (prefers-color-scheme: dark) {
        :root {
          --disco-surface: rgba(22,18,48,0.88);
          --disco-border: rgba(156,143,255,0.3);
          --disco-shadow: rgba(17,11,58,0.55);
        }
        .disco-pill { color: var(--disco-accent-text); box-shadow: 0 12px 32px rgba(12,8,42,0.55); border-color: rgba(156,143,255,0.45); }
        .disco-pill.disco-pill-empty { background: linear-gradient(135deg, rgba(108,92,231,0.38) 0%, rgba(140,123,255,0.48) 100%); color: var(--disco-accent-text); border-color: rgba(156,143,255,0.55); }
        .disco-pill-badge { background: rgba(255,255,255,0.25); color: var(--disco-accent-text); }
        .disco-pill.disco-pill-empty .disco-pill-badge { background: rgba(17,11,58,0.55); color: var(--disco-accent-text); border-color: rgba(156,143,255,0.6); }
        .disco-modal { color:#f0edff; border-color: var(--disco-border); }
        .disco-title { color:#f0edff; }
        .disco-btn { background: rgba(108,92,231,0.18); color:#f5f3ff; border-color: rgba(156,143,255,0.4); }
        .disco-btn:hover { background: rgba(108,92,231,0.28); }
        .disco-btn.primary { background: linear-gradient(135deg, var(--disco-accent) 0%, #8c7bff 100%); border-color: transparent; }
        .disco-chip { background: rgba(22,18,48,0.72); color:#e3defc; border-color: rgba(156,143,255,0.4); }
        .disco-chip:hover { border-color: rgba(192,183,255,0.7); box-shadow: 0 4px 16px rgba(30,20,80,0.6); }
        .disco-chip.selected { color: var(--disco-accent-text); }
        .disco-total { color:#f0edff; background: rgba(108,92,231,0.28); }
        .disco-row small { color: rgba(223,219,255,0.75); }
        .disco-input { background: rgba(22,18,48,0.72); color:#f0edff; border-color: rgba(156,143,255,0.5); }
        .disco-input:focus { outline-color: rgba(192,183,255,0.8); border-color: rgba(192,183,255,0.8); }
      }
    `;
    document.documentElement.appendChild(style);
  }

  function mountPill(count) {
    let pill = document.querySelector(".disco-pill");
    if (!pill) {
      pill = document.createElement("button");
      pill.className = "disco-pill";
      pill.type = "button";
      pill.onclick = openModalAndPrefill;
      document.documentElement.appendChild(pill);
    }
    const safeCount = Number.isFinite(count) && count > 0 ? Math.round(count) : 0;
    if (lastPillCount === safeCount) return pill;
    lastPillCount = safeCount;
    pill.innerHTML = "";
    pill.classList.toggle("disco-pill-empty", safeCount === 0);
    const label = document.createElement("span");
    label.className = "disco-pill-label";
    label.textContent = safeCount === 0 ? "Add promo code" : "Disco promo codes";
    pill.appendChild(label);
    const badge = document.createElement("span");
    badge.className = "disco-pill-badge";
    badge.textContent = safeCount === 0 ? "+" : String(safeCount);
    pill.appendChild(badge);
    pill.title = safeCount === 0
      ? "Click to add and try your own promo codes"
      : `Click to choose from ${safeCount} promo codes`;
    return pill;
  }

  function openModal() {
    let modal = document.querySelector(".disco-modal");
    if (modal) return modal;
    modal = document.createElement("div");
    modal.className = "disco-modal";

    const title = document.createElement("div");
    title.className = "disco-title";
    title.textContent = "Disco – Select codes";
    modal.appendChild(title);

    const actionRow = document.createElement("div");
    actionRow.className = "disco-row";

    const applySelectedBtn = document.createElement("button");
    applySelectedBtn.className = "disco-btn";
    applySelectedBtn.id = "disco-apply-selected";
    applySelectedBtn.textContent = "Apply selected";
    applySelectedBtn.onclick = applySelected;
    actionRow.appendChild(applySelectedBtn);

    const applyBestBtn = document.createElement("button");
    applyBestBtn.className = "disco-btn primary";
    applyBestBtn.id = "disco-apply-best";
    applyBestBtn.textContent = "Apply best";
    applyBestBtn.onclick = applyBest;
    actionRow.appendChild(applyBestBtn);

    const closeBtn = document.createElement("button");
    closeBtn.className = "disco-btn";
    closeBtn.id = "disco-close";
    closeBtn.textContent = "Close";
    closeBtn.onclick = () => modal.remove();
    actionRow.appendChild(closeBtn);

    modal.appendChild(actionRow);

    const manualRow = document.createElement("div");
    manualRow.className = "disco-row disco-manual-row";
    manualRow.id = "disco-manual-row";

    const manualInput = document.createElement("input");
    manualInput.id = "disco-manual";
    manualInput.className = "disco-input";
    manualInput.type = "text";
    manualInput.placeholder = "Enter a code manually";
    manualRow.appendChild(manualInput);

    const manualButton = document.createElement("button");
    manualButton.className = "disco-btn";
    manualButton.id = "disco-add-manual";
    manualButton.textContent = "Save code";
    manualRow.appendChild(manualButton);

    modal.appendChild(manualRow);

    const list = document.createElement("div");
    list.className = "disco-list";
    list.id = "disco-list";
    modal.appendChild(list);

    const total = document.createElement("div");
    total.className = "disco-total";
    total.id = "disco-total";
    total.textContent = "Total saved with Disco: £0.00";
    modal.appendChild(total);

    const statusRow = document.createElement("div");
    statusRow.className = "disco-row";
    const status = document.createElement("small");
    status.id = "disco-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    statusRow.appendChild(status);
    modal.appendChild(statusRow);

    const handleManual = async () => {
      const result = await saveManualCode(manualInput.value);
      if (!result.code) {
        setStatus("Enter a code to save.");
        return;
      }
      manualInput.value = "";
      const domain = location.hostname.replace(/^www\./, "");
      const codes = await collectCodes(domain);
      renderCodes(codes, new Set([result.code]));
      mountPill(codes.length);
      setStatus(result.added ? `Saved ${result.code}. Select it below.` : `${result.code} is already saved.`);
    };

    manualButton.onclick = handleManual;
    manualInput.addEventListener("keydown", (event) => {
      if (event?.key === "Enter") {
        event.preventDefault?.();
        handleManual();
      }
    });

    document.documentElement.appendChild(modal);
    return modal;
  }

  function renderCodes(codes, selected = new Set()) {
    const list = document.getElementById("disco-list");
    if (!list) return;
    const selectedSet = selected instanceof Set ? selected : new Set(selected || []);
    list.innerHTML = "";
    for (const c of codes) {
      const chip = document.createElement("span");
      chip.className = "disco-chip";
      if (selectedSet.has(c)) {
        chip.classList.add("selected");
      }
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
    const storedRaw = await chrome.storage.local.get("discoCodes");
    const storedList = Array.isArray(storedRaw?.discoCodes) ? storedRaw.discoCodes : [];
    const scraped = AI.scrapeCodesFromDom();
    const suggestedData = await AI.fetchCodeSuggestions(domain);
    const suggested = Array.isArray(suggestedData?.codes) ? suggestedData.codes : [];
    const pool = new Set();
    for (const source of [storedList, scraped, suggested]) {
      for (const value of source || []) {
        const code = normalizeCode(value);
        if (code) pool.add(code);
      }
    }
    const merged = Array.from(pool);
    const rankData = await AI.rankCodesWithAI(domain, { codes: merged });
    if (rankData?.codes?.length) {
      const ranked = rankData.codes
        .slice()
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .map(entry => normalizeCode(entry.code))
        .filter(Boolean);
      const combined = Array.from(new Set([...ranked, ...merged]));
      return combined;
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
    setStatus(codes.length ? "Tip: click to select codes." : "No codes found yet. Add your own below.");
    mountPill(codes.length);
    getTotalSavings().then(updateTotalDisplay);
  }

  async function init() {
    ensureStyles();
    if (!isCheckoutLike()) return;

    const sels = selectorsForRetailer(currentRetailer());
    const field = $(sels.coupon);
    if (!field) return;

    const domain = location.hostname.replace(/^www\\./,"");
    mountPill(0);
    const codes = await collectCodes(domain);
    mountPill(codes.length);

    const mo = new MutationObserver(async () => {
      if ($(sels.coupon) && !document.querySelector(".disco-pill")) {
        const codes = await collectCodes(domain);
        mountPill(codes.length);
      }
    });
    mo.observe(document, { childList: true, subtree: true });
  }

  chrome.runtime.onMessage.addListener((m) => { if (m?.type === "DISCO_INIT") init(); });
  try { init(); } catch {}

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      __testHooks: {
        collectCodes,
        applyBest,
        tryOne,
        incrementSavings,
        setStatus,
        ensureSavingsLoaded,
        selectorsForRetailer,
        currentRetailer,
        getSelectedCodes,
        mountPill,
        openModalAndPrefill,
      },
    };
  }
})();
