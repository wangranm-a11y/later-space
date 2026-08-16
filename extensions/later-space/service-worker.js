const APP_URL = "https://wangranm-a11y.github.io/later-space/";
const QUEUE_KEY = "laterSpaceCaptureQueue";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function captureId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function queueCapture(capture) {
  const stored = await chrome.storage.local.get({ [QUEUE_KEY]: [] });
  const queue = stored[QUEUE_KEY];
  if (!queue.some((item) => item.id === capture.id)) queue.push(capture);
  await chrome.storage.local.set({ [QUEUE_KEY]: queue.slice(-200) });
  await chrome.action.setBadgeBackgroundColor({ color: "#1f5045" });
  await chrome.action.setBadgeText({ text: String(Math.min(queue.length, 99)) });
}

async function removeQueued(id) {
  const stored = await chrome.storage.local.get({ [QUEUE_KEY]: [] });
  const queue = stored[QUEUE_KEY].filter((item) => item.id !== id);
  await chrome.storage.local.set({ [QUEUE_KEY]: queue });
  await chrome.action.setBadgeText({ text: queue.length ? String(Math.min(queue.length, 99)) : "" });
}

async function sendCapture(capture) {
  let [tab] = await chrome.tabs.query({ url: `${APP_URL}*` });
  let temporaryTab = false;
  if (!tab) {
    tab = await chrome.tabs.create({ url: `${APP_URL}?capture=extension`, active: false });
    temporaryTab = true;
  }
  try {
    const result = await deliverToTab(tab.id, capture);
    if (!result || !["saved", "duplicate"].includes(result.state)) throw new Error("Later Space unavailable");
    await removeQueued(capture.id);
    return result;
  } finally {
    if (temporaryTab) await chrome.tabs.remove(tab.id).catch(() => {});
  }
}

async function deliverToTab(tabId, capture) {
  for (let attempt = 0; attempt < 15; attempt += 1) {
    try {
      const result = await chrome.tabs.sendMessage(tabId, { type: "later-space-capture", capture });
      if (result?.state !== "unavailable") return result;
    } catch {
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  return null;
}

async function saveCapture(capture) {
  const normalized = { id: capture.id || captureId(), createdAt: capture.createdAt || Date.now(), source: "chrome-extension", ...capture };
  await queueCapture(normalized);
  try {
    return await sendCapture(normalized);
  } catch {
    return { state: "queued" };
  }
}

async function destinationStatus() {
  const [tab] = await chrome.tabs.query({ url: `${APP_URL}*` });
  if (!tab) return { label: "当前浏览器 · 加入后确认保存位置" };
  try {
    const result = await deliverToTab(tab.id, { type: "status" });
    return result?.destination || { label: "当前浏览器 · 保存位置未确认" };
  } catch {
    return { label: "当前浏览器 · 保存位置未确认" };
  }
}

async function retryQueue() {
  const stored = await chrome.storage.local.get({ [QUEUE_KEY]: [] });
  for (const capture of stored[QUEUE_KEY]) {
    try { await sendCapture(capture); } catch { break; }
  }
}

async function blobToDataUrl(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 32768) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
  }
  return `data:${blob.type || "image/jpeg"};base64,${btoa(binary)}`;
}

async function optimizedImage(blob) {
  const bitmap = await createImageBitmap(blob);
  const maximumSide = 2400;
  const scale = Math.min(1, maximumSide / Math.max(bitmap.width, bitmap.height));
  const canvas = new OffscreenCanvas(Math.max(1, Math.round(bitmap.width * scale)), Math.max(1, Math.round(bitmap.height * scale)));
  const context = canvas.getContext("2d", { alpha: false });
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.convertToBlob({ type: "image/jpeg", quality: .82 });
}

async function imageCapture(srcUrl, pageUrl) {
  const response = await fetch(srcUrl);
  if (!response.ok) throw new Error("image fetch failed");
  const blob = await response.blob();
  if (!blob.type.startsWith("image/") || blob.size > MAX_IMAGE_BYTES) throw new Error("image too large");
  const optimized = await optimizedImage(blob);
  const name = decodeURIComponent(new URL(srcUrl).pathname.split("/").pop() || "网页图片").slice(0, 180);
  return saveCapture({ kind: "image", imageData: await blobToDataUrl(optimized), mimeType: optimized.type, name: name.replace(/\.[^.]+$/, "") + ".jpg", pageUrl });
}

function pageCapture(tab) {
  return saveCapture({ kind: "link", url: tab?.url || "", title: tab?.title || "" });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: "later-add", title: "加入 Later Space", contexts: ["page", "link", "image", "selection"] });
  });
  chrome.alarms.create("retry-captures", { periodInMinutes: 1 });
  retryQueue();
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  let result;
  if (info.menuItemId !== "later-add") return;
  if (info.selectionText) result = await saveCapture({ kind: "text", text: info.selectionText, pageUrl: tab?.url || "" });
  else if (info.srcUrl) {
    try { result = await imageCapture(info.srcUrl, tab?.url || ""); }
    catch { result = await saveCapture({ kind: "link", url: info.srcUrl, title: "网页图片", pageUrl: tab?.url || "" }); }
  } else if (info.linkUrl) result = await saveCapture({ kind: "link", url: info.linkUrl, title: "" });
  else result = await pageCapture(tab);
  const messages = {
    saved: "已加入 Later Space",
    duplicate: "已经在 Later Space 里了",
    queued: "暂时离线，稍后自动加入",
  };
  chrome.notifications.create({ type: "basic", iconUrl: "icon-128.png", title: "Later Space", message: messages[result.state] || messages.queued }).catch(() => {});
});

chrome.commands.onCommand.addListener(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await pageCapture(tab);
});

chrome.alarms.onAlarm.addListener((alarm) => { if (alarm.name === "retry-captures") retryQueue(); });
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "capture-current") {
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => pageCapture(tab)).then(sendResponse);
    return true;
  }
  if (message.type === "retry-queue") {
    retryQueue().then(async () => sendResponse(await chrome.storage.local.get({ [QUEUE_KEY]: [] })));
    return true;
  }
  if (message.type === "destination-status") {
    destinationStatus().then(sendResponse);
    return true;
  }
});
