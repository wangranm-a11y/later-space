const status = document.querySelector("#status");
const title = document.querySelector("#pageTitle");
const retry = document.querySelector("#retry");

async function refreshQueue() {
  const { laterSpaceCaptureQueue = [] } = await chrome.storage.local.get({ laterSpaceCaptureQueue: [] });
  retry.hidden = !laterSpaceCaptureQueue.length;
  retry.textContent = laterSpaceCaptureQueue.length ? `重试 ${laterSpaceCaptureQueue.length} 条待发送` : "";
}

chrome.tabs.query({ active: true, currentWindow: true }).then(async ([tab]) => {
  title.textContent = tab?.title || tab?.url || "当前网页";
  status.textContent = "正在接住…";
  const result = await chrome.runtime.sendMessage({ type: "capture-current" });
  status.textContent = result?.state === "saved" ? "已接住，可以继续浏览" : "已暂存，连接后自动发送";
  document.body.classList.add(result?.state === "saved" ? "is-saved" : "is-queued");
  refreshQueue();
});

retry.addEventListener("click", async () => {
  retry.disabled = true;
  await chrome.runtime.sendMessage({ type: "retry-queue" });
  await refreshQueue();
  retry.disabled = false;
});
