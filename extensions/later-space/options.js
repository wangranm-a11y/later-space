const APP_URL = "https://wangranm-a11y.github.io/later-space/";
const status = document.querySelector("#status");
const soundEnabled = document.querySelector("#soundEnabled");

chrome.storage.local.get({ laterSpaceSoundEnabled: true }).then((stored) => { soundEnabled.checked = stored.laterSpaceSoundEnabled !== false; });
soundEnabled.addEventListener("change", async () => {
  await chrome.storage.local.set({ laterSpaceSoundEnabled: soundEnabled.checked });
  status.textContent = soundEnabled.checked ? "收藏提示音已开启" : "收藏提示音已关闭";
});

document.querySelector("#guide").addEventListener("click", () => chrome.tabs.create({ url: chrome.runtime.getURL("welcome.html") }));

document.querySelector("#open").addEventListener("click", () => chrome.tabs.create({ url: APP_URL }));

document.querySelector("#test").addEventListener("click", async () => {
  status.textContent = "正在连接…";
  try {
    const response = await fetch(APP_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(String(response.status));
    status.textContent = "正式版连接成功，可以随手收藏了";
  } catch {
    status.textContent = "暂时连不上，收藏会留在插件中等待重试";
  }
});
