const APP_URL = "https://wangranm-a11y.github.io/later-space/";
const QUEUE_KEY = "laterSpaceCaptureQueue";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const contextImages = new Map();
const undoCaptures = new Map();

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

function feedbackText(state) {
  if (state === "saved") return "已加入 Later Space";
  if (state === "duplicate") return "已经在 Later Space 里了";
  if (state === "undone") return "已撤销";
  if (state === "unavailable") return "这张图片暂时无法加入";
  return "暂时离线，稍后自动加入";
}

function registerUndo(result) {
  if (result?.state !== "saved" || !result.recordIds?.length) return result;
  const undoToken = captureId();
  undoCaptures.set(undoToken, { recordIds: result.recordIds, createdAt: Date.now() });
  setTimeout(() => undoCaptures.delete(undoToken), 30000);
  return { ...result, undoToken };
}

async function undoCapture(token) {
  const undo = undoCaptures.get(token);
  if (!undo) return { state: "unavailable" };
  let [tab] = await chrome.tabs.query({ url: `${APP_URL}*` });
  let temporaryTab = false;
  if (!tab) {
    tab = await chrome.tabs.create({ url: `${APP_URL}?undo=extension`, active: false });
    temporaryTab = true;
  }
  try {
    const result = await deliverToTab(tab.id, { type: "undo", recordIds: undo.recordIds });
    if (result?.state === "undone") undoCaptures.delete(token);
    return result || { state: "unavailable" };
  } finally {
    if (temporaryTab) await chrome.tabs.remove(tab.id).catch(() => {});
  }
}

async function notifySourceTab(tabId, result) {
  if (!tabId) return;
  await chrome.tabs.sendMessage(tabId, {
    type: "later-space-feedback",
    text: feedbackText(result.state),
    undoToken: result.undoToken || "",
  }).catch(() => {});
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
  const response = await fetch(srcUrl, { credentials: "include" });
  if (!response.ok) throw new Error("image fetch failed");
  const blob = await response.blob();
  if (!blob.type.startsWith("image/") || blob.size > MAX_IMAGE_BYTES) throw new Error("image too large");
  const optimized = await optimizedImage(blob);
  const name = decodeURIComponent(new URL(srcUrl).pathname.split("/").pop() || "网页图片").slice(0, 180);
  return saveCapture({ kind: "image", imageData: await blobToDataUrl(optimized), mimeType: optimized.type, name: name.replace(/\.[^.]+$/, "") + ".jpg", pageUrl });
}

async function visibleImageCapture(tab, image) {
  const screenshot = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
  const source = await createImageBitmap(await (await fetch(screenshot)).blob());
  const scaleX = source.width / image.viewport.width;
  const scaleY = source.height / image.viewport.height;
  const x = Math.max(0, Math.round(image.rect.x * scaleX));
  const y = Math.max(0, Math.round(image.rect.y * scaleY));
  const width = Math.min(source.width - x, Math.max(1, Math.round(image.rect.width * scaleX)));
  const height = Math.min(source.height - y, Math.max(1, Math.round(image.rect.height * scaleY)));
  const maximumSide = 2400;
  const outputScale = Math.min(1, maximumSide / Math.max(width, height));
  const canvas = new OffscreenCanvas(Math.max(1, Math.round(width * outputScale)), Math.max(1, Math.round(height * outputScale)));
  const context = canvas.getContext("2d", { alpha: false });
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, x, y, width, height, 0, 0, canvas.width, canvas.height);
  source.close();
  const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: .9 });
  return saveCapture({ kind: "image", imageData: await blobToDataUrl(blob), mimeType: blob.type, name: "网页图片.jpg", pageUrl: tab?.url || "" });
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
  else if (info.srcUrl || (Date.now() - Number(contextImages.get(tab?.id)?.createdAt || 0) < 15000 && contextImages.get(tab?.id)?.image?.url)) {
    const contextImage = contextImages.get(tab?.id)?.image;
    const imageUrl = info.srcUrl || contextImage.url;
    try { result = await imageCapture(imageUrl, tab?.url || ""); }
    catch {
      try { result = await visibleImageCapture(tab, contextImage); }
      catch { result = { state: "unavailable" }; }
    }
  } else if (info.linkUrl) result = await saveCapture({ kind: "link", url: info.linkUrl, title: "" });
  else result = await pageCapture(tab);
  result = registerUndo(result);
  await notifySourceTab(tab?.id, result);
  const messages = {
    saved: "已加入 Later Space",
    duplicate: "已经在 Later Space 里了",
    queued: "暂时离线，稍后自动加入",
    unavailable: "这张图片暂时无法加入",
  };
  chrome.notifications.create({ type: "basic", iconUrl: "icon-128.png", title: "Later Space", message: messages[result.state] || messages.queued }).catch(() => {});
});

chrome.commands.onCommand.addListener(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const result = registerUndo(await pageCapture(tab));
  await notifySourceTab(tab?.id, result);
});

chrome.alarms.onAlarm.addListener((alarm) => { if (alarm.name === "retry-captures") retryQueue(); });
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "capture-current") {
    chrome.tabs.query({ active: true, currentWindow: true }).then(async ([tab]) => {
      const result = registerUndo(await pageCapture(tab));
      await notifySourceTab(tab?.id, result);
      return result;
    }).then(sendResponse);
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
  if (message.type === "context-image") {
    if (_sender.tab?.id) contextImages.set(_sender.tab.id, { image: message.image || { url: "" }, createdAt: Date.now() });
    sendResponse({ state: "ready" });
    return false;
  }
  if (message.type === "undo-capture") {
    undoCapture(message.token).then(sendResponse);
    return true;
  }
});
