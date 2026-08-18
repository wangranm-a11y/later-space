const APP_URL = "https://wangranm-a11y.github.io/later-space/";
const QUEUE_KEY = "laterSpaceCaptureQueue";
const UNDO_KEY = "laterSpaceUndoCaptures";
const LAST_CAPTURE_KEY = "laterSpaceLastCapture";
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

async function laterSpaceTab(windowId) {
  const tabs = await chrome.tabs.query({ url: `${APP_URL}*` });
  return tabs.find((tab) => tab.windowId === windowId) || tabs[0];
}

async function sendCapture(capture) {
  let tab = await laterSpaceTab(capture.windowId);
  let temporaryTab = false;
  if (!tab) {
    tab = await chrome.tabs.create({ url: `${APP_URL}?capture=extension`, active: false });
    temporaryTab = true;
  }
  try {
    const result = await deliverToTab(tab.id, capture);
    if (!result || !["saved", "duplicate"].includes(result.state)) throw new Error("Later Space unavailable");
    await removeQueued(capture.id);
    return { ...result, windowId: capture.windowId, capture: captureSummary(capture) };
  } finally {
    if (temporaryTab) await chrome.tabs.remove(tab.id).catch(() => {});
  }
}

async function deliverToTab(tabId, capture) {
  let reinjected = false;
  for (let attempt = 0; attempt < 15; attempt += 1) {
    try {
      const result = await chrome.tabs.sendMessage(tabId, { type: "later-space-capture", capture });
      if (result?.state !== "unavailable") return result;
    } catch {
      if (!reinjected) {
        reinjected = true;
        await chrome.scripting.executeScript({ target: { tabId }, files: ["page-bridge.js"] }).catch(() => {});
      }
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
    return { state: "queued", windowId: normalized.windowId, capture: captureSummary(normalized) };
  }
}

function captureSummary(capture) {
  const fallback = capture.kind === "image" ? "收藏的图片" : capture.kind === "text" ? capture.text?.slice(0, 80) : capture.url;
  return {
    kind: capture.kind,
    title: capture.kind === "image" ? "收藏的图片" : capture.title || capture.name || fallback || "收藏的内容",
    url: capture.url || capture.pageUrl || "",
    createdAt: capture.createdAt || Date.now(),
  };
}

async function rememberCapture(result) {
  if (!result || !["saved", "duplicate", "queued"].includes(result.state)) return result;
  const recent = {
    state: result.state,
    recordIds: result.recordIds || [],
    undoToken: result.undoToken || "",
    windowId: result.windowId,
    capture: result.capture || { kind: "link", title: "收藏的内容", url: "", createdAt: Date.now() },
    savedAt: Date.now(),
  };
  await chrome.storage.local.set({ [LAST_CAPTURE_KEY]: recent });
  return result;
}

function feedbackText(state) {
  if (state === "saved") return "已加入 Later Space";
  if (state === "duplicate") return "已加入 Later Space";
  if (state === "undone") return "已撤销";
  if (state === "unavailable") return "这张图片暂时无法加入";
  return "暂时离线，稍后自动加入";
}

async function registerUndo(result) {
  if (result?.state !== "saved" || !result.recordIds?.length) return result;
  const undoToken = captureId();
  const stored = await chrome.storage.session.get({ [UNDO_KEY]: {} });
  const now = Date.now();
  const captures = Object.fromEntries(Object.entries(stored[UNDO_KEY]).filter(([, item]) => now - item.createdAt < 60000));
  captures[undoToken] = { recordIds: result.recordIds, createdAt: now, windowId: result.windowId };
  await chrome.storage.session.set({ [UNDO_KEY]: captures });
  return { ...result, undoToken };
}

async function undoCapture(token) {
  const stored = await chrome.storage.session.get({ [UNDO_KEY]: {} });
  const undo = stored[UNDO_KEY][token];
  if (undo && Date.now() - undo.createdAt >= 60000) return { state: "expired" };
  if (!undo) return { state: "unavailable" };
  let tab = await laterSpaceTab(undo.windowId);
  let temporaryTab = false;
  if (!tab) {
    tab = await chrome.tabs.create({ url: `${APP_URL}?undo=extension`, active: false });
    temporaryTab = true;
  }
  try {
    const result = await deliverToTab(tab.id, { type: "undo", recordIds: undo.recordIds });
    if (result?.state === "undone") {
      delete stored[UNDO_KEY][token];
      await chrome.storage.session.set({ [UNDO_KEY]: stored[UNDO_KEY] });
      const recent = await chrome.storage.local.get({ [LAST_CAPTURE_KEY]: null });
      if (recent[LAST_CAPTURE_KEY]?.undoToken === token) await chrome.storage.local.remove(LAST_CAPTURE_KEY);
    }
    return result || { state: "unavailable" };
  } finally {
    if (temporaryTab) await chrome.tabs.remove(tab.id).catch(() => {});
  }
}

async function notifySourceTab(tabId, result) {
  if (!tabId) return false;
  const message = {
    type: "later-space-feedback",
    text: feedbackText(result.state),
    recordIds: result.recordIds || [],
    undoToken: result.undoToken || "",
  };
  try {
    await chrome.tabs.sendMessage(tabId, message);
    return true;
  } catch {
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: ["page-feedback.js"] });
      await chrome.tabs.sendMessage(tabId, message);
      return true;
    } catch {
      return false;
    }
  }
}

