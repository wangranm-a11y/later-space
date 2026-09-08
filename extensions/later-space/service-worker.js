const APP_URL = "https://wangranm-a11y.github.io/later-space/";
const SUPABASE_URL = "https://hesftvntzoawxryhadcw.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_LXghe2HYouHlFBgi_9NWPw_LZ3B7j_d";
const CLOUD_SESSION_KEY = "laterSpaceCloudSession";
const QUEUE_KEY = "laterSpaceCaptureQueue";
const UNDO_KEY = "laterSpaceUndoCaptures";
const LAST_CAPTURE_KEY = "laterSpaceLastCapture";
const LAST_FAILURE_KEY = "laterSpaceLastFailure";
const ONBOARDING_STATE_KEY = "laterSpaceOnboardingState";
const ONBOARDING_VERSION = 1;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_SOURCE_IMAGE_BYTES = 40 * 1024 * 1024;

function defaultOnboardingState() {
  return { version: ONBOARDING_VERSION, step: 1, completed: false, sessionId: captureId(), recordIds: [], queuedCaptureIds: [], keepPractice: false };
}

async function onboardingState() {
  const stored = await chrome.storage.local.get({ [ONBOARDING_STATE_KEY]: null });
  return stored[ONBOARDING_STATE_KEY] || defaultOnboardingState();
}

async function updateOnboardingState(patch = {}) {
  const next = { ...(await onboardingState()), ...patch, version: ONBOARDING_VERSION };
  await chrome.storage.local.set({ [ONBOARDING_STATE_KEY]: next });
  return next;
}

async function getCloudSession() {
  const stored = await chrome.storage.local.get({ [CLOUD_SESSION_KEY]: null });
  const session = stored[CLOUD_SESSION_KEY];
  if (!session?.access_token) return null;
  if (Number(session.expires_at || 0) * 1000 > Date.now() + 60_000) return session;
  if (!session.refresh_token) return null;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  });
  if (!response.ok) return null;
  const next = await response.json();
  const refreshed = { ...session, ...next, expires_at: Math.floor(Date.now() / 1000) + Number(next.expires_in || 3600) };
  await chrome.storage.local.set({ [CLOUD_SESSION_KEY]: refreshed });
  return refreshed;
}

async function cloudRequest(path, options = {}) {
  const session = await getCloudSession();
  if (!session?.access_token || !session.user?.id) return null;
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${session.access_token}`, ...(options.headers || {}) },
  });
  return { response, session };
}

function dataUrlToBlob(dataUrl) {
  const [header, encoded] = String(dataUrl || "").split(",");
  const mimeType = header.match(/data:([^;]+)/)?.[1] || "image/jpeg";
  const binary = atob(encoded || "");
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new Blob([bytes], { type: mimeType });
}

function cloudRecordData(capture, now) {
  const onboarding = capture.onboarding ? { onboarding: true, onboardingSessionId: capture.onboardingSessionId || "" } : {};
  const base = { status: "inbox", tags: [], note: "", source: "chrome-extension", createdAt: now, updatedAt: now, canvasX: 0, canvasY: 0, zIndex: now, ...onboarding };
  if (capture.kind === "text") return { ...base, kind: "text", text: capture.text || "", name: (capture.text || "收藏的文字").slice(0, 32), textTheme: "paper", canvasWidth: 300, textHeight: 375, textScale: 1 };
  if (capture.kind === "link") return { ...base, kind: "link", url: capture.url || capture.pageUrl || "", canonicalUrl: capture.url || capture.pageUrl || "", name: capture.title || capture.url || "收藏的链接", title: capture.title || capture.url || "收藏的链接", shareTitle: capture.title || "", customTitle: false, description: "", previewImage: "", previewState: "loading", coverIndex: 0, fontIndex: 0, coverMode: "editorial", canvasWidth: 300 };
  return { ...base, kind: capture.kind || "image", name: capture.name || "收藏的图片", type: capture.mimeType || "image/jpeg", size: capture.imageData ? dataUrlToBlob(capture.imageData).size : 0, width: 960, height: 720, fingerprint: "", canvasWidth: 300 };
}

async function directCloudCapture(capture) {
  const now = Number(capture.createdAt || Date.now());
  const session = await getCloudSession();
  const cloud = session?.user?.id ? { session } : null;
  if (!cloud) return null;
  const id = capture.id || captureId();
  let asset = null;
  if (capture.kind === "image" && capture.imageData) {
    const blob = dataUrlToBlob(capture.imageData);
    const uploadUrl = new URL(`${SUPABASE_URL}/functions/v1/mobile-inbox`);
    uploadUrl.searchParams.set("mode", "asset");
    uploadUrl.searchParams.set("record_id", id);
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${cloud.session.access_token}`,
        "Content-Type": blob.type || "image/jpeg",
        "X-Later-Space-Kind": "image",
        "X-Later-Space-Name": capture.name || "网页图片.jpg",
      },
      body: blob,
    });
    if (!response.ok) throw new Error(await response.text() || "cloud asset upload failed");
    asset = await response.json();
  }
  const row = { id, user_id: cloud.session.user.id, kind: capture.kind || "link", data: cloudRecordData(capture, now), asset_path: asset?.assetPath || null, asset_bytes: asset?.assetBytes || 0, content_hash: asset?.contentHash || null, source_device_id: `extension-${chrome.runtime.id}`, client_updated_at: now, deleted_at: null };
  const result = await cloudRequest("/rest/v1/later_space_items?on_conflict=id", { method: "POST", headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify([row]) });
  if (!result?.response.ok) {
    if (asset?.assetPath && asset?.assetBytes) {
      const discardUrl = new URL(`${SUPABASE_URL}/functions/v1/mobile-inbox`);
      discardUrl.searchParams.set("mode", "discard");
      await fetch(discardUrl, { method: "POST", headers: { Authorization: `Bearer ${cloud.session.access_token}`, "Content-Type": "application/json" }, body: JSON.stringify({ assetPath: asset.assetPath, assetBytes: asset.assetBytes }) }).catch(() => null);
    }
    throw new Error(await result?.response.text());
  }
  return { state: "saved", recordIds: [id], windowId: capture.windowId, capture: captureSummary(capture), destination: { label: `${cloud.session.user.email || "Later Space"} · 云端同步已开启`, email: cloud.session.user.email, synced: true } };
}

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

