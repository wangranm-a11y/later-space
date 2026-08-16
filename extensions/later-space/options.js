const APP_URL = "https://wangranm-a11y.github.io/later-space/";
const status = document.querySelector("#status");

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
