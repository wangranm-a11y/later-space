const status = document.querySelector("#status");
const title = document.querySelector("#pageTitle");
const retry = document.querySelector("#retry");
const save = document.querySelector("#save");
const destination = document.querySelector("#destination");
const undo = document.querySelector("#undo");
const view = document.querySelector("#view");
let undoToken = "";
let recordIds = [];

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
  let result;
  try { result = await chrome.runtime.sendMessage({ type: "capture-current" }); }
  catch { result = { state: "unavailable" }; }
  const messages = {
    saved: "已加入 Later Space",
    duplicate: "已加入 Later Space",
    queued: "暂时离线，稍后自动加入",
    unavailable: "暂时无法加入，请稍后重试",
  };
  status.textContent = messages[result?.state] || messages.queued;
  document.body.classList.add(`is-${result?.state || "queued"}`);
  if (result?.destination?.label) destination.textContent = result.destination.label;
  const buttonLabels = { saved: "已加入", duplicate: "已加入", queued: "等待发送", unavailable: "加入失败" };
  save.textContent = buttonLabels[result?.state] || "加入失败";
  undoToken = result?.undoToken || "";
  recordIds = result?.recordIds || [];
  view.hidden = !recordIds.length;
  undo.hidden = !undoToken;
  await refreshQueue();
});

view.addEventListener("click", async () => {
  if (!recordIds.length) return;
  view.disabled = true;
  const result = await chrome.runtime.sendMessage({ type: "view-capture", recordIds }).catch(() => ({ state: "unavailable" }));
  if (result?.state !== "viewed") status.textContent = "暂时无法定位，请打开 Later Space 查看";
  view.disabled = false;
});

undo.addEventListener("click", async () => {
  if (!undoToken) return;
  undo.disabled = true;
  const result = await chrome.runtime.sendMessage({ type: "undo-capture", token: undoToken });
  status.textContent = result?.state === "undone" ? "已撤销" : result?.state === "expired" ? "撤销时间已过" : "暂时无法撤销";
  if (result?.state === "undone") {
    undoToken = "";
    undo.hidden = true;
    view.hidden = true;
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