async function removeQueuedCaptures(ids) {
  const targets = new Set(ids || []);
  const stored = await chrome.storage.local.get({ [QUEUE_KEY]: [] });
  const queue = stored[QUEUE_KEY].filter((item) => !targets.has(item.id));
  await chrome.storage.local.set({ [QUEUE_KEY]: queue });
  await chrome.action.setBadgeText({ text: queue.length ? String(Math.min(queue.length, 99)) : "" });
}

function isLaterSpaceCanvasTab(tab) {
  try {
    const url = new URL(tab?.url || "");
    return url.origin === new URL(APP_URL).origin && ["/later-space/", "/later-space/index.html"].includes(url.pathname);
  } catch {
    return false;
  }
}

async function laterSpaceTab(windowId) {
  const tabs = (await chrome.tabs.query({ url: `${APP_URL}*` })).filter(isLaterSpaceCanvasTab);
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
  let directFailure = null;
  try {
    const direct = await directCloudCapture(normalized);
    if (direct) {
      await removeQueued(normalized.id);
      return direct;
    }
  } catch (error) {
    directFailure = error;
  }
  try {
    return await sendCapture(normalized);
  } catch (error) {
    await chrome.storage.local.set({ [LAST_FAILURE_KEY]: { message: error?.message || directFailure?.message || "capture failed", at: Date.now(), kind: normalized.kind || "link" } });
    return { state: "queued", windowId: normalized.windowId, capture: captureSummary(normalized) };
  }
}

