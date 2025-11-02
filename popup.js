async function load() {
  try {
    const hero = document.getElementById("disco-hero-icon");
    if (hero && self?.DISCO_ICON_BASE64?.["48"]) {
      hero.src = `data:image/png;base64,${self.DISCO_ICON_BASE64["48"]}`;
    }
  } catch {}
  const { discoSettings = {} } = await chrome.storage.local.get("discoSettings");
  document.getElementById("backend").value = discoSettings.backendUrl || "";
  document.getElementById("key").value = discoSettings.apiKey || "";
  try {
    const stored = await chrome.storage.local.get("discoSavingsTotal");
    const raw = stored?.discoSavingsTotal;
    const amount = typeof raw === "number" ? raw : parseFloat(raw);
    const total = Number.isFinite(amount) && amount > 0 ? amount : 0;
    const totalEl = document.getElementById("total-savings");
    if (totalEl) {
      totalEl.textContent = `Total saved with Disco: £${total.toFixed(2)}`;
    }
  } catch {}
  const { discoCodes = [] } = await chrome.storage.local.get("discoCodes");
  const list = document.getElementById("list");
  list.innerHTML = "";
  for (const c of discoCodes) {
    const li = document.createElement("li");
    li.textContent = c;
    const btn = document.createElement("button");
    btn.className = "secondary";
    btn.textContent = "Remove";
    btn.onclick = async () => {
      const { discoCodes = [] } = await chrome.storage.local.get("discoCodes");
      await chrome.storage.local.set({ discoCodes: discoCodes.filter(x => x !== c) });
      load();
    };
    li.appendChild(btn);
    list.appendChild(li);
  }
}
document.getElementById("save").onclick = async () => {
  const backendUrl = document.getElementById("backend").value.trim();
  const apiKey = document.getElementById("key").value.trim();
  await chrome.storage.local.set({ discoSettings: { backendUrl, apiKey }});
  load();
};
document.getElementById("clear").onclick = async () => {
  await chrome.storage.local.remove("discoSettings");
  load();
};
document.getElementById("add").onclick = async () => {
  const inp = document.getElementById("code");
  const v = (inp.value || "").trim();
  if (!v) return;
  const { discoCodes = [] } = await chrome.storage.local.get("discoCodes");
  if (!discoCodes.includes(v)) discoCodes.push(v);
  await chrome.storage.local.set({ discoCodes });
  inp.value = "";
  load();
};
load();