async function currentContextImage(tabId) {
  try {
    const result = await chrome.tabs.sendMessage(tabId, { type: "later-space-context-image" });
    return result?.image;
  } catch {
    return undefined;
  }
}

async function viewCapture(recordIds, windowId) {
  if (!recordIds?.length) return { state: "unavailable" };
  let tab = await laterSpaceTab(windowId);
  if (!tab) tab = await chrome.tabs.create({ url: `${APP_URL}?view=extension`, active: false });
  await chrome.tabs.update(tab.id, { active: true });
  await chrome.windows.update(tab.windowId, { focused: true });
  await new Promise((resolve) => setTimeout(resolve, 180));
  const result = await deliverToTab(tab.id, { type: "view", recordIds });
  if (result?.state !== "viewed") return result || { state: "unavailable" };
  return result;
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

async function imageCapture(srcUrl, pageUrl, windowId) {
  const response = await fetch(srcUrl, { credentials: "include" });
  if (!response.ok) throw new Error("image fetch failed");
  const blob = await response.blob();
  if (!blob.type.startsWith("image/") || blob.size > MAX_IMAGE_BYTES) throw new Error("image too large");
  const optimized = await optimizedImage(blob);
  const name = decodeURIComponent(new URL(srcUrl).pathname.split("/").pop() || "网页图片").slice(0, 180);
  return saveCapture({ kind: "image", imageData: await blobToDataUrl(optimized), mimeType: optimized.type, name: name.replace(/\.[^.]+$/, "") + ".jpg", pageUrl, windowId });
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
  return saveCapture({ kind: "image", imageData: await blobToDataUrl(blob), mimeType: blob.type, name: "网页图片.jpg", pageUrl: tab?.url || "", windowId: tab?.windowId });
}

function pageCapture(tab) {
  return saveCapture({ kind: "link", url: tab?.url || "", title: tab?.title || "", windowId: tab?.windowId });
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
  const contextImage = await currentContextImage(tab?.id);
  if (info.selectionText) result = await saveCapture({ kind: "text", text: info.selectionText, pageUrl: tab?.url || "", windowId: tab?.windowId });
  else if (info.srcUrl || contextImage?.url) {
    const imageUrl = info.srcUrl || contextImage?.url;
    try { result = await imageCapture(imageUrl, tab?.url || "", tab?.windowId); }
    catch {
      try { result = await visibleImageCapture(tab, contextImage); }
      catch { result = { state: "unavailable" }; }
    }
  } else if (info.linkUrl) result = await saveCapture({ kind: "link", url: info.linkUrl, title: "", windowId: tab?.windowId });
  else result = await pageCapture(tab);
  result = await rememberCapture(await registerUndo(result));
  const sourceFeedbackShown = await notifySourceTab(tab?.id, result);
  const messages = {
    saved: "已加入 Later Space",
    duplicate: "已加入 Later Space",
    queued: "暂时离线，稍后自动加入",
    unavailable: "这张图片暂时无法加入",
  };
  if (!sourceFeedbackShown) chrome.notifications.create({ type: "basic", iconUrl: "icon-128.png", title: "Later Space", message: messages[result.state] || messages.queued }).catch(() => {});
});

chrome.commands.onCommand.addListener(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const result = await rememberCapture(await registerUndo(await pageCapture(tab)));
  await notifySourceTab(tab?.id, result);
});

chrome.alarms.onAlarm.addListener((alarm) => { if (alarm.name === "retry-captures") retryQueue(); });
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "capture-current") {
    const activeTab = message.tabId
      ? chrome.tabs.get(message.tabId).catch(() => null)
      : chrome.tabs.query({ active: true, lastFocusedWindow: true }).then(([tab]) => tab);
    activeTab.then(async (tab) => {
      const result = await rememberCapture(await registerUndo(await pageCapture(tab)));
      await notifySourceTab(tab?.id, result);
      return result;
    }).then(sendResponse);
    return true;
  }
  if (message.type === "capture-selection") {
    chrome.tabs.query({ active: true, currentWindow: true }).then(async ([tab]) => {
      const result = await rememberCapture(await registerUndo(await saveCapture({ kind: "text", text: message.text || "", pageUrl: tab?.url || "", windowId: tab?.windowId })));
      await notifySourceTab(tab?.id, result);
      return result;
    }).then(sendResponse);
    return true;
  }
  if (message.type === "capture-image") {
    const tab = _sender.tab;
    const image = message.image;
    (async () => {
      let result;
      try { result = await imageCapture(image?.url, tab?.url || "", tab?.windowId); }
      catch {
        try { result = await visibleImageCapture(tab, image); }
        catch { result = { state: "unavailable", capture: { kind: "image", title: "收藏的图片", url: tab?.url || "", createdAt: Date.now() } }; }
      }
      result = await rememberCapture(await registerUndo(result));
      await notifySourceTab(tab?.id, result);
      return result;
    })().then(sendResponse);
    return true;
  }
  if (message.type === "recent-capture") {
    chrome.storage.local.get({ [LAST_CAPTURE_KEY]: null }).then((stored) => sendResponse(stored[LAST_CAPTURE_KEY]));
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
  if (message.type === "undo-capture") {
    undoCapture(message.token).then(sendResponse);
    return true;
  }
  if (message.type === "view-capture") {
    chrome.windows.getLastFocused().then((window) => viewCapture(message.recordIds, _sender.tab?.windowId || window.id)).then(sendResponse);
    return true;
  }
});