async function cancelCaptureQueue() {
  const stored = await chrome.storage.local.get({ [QUEUE_KEY]: [], [LAST_CAPTURE_KEY]: null });
  const cancelled = stored[QUEUE_KEY].length;
  await chrome.storage.local.set({ [QUEUE_KEY]: [] });
  await chrome.storage.local.remove(LAST_FAILURE_KEY);
  if (stored[LAST_CAPTURE_KEY]?.state === "queued") await chrome.storage.local.remove(LAST_CAPTURE_KEY);
  await chrome.action.setBadgeText({ text: "" });
  return { cancelled, diagnosis: await connectionDiagnosis() };
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
  return "Later Space 正在连接，稍后自动加入";
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
  const session = await getCloudSession();
  if (session?.user?.id) {
    const filter = encodeURIComponent(`(${undo.recordIds.join(",")})`);
    const cloud = await cloudRequest(`/rest/v1/later_space_items?id=in.${filter}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ deleted_at: Date.now() }),
    });
    if (cloud?.response.ok) {
      delete stored[UNDO_KEY][token];
      await chrome.storage.session.set({ [UNDO_KEY]: stored[UNDO_KEY] });
      const recent = await chrome.storage.local.get({ [LAST_CAPTURE_KEY]: null });
      if (recent[LAST_CAPTURE_KEY]?.undoToken === token) await chrome.storage.local.remove(LAST_CAPTURE_KEY);
      return { state: "undone" };
    }
  }
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

async function notifySourceTab(tabId, result, options = {}) {
  if (!tabId) return false;
  const message = {
    type: "later-space-feedback",
    state: result.state,
    playSound: options.playSound !== false,
    text: feedbackText(result.state),
    recordIds: result.recordIds || [],
    undoToken: result.undoToken || "",
  };
  try {
    await chrome.tabs.sendMessage(tabId, message);
    return true;
  } catch {
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: ["feedback-sound.js", "page-feedback.js"] });
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
  const session = await getCloudSession();
  if (session?.user?.id) {
    return { label: `${session.user.email || "Later Space"} · 云端同步已开启`, email: session.user.email, synced: true };
  }
  const tab = await queryLaterSpaceTab(800);
  if (tab) {
    requestAuthFromTab(tab.id).then((result) => {
      if (result.state === "auth") return retryQueue();
      return null;
    }).catch(() => {});
  }
  return { label: "未连接 · 点击连接 Later Space", synced: false };
}

async function connectionDiagnosis() {
  const stored = await chrome.storage.local.get({
    [QUEUE_KEY]: [],
    [CLOUD_SESSION_KEY]: null,
    [LAST_FAILURE_KEY]: null,
  });
  const queued = stored[QUEUE_KEY].length;
  if (!navigator.onLine) {
    return { state: "offline", queued, title: "当前没有网络", detail: "收藏已留在插件里，联网后会自动补送。", repairable: false };
  }
  const session = await getCloudSession();
  if (session?.user?.id) {
    return { state: queued ? "queued" : "healthy", queued, title: queued ? `有 ${queued} 条等待补送` : "连接正常", detail: `${session.user.email || "Later Space"} · 云端同步已开启`, repairable: queued > 0 };
  }
  const tab = await queryLaterSpaceTab(900);
  if (tab) {
    const ready = await Promise.race([
      chrome.tabs.sendMessage(tab.id, { type: "later-space-capture", capture: { type: "status" } }).catch(() => null),
      new Promise((resolve) => setTimeout(() => resolve(null), 650)),
    ]);
    if (ready?.state === "ready") {
      return { state: queued ? "queued" : "local", queued, title: queued ? `有 ${queued} 条等待补送` : "本地收藏可用", detail: ready.destination?.label || "保存在当前浏览器", repairable: queued > 0 };
    }
    return { state: "bridge", queued, title: "页面连接需要刷新", detail: "Later Space 已打开，但收藏通道没有响应。", repairable: true };
  }
  if (stored[CLOUD_SESSION_KEY]?.access_token) {
    return { state: "auth", queued, title: "登录状态已过期", detail: "重新连接账号后，待发送内容会自动补上。", repairable: true };
  }
  return { state: "detached", queued, title: queued ? `${queued} 条内容正在等待` : "尚未连接保存空间", detail: "可以继续收藏；连接后会自动补送。", repairable: true };
}

function queryLaterSpaceTab(timeoutMs = 800) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value || null);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    try {
        chrome.tabs.query({ url: `${APP_URL}*` }, (tabs) => finish(tabs?.find(isLaterSpaceCanvasTab)));
    } catch {
      finish(null);
    }
  });
}

async function requestAuthFromTab(tabId) {
  if (!tabId) return { state: "unauthenticated" };
  await chrome.scripting.executeScript({ target: { tabId }, files: ["page-bridge.js"] }).catch(() => {});
  try {
    const result = await chrome.tabs.sendMessage(tabId, { type: "later-space-auth" });
    if (result?.state === "auth" && result.session?.access_token) {
      await chrome.storage.local.set({ [CLOUD_SESSION_KEY]: result.session });
      return result;
    }
  } catch {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["page-bridge.js"] }).catch(() => {});
    try {
      const result = await chrome.tabs.sendMessage(tabId, { type: "later-space-auth" });
      if (result?.state === "auth" && result.session?.access_token) {
        await chrome.storage.local.set({ [CLOUD_SESSION_KEY]: result.session });
        return result;
      }
    } catch {}
  }
  return { state: "unauthenticated" };
}

async function connectAuth() {
  const existing = await getCloudSession();
  if (existing?.user?.id) {
    await retryQueue();
    return { state: "connected", email: existing.user.email };
  }
  const tab = await laterSpaceTab();
  if (tab) {
    const result = await requestAuthFromTab(tab.id);
    if (result.state === "auth") {
      await retryQueue();
      return { state: "connected", email: result.session.user?.email };
    }
  }
  const created = await chrome.tabs.create({ url: `${APP_URL}?extension=connect`, active: true });
  return { state: "needs-login", tabId: created.id, url: APP_URL };
}

async function waitForBridge(tabId, attempts = 5) {
  await chrome.scripting.executeScript({ target: { tabId }, files: ["page-bridge.js"] }).catch(() => {});
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const ready = await Promise.race([
      chrome.tabs.sendMessage(tabId, { type: "later-space-capture", capture: { type: "status" } }).catch(() => null),
      new Promise((resolve) => setTimeout(() => resolve(null), 700)),
    ]);
    if (ready?.state === "ready") return ready;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return null;
}

async function repairConnection() {
  if (!navigator.onLine) return connectionDiagnosis();
  const stored = await chrome.storage.local.get({ [CLOUD_SESSION_KEY]: null });
  const session = await getCloudSession();
  if (stored[CLOUD_SESSION_KEY]?.access_token && !session?.user?.id) {
    const loginTab = await chrome.tabs.create({ url: `${APP_URL}?extension=connect`, active: true });
    return { state: "needs-login", queued: (await chrome.storage.local.get({ [QUEUE_KEY]: [] }))[QUEUE_KEY].length, title: "登录状态已过期", detail: "重新登录后，待发送内容会回到原来的账号。", repairable: true, opened: true, tabId: loginTab.id };
  }
  let tab = await laterSpaceTab();
  if (tab) {
    let ready = await waitForBridge(tab.id, 2);
    if (!ready) {
      await chrome.tabs.reload(tab.id).catch(() => {});
      await new Promise((resolve) => setTimeout(resolve, 900));
      ready = await waitForBridge(tab.id);
    }
    if (ready?.state === "ready") {
      await Promise.race([
        requestAuthFromTab(tab.id),
        new Promise((resolve) => setTimeout(() => resolve({ state: "unauthenticated" }), 1200)),
      ]);
      const retry = await retryQueue();
      return { ...(await connectionDiagnosis()), repaired: true, sent: retry.sent, remaining: retry.remaining };
    }
  }
  tab = await chrome.tabs.create({ url: `${APP_URL}?extension=repair`, active: false });
  const ready = await waitForBridge(tab.id);
  if (ready?.state === "ready") {
    const retry = await retryQueue();
    await chrome.tabs.remove(tab.id).catch(() => {});
    return { ...(await connectionDiagnosis()), repaired: true, sent: retry.sent, remaining: retry.remaining };
  }
  await chrome.tabs.update(tab.id, { active: true }).catch(() => {});
  return { ...(await connectionDiagnosis()), state: "needs-login", title: "请完成一次连接", detail: "登录或选择先体验后，待发送内容会自动补上。", repairable: true, opened: true };
}

async function saveOnboardingCapture(payload = {}) {
  const state = await onboardingState();
  const capture = { ...payload, id: captureId(), onboarding: true, onboardingSessionId: state.sessionId };
  const result = await rememberCapture(await saveCapture(capture));
  const createdIds = result?.state === "saved" ? result.recordIds || [] : [];
  return {
    ...result,
    onboarding: await updateOnboardingState({
      step: Math.max(state.step || 1, Number(payload.nextStep || state.step || 1)),
      recordIds: [...new Set([...(state.recordIds || []), ...createdIds])],
      queuedCaptureIds: result?.state === "queued"
        ? [...new Set([...(state.queuedCaptureIds || []), capture.id])]
        : state.queuedCaptureIds || [],
    }),
  };
}

async function cleanupOnboardingPractice() {
  const state = await onboardingState();
  const recordIds = [...new Set(state.recordIds || [])];
  await removeQueuedCaptures(state.queuedCaptureIds || []);
  if (!recordIds.length) return { state: "cleaned", onboarding: await updateOnboardingState({ recordIds: [], queuedCaptureIds: [] }) };

  let removed = false;
  const session = await getCloudSession();
  if (session?.user?.id) {
    const filter = encodeURIComponent(`(${recordIds.join(",")})`);
    const cloud = await cloudRequest(`/rest/v1/later_space_items?id=in.${filter}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ deleted_at: new Date().toISOString() }),
    });
    removed = Boolean(cloud?.response.ok);
  } else {
    let tab = await laterSpaceTab();
    let temporaryTab = false;
    if (!tab) {
      tab = await chrome.tabs.create({ url: `${APP_URL}?undo=onboarding`, active: false });
      temporaryTab = true;
    }
    try {
      const result = await deliverToTab(tab.id, { type: "undo", recordIds });
      removed = result?.state === "undone";
    } finally {
      if (temporaryTab) await chrome.tabs.remove(tab.id).catch(() => {});
    }
  }
  if (!removed) return { state: "partial", remainingIds: recordIds, onboarding: state };
  return { state: "cleaned", onboarding: await updateOnboardingState({ recordIds: [], queuedCaptureIds: [] }) };
}

