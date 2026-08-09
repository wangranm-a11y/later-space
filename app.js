const DB_NAME = "later-space-image-inbox";
const DB_VERSION = 2;
const STORE_NAME = "images";
const ASSET_STORE_NAME = "image-assets";
const THUMBNAIL_VERSION = 5;
const STATIC_DEPLOYMENT = location.protocol !== "file:" && !["localhost", "127.0.0.1", "::1"].includes(location.hostname);
const ONBOARDING_DISMISSED_KEY = "later-space-onboarding-dismissed-v1";
document.documentElement.dataset.appVersion = "58";
document.documentElement.dataset.deployment = STATIC_DEPLOYMENT ? "static" : "local";

const state = {
  db: null,
  images: [],
  selectedId: null,
  selectedIds: new Set(),
  objectUrls: new Map(),
  view: { x: innerWidth / 2, y: innerHeight / 2, zoom: 1 },
  pointer: null,
  dragDepth: 0,
  pasteOffset: 0,
  activeView: "all",
  workflow: "all",
  filters: { query: "", source: "all", purpose: "all", time: "all" },
  captureMode: "text",
  captureSubmitting: false,
  editingTextId: null,
  editingLinkId: null,
  editingImageId: null,
  pendingImageFiles: [],
  pendingImageSource: "upload",
  captureTags: new Set(),
  initialBatchTags: new Set(),
  tagUndoSnapshot: null,
  deletionUndoSnapshot: null,
  tagManageEdit: null,
  crop: null,
  layoutSnapshot: null,
  recentIds: new Set(),
  arrivingIds: new Set(),
  duplicateFocusId: null,
  duplicatePrompt: null,
  backupTimer: null,
  backupInFlight: false,
  backupQueued: false,
  backedUpAssets: null,
  renderFrame: null,
  searchTimer: null,
  externalInboxImporting: false,
  externalInboxTimer: null,
  globalCoverPreference: localStorage.getItem("later-space-global-cover-mode") || "editorial",
};

const elements = {
  canvas: document.querySelector("#canvas"),
  world: document.querySelector("#world"),
  emptyCue: document.querySelector("#emptyCue"),
  imageCount: document.querySelector("#imageCount"),
  emptyTitle: document.querySelector("#emptyTitle"),
  emptyHint: document.querySelector("#emptyHint"),
  onboardingCards: document.querySelector("#onboardingCards"),
  onboardingStartButton: document.querySelector("#onboardingStartButton"),
  onboardingDismissButton: document.querySelector("#onboardingDismissButton"),
  searchInput: document.querySelector("#searchInput"),
  filterToggleButton: document.querySelector("#filterToggleButton"),
  filterCount: document.querySelector("#filterCount"),
  clearSearchButton: document.querySelector("#clearSearchButton"),
  filterPanel: document.querySelector("#filterPanel"),
  sourceFilter: document.querySelector("#sourceFilter"),
  purposeFilter: document.querySelector("#purposeFilter"),
  timeFilter: document.querySelector("#timeFilter"),
  resetFiltersButton: document.querySelector("#resetFiltersButton"),
  addButton: document.querySelector("#addButton"),
  fileInput: document.querySelector("#fileInput"),
  fitButton: document.querySelector("#fitButton"),
  organizeButton: document.querySelector("#organizeButton"),
  resetZoomButton: document.querySelector("#resetZoomButton"),
  exportButton: document.querySelector("#exportButton"),
  importButton: document.querySelector("#importButton"),
  backupInput: document.querySelector("#backupInput"),
  restoreBackupButton: document.querySelector("#restoreBackupButton"),
  storageButton: document.querySelector("#storageButton"),
  storagePanel: document.querySelector("#storagePanel"),
  closeStorageButton: document.querySelector("#closeStorageButton"),
  storageMeterFill: document.querySelector("#storageMeterFill"),
  browserStorageValue: document.querySelector("#browserStorageValue"),
  originalStorageValue: document.querySelector("#originalStorageValue"),
  recordStorageValue: document.querySelector("#recordStorageValue"),
  backupStorageValue: document.querySelector("#backupStorageValue"),
  storageHint: document.querySelector("#storageHint"),
  selectionBar: document.querySelector("#selectionBar"),
  selectionName: document.querySelector("#selectionName"),
  selectionSize: document.querySelector("#selectionSize"),
  deleteButton: document.querySelector("#deleteButton"),
  editTextButton: document.querySelector("#editTextButton"),
  editLinkButton: document.querySelector("#editLinkButton"),
  linkModeSwitcher: document.querySelector("#linkModeSwitcher"),
  linkModeButtons: document.querySelectorAll("[data-link-mode]"),
  shuffleCoverButton: document.querySelector("#shuffleCoverButton"),
  shuffleFontButton: document.querySelector("#shuffleFontButton"),
  copyImageButton: document.querySelector("#copyImageButton"),
  cropImageButton: document.querySelector("#cropImageButton"),
  batchEditButton: document.querySelector("#batchEditButton"),
  openSelectedButton: document.querySelector("#openSelectedButton"),
  viewButtons: document.querySelectorAll("[data-view]"),
  globalCoverSwitcher: document.querySelector("#globalCoverSwitcher"),
  globalCoverButtons: document.querySelectorAll("[data-global-cover-mode]"),
  captureBackdrop: document.querySelector("#captureBackdrop"),
  captureDialog: document.querySelector("#captureDialog"),
  captureModeButtons: document.querySelectorAll("[data-capture-mode]"),
  closeCaptureButton: document.querySelector("#closeCaptureButton"),
  captureInputGroup: document.querySelector("#captureInputGroup"),
  captureInputLabel: document.querySelector("#captureInputLabel"),
  captureInput: document.querySelector("#captureInput"),
  linkPurposeGroup: document.querySelector("#linkPurposeGroup"),
  linkTitleInput: document.querySelector("#linkTitleInput"),
  chooseImagesButton: document.querySelector("#chooseImagesButton"),
  addContentButton: document.querySelector("#addContentButton"),
  dropState: document.querySelector("#dropState"),
  toast: document.querySelector("#toast"),
  toastMessage: document.querySelector("#toastMessage"),
  toastAction: document.querySelector("#toastAction"),
  cropBackdrop: document.querySelector("#cropBackdrop"),
  cropDialog: document.querySelector("#cropDialog"),
  cropStage: document.querySelector("#cropStage"),
  cropPreview: document.querySelector("#cropPreview"),
  cropFrame: document.querySelector("#cropFrame"),
  closeCropButton: document.querySelector("#closeCropButton"),
  resetCropButton: document.querySelector("#resetCropButton"),
  applyCropButton: document.querySelector("#applyCropButton"),
  cropRatioButtons: document.querySelectorAll("[data-crop-ratio]"),
  duplicateBackdrop: document.querySelector("#duplicateBackdrop"),
  duplicateDialog: document.querySelector("#duplicateDialog"),
  duplicateTitle: document.querySelector("#duplicateTitle"),
  findDuplicateButton: document.querySelector("#findDuplicateButton"),
  keepDuplicateButton: document.querySelector("#keepDuplicateButton"),
  selectionMarquee: document.querySelector("#selectionMarquee"),
  batchBackdrop: document.querySelector("#batchBackdrop"),
  batchDialog: document.querySelector("#batchDialog"),
  closeBatchButton: document.querySelector("#closeBatchButton"),
  cancelBatchButton: document.querySelector("#cancelBatchButton"),
  applyBatchButton: document.querySelector("#applyBatchButton"),
  batchTagsInput: document.querySelector("#batchTagsInput"),
  batchTagSuggestions: document.querySelector("#batchTagSuggestions"),
  tagEditorHint: document.querySelector("#tagEditorHint"),
  tagManageBackdrop: document.querySelector("#tagManageBackdrop"),
  tagManageDialog: document.querySelector("#tagManageDialog"),
  closeTagManageButton: document.querySelector("#closeTagManageButton"),
  tagManageList: document.querySelector("#tagManageList"),
  tagManageEmpty: document.querySelector("#tagManageEmpty"),
  workflowSwitcher: document.querySelector("#workflowSwitcher"),
  syncButton: document.querySelector("#syncButton"),
  syncPanel: document.querySelector("#syncPanel"),
  closeSyncButton: document.querySelector("#closeSyncButton"),
  syncStatus: document.querySelector(".sync-status"),
  syncStatusTitle: document.querySelector("#syncStatusTitle"),
  syncStatusDetail: document.querySelector("#syncStatusDetail"),
  pullCloudButton: document.querySelector("#pullCloudButton"),
  pushCloudButton: document.querySelector("#pushCloudButton"),
};

