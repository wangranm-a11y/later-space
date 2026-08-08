const endpoint = document.querySelector("#endpoint");
const token = document.querySelector("#token");
const status = document.querySelector("#status");

chrome.storage.sync.get({ endpoint: "http://127.0.0.1:5177", token: "" }).then((value) => {
  endpoint.value = value.endpoint;
  token.value = value.token;
});

function normalizedEndpoint() {
  return endpoint.value.trim().replace(/\/$/, "");
}

document.querySelector("#save").addEventListener("click", async () => {
  await chrome.storage.sync.set({ endpoint: normalizedEndpoint(), token: token.value.trim() });
  status.textContent = "设置已保存";
});

document.querySelector("#test").addEventListener("click", async () => {
  status.textContent = "正在连接…";
  try {
    const response = await fetch(`${normalizedEndpoint()}/api/inbox`, {
      headers: token.value.trim() ? { "X-Later-Space-Token": token.value.trim() } : {},
    });
    if (!response.ok) throw new Error(String(response.status));
    status.textContent = "连接成功，可以随手收藏了";
  } catch {
    status.textContent = "暂时连不上，收藏仍会排队等待发送";
  }
});