async function retryQueue() {
  const stored = await chrome.storage.local.get({ [QUEUE_KEY]: [] });
  let sent = 0;
  for (const capture of stored[QUEUE_KEY]) {
    try {
      const result = await sendCapture(capture);
      if (["saved", "duplicate"].includes(result?.state)) sent += 1;
      if (capture.onboarding && result?.recordIds?.length) {
        const state = await onboardingState();
        await updateOnboardingState({
          recordIds: [...new Set([...(state.recordIds || []), ...result.recordIds])],
          queuedCaptureIds: (state.queuedCaptureIds || []).filter((id) => id !== capture.id),
        });
      }
    } catch { break; }
  }
  const latest = await chrome.storage.local.get({ [QUEUE_KEY]: [] });
  return { sent, remaining: latest[QUEUE_KEY].length };
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
  if (blob.size > MAX_SOURCE_IMAGE_BYTES) throw new Error("image source too large");
  const optimized = await optimizedImage(blob);
  if (optimized.size > MAX_IMAGE_BYTES) throw new Error("optimized image too large");
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

async function refreshOpenWebTabs() {
  const tabs = await chrome.tabs.query({ url: ["http://*/*", "https://*/*"] });
  await Promise.allSettled(tabs.map((tab) => chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["feedback-sound.js", "page-feedback.js"],
  })));
}

