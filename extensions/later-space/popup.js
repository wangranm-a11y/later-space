const brandStylesheet = document.createElement("link");
brandStylesheet.rel = "stylesheet";
brandStylesheet.href = "brand.css";
document.head.append(brandStylesheet);

const elements = Object.fromEntries(["status", "pageTitle", "save", "destination", "undo", "view", "recent", "recentView", "recentKind", "recentTitle", "diagnosis", "diagnosisEyebrow", "diagnosisTitle", "diagnosisDetail", "healthDot", "repair", "connect", "guide", "settings", "retry"].map((id) => [id, document.querySelector(`#${id}`)]));
let undoToken = "";
let recordIds = [];
let currentTabId = null;

function renderRecent(item) {
  if (!item?.capture || Date.now() - Number(item.savedAt || 0) > 24 * 60 * 60 * 1000) return;
  const labels = { link: "链接", image: "图片", text: "文字" };
  elements.recentKind.textContent = labels[item.capture.kind] || "内容";
  elements.recentTitle.textContent = item.capture.title || "收藏的内容";
  recordIds = item.recordIds || [];
  undoToken = item.undoToken || "";
  elements.recent.hidden = false;
}

function renderDiagnosis(result = {}) {
  const healthy = ["healthy", "local"].includes(result.state) && !result.queued;
  elements.healthDot.dataset.state = healthy ? "healthy" : result.state || "checking";
  elements.healthDot.setAttribute("aria-label", result.title || "连接状态");
  elements.diagnosis.hidden = healthy;
  if (healthy) return;
  elements.diagnosis.dataset.state = result.state || "unknown";
  elements.diagnosisEyebrow.textContent = result.state === "offline" ? "OFFLINE" : result.queued ? `${result.queued} IN QUEUE` : "CONNECTION";
  elements.diagnosisTitle.textContent = result.title || "连接需要检查";
  elements.diagnosisDetail.textContent = result.detail || "收藏会先保留在插件中。";
  elements.repair.hidden = result.repairable === false;
  elements.repair.disabled = false;
  elements.repair.textContent = ["auth", "needs-login"].includes(result.state) ? "重新连接" : "修复并重试";
}

async function refreshDiagnosis() {
  const result = await chrome.runtime.sendMessage({ type: "connection-diagnosis" }).catch(() => ({ state: "unknown", title: "暂时无法检查连接", detail: "收藏仍会保留在插件中。", repairable: true }));
  renderDiagnosis(result);
  elements.destination.textContent = result.detail || "收藏会先安全留在插件中";
  return result;
}

chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => { currentTabId = tab?.id || null; elements.pageTitle.textContent = tab?.title || tab?.url || "当前网页"; });
refreshDiagnosis();
chrome.runtime.sendMessage({ type: "onboarding-status" }).then((result) => { elements.guide.textContent = result?.onboarding?.completed ? "使用指南" : "继续新手引导"; }).catch(() => {});
chrome.runtime.sendMessage({ type: "recent-capture" }).then(renderRecent).catch(() => {});
elements.guide.addEventListener("click", () => chrome.tabs.create({ url: chrome.runtime.getURL("welcome.html") }));
elements.settings.addEventListener("click", () => chrome.runtime.openOptionsPage());

elements.save.addEventListener("click", async () => {
  globalThis.laterSpaceSound?.prepare();
  elements.save.disabled = true;
  elements.save.classList.remove("is-saved", "is-queued");
  elements.status.textContent = "正在接住…";
  let result;
  try { result = await chrome.runtime.sendMessage({ type: "capture-current", tabId: currentTabId }); }
  catch { result = { state: "unavailable" }; }
  const saved = ["saved", "duplicate"].includes(result?.state);
  elements.save.classList.add(saved ? "is-saved" : "is-queued");
  elements.save.querySelector("span").textContent = saved ? "已经接住" : result?.state === "queued" ? "已放入待发送" : "暂时没有接住";
  elements.save.querySelector("b").textContent = saved ? "✓" : "↻";
  elements.status.textContent = saved ? "可以继续浏览了。" : "内容没有丢，正在检查连接。";
  globalThis.laterSpaceSound?.play(result?.state);
  if (result?.destination?.label) elements.destination.textContent = result.destination.label;
  undoToken = result?.undoToken || "";
  recordIds = result?.recordIds || [];
  elements.view.hidden = !recordIds.length;
  elements.undo.hidden = !undoToken;
  renderRecent({ ...result, savedAt: Date.now() });
  await refreshDiagnosis();
  elements.save.disabled = false;
});

elements.repair.addEventListener("click", async () => {
  elements.repair.disabled = true;
  elements.repair.textContent = "正在修复…";
  elements.diagnosisTitle.textContent = "正在重新连接";
  elements.diagnosisDetail.textContent = "检查登录、唤醒画布并补送等待内容。";
  const result = await Promise.race([
    chrome.runtime.sendMessage({ type: "repair-connection" }),
    new Promise((resolve) => setTimeout(() => resolve({ state: "unknown", title: "这次连接有点慢", detail: "收藏仍在插件中，可以再次点击修复。", repairable: true }), 18000)),
  ]).catch(() => ({ state: "unknown", title: "暂时没有修好", detail: "收藏仍在插件中，可以稍后重试。", repairable: true }));
  if (result.sent) elements.status.textContent = `已补送 ${result.sent} 条内容`;
  renderDiagnosis(result);
  renderRecent(await chrome.runtime.sendMessage({ type: "recent-capture" }).catch(() => null));
});

elements.recentView.addEventListener("click", async () => { if (recordIds.length) await chrome.runtime.sendMessage({ type: "view-capture", recordIds }); else window.open("https://wangranm-a11y.github.io/later-space/", "_blank"); });
elements.view.addEventListener("click", async () => { if (!recordIds.length) return; const result = await chrome.runtime.sendMessage({ type: "view-capture", recordIds }).catch(() => ({ state: "unavailable" })); if (result?.state !== "viewed") elements.status.textContent = "请打开 Later Space 查看"; });
elements.undo.addEventListener("click", async () => {
  if (!undoToken) return;
  elements.undo.disabled = true;
  const result = await chrome.runtime.sendMessage({ type: "undo-capture", token: undoToken });
  elements.status.textContent = result?.state === "undone" ? "已撤销" : result?.state === "expired" ? "撤销时间已过" : "暂时无法撤销";
  if (result?.state === "undone") { undoToken = ""; elements.undo.hidden = true; elements.view.hidden = true; elements.recent.hidden = true; elements.save.querySelector("span").textContent = "加入 Later Space"; elements.save.querySelector("b").textContent = "＋"; elements.save.classList.remove("is-saved", "is-queued"); }
  elements.undo.disabled = false;
});
elements.connect.addEventListener("click", () => elements.repair.click());
elements.retry.addEventListener("click", () => elements.repair.click());
