async function load() {
  const { discoSettings = {} } = await chrome.storage.local.get("discoSettings");
  document.getElementById("backend").value = discoSettings.backendUrl || "";
  document.getElementById("key").value = discoSettings.apiKey || "";
  const { discoCodes = [] } = await chrome.storage.local.get("discoCodes");
  const list = document.getElementById("list");
  list.innerHTML = "";
  for (const c of discoCodes) {
    const li = document.createElement("li");
    li.textContent = c;
    const btn = document.createElement("button");
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