chrome.runtime.onInstalled.addListener((details) => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: "later-add", title: "加入 Later Space", contexts: ["page", "link", "image", "selection"] });
  });
  chrome.alarms.create("retry-captures", { periodInMinutes: 1 });
  retryQueue();
  refreshOpenWebTabs();
  if (details.reason === "install") {
    chrome.storage.local.set({ [ONBOARDING_STATE_KEY]: defaultOnboardingState() });
    chrome.tabs.create({ url: chrome.runtime.getURL("welcome.html") });
  }
});

chrome.runtime.onStartup.addListener(() => refreshOpenWebTabs());
refreshOpenWebTabs();

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
    queued: "Later Space 正在连接，稍后自动加入",
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
      await notifySourceTab(tab?.id, result, { playSound: false });
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
    retryQueue().then(sendResponse);
    return true;
  }
  if (message.type === "connection-diagnosis") {
    connectionDiagnosis().then(sendResponse).catch(() => sendResponse({ state: "unknown", queued: 0, title: "暂时无法检查连接", detail: "你的收藏仍会保留在插件中。", repairable: true }));
    return true;
  }
  if (message.type === "repair-connection") {
    repairConnection().then(sendResponse).catch(() => sendResponse({ state: "unknown", queued: 0, title: "暂时没有修好", detail: "收藏仍在插件中，可以稍后再次修复。", repairable: true }));
    return true;
  }
  if (message.type === "cancel-queue") {
    cancelCaptureQueue().then(sendResponse).catch(() => sendResponse({ cancelled: 0 }));
    return true;
  }
  if (message.type === "destination-status") {
    destinationStatus().then(sendResponse).catch(() => sendResponse({ label: "当前浏览器 · 保存位置未确认", synced: false }));
    return true;
  }
  if (message.type === "connect-auth") {
    connectAuth().then(sendResponse).catch(() => sendResponse({ state: "unavailable" }));
    return true;
  }
  if (message.type === "onboarding-status") {
    Promise.all([onboardingState(), destinationStatus()]).then(([onboarding, destination]) => sendResponse({ onboarding, destination }));
    return true;
  }
  if (message.type === "onboarding-progress") {
    updateOnboardingState(message.patch || {}).then(sendResponse);
    return true;
  }
  if (message.type === "onboarding-capture") {
    saveOnboardingCapture(message.capture || {}).then(sendResponse).catch(() => sendResponse({ state: "unavailable" }));
    return true;
  }
  if (message.type === "onboarding-cleanup") {
    cleanupOnboardingPractice().then(sendResponse).catch(() => sendResponse({ state: "partial" }));
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
