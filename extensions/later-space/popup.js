const status = document.querySelector("#status");
const title = document.querySelector("#pageTitle");
const retry = document.querySelector("#retry");
const save = document.querySelector("#save");
const destination = document.querySelector("#destination");
const undo = document.querySelector("#undo");
let undoToken = "";

async function refreshQueue() {
  const { laterSpaceCaptureQueue = [] } = await chrome.storage.local.get({ laterSpaceCaptureQueue: [] });
  retry.hidden = !laterSpaceCaptureQueue.length;
  retry.textContent = laterSpaceCaptureQueue.length ? `重试 ${laterSpaceCaptureQueue.length} 条待发送` : "";
}

chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
  title.textContent = tab?.title || tab?.url || "当前网页";
});

chrome.runtime.sendMessage({ type: "destination-status" }).then((result) => {
  if (result?.label) destination.textContent = result.label;
});

save.addEventListener("click", async () => {
  save.disabled = true;
  status.textContent = "正在加入…";
  document.body.classList.remove("is-saved", "is-duplicate", "is-queued");
  const result = await chrome.runtime.sendMessage({ type: "capture-current" });
  const messages = {
    saved: "已加入 Later Space",
    duplicate: "已经在 Later Space 里了",
    queued: "暂时离线，稍后自动加入",
    unavailable: "暂时无法加入，请稍后重试",
  };
  status.textContent = messages[result?.state] || messages.queued;
  document.body.classList.add(`is-${result?.state || "queued"}`);
  if (result?.destination?.label) destination.textContent = result.destination.label;
  const buttonLabels = { saved: "已加入", duplicate: "已经加入", queued: "等待发送", unavailable: "加入失败" };
  save.textContent = buttonLabels[result?.state] || "加入失败";
  undoToken = result?.undoToken || "";
  undo.hidden = !undoToken;
  await refreshQueue();
});

undo.addEventListener("click", async () => {
  if (!undoToken) return;
  undo.disabled = true;
  const result = await chrome.runtime.sendMessage({ type: "undo-capture", token: undoToken });
  status.textContent = result?.state === "undone" ? "已撤销" : "暂时无法撤销";
  if (result?.state === "undone") {
    undoToken = "";
    undo.hidden = true;
    save.disabled = false;
    save.textContent = "重新加入";
  }
  undo.disabled = false;
});

retry.addEventListener("click", async () => {
  retry.disabled = true;
  await chrome.runtime.sendMessage({ type: "retry-queue" });
  await refreshQueue();
  retry.disabled = false;
});

refreshQueue();