const WORKFLOW_STATUSES = new Set(["inbox", "unread", "inspired", "action", "read"]);

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: "id" });
      if (!db.objectStoreNames.contains(ASSET_STORE_NAME)) db.createObjectStore(ASSET_STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactAsset(mode, operation) {
  return new Promise((resolve, reject) => {
    const transaction = state.db.transaction(ASSET_STORE_NAME, mode);
    const request = operation(transaction.objectStore(ASSET_STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transact(mode, operation) {
  return new Promise((resolve, reject) => {
    const transaction = state.db.transaction(STORE_NAME, mode);
    const request = operation(transaction.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function sumOriginalAssetBytes() {
  return new Promise((resolve, reject) => {
    const transaction = state.db.transaction(ASSET_STORE_NAME, "readonly");
    const request = transaction.objectStore(ASSET_STORE_NAME).openCursor();
    let total = 0;
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return resolve(total);
      total += cursor.value?.blob?.size || 0;
      cursor.continue();
    };
    request.onerror = () => reject(request.error);
  });
}

function formatBytes(value) {
  if (!Number.isFinite(value) || value <= 0) return "0 MB";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)));
  const amount = value / 1024 ** index;
  return `${amount >= 10 || index === 0 ? amount.toFixed(0) : amount.toFixed(1)} ${units[index]}`;
}

function makeId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function canonicalUrl(value) {
  try {
    const url = new URL(value);
    url.hash = "";
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "spm", "from", "source"].forEach((key) => url.searchParams.delete(key));
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/$/, "");
    url.searchParams.sort();
    return url.href;
  } catch {
    return String(value || "").trim();
  }
}

function normalizedTextFingerprint(value) {
  return normalizedSearchValue(value).replace(/\s/g, "");
}

async function blobFingerprint(blob) {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function createThumbnail(blob, maximumSide = 960) {
  const image = await createImageBitmap(blob);
  const scale = Math.min(1, maximumSide / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext("2d", { alpha: false });
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();
  return new Promise((resolve, reject) => canvas.toBlob(
    (thumbnail) => thumbnail ? resolve(thumbnail) : reject(new Error("缩略图生成失败")),
    "image/jpeg",
    .84,
  ));
}

async function originalBlob(record) {
  if (record.kind) return null;
  const asset = await transactAsset("readonly", (store) => store.get(record.id));
  return asset?.blob || record.blob || null;
}

async function storeImageAsset(record, blob) {
  await transactAsset("readwrite", (store) => store.put({ id: record.id, blob }));
}

async function backupImageAssets() {
  try {
    const response = await fetch("/api/backups/latest");
    if (!response.ok) return new Map();
    const payload = await response.json();
    return new Map((payload.images || [])
      .filter((record) => !record.kind && record.dataUrl)
      .map((record) => [record.id, { blob: dataUrlToBlob(record.dataUrl), assetHash: record.assetHash }]));
  } catch {
    return new Map();
  }
}

function screenToWorld(clientX, clientY) {
  return { x: (clientX - state.view.x) / state.view.zoom, y: (clientY - state.view.y) / state.view.zoom };
}

function worldCenter() {
  return screenToWorld(innerWidth / 2, innerHeight / 2);
}

function updateView() {
  const { x, y, zoom } = state.view;
  elements.world.style.transform = `translate(${x}px, ${y}px) scale(${zoom})`;
  elements.world.style.setProperty("--canvas-control-scale", String(1 / zoom));
  elements.canvas.style.setProperty("--pan-x", `${x % (24 * zoom)}px`);
  elements.canvas.style.setProperty("--pan-y", `${y % (24 * zoom)}px`);
  elements.canvas.style.setProperty("--grid-size", `${24 * zoom}px`);
  elements.resetZoomButton.textContent = `${Math.round(zoom * 100)}%`;
  scheduleViewportRender();
}

function scheduleViewportRender() {
  if (state.pointer?.mode === "item" || state.pointer?.mode === "resize" || state.arrivingIds.size || state.renderFrame) return;
  state.renderFrame = requestAnimationFrame(() => {
    state.renderFrame = null;
    render();
  });
}

function imageUrl(record) {
  const displayBlob = record.thumbnail || record.blob;
  if (!state.objectUrls.has(record.id) && displayBlob) state.objectUrls.set(record.id, URL.createObjectURL(displayBlob));
  return state.objectUrls.get(record.id) || (record.assetHash ? `/api/backups/assets/${record.assetHash}` : "");
}

function linkHostname(value) {
  try { return new URL(value).hostname.replace(/^www\./, ""); } catch { return "链接"; }
}

function linkSourceName(record) {
  const host = linkHostname(record.url);
  if (host.includes("xiaohongshu.com") || host.includes("xhslink.com")) return "小红书";
  if (host === "x.com" || host.includes("twitter.com")) return "X";
  if (host.includes("youtube.com") || host === "youtu.be") return "YouTube";
  if (host.includes("instagram.com")) return "Instagram";
  if (host.includes("tiktok.com")) return "TikTok";
  if (host.includes("douyin.com")) return "抖音";
  if (host.includes("weibo.com")) return "微博";
  if (host.includes("bilibili.com") || host === "b23.tv") return "哔哩哔哩";
  if (host.includes("zhihu.com")) return "知乎";
  if (host.includes("mp.weixin.qq.com")) return "微信公众号";
  if (host.includes("okjike.com")) return "即刻";
  if (host.includes("feishu.cn") || host.includes("larksuite.com")) return "飞书";
  if (host.includes("medium.com")) return "Medium";
  if (host.includes("substack.com")) return "Substack";
  if (host.includes("linkedin.com")) return "LinkedIn";
  if (host.includes("facebook.com")) return "Facebook";
  return host;
}

function linkSiteName(record) {
  return linkSourceName(record);
}

function normalizedSearchValue(value) {
  return String(value || "").normalize("NFKC").toLocaleLowerCase("zh-CN").replace(/\s+/g, " ").trim();
}

function recordSearchText(record) {
  return normalizedSearchValue([
    record.title, record.shareTitle, record.text, record.purpose, record.description,
    record.url, record.name, record.note, record.siteName, record.kind === "link" ? linkSourceName(record) : "",
    ...(Array.isArray(record.tags) ? record.tags : []),
  ].filter(Boolean).join(" "));
}

function availableTags() {
  const counts = new Map();
  state.images.forEach((record) => (record.tags || []).forEach((tag) => {
    const value = String(tag).trim();
    if (value) counts.set(value, (counts.get(value) || 0) + 1);
  }));
  return [...counts].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "zh-CN")).map(([tag]) => tag);
}

function renderCaptureTags() {
  const tags = [...new Set([...state.captureTags, ...availableTags()])];
  elements.batchTagSuggestions.innerHTML = tags.map((tag) => (
    `<button class="capture-tag-chip${state.captureTags.has(tag) ? " is-selected" : ""}" type="button" data-capture-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`
  )).join("");
}

function addCaptureTag() {
  const tag = elements.batchTagsInput.value.trim().replace(/^#/, "");
  if (!tag) return;
  state.captureTags.add(tag);
  elements.batchTagsInput.value = "";
  renderCaptureTags();
}

function setCaptureTags(tags = []) {
  state.captureTags = new Set(tags.filter(Boolean));
  if (elements.batchTagsInput) elements.batchTagsInput.value = "";
  if (elements.batchTagSuggestions) renderCaptureTags();
}

function recordMatchesTime(record, range) {
  if (range === "all") return true;
  const createdAt = Number(record.createdAt) || 0;
  const now = new Date();
  let threshold;
  if (range === "today") threshold = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  else if (range === "week") threshold = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  else if (range === "month") threshold = now.getTime() - 30 * 24 * 60 * 60 * 1000;
  else if (range === "year") threshold = new Date(now.getFullYear(), 0, 1).getTime();
  return createdAt >= threshold;
}

function visibleRecords() {
  const query = normalizedSearchValue(state.filters.query);
  return state.images.filter((record) => {
    const matchesView = state.activeView === "all"
      || (state.activeView === "links" && record.kind === "link")
      || (state.activeView === "texts" && record.kind === "text")
      || (state.activeView === "images" && !record.kind);
    const isUnsorted = !(record.tags || []).length;
    const matchesWorkflow = state.workflow === "all"
      || (state.workflow === "inbox" && isUnsorted)
      || (state.workflow.startsWith("tag:") && (record.tags || []).includes(state.workflow.slice(4)));
    if (!matchesView || !matchesWorkflow || (query && !recordSearchText(record).includes(query))) return false;
    if (state.filters.source !== "all" && (record.kind !== "link" || linkSourceName(record) !== state.filters.source)) return false;
    if (state.filters.purpose === "with" && (record.kind !== "link" || !record.purpose?.trim())) return false;
    if (state.filters.purpose === "without" && (record.kind !== "link" || record.purpose?.trim())) return false;
    return recordMatchesTime(record, state.filters.time);
  });
}

function recordsNearViewport(records) {
  if (records.length < 80 || state.filters.query) return records;
  const margin = 900 / state.view.zoom;
  const left = -state.view.x / state.view.zoom - margin;
  const top = -state.view.y / state.view.zoom - margin;
  const right = (innerWidth - state.view.x) / state.view.zoom + margin;
  const bottom = (innerHeight - state.view.y) / state.view.zoom + margin;
  return records.filter((record) => (
    record.id === state.selectedId
    || state.recentIds.has(record.id)
    || (record.canvasX < right && record.canvasX + itemWidth(record) > left
      && record.canvasY < bottom && record.canvasY + itemHeight(record) > top)
  ));
}

function filtersAreActive() {
  return Boolean(state.filters.query)
    || state.activeView !== "all"
    || state.workflow !== "all"
    || state.filters.source !== "all"
    || state.filters.purpose !== "all"
    || state.filters.time !== "all";
}

function renderSourceOptions() {
  const current = state.filters.source;
  const sources = [...new Set(state.images.filter((record) => record.kind === "link").map(linkSourceName))]
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right, "zh-CN"));
  elements.sourceFilter.replaceChildren(new Option("全部来源", "all"), ...sources.map((source) => new Option(source, source)));
  if (current !== "all" && !sources.includes(current)) state.filters.source = "all";
  elements.sourceFilter.value = state.filters.source;
}

function renderFilterControls() {
  renderSourceOptions();
  elements.searchInput.value = state.filters.query;
  elements.purposeFilter.value = state.filters.purpose;
  elements.timeFilter.value = state.filters.time;
  elements.clearSearchButton.hidden = !state.filters.query;
  const advancedCount = [state.filters.source, state.filters.purpose, state.filters.time].filter((value) => value !== "all").length;
  elements.filterCount.textContent = advancedCount;
  elements.filterCount.hidden = advancedCount === 0;
  elements.filterToggleButton.classList.toggle("is-active", advancedCount > 0 || !elements.filterPanel.hidden);
}

function renderWorkflowControls() {
  const tagCounts = new Map();
  state.images.forEach((record) => (record.tags || []).forEach((tag) => {
    tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
  }));
  const tags = availableTags();
  if (state.workflow.startsWith("tag:") && !tagCounts.has(state.workflow.slice(4))) state.workflow = "all";
  const button = (value, label, count = null) => `<button type="button" class="workflow-button${state.workflow === value ? " is-active" : ""}" data-workflow="${escapeHtml(value)}" aria-pressed="${state.workflow === value}">${escapeHtml(label)}${count === null ? "" : ` <span>${count}</span>`}</button>`;
  elements.workflowSwitcher.innerHTML = [
    button("all", "全部"),
    button("inbox", "未整理", state.images.filter((record) => !(record.tags || []).length).length),
    ...tags.map((tag) => button(`tag:${tag}`, tag, tagCounts.get(tag))),
    tags.length ? `<button type="button" class="workflow-manage-button" data-manage-tags aria-label="管理标签" title="管理标签"><svg viewBox="0 0 24 24"><path d="M4 7h10M4 17h16M18 7h2M10 12h10M4 12h2"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="12" r="2"/></svg></button>` : "",
  ].join("");
}

function tagCounts() {
  const counts = new Map();
  state.images.forEach((record) => (record.tags || []).forEach((tag) => counts.set(tag, (counts.get(tag) || 0) + 1)));
  return counts;
}

function renderTagManager() {
  const counts = tagCounts();
  const tags = availableTags();
  elements.tagManageEmpty.hidden = tags.length > 0;
  elements.tagManageList.innerHTML = tags.map((tag) => {
    const alternatives = tags.filter((candidate) => candidate !== tag);
    const edit = state.tagManageEdit?.tag === tag ? state.tagManageEdit : null;
    const editor = edit?.action === "rename"
      ? `<div class="tag-manage-inline"><input type="text" data-tag-edit-input maxlength="24" value="${escapeHtml(tag)}" aria-label="新标签名称"><button type="button" data-tag-edit-save>保存</button><button type="button" data-tag-edit-cancel>取消</button></div>`
      : edit?.action === "merge"
        ? `<div class="tag-manage-inline"><select data-tag-edit-target aria-label="合并到">${alternatives.map((candidate) => `<option value="${escapeHtml(candidate)}">${escapeHtml(candidate)}</option>`).join("")}</select><button type="button" data-tag-edit-save>合并</button><button type="button" data-tag-edit-cancel>取消</button></div>`
        : "";
    return `<div class="tag-manage-row" data-managed-tag="${escapeHtml(tag)}">
      <div class="tag-manage-name"><strong>${escapeHtml(tag)}</strong><span>${counts.get(tag) || 0} 项内容</span></div>
      <div class="tag-manage-actions">
        <button type="button" data-tag-action="rename">重命名</button>
        <button type="button" data-tag-action="merge"${alternatives.length ? "" : " disabled"}>合并</button>
        <button type="button" class="danger" data-tag-action="delete">删除</button>
      </div>
      ${editor}
    </div>`;
  }).join("");
}

function openTagManager() {
  renderTagManager();
  elements.tagManageBackdrop.hidden = false;
  elements.tagManageDialog.hidden = false;
}

function closeTagManager() {
  state.tagManageEdit = null;
  elements.tagManageBackdrop.hidden = true;
  elements.tagManageDialog.hidden = true;
}

function snapshotTags(source) {
  state.tagUndoSnapshot = state.images
    .filter((record) => (record.tags || []).includes(source))
    .map((record) => ({ id: record.id, tags: [...(record.tags || [])] }));
}

async function transformTag(source, target = "") {
  snapshotTags(source);
  const affected = state.images.filter((record) => (record.tags || []).includes(source));
  for (const record of affected) {
    record.tags = [...new Set((record.tags || []).flatMap((tag) => tag === source ? (target ? [target] : []) : [tag]))];
    await persistRecord(record);
  }
  if (state.workflow === `tag:${source}`) state.workflow = target ? `tag:${target}` : "all";
  render();
  renderTagManager();
  showToast(target ? `已将「${source}」调整为「${target}」` : `已删除「${source}」`, "撤销", undoTagChange);
}

async function undoTagChange() {
  if (!state.tagUndoSnapshot) return;
  const snapshot = new Map(state.tagUndoSnapshot.map((entry) => [entry.id, entry.tags]));
  const affected = state.images.filter((record) => snapshot.has(record.id));
  for (const record of affected) {
    record.tags = snapshot.get(record.id);
    await persistRecord(record);
  }
  state.tagUndoSnapshot = null;
  render();
  if (!elements.tagManageDialog.hidden) renderTagManager();
  showToast("标签操作已撤销");
}

function beginTagAction(tag, action) {
  if (action === "delete") return transformTag(tag);
  state.tagManageEdit = { tag, action };
  renderTagManager();
  requestAnimationFrame(() => elements.tagManageList.querySelector("[data-tag-edit-input], [data-tag-edit-target]")?.focus());
}

function applyTagManagerEdit(row) {
  const source = row.dataset.managedTag;
  const action = state.tagManageEdit?.action;
  const target = action === "rename"
    ? row.querySelector("[data-tag-edit-input]")?.value.trim().replace(/^#/, "")
    : row.querySelector("[data-tag-edit-target]")?.value;
  if (!target || target === source) {
    state.tagManageEdit = null;
    return renderTagManager();
  }
  state.tagManageEdit = null;
  return transformTag(source, target);
}

const LINK_COVERS = [
  { layout: "film", image: "assets/covers/film-strip.png", tone: "paper" },
  { layout: "landscape", image: "assets/covers/mountain.png", tone: "stone" },
  { layout: "offset", image: "assets/covers/desert.png", tone: "mist" },
  { layout: "specimen", image: "assets/covers/optics.png", tone: "pollen" },
  { layout: "center", image: "assets/covers/workspace.png", tone: "sage" },
  { layout: "portrait", image: "assets/covers/portrait.png", tone: "paper" },
  { layout: "object", image: "assets/covers/object.png", tone: "rose" },
  { layout: "letter", image: "assets/covers/letter.png", tone: "archive" },
];

const LINK_FONTS = ["original", "sans", "fangsong", "round"];

function randomIndex(length, except = -1) {
  if (length < 2) return 0;
  const candidate = Math.floor(Math.random() * (length - 1));
  return candidate >= except ? candidate + 1 : candidate;
}

function ensureLinkStyle(record) {
  if (!Number.isInteger(record.coverIndex) || !LINK_COVERS[record.coverIndex]) record.coverIndex = randomIndex(LINK_COVERS.length);
  if (!Number.isInteger(record.fontIndex) || !LINK_FONTS[record.fontIndex]) record.fontIndex = 0;
  if (!record.coverMode) record.coverMode = "editorial";
  return LINK_COVERS[record.coverIndex];
}

function displayLinkTitle(value) {
  const title = String(value || "").replace(/\s+/g, " ").trim();
  if ([...title].length <= 32) return title;
  const cleaned = title
    .replace(/^(?:最近|这两天|前段时间|今天|昨天)?(?:研究|尝试|体验|测试)(?:了|了一下)?(?:一个|一种|一款)?\s*/u, "")
    .replace(/[。！？!?；;].*$/u, "")
    .replace(/(?:前段时间|最近|顺便|以及|然后).{0,22}$/u, "")
    .trim();
  const source = cleaned.length >= 8 ? cleaned : title;
  const clauses = source.split(/[，,：:｜|—–-]/).map((part) => part.trim()).filter(Boolean);
  let summary = clauses[0] || source;
  if ([...summary].length < 14 && clauses[1]) summary += `：${clauses[1]}`;
  const characters = [...summary];
  return characters.length > 30 ? `${characters.slice(0, 29).join("")}…` : summary;
}

function linkCard(record) {
  const title = record.title || record.url;
  const displayTitle = displayLinkTitle(title);
  const cover = ensureLinkStyle(record);
  const font = LINK_FONTS[record.fontIndex];
  return `<div class="link-card mode-${record.coverMode} cover-${cover.layout} tone-${cover.tone} font-${font}${record.purpose ? " has-purpose" : ""}${record.previewState === "loading" ? " is-loading" : ""}">
    <div class="link-cover-image" style="--cover-image:url('${cover.image}')" aria-hidden="true"></div>
    <span class="link-cover-index" aria-hidden="true">${String(record.coverIndex + 1).padStart(2, "0")}</span>
    <a class="link-title" href="${escapeHtml(record.url)}" target="_blank" rel="noopener noreferrer" data-open-link aria-label="打开 ${escapeHtml(title)}" title="${escapeHtml(title)}">${escapeHtml(displayTitle)}</a>
    ${record.purpose ? `<p class="link-purpose">用于：${escapeHtml(record.purpose)}</p>` : ""}
    <a class="link-card-footer" href="${escapeHtml(record.url)}" target="_blank" rel="noopener noreferrer" data-open-link aria-label="打开原文">打开原文</a>
  </div>`;
}

function escapeHtml(value = "") {
  const node = document.createElement("div");
  node.textContent = value;
  return node.innerHTML;
}

function textBaseSize(text) {
  const lines = text.split("\n");
  const longestLine = Math.max(1, ...lines.map((line) => [...line].length));
  const charactersPerLine = Math.min(18, Math.max(2, longestLine));
  const wrappedLines = lines.reduce((total, line) => total + Math.max(1, Math.ceil([...line].length / charactersPerLine)), 0);
  return {
    width: Math.min(510, Math.max(86, charactersPerLine * 30 + 30)),
    height: wrappedLines * 38.4 + 25,
  };
}

function textResizeHandles() {
  return ["nw", "n", "ne", "e", "se", "s", "sw", "w"]
    .map((direction) => `<span class="text-resize-handle text-resize-${direction}" data-resize data-resize-direction="${direction}" aria-hidden="true"></span>`)
    .join("");
}

function defaultPlacement(index, width, height) {
  const columns = 4;
  const displayWidth = Math.min(320, Math.max(180, width ? width * Math.min(1, 320 / width) : 280));
  const displayHeight = height && width ? displayWidth * height / width : displayWidth;
  return {
    canvasX: (index % columns) * 360 - 540,
    canvasY: Math.floor(index / columns) * 390 - 260,
    canvasWidth: displayWidth,
    displayHeight,
  };
}

async function loadImages() {
  const records = await transact("readonly", (store) => store.getAll());
  records.sort((a, b) => a.createdAt - b.createdAt);
  let migrated = false;
  const needsAssetRecovery = records.some((record) => !record.kind && record.thumbnailVersion !== THUMBNAIL_VERSION);
  const recoveredAssets = needsAssetRecovery ? await backupImageAssets() : new Map();
  state.images = records.map((record, index) => {
    if (!WORKFLOW_STATUSES.has(record.status)) {
      record.status = "unread";
      migrated = true;
    }
    if (record.kind === "link" && (!Number.isInteger(record.coverIndex) || !Number.isInteger(record.fontIndex) || !record.coverMode)) {
      ensureLinkStyle(record);
      migrated = true;
    }
    if (record.kind === "text" && (!record.textHeight || !record.textScale || record.textScale !== 1)) {
      const size = textBaseSize(record.text || record.name || "文字");
      const legacyScale = Number.isFinite(record.textScale) ? record.textScale : 1;
      migrated = true;
      return {
        ...record,
        canvasWidth: (record.canvasWidth || size.width) * legacyScale,
        textHeight: (record.textHeight || size.height) * legacyScale,
        textScale: 1,
      };
    }
    if (Number.isFinite(record.canvasX) && Number.isFinite(record.canvasY) && Number.isFinite(record.canvasWidth)) return record;
    migrated = true;
    const placement = defaultPlacement(index, record.width, record.height);
    return { ...record, canvasX: placement.canvasX, canvasY: placement.canvasY, canvasWidth: placement.canvasWidth, zIndex: index + 1 };
  });
  for (const record of state.images) {
    if (record.kind === "link" && !record.canonicalUrl) {
      record.canonicalUrl = canonicalUrl(record.url);
      migrated = true;
    } else if (!record.kind) {
      if (record.blob) {
        if (!record.fingerprint) record.fingerprint = await blobFingerprint(record.blob);
        await storeImageAsset(record, record.blob);
        record.thumbnail = record.blob;
        record.thumbnailVersion = THUMBNAIL_VERSION;
        delete record.blob;
        migrated = true;
      } else if (!record.thumbnail || record.thumbnailVersion !== THUMBNAIL_VERSION) {
        const recovered = recoveredAssets.get(record.id);
        if (recovered?.blob) {
          await storeImageAsset(record, recovered.blob);
          record.assetHash = recovered.assetHash;
        }
        const original = recovered?.blob || await originalBlob(record);
        if (original) {
          record.thumbnail = original;
          record.thumbnailVersion = THUMBNAIL_VERSION;
          migrated = true;
        }
      }
    }
  }
  try {
    state.layoutSnapshot = JSON.parse(localStorage.getItem("later-space-layout-snapshot")) || null;
  } catch {
    state.layoutSnapshot = null;
  }
  updateOrganizeButton();
  if (migrated) {
    for (const record of state.images) await transact("readwrite", (store) => store.put(record));
  }
  render();
}

function render() {
  const filteredRecords = visibleRecords();
  const renderedRecords = recordsNearViewport(filteredRecords);
  if (filteredRecords.length >= 80) {
    const renderedIds = new Set(renderedRecords.map((record) => record.id));
    state.objectUrls.forEach((url, id) => {
      if (!renderedIds.has(id)) {
        URL.revokeObjectURL(url);
        state.objectUrls.delete(id);
      }
    });
  }
  elements.imageCount.textContent = filtersAreActive() ? `${filteredRecords.length}/${state.images.length}` : state.images.length;
  elements.emptyCue.hidden = filteredRecords.length > 0;
  elements.emptyCue.setAttribute("aria-hidden", filteredRecords.length > 0 ? "true" : "false");
  elements.emptyTitle.textContent = state.images.length ? "没有找到匹配内容" : "粘贴图片、链接或文字";
  elements.emptyHint.innerHTML = state.images.length ? "换个关键词，或者重置筛选" : "<kbd>⌘</kbd><kbd>V</kbd>";
  const showOnboarding = !state.images.length && localStorage.getItem(ONBOARDING_DISMISSED_KEY) !== "true";
  elements.onboardingCards.hidden = !showOnboarding;
  elements.onboardingCards.setAttribute("aria-hidden", showOnboarding ? "false" : "true");
  if (state.selectedId && !filteredRecords.some((record) => record.id === state.selectedId)) state.selectedId = null;
  const filteredIds = new Set(filteredRecords.map((record) => record.id));
  state.selectedIds.forEach((id) => { if (!filteredIds.has(id)) state.selectedIds.delete(id); });
  elements.world.innerHTML = renderedRecords.map((record) => {
    const selected = record.id === state.selectedId;
    const multiSelected = state.selectedIds.has(record.id);
    const isLink = record.kind === "link";
    const isText = record.kind === "text";
    const content = isLink ? linkCard(record) : isText ? `<div class="text-block">${escapeHtml(record.text)}</div>` : `<img src="${imageUrl(record)}" alt="${escapeHtml(record.note || record.name || "收藏图片")}" draggable="false" />`;
    const transform = `translate(${record.canvasX}px,${record.canvasY}px)`;
    const textHeight = isText ? `height:${record.textHeight || textBaseSize(record.text).height}px;` : "";
    return `<article class="canvas-item${isLink ? " link-item" : ""}${isText ? " text-item" : ""}${selected ? " is-selected" : ""}${multiSelected ? " is-multi-selected" : ""}${state.recentIds.has(record.id) ? " is-new" : ""}${state.arrivingIds.has(record.id) ? " is-arriving" : ""}${state.duplicateFocusId === record.id ? " is-duplicate-focus" : ""}" data-id="${record.id}" data-status="${record.status || "unread"}" tabindex="0" aria-label="${escapeHtml(record.title || record.text || record.name || "收藏内容")}" style="width:${record.canvasWidth}px;${textHeight}transform:${transform};z-index:${record.zIndex || 1}">
      ${content}
      ${isText ? textResizeHandles() : `<span class="resize-handle" data-resize aria-hidden="true"></span>`}
      <span class="item-caption">${escapeHtml(record.title || record.note || record.name || "内容")}</span>
    </article>`;
  }).join("");
  renderFilterControls();
  renderWorkflowControls();
  renderSelection();
  renderGlobalCoverMode();
}

function renderGlobalCoverMode() {
  const links = state.images.filter((record) => record.kind === "link");
  const modes = new Set(links.map((record) => record.coverMode || "editorial"));
  elements.globalCoverSwitcher.dataset.state = modes.size > 1 ? "mixed" : (modes.values().next().value || "editorial");
  elements.globalCoverButtons.forEach((button) => {
    const active = links.length > 0 && modes.size === 1 && modes.has(button.dataset.globalCoverMode);
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function renderSelection() {
  if (state.selectedIds.size > 1) {
    elements.selectionBar.hidden = false;
    elements.selectionName.textContent = `已选择 ${state.selectedIds.size} 项`;
    elements.selectionSize.textContent = "Shift 拖动框选";
    elements.editTextButton.hidden = true;
    elements.editLinkButton.hidden = true;
    elements.linkModeSwitcher.hidden = true;
    elements.shuffleCoverButton.hidden = true;
    elements.shuffleFontButton.hidden = true;
    elements.copyImageButton.hidden = true;
    elements.cropImageButton.hidden = true;
    elements.openSelectedButton.hidden = true;
    elements.batchEditButton.hidden = false;
    return;
  }
  const record = state.images.find((image) => image.id === state.selectedId);
  elements.selectionBar.hidden = !record;
  if (!record) return;
  elements.selectionName.textContent = record.title || record.text || record.note || record.name || "内容";
  elements.selectionSize.textContent = (record.tags || []).length ? record.tags.map((tag) => `#${tag}`).join(" · ") : "未整理";
  elements.editTextButton.hidden = record.kind !== "text";
  elements.editLinkButton.hidden = record.kind !== "link";
  elements.linkModeSwitcher.hidden = record.kind !== "link";
  elements.linkModeButtons.forEach((button) => {
    const active = record.kind === "link" && button.dataset.linkMode === (record.coverMode || "editorial");
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  elements.shuffleCoverButton.hidden = record.kind !== "link" || record.coverMode === "clean";
  elements.shuffleFontButton.hidden = record.kind !== "link" || record.coverMode === "clean";
  elements.copyImageButton.hidden = Boolean(record.kind);
  elements.cropImageButton.hidden = Boolean(record.kind);
  elements.batchEditButton.hidden = false;
  elements.openSelectedButton.hidden = record.kind !== "link";
  elements.openSelectedButton.href = record.kind === "link" ? record.url : "#";
}

function openLink(record) {
  if (!record?.url) return;
  const popup = window.open(record.url, "_blank");
  if (popup) popup.opener = null;
  else window.location.assign(record.url);
}

async function openStoragePanel() {
  elements.storagePanel.hidden = false;
  elements.browserStorageValue.textContent = "计算中…";
  elements.originalStorageValue.textContent = "计算中…";
  elements.recordStorageValue.textContent = `${state.images.length} 条`;
  const [estimate, originalBytes, backupStatus] = await Promise.all([
    navigator.storage?.estimate?.().catch(() => null),
    sumOriginalAssetBytes().catch(() => 0),
    fetch("/api/backups/status").then((response) => response.ok ? response.json() : null).catch(() => null),
  ]);
  const usage = estimate?.usage || 0;
  const quota = estimate?.quota || 0;
  const ratio = quota ? usage / quota : 0;
  elements.browserStorageValue.textContent = quota ? `${formatBytes(usage)} / ${formatBytes(quota)}` : formatBytes(usage);
  elements.originalStorageValue.textContent = formatBytes(originalBytes);
  elements.storageMeterFill.style.width = `${Math.min(100, ratio * 100)}%`;
  elements.storageMeterFill.parentElement.classList.toggle("is-warning", ratio > .8);
  elements.backupStorageValue.textContent = backupStatus?.count
    ? `${backupStatus.count} 版 · ${formatBytes(backupStatus.bytes)}`
    : "尚无备份";
  elements.storageHint.textContent = ratio > .8
    ? "本地空间已接近浏览器配额，建议立即导出或启用云端同步。"
    : "原图按需加载，画布只使用缩略图；云端同步上线后，本地可进一步改为缓存模式。";
}

function openBatchEditor() {
  const records = selectedRecords();
  if (!records.length) return;
  const commonTags = records.length === 1
    ? [...(records[0].tags || [])]
    : availableTags().filter((tag) => records.every((record) => (record.tags || []).includes(tag)));
  state.initialBatchTags = new Set(commonTags);
  setCaptureTags(commonTags);
  elements.tagEditorHint.textContent = records.length === 1
    ? "选择已有标签，或创建一个新标签。"
    : `为选中的 ${records.length} 项内容批量调整标签。`;
  elements.batchBackdrop.hidden = false;
  elements.batchDialog.hidden = false;
  requestAnimationFrame(() => elements.batchTagsInput.focus());
}

function closeBatchEditor() {
  elements.batchBackdrop.hidden = true;
  elements.batchDialog.hidden = true;
}

async function applyBatchEdit() {
  addCaptureTag();
  const records = selectedRecords();
  const addedTags = [...state.captureTags].filter((tag) => !state.initialBatchTags.has(tag));
  const removedTags = [...state.initialBatchTags].filter((tag) => !state.captureTags.has(tag));
  for (const record of records) {
    record.tags = [...new Set([...(record.tags || []).filter((tag) => !removedTags.includes(tag)), ...addedTags])];
    await persistRecord(record);
  }
  closeBatchEditor();
  render();
  showToast(records.length === 1 ? "标签已保存" : `已更新 ${records.length} 项标签`);
}

function selectedRecords() {
  const ids = state.selectedIds.size ? state.selectedIds : new Set(state.selectedId ? [state.selectedId] : []);
  return state.images.filter((record) => ids.has(record.id));
}

function openCapture() {
  state.editingTextId = null;
  state.editingLinkId = null;
  state.editingImageId = null;
  state.pendingImageFiles = [];
  setCaptureTags();
  setCaptureMode("text");
  elements.captureBackdrop.hidden = false;
  elements.captureDialog.hidden = false;
  requestAnimationFrame(() => elements.captureInput.focus());
}

function setCaptureMode(mode) {
  state.captureMode = mode;
  elements.captureInput.readOnly = mode === "link" && Boolean(state.editingLinkId);
  elements.captureModeButtons.forEach((button) => {
    const active = button.dataset.captureMode === mode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  const isImage = mode === "image";
  elements.linkPurposeGroup.hidden = mode !== "link" || !state.editingLinkId;
  elements.captureInputGroup.hidden = isImage;
  elements.chooseImagesButton.hidden = !isImage;
  elements.addContentButton.parentElement.hidden = false;
  if (mode === "text") {
    elements.captureInputLabel.textContent = "写点什么";
    elements.captureInput.placeholder = "一句话、一个标题，或者此刻的想法……";
    elements.addContentButton.textContent = "添加文字";
  } else if (mode === "link") {
    elements.captureInputLabel.textContent = "链接或分享文案";
    elements.captureInput.placeholder = "粘贴网址、小红书分享文案、X 帖子链接……";
    elements.addContentButton.textContent = "添加链接";
  } else {
    elements.addContentButton.textContent = state.editingImageId ? "保存用途" : "添加图片";
  }
  if (!isImage && !elements.captureDialog.hidden) requestAnimationFrame(() => elements.captureInput.focus());
}

function closeCapture() {
  elements.captureBackdrop.hidden = true;
  elements.captureDialog.hidden = true;
  elements.captureInput.value = "";
  elements.linkTitleInput.value = "";
  state.pendingImageFiles = [];
  state.editingTextId = null;
  state.editingLinkId = null;
  state.editingImageId = null;
}

function openTextEditor(record) {
  if (!record || record.kind !== "text") return;
  state.editingTextId = record.id;
  setCaptureMode("text");
  elements.captureBackdrop.hidden = false;
  elements.captureDialog.hidden = false;
  elements.captureInputLabel.textContent = "编辑文字";
  elements.captureInput.value = record.text;
  elements.addContentButton.textContent = "保存修改";
  requestAnimationFrame(() => {
    elements.captureInput.focus();
    elements.captureInput.setSelectionRange(elements.captureInput.value.length, elements.captureInput.value.length);
  });
}

function openLinkEditor(record) {
  if (!record || record.kind !== "link") return;
  state.editingTextId = null;
  state.editingLinkId = record.id;
  setCaptureMode("link");
  elements.captureBackdrop.hidden = false;
  elements.captureDialog.hidden = false;
  elements.captureInputLabel.textContent = "原链接";
  elements.captureInput.value = record.url;
  elements.captureInput.readOnly = true;
  elements.linkTitleInput.value = record.title || "";
  elements.addContentButton.textContent = "保存修改";
  requestAnimationFrame(() => elements.linkTitleInput.focus());
}

function screenCenter() {
  return { x: innerWidth / 2, y: innerHeight / 2 };
}

function buttonCenter(button) {
  const bounds = button?.getBoundingClientRect();
  return bounds ? { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 } : screenCenter();
}

function animateRecordArrival(record, origin, delay) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return Promise.resolve();
  return new Promise((resolve) => requestAnimationFrame(() => {
    const target = elements.world.querySelector(`[data-id="${record.id}"]`);
    if (!target) return resolve();
    const bounds = target.getBoundingClientRect();
    const clone = target.cloneNode(true);
    const minimumStartSize = 118;
    const startScale = Math.max(1.08, minimumStartSize / Math.max(1, bounds.width));
    const startX = origin.x - (bounds.left + bounds.width / 2);
    const startY = origin.y - (bounds.top + bounds.height / 2);
    clone.classList.remove("is-arriving", "is-selected", "is-new");
    clone.classList.add("arrival-ghost");
    Object.assign(clone.style, {
      position: "fixed", left: `${bounds.left}px`, top: `${bounds.top}px`,
      width: `${bounds.width}px`, height: `${bounds.height}px`, transform: "none", zIndex: "120",
    });
    document.body.appendChild(clone);
    const animation = clone.animate([
      { transform: `translate(${startX}px, ${startY}px) scale(${startScale})`, opacity: 0, offset: 0 },
      { transform: `translate(${startX * .82}px, ${startY * .82 - 18}px) scale(${startScale * 1.04})`, opacity: 1, offset: .16 },
      { transform: `translate(${startX * .35}px, ${startY * .35 - 24}px) scale(${1 + (startScale - 1) * .32})`, opacity: 1, offset: .68 },
      { transform: "translate(0, 0) scale(1)", opacity: 1, offset: 1 },
    ], { duration: 760, delay, easing: "cubic-bezier(.2,.78,.2,1)", fill: "both" });
    animation.finished.catch(() => {}).finally(() => { clone.remove(); resolve(); });
  }));
}

async function highlightNewRecords(records, origin = screenCenter()) {
  state.selectedIds.clear();
  if (records.length) state.selectedIds.add(records[records.length - 1].id);
  records.forEach((record) => {
    state.recentIds.add(record.id);
    state.arrivingIds.add(record.id);
  });
  render();
  await Promise.all(records.map((record, index) => animateRecordArrival(record, origin, index * 90)));
  records.forEach((record) => state.arrivingIds.delete(record.id));
  render();
  setTimeout(() => {
    records.forEach((record) => state.recentIds.delete(record.id));
    render();
  }, 3600);
}

async function submitCapture() {
  if (state.captureSubmitting) return;
  const text = elements.captureInput.value.trim();
  const arrivalOrigin = buttonCenter(elements.addContentButton);
  if (state.captureMode === "image") {
    return elements.fileInput.click();
  }
  if (state.editingLinkId) {
    const record = state.images.find((item) => item.id === state.editingLinkId);
    if (!record) return closeCapture();
    const customTitle = elements.linkTitleInput.value.trim();
    record.title = customTitle || record.shareTitle || linkHostname(record.url);
    record.customTitle = Boolean(customTitle);
    await persistRecord(record);
    closeCapture();
    state.selectedId = record.id;
    render();
    showToast("链接封面已更新");
    return;
  }
  if (state.captureMode === "text") {
    if (!text) {
      showToast("先写点什么吧");
      elements.captureInput.focus();
      return;
    }
    if (state.editingTextId) {
      const record = state.images.find((item) => item.id === state.editingTextId);
      if (record) {
        record.text = text;
        record.name = text.slice(0, 32);
        await persistRecord(record);
        closeCapture();
        state.selectedId = record.id;
        render();
        showToast("文字已更新");
      }
    } else {
      closeCapture();
      await saveText(text, arrivalOrigin);
    }
    return;
  }
  const urls = extractUrls(text);
  if (!urls.length) {
    showToast("请粘贴网址或分享文案");
    elements.captureInput.focus();
    return;
  }
  state.captureSubmitting = true;
  elements.addContentButton.disabled = true;
  closeCapture();
  try {
    await saveLinks(urls, text, "", "", arrivalOrigin);
  } finally {
    state.captureSubmitting = false;
    elements.addContentButton.disabled = false;
  }
}

function setView(view) {
  state.activeView = view;
  elements.viewButtons.forEach((button) => {
    const active = button.dataset.view === view;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  render();
  fitAll();
}

function updateFilters() {
  state.filters.source = elements.sourceFilter.value;
  state.filters.purpose = elements.purposeFilter.value;
  state.filters.time = elements.timeFilter.value;
  render();
  fitAll();
}

function resetFilters() {
  state.filters = { query: "", source: "all", purpose: "all", time: "all" };
  state.activeView = "all";
  state.workflow = "all";
  elements.viewButtons.forEach((button) => {
    const active = button.dataset.view === "all";
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  render();
  fitAll();
  elements.searchInput.focus();
}

function getDimensions(blob) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => { resolve({ width: image.naturalWidth, height: image.naturalHeight }); URL.revokeObjectURL(url); };
    image.onerror = () => { resolve({ width: 0, height: 0 }); URL.revokeObjectURL(url); };
    image.src = url;
  });
}

async function saveFiles(fileList, source, screenPoint, purpose = "", tags = []) {
  const files = Array.from(fileList).filter((file) => file?.type?.startsWith("image/"));
  if (!files.length) return showToast("没有找到图片");
  const center = screenPoint ? screenToWorld(screenPoint.x, screenPoint.y) : worldCenter();
  const baseOffset = state.pasteOffset;
  const savedRecords = [];
  for (const [index, file] of files.entries()) {
    const fingerprint = await blobFingerprint(file);
    const duplicate = state.images.find((record) => !record.kind && record.fingerprint === fingerprint);
    if (duplicate && !await confirmDuplicateUpload("这张图片", duplicate)) continue;
    const dimensions = await getDimensions(file);
    const canvasWidth = Math.min(360, Math.max(180, dimensions.width ? Math.min(dimensions.width, 320) : 280));
    const ratio = dimensions.width ? dimensions.height / dimensions.width : 1;
    const placement = openPlacement(center, canvasWidth, canvasWidth * ratio);
    const now = Date.now() + index;
    const record = {
      id: makeId(), thumbnail: file, thumbnailVersion: THUMBNAIL_VERSION, name: file.name || `粘贴图片 ${new Date(now).toLocaleTimeString("zh-CN")}`,
      type: file.type, size: file.size, width: dimensions.width, height: dimensions.height, fingerprint,
      status: "inbox", tags: [...tags], note: purpose, source, createdAt: now, updatedAt: now,
      canvasX: placement.x,
      canvasY: placement.y,
      canvasWidth, zIndex: Math.max(0, ...state.images.map((item) => item.zIndex || 0)) + index + 1,
    };
    await storeImageAsset(record, file);
    await transact("readwrite", (store) => store.put(record));
    state.images.push(record);
    savedRecords.push(record);
    state.selectedId = record.id;
  }
  state.pasteOffset = (baseOffset + files.length) % 7;
  if (savedRecords.length) {
    highlightNewRecords(savedRecords, screenPoint || screenCenter());
    scheduleBackup();
    showToast(`${savedRecords.length} 张图片已放入画布`);
  }
}

async function saveText(text, arrivalOrigin = screenCenter(), tags = []) {
  const fingerprint = normalizedTextFingerprint(text);
  const duplicate = state.images.find((record) => record.kind === "text" && normalizedTextFingerprint(record.text) === fingerprint);
  if (duplicate && !await confirmDuplicateUpload("这段文字", duplicate)) return;
  const center = worldCenter();
  const size = textBaseSize(text);
  const placement = openPlacement(center, size.width, size.height);
  const now = Date.now();
  const record = {
    id: makeId(), kind: "text", text, name: text.slice(0, 32),
    status: "inbox", tags: [...tags], note: "", source: "compose", createdAt: now, updatedAt: now,
    canvasX: placement.x, canvasY: placement.y, canvasWidth: size.width, textHeight: size.height, textScale: 1,
    zIndex: Math.max(0, ...state.images.map((item) => item.zIndex || 0)) + 1,
  };
  await transact("readwrite", (store) => store.put(record));
  state.images.push(record);
  state.selectedId = record.id;
  highlightNewRecords([record], arrivalOrigin);
  scheduleBackup();
  showToast("文字已放入画布");
}

function extractUrls(text) {
  return [...text.matchAll(/https?:\/\/[^\s<>"'，。；！？）】]+/gi)].map((match) => match[0].replace(/[),.;!?]+$/, ""));
}

function titleFromShareText(text, url) {
  const cleaned = text
    .replace(url, " ")
    .replace(/\d*\s*[【[]([^】\]]+)[】\]]/g, (_, content) => {
      const primary = content.split(/[|｜]/)[0].trim();
      return primary.replace(/\s+[-–—]\s+[^-–—]{1,30}$/, "").trim();
    })
    .replace(/复制(?:本条信息)?后打开.*$/gis, " ")
    .replace(/打开(?:小红书|抖音|微博|知乎|浏览器).*$/gis, " ")
    .replace(/(?:戳|点击|长按).*?(?:查看|打开).*$/gis, " ")
    .replace(/@[\w\u4e00-\u9fff·.-]+/g, " ")
    .replace(/[#｜|].*$/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const candidates = cleaned
    .split(/[\n。！？!?]/)
    .map((line) => line.replace(/^\d+\s*/, "").trim())
    .filter((line) => line.length >= 4 && line.length <= 120);
  if (candidates[0]) return candidates[0];
  const xStatus = url.match(/(?:x|twitter)\.com\/[^/]+\/status\/(\d+)/i);
  return xStatus ? `X 帖子 · ${xStatus[1].slice(-6)}` : linkHostname(url);
}

function isGenericTitle(title, record) {
  if (!title) return true;
  const normalized = title.trim().toLocaleLowerCase("zh-CN");
  const host = linkHostname(record.url).toLocaleLowerCase("zh-CN");
  const generic = new Set([host, "小红书", "xiaohongshu", "稍后阅读", "登录", "login", "安全验证", "验证码"]);
  return generic.has(normalized) || normalized.includes("website-login/captcha");
}

function itemHeight(record) {
  if (record.kind === "link") return record.canvasWidth * 1.25;
  if (record.kind === "text") {
    return record.textHeight || textBaseSize(record.text).height;
  }
  return record.canvasWidth * (record.height && record.width ? record.height / record.width : 1);
}

function itemWidth(record) {
  return record.canvasWidth;
}

function closeDuplicatePrompt(keepDuplicate) {
  if (!state.duplicatePrompt) return;
  const { resolve, record, label } = state.duplicatePrompt;
  state.duplicatePrompt = null;
  elements.duplicateBackdrop.hidden = true;
  elements.duplicateDialog.hidden = true;
  if (!keepDuplicate) revealDuplicate(record, label);
  resolve(keepDuplicate);
}

function confirmDuplicateUpload(label, record) {
  if (state.duplicatePrompt) closeDuplicatePrompt(false);
  elements.duplicateTitle.textContent = `${label}已经在画布里了`;
  elements.duplicateBackdrop.hidden = false;
  elements.duplicateDialog.hidden = false;
  requestAnimationFrame(() => elements.findDuplicateButton.focus());
  return new Promise((resolve) => {
    state.duplicatePrompt = { resolve, record, label };
  });
}

function revealDuplicate(record, label) {
  state.selectedId = record.id;
  state.selectedIds.clear();
  state.selectedIds.add(record.id);
  state.duplicateFocusId = record.id;
  state.activeView = "all";
  state.filters = { query: "", source: "all", purpose: "all", time: "all" };
  const centerX = record.canvasX + itemWidth(record) / 2;
  const centerY = record.canvasY + itemHeight(record) / 2;
  state.view.x = innerWidth / 2 - centerX * state.view.zoom;
  state.view.y = innerHeight / 2 - centerY * state.view.zoom;
  render();
  updateView();
  showToast(`${label}已经收藏过，已带你找到原内容`);
  setTimeout(() => {
    if (state.duplicateFocusId !== record.id) return;
    state.duplicateFocusId = null;
    render();
  }, 1100);
}

function updateOrganizeButton() {
  const organized = Boolean(state.layoutSnapshot);
  elements.organizeButton.classList.toggle("is-organized", organized);
  elements.organizeButton.setAttribute("aria-label", organized ? "一键还原画布" : "一键整理画布");
  elements.organizeButton.title = organized ? "一键还原" : "一键整理";
}

async function organizeCanvas() {
  const records = visibleRecords();
  if (!records.length) return showToast("当前视图里没有可整理的内容");
  if (state.layoutSnapshot) return restoreCanvas();
  state.layoutSnapshot = records.map((record) => ({
    id: record.id,
    canvasX: record.canvasX,
    canvasY: record.canvasY,
    canvasWidth: record.canvasWidth,
    textHeight: record.textHeight,
    zIndex: record.zIndex,
  }));
  localStorage.setItem("later-space-layout-snapshot", JSON.stringify(state.layoutSnapshot));
  const columns = Math.max(1, Math.min(records.length, Math.ceil(Math.sqrt(records.length * 2.4))));
  const gap = 34;
  const cardWidth = 280;
  const columnHeights = Array(columns).fill(0);
  records.forEach((record, index) => {
    const column = columnHeights.indexOf(Math.min(...columnHeights));
    if (record.kind === "text") {
      if (record.canvasWidth > cardWidth) {
        const widthRatio = cardWidth / record.canvasWidth;
        record.canvasWidth = cardWidth;
        record.textHeight = Math.max(72, itemHeight(record) / widthRatio);
      }
    } else {
      record.canvasWidth = cardWidth;
    }
    record.canvasX = column * (cardWidth + gap);
    record.canvasY = columnHeights[column];
    record.zIndex = index + 1;
    const height = itemHeight(record);
    columnHeights[column] += height + gap;
  });
  for (const record of records) await persistRecord(record);
  state.selectedId = null;
  state.selectedIds.clear();
  render();
  updateOrganizeButton();
  fitAll();
  showToast(state.activeView === "all" ? "当前结果已整理整齐" : "当前分类已整理整齐");
}

async function restoreCanvas() {
  if (!state.layoutSnapshot) return;
  const snapshotById = new Map(state.layoutSnapshot.map((item) => [item.id, item]));
  state.images.forEach((record) => {
    const previous = snapshotById.get(record.id);
    if (previous) Object.assign(record, previous);
  });
  for (const record of state.images) await persistRecord(record);
  state.layoutSnapshot = null;
  localStorage.removeItem("later-space-layout-snapshot");
  state.selectedId = null;
  state.selectedIds.clear();
  render();
  updateOrganizeButton();
  fitAll();
  showToast("已还原整理前的位置");
}

function overlapsExisting(x, y, width, height) {
  const margin = 28;
  return state.images.some((item) => (
    x < item.canvasX + itemWidth(item) + margin
    && x + width + margin > item.canvasX
    && y < item.canvasY + itemHeight(item) + margin
    && y + height + margin > item.canvasY
  ));
}

function openPlacement(center, width, height) {
  const stepX = Math.max(210, width + 36);
  const stepY = Math.max(190, height + 36);
  const candidates = [[0, 0]];
  for (let ring = 1; ring <= 8; ring += 1) {
    candidates.push([ring, 0], [-ring, 0], [0, ring], [0, -ring]);
    for (let offset = 1; offset <= ring; offset += 1) {
      candidates.push(
        [ring, offset], [ring, -offset], [-ring, offset], [-ring, -offset],
        [offset, ring], [-offset, ring], [offset, -ring], [-offset, -ring],
      );
    }
  }
  for (const [column, row] of candidates) {
    const x = center.x - width / 2 + column * stepX;
    const y = center.y - height / 2 + row * stepY;
    if (!overlapsExisting(x, y, width, height)) return { x, y };
  }
  return { x: center.x - width / 2 + state.images.length * stepX, y: center.y - height / 2 };
}

async function saveLinks(urls, sourceText = "", purpose = "", customTitle = "", arrivalOrigin = screenCenter(), tags = []) {
  const center = worldCenter();
  const baseOffset = state.pasteOffset;
  const savedRecords = [];
  for (const [index, value] of urls.entries()) {
    let normalized;
    try { normalized = new URL(value).href; } catch { continue; }
    const canonical = canonicalUrl(normalized);
    const duplicate = state.images.find((record) => record.kind === "link" && canonicalUrl(record.url) === canonical);
    if (duplicate && !await confirmDuplicateUpload("这个链接", duplicate)) continue;
    const placement = openPlacement(center, 300, 375);
    const now = Date.now() + index;
    const shareTitle = titleFromShareText(sourceText, value);
    const record = {
      id: makeId(), kind: "link", url: normalized, canonicalUrl: canonical, name: linkHostname(normalized),
      title: customTitle || shareTitle, shareTitle, customTitle: Boolean(customTitle), description: "", previewImage: "", previewState: "loading",
      purpose,
      coverIndex: randomIndex(LINK_COVERS.length), fontIndex: 0, coverMode: state.globalCoverPreference,
      status: "inbox", tags: [...tags], note: "", source: "paste", createdAt: now, updatedAt: now,
      canvasX: placement.x, canvasY: placement.y,
      canvasWidth: 300, zIndex: Math.max(0, ...state.images.map((item) => item.zIndex || 0)) + index + 1,
    };
    await transact("readwrite", (store) => store.put(record));
    state.images.push(record);
    savedRecords.push(record);
    state.selectedId = record.id;
    render();
    enrichLink(record);
  }
  state.pasteOffset = (baseOffset + urls.length) % 7;
  if (savedRecords.length) {
    highlightNewRecords(savedRecords, arrivalOrigin);
    scheduleBackup();
    showToast(`${savedRecords.length} 个链接已放入画布`);
  }
}

async function enrichLink(record) {
  try {
    const response = await fetch(`/api/preview?url=${encodeURIComponent(record.url)}`);
    if (!response.ok) throw new Error("preview unavailable");
    const preview = await response.json();
    if (!record.customTitle && !isGenericTitle(preview.title, record)) record.title = preview.title;
    record.description = preview.description || "";
    record.previewImage = preview.image || "";
    record.siteName = preview.siteName || linkSiteName(record);
    record.previewState = record.previewImage ? "ready" : "generated";
  } catch {
    record.previewState = "generated";
  }
  if (!state.images.some((item) => item.id === record.id)) return;
  await persistRecord(record);
  render();
}

async function persistRecord(record) {
  record.updatedAt = Date.now();
  await transact("readwrite", (store) => store.put(record));
  scheduleBackup();
}

async function shuffleSelectedCover() {
  const record = state.images.find((item) => item.id === state.selectedId);
  if (record?.kind !== "link") return;
  record.coverIndex = randomIndex(LINK_COVERS.length, record.coverIndex);
  await persistRecord(record);
  render();
  showToast("已换一张封面");
}

async function shuffleSelectedFont() {
  const record = state.images.find((item) => item.id === state.selectedId);
  if (record?.kind !== "link") return;
  record.fontIndex = (record.fontIndex + 1) % LINK_FONTS.length;
  await persistRecord(record);
  render();
  showToast(record.fontIndex === 0 ? "已回到默认字体" : "已切换字体");
}

async function setSelectedLinkMode(mode) {
  const record = state.images.find((item) => item.id === state.selectedId);
  if (record?.kind !== "link" || !["clean", "editorial"].includes(mode)) return;
  record.coverMode = mode;
  render();
  await persistRecord(record);
}

async function setAllLinkModes(mode) {
  if (!["clean", "editorial"].includes(mode)) return;
  const links = state.images.filter((record) => record.kind === "link");
  if (!links.length) return showToast("画布里还没有链接");
  state.globalCoverPreference = mode;
  localStorage.setItem("later-space-global-cover-mode", mode);
  links.forEach((record) => { record.coverMode = mode; });
  render();
  for (const record of links) await persistRecord(record);
  showToast(mode === "clean" ? "全部链接已切换为纯净版" : "全部链接已切换为编辑版");
}

function selectItem(id) {
  state.selectedIds.clear();
  state.selectedIds.add(id);
  state.selectedId = id;
  const top = Math.max(0, ...state.images.map((item) => item.zIndex || 0)) + 1;
  const record = state.images.find((image) => image.id === id);
  if (record) record.zIndex = top;
  render();
  if (record) persistRecord(record);
}

function beginPointer(event) {
  if (event.button !== 0) return;
  if (event.target.closest("button, a, input, textarea, select, label")) return;
  const openButton = event.target.closest("[data-open-link]");
  if (openButton) {
    event.stopPropagation();
    return;
  }
  const item = event.target.closest(".canvas-item");
  const resize = event.target.closest("[data-resize]");
  if (item) {
    event.stopPropagation();
    const id = item.dataset.id;
    if (event.shiftKey && !resize) {
      if (state.selectedIds.has(id)) state.selectedIds.delete(id);
      else state.selectedIds.add(id);
      state.selectedId = state.selectedIds.size === 1 ? [...state.selectedIds][0] : null;
      render();
      return;
    }
    if (state.selectedId !== id) selectItem(id);
    const record = state.images.find((image) => image.id === id);
    state.pointer = {
      mode: resize ? "resize" : "item",
      resizeDirection: resize?.dataset.resizeDirection || "se",
      id, startX: event.clientX, startY: event.clientY,
      originX: record.canvasX, originY: record.canvasY, originWidth: record.canvasWidth,
      originHeight: itemHeight(record),
    };
  } else {
    state.selectedId = null;
    state.selectedIds.clear();
    if (event.shiftKey) {
      state.pointer = { mode: "marquee", startX: event.clientX, startY: event.clientY };
      elements.selectionMarquee.hidden = false;
    } else {
      render();
      state.pointer = { mode: "pan", startX: event.clientX, startY: event.clientY, originX: state.view.x, originY: state.view.y };
      elements.canvas.classList.add("is-panning");
    }
  }
  elements.canvas.setPointerCapture(event.pointerId);
}

function movePointer(event) {
  if (!state.pointer) return;
  const dx = event.clientX - state.pointer.startX;
  const dy = event.clientY - state.pointer.startY;
  if (state.pointer.mode === "marquee") {
    const left = Math.min(state.pointer.startX, event.clientX);
    const top = Math.min(state.pointer.startY, event.clientY);
    const right = Math.max(state.pointer.startX, event.clientX);
    const bottom = Math.max(state.pointer.startY, event.clientY);
    Object.assign(elements.selectionMarquee.style, { left: `${left}px`, top: `${top}px`, width: `${right - left}px`, height: `${bottom - top}px` });
    state.selectedIds = new Set(visibleRecords().filter((record) => {
      const itemLeft = state.view.x + record.canvasX * state.view.zoom;
      const itemTop = state.view.y + record.canvasY * state.view.zoom;
      const itemRight = itemLeft + itemWidth(record) * state.view.zoom;
      const itemBottom = itemTop + itemHeight(record) * state.view.zoom;
      return itemLeft < right && itemRight > left && itemTop < bottom && itemBottom > top;
    }).map((record) => record.id));
    state.selectedId = state.selectedIds.size === 1 ? [...state.selectedIds][0] : null;
    render();
    return;
  }
  if (state.pointer.mode === "pan") {
    state.view.x = state.pointer.originX + dx;
    state.view.y = state.pointer.originY + dy;
    updateView();
    return;
  }
  const record = state.images.find((image) => image.id === state.pointer.id);
  if (!record) return;
  if (state.pointer.mode === "item") {
    record.canvasX = state.pointer.originX + dx / state.view.zoom;
    record.canvasY = state.pointer.originY + dy / state.view.zoom;
  } else if (record.kind === "text") {
    const direction = state.pointer.resizeDirection;
    const worldDx = dx / state.view.zoom;
    const worldDy = dy / state.view.zoom;
    const minimumWidth = 120;
    const minimumHeight = 72;
    if (direction.includes("e")) record.canvasWidth = Math.max(minimumWidth, state.pointer.originWidth + worldDx);
    if (direction.includes("s")) record.textHeight = Math.max(minimumHeight, state.pointer.originHeight + worldDy);
    if (direction.includes("w")) {
      const nextWidth = Math.max(minimumWidth, state.pointer.originWidth - worldDx);
      record.canvasX = state.pointer.originX + state.pointer.originWidth - nextWidth;
      record.canvasWidth = nextWidth;
    }
    if (direction.includes("n")) {
      const nextHeight = Math.max(minimumHeight, state.pointer.originHeight - worldDy);
      record.canvasY = state.pointer.originY + state.pointer.originHeight - nextHeight;
      record.textHeight = nextHeight;
    }
  } else {
    record.canvasWidth = Math.max(72, state.pointer.originWidth + dx / state.view.zoom);
  }
  const node = elements.world.querySelector(`[data-id="${record.id}"]`);
  if (node) {
    node.style.width = `${record.canvasWidth}px`;
    if (record.kind === "text") node.style.height = `${record.textHeight}px`;
    node.style.transform = `translate(${record.canvasX}px,${record.canvasY}px)`;
  }
  renderSelection();
}

function endPointer() {
  if (!state.pointer) return;
  const record = state.images.find((image) => image.id === state.pointer.id);
  if (record) persistRecord(record);
  elements.selectionMarquee.hidden = true;
  state.pointer = null;
  elements.canvas.classList.remove("is-panning");
}

function zoomAt(clientX, clientY, factor) {
  const before = screenToWorld(clientX, clientY);
  state.view.zoom = Math.min(3, Math.max(.15, state.view.zoom * factor));
  state.view.x = clientX - before.x * state.view.zoom;
  state.view.y = clientY - before.y * state.view.zoom;
  updateView();
}

function fitAll() {
  const filteredRecords = visibleRecords();
  if (!filteredRecords.length) return resetView();
  const bounds = filteredRecords.reduce((result, item) => {
    const height = itemHeight(item);
    return {
      minX: Math.min(result.minX, item.canvasX), minY: Math.min(result.minY, item.canvasY),
      maxX: Math.max(result.maxX, item.canvasX + itemWidth(item)), maxY: Math.max(result.maxY, item.canvasY + height),
    };
  }, { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
  const width = Math.max(1, bounds.maxX - bounds.minX);
  const height = Math.max(1, bounds.maxY - bounds.minY);
  state.view.zoom = Math.min(1.25, Math.max(.15, Math.min((innerWidth - 120) / width, (innerHeight - 140) / height)));
  state.view.x = innerWidth / 2 - (bounds.minX + width / 2) * state.view.zoom;
  state.view.y = innerHeight / 2 - (bounds.minY + height / 2) * state.view.zoom;
  updateView();
}

function resetView() {
  const center = worldCenter();
  state.view.zoom = 1;
  state.view.x = innerWidth / 2 - center.x;
  state.view.y = innerHeight / 2 - center.y;
  updateView();
}

async function deleteSelected() {
  const ids = state.selectedIds.size ? [...state.selectedIds] : state.selectedId ? [state.selectedId] : [];
  if (!ids.length) return;
  const records = ids
    .map((id) => state.images.find((record) => record.id === id))
    .filter(Boolean);
  const assets = new Map();
  for (const record of records) {
    if (!record.kind) {
      const blob = await originalBlob(record);
      if (blob) assets.set(record.id, blob);
    }
  }
  state.deletionUndoSnapshot = {
    records: structuredClone(records),
    assets,
    restoring: false,
  };
  for (const id of ids) {
    await transact("readwrite", (store) => store.delete(id));
    await transactAsset("readwrite", (store) => store.delete(id));
    if (state.objectUrls.has(id)) URL.revokeObjectURL(state.objectUrls.get(id));
    state.objectUrls.delete(id);
  }
  const deletedIds = new Set(ids);
  state.images = state.images.filter((image) => !deletedIds.has(image.id));
  state.selectedId = null;
  state.selectedIds.clear();
  render();
  scheduleBackup();
  showToast(ids.length > 1 ? `已移除 ${ids.length} 项内容` : "内容已移除", "撤销", undoDeletion);
}

async function undoDeletion() {
  const snapshot = state.deletionUndoSnapshot;
  if (!snapshot || snapshot.restoring) return;
  snapshot.restoring = true;
  try {
    for (const record of snapshot.records) {
      await transact("readwrite", (store) => store.put(record));
      const blob = snapshot.assets.get(record.id);
      if (blob) await storeImageAsset(record, blob);
    }
    const restoredIds = new Set(snapshot.records.map((record) => record.id));
    state.images = state.images
      .filter((record) => !restoredIds.has(record.id))
      .concat(snapshot.records)
      .sort((left, right) => left.createdAt - right.createdAt);
    state.selectedIds = restoredIds;
    state.selectedId = restoredIds.size === 1 ? [...restoredIds][0] : null;
    state.deletionUndoSnapshot = null;
    render();
    scheduleBackup();
    showToast(snapshot.records.length > 1 ? `已恢复 ${snapshot.records.length} 项内容` : "内容已恢复");
  } catch (error) {
    snapshot.restoring = false;
    console.error(error);
    showToast("恢复失败，请通过备份找回内容");
  }
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function backupPayload() {
  const images = [];
  for (const record of state.images) {
    const blob = await originalBlob(record);
    images.push({ ...record, thumbnail: undefined, blob: undefined, dataUrl: blob ? await blobToDataUrl(blob) : undefined });
  }
  return { app: "Later Space", version: 3, exportedAt: Date.now(), images };
}

async function automaticBackupPayload() {
  if (!state.backedUpAssets) {
    try {
      const response = await fetch("/api/backups/assets");
      const payload = response.ok ? await response.json() : { hashes: [] };
      state.backedUpAssets = new Set(payload.hashes || []);
    } catch {
      state.backedUpAssets = new Set();
    }
  }
  const images = [];
  const assets = {};
  for (const record of state.images) {
    const stored = { ...record, thumbnail: undefined, blob: undefined };
    const blob = await originalBlob(record);
    if (blob) {
      stored.assetHash = record.fingerprint || await blobFingerprint(blob);
      if (!state.backedUpAssets.has(stored.assetHash)) assets[stored.assetHash] = await blobToDataUrl(blob);
    }
    images.push(stored);
  }
  return { app: "Later Space", version: 4, exportedAt: Date.now(), images, assets };
}

function dataUrlToBlob(dataUrl) {
  const [metadata, encoded] = dataUrl.split(",", 2);
  const mimeType = metadata.match(/^data:([^;]+)/)?.[1] || "application/octet-stream";
  const bytes = atob(encoded);
  const buffer = new Uint8Array(bytes.length);
  for (let index = 0; index < bytes.length; index += 1) buffer[index] = bytes.charCodeAt(index);
  return new Blob([buffer], { type: mimeType });
}

async function saveAutomaticBackup() {
  if (!state.db) return;
  if (state.backupInFlight) {
    state.backupQueued = true;
    return;
  }
  state.backupInFlight = true;
  state.backupQueued = false;
  try {
    const payload = await automaticBackupPayload();
    const response = await fetch("/api/backups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error("backup failed");
    Object.keys(payload.assets).forEach((hash) => state.backedUpAssets.add(hash));
    localStorage.setItem("later-space-last-backup", String(Date.now()));
  } catch (error) {
    console.warn("Automatic backup unavailable", error);
  } finally {
    state.backupInFlight = false;
    if (state.backupQueued) scheduleBackup();
  }
}

function scheduleBackup() {
  if (STATIC_DEPLOYMENT) return;
  clearTimeout(state.backupTimer);
  state.backupTimer = setTimeout(saveAutomaticBackup, 900);
}

async function restorePayload(payload) {
  if (!payload || payload.app !== "Later Space" || !Array.isArray(payload.images)) throw new Error("invalid backup");
  await transact("readwrite", (store) => store.clear());
  await transactAsset("readwrite", (store) => store.clear());
  const records = [];
  for (const record of payload.images) {
    const restored = { ...record };
    if (restored.dataUrl) {
      const blob = dataUrlToBlob(restored.dataUrl);
      await storeImageAsset(restored, blob);
      restored.thumbnail = blob;
      restored.thumbnailVersion = THUMBNAIL_VERSION;
    }
    delete restored.dataUrl;
    delete restored.blob;
    if (!WORKFLOW_STATUSES.has(restored.status)) restored.status = "unread";
    records.push(restored);
  }
  for (const record of records) await transact("readwrite", (store) => store.put(record));
  state.objectUrls.forEach((url) => URL.revokeObjectURL(url));
  state.objectUrls.clear();
  state.images = records.sort((left, right) => left.createdAt - right.createdAt);
  state.selectedId = null;
  state.selectedIds.clear();
  render();
  fitAll();
  return records.length;
}

async function restoreLatestBackup() {
  if (!confirm("恢复上一个自动备份版本会替换当前画布，确定继续吗？")) return;
  try {
    showToast("正在恢复上一个版本…");
    await saveAutomaticBackup();
    const response = await fetch("/api/backups/previous");
    if (!response.ok) throw new Error("no backup");
    const payload = await response.json();
    const count = await restorePayload(payload);
    showToast(`已恢复 ${count} 条内容`);
  } catch {
    showToast("还没有更早的自动备份版本");
  }
}

async function importBackupFile(file) {
  if (!file) return;
  try {
    const payload = JSON.parse(await file.text());
    if (!confirm(`导入备份会替换当前画布，确定继续吗？`)) return;
    const count = await restorePayload(payload);
    showToast(`已导入 ${count} 条内容`);
  } catch (error) {
    console.error(error);
    showToast("备份文件无法读取");
  }
}

async function changeSelectedStatus(status) {
  if (!WORKFLOW_STATUSES.has(status)) return;
  const ids = state.selectedIds.size ? [...state.selectedIds] : state.selectedId ? [state.selectedId] : [];
  if (!ids.length) return;
  const records = state.images.filter((record) => ids.includes(record.id));
  records.forEach((record) => { record.status = status; record.statusChangedAt = Date.now(); });
  for (const record of records) await persistRecord(record);
  render();
  showToast(`已更新 ${records.length} 项状态`);
}

async function openSyncPanel() {
  elements.syncPanel.hidden = false;
  elements.storagePanel.hidden = true;
  elements.syncStatus.className = "sync-status";
  elements.syncStatusTitle.textContent = "检查中…";
  elements.syncStatusDetail.textContent = "正在检查云端配置";
  try {
    const response = await fetch("/api/sync/status");
    const payload = await response.json();
    elements.syncStatus.classList.toggle("is-ready", Boolean(payload.configured));
    elements.syncStatusTitle.textContent = payload.configured ? "云端同步已就绪" : "当前为本地模式";
    elements.syncStatusDetail.textContent = payload.configured
      ? `Supabase · ${payload.latestAt ? `最近同步 ${new Date(payload.latestAt * 1000).toLocaleString("zh-CN")}` : "尚未同步"}`
      : "本地自动备份正常；配置 Supabase 环境变量后可跨设备同步";
    elements.pushCloudButton.disabled = !payload.configured;
    elements.pullCloudButton.disabled = !payload.configured || !payload.latestAt;
  } catch {
    elements.syncStatus.classList.add("is-error");
    elements.syncStatusTitle.textContent = "同步服务不可用";
    elements.syncStatusDetail.textContent = "请确认 Later Space 本地服务正在运行";
  }
}

async function pushCloudBackup() {
  try {
    showToast("正在同步到云端…");
    const response = await fetch("/api/sync/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(await backupPayload()) });
    if (!response.ok) throw new Error("sync failed");
    showToast("云端同步完成");
    openSyncPanel();
  } catch { showToast("云端同步失败，请检查配置"); }
}

async function pullCloudBackup() {
  if (!confirm("从云端恢复会替换当前画布，确定继续吗？")) return;
  try {
    await saveAutomaticBackup();
    const response = await fetch("/api/sync/latest");
    if (!response.ok) throw new Error("sync unavailable");
    const count = await restorePayload(await response.json());
    showToast(`已从云端恢复 ${count} 条内容`);
  } catch { showToast("云端暂时没有可恢复的数据"); }
}

async function importExternalInbox() {
  if (state.externalInboxImporting || document.hidden) return;
  state.externalInboxImporting = true;
  try {
    const response = await fetch("/api/inbox?consume=1");
    if (!response.ok) return;
    const payload = await response.json();
    let imported = 0;
    for (const entry of payload.items || []) {
      if (entry.kind === "image" && entry.imageData) {
        const blob = dataUrlToBlob(entry.imageData);
        const file = new File([blob], entry.name || `分享图片 ${new Date(entry.createdAt || Date.now()).toLocaleTimeString("zh-CN")}`, { type: entry.mimeType || blob.type || "image/jpeg" });
        await saveFiles([file], entry.source || "external", screenCenter(), entry.purpose || "");
      } else if (entry.url) await saveLinks([entry.url], entry.text || entry.title || entry.url, entry.purpose || "", entry.title || "", screenCenter());
      else if (entry.text) await saveText(entry.text, screenCenter());
      imported += 1;
    }
    if (imported) showToast(`${imported} 条新收藏已进入收件箱`);
  } catch {
  } finally {
    state.externalInboxImporting = false;
  }
}

function imageElementFromBlob(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("图片解码失败")); };
    image.src = url;
  });
}

function drawCropPreview() {
  if (!state.crop) return;
  const { image, box } = state.crop;
  const stageWidth = elements.cropStage.clientWidth;
  const stageHeight = elements.cropStage.clientHeight;
  const scale = Math.min(stageWidth / image.naturalWidth, stageHeight / image.naturalHeight);
  const imageWidth = image.naturalWidth * scale;
  const imageHeight = image.naturalHeight * scale;
  const imageLeft = (stageWidth - imageWidth) / 2;
  const imageTop = (stageHeight - imageHeight) / 2;
  state.crop.imageRect = { left: imageLeft, top: imageTop, width: imageWidth, height: imageHeight };
  Object.assign(elements.cropPreview.style, {
    left: `${imageLeft}px`, top: `${imageTop}px`, width: `${imageWidth}px`, height: `${imageHeight}px`,
  });
  Object.assign(elements.cropFrame.style, {
    left: `${imageLeft + box.x * imageWidth}px`,
    top: `${imageTop + box.y * imageHeight}px`,
    width: `${box.width * imageWidth}px`,
    height: `${box.height * imageHeight}px`,
  });
  state.crop.sourceRect = {
    x: box.x * image.naturalWidth,
    y: box.y * image.naturalHeight,
    width: box.width * image.naturalWidth,
    height: box.height * image.naturalHeight,
  };
}

function initialCropBox(ratio, image) {
  const padding = .08;
  if (ratio === "free") return { x: padding, y: padding, width: 1 - padding * 2, height: 1 - padding * 2 };
  const targetRatio = Number(ratio);
  const sourceRatio = image.naturalWidth / image.naturalHeight;
  let width = 1 - padding * 2;
  let height = width * sourceRatio / targetRatio;
  if (height > 1 - padding * 2) {
    height = 1 - padding * 2;
    width = height * targetRatio / sourceRatio;
  }
  return { x: (1 - width) / 2, y: (1 - height) / 2, width, height };
}

async function openCropEditor() {
  const record = state.images.find((item) => item.id === state.selectedId);
  if (record?.kind) return;
  try {
    const blob = await originalBlob(record);
    if (!blob) throw new Error("missing image");
    const image = await imageElementFromBlob(blob);
    const previewUrl = URL.createObjectURL(blob);
    state.crop = { record, image, previewUrl, ratio: "free", box: initialCropBox("free", image), sourceRect: null, imageRect: null, pointer: null };
    elements.cropPreview.src = previewUrl;
    await elements.cropPreview.decode();
    elements.cropRatioButtons.forEach((button) => button.classList.toggle("is-active", button.dataset.cropRatio === "free"));
    elements.cropBackdrop.hidden = false;
    elements.cropDialog.hidden = false;
    requestAnimationFrame(drawCropPreview);
  } catch {
    showToast("这张图片暂时无法裁剪");
  }
}

function closeCropEditor() {
  elements.cropBackdrop.hidden = true;
  elements.cropDialog.hidden = true;
  if (state.crop?.previewUrl) URL.revokeObjectURL(state.crop.previewUrl);
  elements.cropPreview.removeAttribute("src");
  state.crop = null;
}

function resetCropEditor() {
  if (!state.crop) return;
  state.crop.ratio = "free";
  state.crop.box = initialCropBox("free", state.crop.image);
  elements.cropRatioButtons.forEach((button) => button.classList.toggle("is-active", button.dataset.cropRatio === "free"));
  drawCropPreview();
}

function beginCropPointer(event) {
  if (!state.crop || event.button !== 0) return;
  event.preventDefault();
  const handle = event.target.closest("[data-crop-handle]");
  const box = state.crop.box;
  state.crop.pointer = {
    id: event.pointerId,
    mode: handle ? "resize" : "move",
    handle: handle?.dataset.cropHandle || "",
    startX: event.clientX,
    startY: event.clientY,
    box: { ...box },
  };
  elements.cropFrame.setPointerCapture(event.pointerId);
}

function moveCropPointer(event) {
  const pointer = state.crop?.pointer;
  const imageRect = state.crop?.imageRect;
  if (!pointer || !imageRect || event.pointerId !== pointer.id) return;
  const deltaX = (event.clientX - pointer.startX) / imageRect.width;
  const deltaY = (event.clientY - pointer.startY) / imageRect.height;
  const minimumWidth = Math.min(.16, 72 / imageRect.width);
  const minimumHeight = Math.min(.16, 72 / imageRect.height);
  if (pointer.mode === "move") {
    state.crop.box.x = Math.max(0, Math.min(1 - pointer.box.width, pointer.box.x + deltaX));
    state.crop.box.y = Math.max(0, Math.min(1 - pointer.box.height, pointer.box.y + deltaY));
    drawCropPreview();
    return;
  }
  const fromLeft = pointer.handle.includes("w");
  const fromTop = pointer.handle.includes("n");
  const anchorX = fromLeft ? pointer.box.x + pointer.box.width : pointer.box.x;
  const horizontalEdge = pointer.handle === "w" || pointer.handle === "e";
  if (horizontalEdge) {
    let edgeX = (fromLeft ? pointer.box.x : pointer.box.x + pointer.box.width) + deltaX;
    edgeX = Math.max(0, Math.min(1, edgeX));
    let width = Math.max(minimumWidth, Math.abs(edgeX - anchorX));
    width = Math.min(width, fromLeft ? anchorX : 1 - anchorX);
    let height = pointer.box.height;
    let y = pointer.box.y;
    if (state.crop.ratio !== "free") {
      const normalizedRatio = Number(state.crop.ratio) / (state.crop.image.naturalWidth / state.crop.image.naturalHeight);
      const centerY = pointer.box.y + pointer.box.height / 2;
      height = width / normalizedRatio;
      const maximumHeight = 2 * Math.min(centerY, 1 - centerY);
      if (height > maximumHeight) {
        height = maximumHeight;
        width = height * normalizedRatio;
      }
      y = centerY - height / 2;
    }
    state.crop.box = { x: fromLeft ? anchorX - width : anchorX, y, width, height };
    drawCropPreview();
    return;
  }
  const anchorY = fromTop ? pointer.box.y + pointer.box.height : pointer.box.y;
  const verticalEdge = pointer.handle === "n" || pointer.handle === "s";
  if (verticalEdge) {
    let edgeY = (fromTop ? pointer.box.y : pointer.box.y + pointer.box.height) + deltaY;
    edgeY = Math.max(0, Math.min(1, edgeY));
    let height = Math.max(minimumHeight, Math.abs(edgeY - anchorY));
    height = Math.min(height, fromTop ? anchorY : 1 - anchorY);
    let width = pointer.box.width;
    let x = pointer.box.x;
    if (state.crop.ratio !== "free") {
      const normalizedRatio = Number(state.crop.ratio) / (state.crop.image.naturalWidth / state.crop.image.naturalHeight);
      const centerX = pointer.box.x + pointer.box.width / 2;
      width = height * normalizedRatio;
      const maximumWidth = 2 * Math.min(centerX, 1 - centerX);
      if (width > maximumWidth) {
        width = maximumWidth;
        height = width / normalizedRatio;
      }
      x = centerX - width / 2;
    }
    state.crop.box = { x, y: fromTop ? anchorY - height : anchorY, width, height };
    drawCropPreview();
    return;
  }
  let edgeX = (fromLeft ? pointer.box.x : pointer.box.x + pointer.box.width) + deltaX;
  let edgeY = (fromTop ? pointer.box.y : pointer.box.y + pointer.box.height) + deltaY;
  edgeX = Math.max(0, Math.min(1, edgeX));
  edgeY = Math.max(0, Math.min(1, edgeY));
  let width = Math.max(minimumWidth, Math.abs(edgeX - anchorX));
  let height = Math.max(minimumHeight, Math.abs(edgeY - anchorY));
  if (state.crop.ratio !== "free") {
    const normalizedRatio = Number(state.crop.ratio) / (state.crop.image.naturalWidth / state.crop.image.naturalHeight);
    if (width / height > normalizedRatio) height = width / normalizedRatio;
    else width = height * normalizedRatio;
    width = Math.min(width, fromLeft ? anchorX : 1 - anchorX);
    height = width / normalizedRatio;
    if (height > (fromTop ? anchorY : 1 - anchorY)) {
      height = fromTop ? anchorY : 1 - anchorY;
      width = height * normalizedRatio;
    }
  }
  state.crop.box = {
    x: fromLeft ? anchorX - width : anchorX,
    y: fromTop ? anchorY - height : anchorY,
    width,
    height,
  };
  drawCropPreview();
}

function endCropPointer(event) {
  if (!state.crop?.pointer || event.pointerId !== state.crop.pointer.id) return;
  state.crop.pointer = null;
}

async function applyCrop() {
  if (!state.crop?.sourceRect) return;
  const { record, image, sourceRect, ratio } = state.crop;
  const output = document.createElement("canvas");
  output.width = Math.max(1, Math.round(sourceRect.width));
  output.height = Math.max(1, Math.round(ratio === "free" ? sourceRect.height : output.width / Number(ratio)));
  output.getContext("2d").drawImage(
    image,
    sourceRect.x, sourceRect.y, sourceRect.width, sourceRect.height,
    0, 0, output.width, output.height,
  );
  const blob = await new Promise((resolve, reject) => output.toBlob(
    (result) => result ? resolve(result) : reject(new Error("裁剪失败")),
    record.type === "image/jpeg" ? "image/jpeg" : "image/png",
    .94,
  ));
  if (state.objectUrls.has(record.id)) URL.revokeObjectURL(state.objectUrls.get(record.id));
  state.objectUrls.delete(record.id);
  record.fingerprint = await blobFingerprint(blob);
  record.thumbnail = await createThumbnail(blob);
  record.thumbnailVersion = THUMBNAIL_VERSION;
  await storeImageAsset(record, blob);
  delete record.assetHash;
  record.type = blob.type;
  record.size = blob.size;
  record.width = output.width;
  record.height = output.height;
  await persistRecord(record);
  closeCropEditor();
  render();
  showToast("图片已裁剪");
}

async function imageBlobAsPng(blob) {
  if (blob.type === "image/png") return blob;
  const source = "createImageBitmap" in window ? await createImageBitmap(blob) : await imageElementFromBlob(blob);
  const width = source.width || source.naturalWidth;
  const height = source.height || source.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").drawImage(source, 0, 0);
  if (source.close) source.close();
  return new Promise((resolve, reject) => canvas.toBlob(
    (png) => png ? resolve(png) : reject(new Error("图片转换失败")),
    "image/png",
  ));
}

async function copySelectedImage() {
  const record = state.images.find((image) => image.id === state.selectedId);
  if (!record || record.kind) return;
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    showToast("当前浏览器不支持复制图片");
    return;
  }
  try {
    const blob = await originalBlob(record);
    if (!blob) throw new Error("missing image");
    const png = await imageBlobAsPng(blob);
    await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
    showToast("图片已复制，可以粘贴到其他地方");
  } catch (error) {
    console.error(error);
    showToast("复制失败，请允许浏览器访问剪贴板");
  }
}

async function exportBackup() {
  if (!state.images.length) return showToast("画布还是空的");
  showToast("正在生成备份…");
  const url = URL.createObjectURL(new Blob([JSON.stringify(await backupPayload())], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `later-space-canvas-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast("备份已导出");
}

let toastTimer;
function showToast(message, actionLabel = "", action = null) {
  clearTimeout(toastTimer);
  elements.toastMessage.textContent = message;
  elements.toastAction.textContent = actionLabel;
  elements.toastAction.hidden = !actionLabel;
  elements.toastAction.onclick = action ? () => {
    elements.toastAction.hidden = true;
    action();
  } : null;
  elements.toast.classList.add("is-visible");
  toastTimer = setTimeout(() => {
    elements.toast.classList.remove("is-visible");
    elements.toastAction.hidden = true;
  }, actionLabel ? 5000 : 2200);
}

function bindEvents() {
  elements.onboardingStartButton.addEventListener("click", () => {
    localStorage.setItem(ONBOARDING_DISMISSED_KEY, "true");
    elements.onboardingCards.hidden = true;
    openCapture();
  });
  elements.onboardingDismissButton.addEventListener("click", () => {
    localStorage.setItem(ONBOARDING_DISMISSED_KEY, "true");
    elements.onboardingCards.hidden = true;
  });
  elements.searchInput.addEventListener("input", () => {
    state.filters.query = elements.searchInput.value;
    clearTimeout(state.searchTimer);
    state.searchTimer = setTimeout(() => {
      render();
      fitAll();
    }, 120);
  });
  elements.clearSearchButton.addEventListener("click", () => {
    state.filters.query = "";
    render();
    fitAll();
    elements.searchInput.focus();
  });
  elements.filterToggleButton.addEventListener("click", () => {
    elements.filterPanel.hidden = !elements.filterPanel.hidden;
    elements.filterToggleButton.setAttribute("aria-expanded", String(!elements.filterPanel.hidden));
    renderFilterControls();
  });
  [elements.sourceFilter, elements.purposeFilter, elements.timeFilter].forEach((select) => select.addEventListener("change", updateFilters));
  elements.resetFiltersButton.addEventListener("click", resetFilters);
  elements.addButton.addEventListener("click", openCapture);
  elements.captureModeButtons.forEach((button) => button.addEventListener("click", () => setCaptureMode(button.dataset.captureMode)));
  elements.closeCaptureButton.addEventListener("click", closeCapture);
  elements.captureBackdrop.addEventListener("click", closeCapture);
  elements.chooseImagesButton.addEventListener("click", () => elements.fileInput.click());
  elements.addContentButton.addEventListener("click", submitCapture);
  elements.batchTagsInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") { event.preventDefault(); addCaptureTag(); }
  });
  elements.batchTagSuggestions.addEventListener("click", (event) => {
    const button = event.target.closest("[data-capture-tag]");
    if (!button) return;
    const tag = button.dataset.captureTag;
    if (state.captureTags.has(tag)) state.captureTags.delete(tag);
    else state.captureTags.add(tag);
    renderCaptureTags();
  });
  elements.findDuplicateButton.addEventListener("click", () => closeDuplicatePrompt(false));
  elements.keepDuplicateButton.addEventListener("click", () => closeDuplicatePrompt(true));
  elements.duplicateBackdrop.addEventListener("click", () => closeDuplicatePrompt(false));
  elements.captureInput.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") submitCapture();
  });
  elements.globalCoverButtons.forEach((button) => button.addEventListener("click", () => {
    setAllLinkModes(button.dataset.globalCoverMode);
  }));
  elements.fileInput.addEventListener("change", () => {
    if (elements.fileInput.files.length) {
      saveFiles(elements.fileInput.files, "upload", buttonCenter(elements.addButton));
      closeCapture();
    }
    elements.fileInput.value = "";
  });
  elements.fitButton.addEventListener("click", fitAll);
  elements.organizeButton.addEventListener("click", organizeCanvas);
  elements.resetZoomButton.addEventListener("click", resetView);
  elements.exportButton.addEventListener("click", exportBackup);
  elements.importButton.addEventListener("click", () => elements.backupInput.click());
  elements.backupInput.addEventListener("change", () => {
    importBackupFile(elements.backupInput.files[0]);
    elements.backupInput.value = "";
  });
  elements.restoreBackupButton.addEventListener("click", restoreLatestBackup);
  elements.storageButton.addEventListener("click", openStoragePanel);
  elements.closeStorageButton.addEventListener("click", () => { elements.storagePanel.hidden = true; });
  elements.syncButton.addEventListener("click", openSyncPanel);
  elements.closeSyncButton.addEventListener("click", () => { elements.syncPanel.hidden = true; });
  elements.pushCloudButton.addEventListener("click", pushCloudBackup);
  elements.pullCloudButton.addEventListener("click", pullCloudBackup);
  elements.copyImageButton.addEventListener("click", copySelectedImage);
  elements.cropImageButton.addEventListener("click", openCropEditor);
  elements.batchEditButton.addEventListener("click", openBatchEditor);
  elements.closeBatchButton.addEventListener("click", closeBatchEditor);
  elements.cancelBatchButton.addEventListener("click", closeBatchEditor);
  elements.batchBackdrop.addEventListener("click", closeBatchEditor);
  elements.applyBatchButton.addEventListener("click", applyBatchEdit);
  elements.editTextButton.addEventListener("click", () => openTextEditor(state.images.find((record) => record.id === state.selectedId)));
  elements.editLinkButton.addEventListener("click", () => openLinkEditor(state.images.find((record) => record.id === state.selectedId)));
  elements.shuffleCoverButton.addEventListener("click", shuffleSelectedCover);
  elements.shuffleFontButton.addEventListener("click", shuffleSelectedFont);
  elements.linkModeButtons.forEach((button) => button.addEventListener("click", () => setSelectedLinkMode(button.dataset.linkMode)));
  elements.closeCropButton.addEventListener("click", closeCropEditor);
  elements.cropBackdrop.addEventListener("click", closeCropEditor);
  elements.resetCropButton.addEventListener("click", resetCropEditor);
  elements.applyCropButton.addEventListener("click", applyCrop);
  elements.cropFrame.addEventListener("pointerdown", beginCropPointer);
  elements.cropFrame.addEventListener("pointermove", moveCropPointer);
  elements.cropFrame.addEventListener("pointerup", endCropPointer);
  elements.cropFrame.addEventListener("pointercancel", endCropPointer);
  elements.cropRatioButtons.forEach((button) => button.addEventListener("click", () => {
    if (!state.crop) return;
    state.crop.ratio = button.dataset.cropRatio;
    state.crop.box = initialCropBox(state.crop.ratio, state.crop.image);
    elements.cropRatioButtons.forEach((candidate) => candidate.classList.toggle("is-active", candidate === button));
    drawCropPreview();
  }));
  elements.deleteButton.addEventListener("click", deleteSelected);
  elements.viewButtons.forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
  elements.workflowSwitcher.addEventListener("click", (event) => {
    if (event.target.closest("[data-manage-tags]")) return openTagManager();
    const button = event.target.closest("[data-workflow]");
    if (!button) return;
    state.workflow = button.dataset.workflow;
    render();
    fitAll();
  });
  elements.closeTagManageButton.addEventListener("click", closeTagManager);
  elements.tagManageBackdrop.addEventListener("click", closeTagManager);
  elements.tagManageList.addEventListener("click", (event) => {
    const row = event.target.closest("[data-managed-tag]");
    if (!row) return;
    if (event.target.closest("[data-tag-edit-save]")) return applyTagManagerEdit(row);
    if (event.target.closest("[data-tag-edit-cancel]")) {
      state.tagManageEdit = null;
      return renderTagManager();
    }
    const action = event.target.closest("[data-tag-action]")?.dataset.tagAction;
    if (action) beginTagAction(row.dataset.managedTag, action);
  });
  elements.tagManageList.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.target.matches("[data-tag-edit-input]")) {
      event.preventDefault();
      applyTagManagerEdit(event.target.closest("[data-managed-tag]"));
    }
  });
  elements.canvas.addEventListener("pointerdown", beginPointer);
  elements.canvas.addEventListener("pointermove", movePointer);
  elements.canvas.addEventListener("pointerup", endPointer);
  elements.canvas.addEventListener("pointercancel", endPointer);
  elements.canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    if (event.ctrlKey || event.metaKey) zoomAt(event.clientX, event.clientY, Math.exp(-event.deltaY * .008));
    else {
      state.view.x -= event.deltaX;
      state.view.y -= event.deltaY;
      updateView();
    }
  }, { passive: false });
  window.addEventListener("paste", (event) => {
    if (event.target.matches?.("input, textarea, [contenteditable='true']")) return;
    const files = Array.from(event.clipboardData?.items || []).filter((item) => item.kind === "file" && item.type.startsWith("image/")).map((item) => item.getAsFile()).filter(Boolean);
    const text = event.clipboardData?.getData("text/plain") || "";
    const urls = extractUrls(text);
    if (files.length) { event.preventDefault(); saveFiles(files, "paste", screenCenter()); }
    else if (urls.length) { event.preventDefault(); saveLinks(urls, text, "", "", screenCenter()); }
    else if (text.trim()) { event.preventDefault(); saveText(text.trim(), screenCenter()); }
  });

  elements.world.addEventListener("dblclick", (event) => {
    const item = event.target.closest(".canvas-item");
    const record = item && state.images.find((entry) => entry.id === item.dataset.id);
    if (record?.kind === "link") openLink(record);
    else if (record?.kind === "text") openTextEditor(record);
    else if (record) openBatchEditor();
  });
  window.addEventListener("keydown", (event) => {
    const isEditing = event.target.matches?.("input, textarea, [contenteditable='true']");
    const selectedRecord = state.images.find((record) => record.id === state.selectedId);
    if (!isEditing && !event.shiftKey && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z" && state.deletionUndoSnapshot) {
      event.preventDefault();
      undoDeletion();
      return;
    }
    if (!isEditing && event.key.toLowerCase() === "c" && (event.metaKey || event.ctrlKey) && selectedRecord && !selectedRecord.kind) {
      event.preventDefault();
      copySelectedImage();
    }
    if (!isEditing && (event.key === "Delete" || event.key === "Backspace") && (state.selectedId || state.selectedIds.size)) { event.preventDefault(); deleteSelected(); }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
      event.preventDefault();
      elements.searchInput.focus();
      elements.searchInput.select();
    }
    if (event.key === "Escape" && !elements.tagManageDialog.hidden) closeTagManager();
    else if (event.key === "Escape" && !elements.batchDialog.hidden) closeBatchEditor();
    else if (event.key === "Escape" && !elements.duplicateDialog.hidden) closeDuplicatePrompt(false);
    else if (event.key === "Escape" && !elements.cropDialog.hidden) closeCropEditor();
    else if (event.key === "Escape" && !elements.captureDialog.hidden) closeCapture();
    else if (event.key === "Escape" && !elements.filterPanel.hidden) {
      elements.filterPanel.hidden = true;
      elements.filterToggleButton.setAttribute("aria-expanded", "false");
      renderFilterControls();
    }
    else if (event.key === "Escape") { state.selectedId = null; state.selectedIds.clear(); render(); }
    if (event.key === "0" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); resetView(); }
    if ((event.key === "+" || event.key === "=") && (event.metaKey || event.ctrlKey)) { event.preventDefault(); zoomAt(innerWidth / 2, innerHeight / 2, 1.15); }
    if (event.key === "-" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); zoomAt(innerWidth / 2, innerHeight / 2, 1 / 1.15); }
  });
  window.addEventListener("dragenter", (event) => {
    if (!Array.from(event.dataTransfer?.types || []).includes("Files")) return;
    event.preventDefault(); state.dragDepth += 1; elements.dropState.classList.add("is-visible");
  });
  window.addEventListener("dragover", (event) => event.preventDefault());
  window.addEventListener("dragleave", () => { state.dragDepth -= 1; if (state.dragDepth <= 0) { state.dragDepth = 0; elements.dropState.classList.remove("is-visible"); } });
  window.addEventListener("drop", (event) => {
    event.preventDefault(); state.dragDepth = 0; elements.dropState.classList.remove("is-visible");
    saveFiles(event.dataTransfer.files, "drop", { x: event.clientX, y: event.clientY });
  });
  window.addEventListener("resize", () => {
    updateView();
    if (state.crop) drawCropPreview();
  });
}

async function init() {
  try {
    state.db = await openDatabase();
    if (STATIC_DEPLOYMENT) {
      elements.restoreBackupButton.hidden = true;
      elements.syncButton.hidden = true;
    }
    bindEvents();
    updateView();
    await loadImages();
    if (!STATIC_DEPLOYMENT) {
      await importExternalInbox();
      state.externalInboxTimer = window.setInterval(importExternalInbox, 20000);
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) importExternalInbox();
      });
    }
    if (state.images.length) scheduleBackup();
    const incompleteLinks = state.images.filter((record) => record.kind === "link" && isGenericTitle(record.title, record));
    incompleteLinks.forEach((record) => enrichLink(record));
  } catch (error) {
    console.error(error);
    showToast("画布打开失败，请刷新重试");
  }
}

init();
