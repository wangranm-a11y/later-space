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
    return true;
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
    await sendCapture(normalized);
    return { state: "saved" };
  } catch {
    return { state: "queued" };
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
  chrome.contextMenus.create({ id: "later-page", title: "保存此页面到 Later Space", contexts: ["page"] });
  chrome.contextMenus.create({ id: "later-link", title: "保存此链接到 Later Space", contexts: ["link"] });
  chrome.contextMenus.create({ id: "later-image", title: "保存此图片到 Later Space", contexts: ["image"] });
  chrome.contextMenus.create({ id: "later-selection", title: "保存选中文字到 Later Space", contexts: ["selection"] });
  chrome.alarms.create("retry-captures", { periodInMinutes: 1 });
  retryQueue();
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  let result;
  if (info.menuItemId === "later-link") result = await saveCapture({ kind: "link", url: info.linkUrl, title: info.selectionText || "" });
  else if (info.menuItemId === "later-selection") result = await saveCapture({ kind: "text", text: info.selectionText || "", pageUrl: tab?.url || "" });
  else if (info.menuItemId === "later-image") {
    try { result = await imageCapture(info.srcUrl, tab?.url || ""); }
    catch { result = await saveCapture({ kind: "link", url: info.srcUrl, title: "网页图片", pageUrl: tab?.url || "" }); }
  } else result = await pageCapture(tab);
  chrome.notifications.create({ type: "basic", iconUrl: "icon-128.png", title: "Later Space", message: result.state === "saved" ? "已接住" : "已暂存，连接后自动发送" }).catch(() => {});
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
});
