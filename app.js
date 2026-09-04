const DB_NAME = "later-space-image-inbox";
const DB_VERSION = 3;
const STORE_NAME = "images";
const ASSET_STORE_NAME = "image-assets";
const GUEST_WORKSPACE_KEY = "later-space-guest-workspace-v1";
const CLOUD_MIGRATION_KEY = "later-space-cloud-migration-v1";
const WELCOME_COMPLETED_KEY = "later-space-welcome-completed-v1";
const CANVAS_GUIDE_DISMISSED_KEY = "later-space-canvas-guide-dismissed-v2";
const AUTH_RETURN_STATE_KEY = "later-space-auth-return-v1";
const LAST_LOGIN_EMAIL_KEY = "later-space-last-login-email-v1";
const THUMBNAIL_VERSION = 5;
const TEXT_CARD_WIDTH = 300;
const TEXT_CARD_HEIGHT = 375;
const EXPANDED_TEXT_WIDTH = 420;
const EXPANDED_TEXT_HEIGHT = 520;
const STATIC_DEPLOYMENT = location.protocol !== "file:" && !["localhost", "127.0.0.1", "::1"].includes(location.hostname);
document.documentElement.dataset.appVersion = "80";
document.documentElement.dataset.deployment = STATIC_DEPLOYMENT ? "static" : "local";

const state = {
  db: null,
  images: [],
  selectedId: null,
  selectedIds: new Set(),
  objectUrls: new Map(),
  assetUrls: new Map(),
  view: { x: innerWidth / 2, y: innerHeight / 2, zoom: 1 },
  pointer: null,
  dragDepth: 0,
  pasteOffset: 0,
  activeView: "reading",
  workflow: "all",
  filters: { query: "", type: "all", source: "all", purpose: "all", time: "all" },
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
  expandedTextIds: new Set(),
  backupTimer: null,
  backupInFlight: false,
  backupQueued: false,
  backedUpAssets: null,
  renderFrame: null,
  searchTimer: null,
  externalInboxImporting: false,
  externalInboxTimer: null,
  cloudSession: null,
  cloudSyncTimer: null,
  cloudPollTimer: null,
  cloudSyncing: false,
  cloudLastSyncAt: 0,
  cloudRealtime: null,
  cloudAuthClient: null,
  cloudUsage: null,
  captureToken: null,
  migrationCancelled: false,
  workspaceId: null,
  onboardingForced: new URLSearchParams(location.search).get("onboarding") === "1",
  authReturnActive: false,
  globalCoverPreference: localStorage.getItem("later-space-global-cover-mode") || "editorial",
  globalTextPreference: localStorage.getItem("later-space-global-text-theme") || "paper",
};

const elements = {
  canvas: document.querySelector("#canvas"),
  world: document.querySelector("#world"),
  emptyCue: document.querySelector("#emptyCue"),
  imageCount: document.querySelector("#imageCount"),
  emptyTitle: document.querySelector("#emptyTitle"),
  emptyHint: document.querySelector("#emptyHint"),
  canvasGuide: document.querySelector("#canvasGuide"),
  closeCanvasGuideButton: document.querySelector("#closeCanvasGuideButton"),
  welcomeScreen: document.querySelector("#welcomeScreen"),
  welcomeLoginForm: document.querySelector("#welcomeLoginForm"),
  welcomeEmailInput: document.querySelector("#welcomeEmailInput"),
  welcomeEmailSuggestion: document.querySelector("#welcomeEmailSuggestion"),
  welcomeEmailSuggestionValue: document.querySelector("#welcomeEmailSuggestionValue"),
  welcomeGoogleButton: document.querySelector("#welcomeGoogleButton"),
  welcomeGuestButton: document.querySelector("#welcomeGuestButton"),
  closeWelcomeButton: document.querySelector("#closeWelcomeButton"),
  authReturnScreen: document.querySelector("#authReturnScreen"),
  authReturnMark: document.querySelector("#authReturnMark"),
  authReturnTitle: document.querySelector("#authReturnTitle"),
  authReturnDetail: document.querySelector("#authReturnDetail"),
  authReturnRetryButton: document.querySelector("#authReturnRetryButton"),
  accountButton: document.querySelector("#accountButton"),
  accountAvatar: document.querySelector("#accountAvatar"),
  accountName: document.querySelector("#accountName"),
  accountStatus: document.querySelector("#accountStatus"),
  searchInput: document.querySelector("#searchInput"),
  filterToggleButton: document.querySelector("#filterToggleButton"),
  filterCount: document.querySelector("#filterCount"),
  clearSearchButton: document.querySelector("#clearSearchButton"),
  filterPanel: document.querySelector("#filterPanel"),
  typeFilter: document.querySelector("#typeFilter"),
  sourceFilterGroup: document.querySelector("#sourceFilterGroup"),
  sourceFilter: document.querySelector("#sourceFilter"),
  purposeFilterGroup: document.querySelector("#purposeFilterGroup"),
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
  appearanceSwitcher: document.querySelector("#appearanceSwitcher"),
  globalCoverSwitcher: document.querySelector("#globalCoverSwitcher"),
  globalCoverButtons: document.querySelectorAll("[data-global-cover-mode]"),
  globalTextSwitcher: document.querySelector("#globalTextSwitcher"),
  globalTextButtons: document.querySelectorAll("[data-global-text-theme]"),
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
  accountProfile: document.querySelector("#accountProfile"),
  accountPanelAvatar: document.querySelector("#accountPanelAvatar"),
  accountNameInput: document.querySelector("#accountNameInput"),
  syncStatus: document.querySelector(".sync-status"),
  syncStatusTitle: document.querySelector("#syncStatusTitle"),
  syncStatusDetail: document.querySelector("#syncStatusDetail"),
  syncLoginForm: document.querySelector("#syncLoginForm"),
  syncAuthDivider: document.querySelector("#syncAuthDivider"),
  syncGoogleButton: document.querySelector("#syncGoogleButton"),
  syncEmailInput: document.querySelector("#syncEmailInput"),
  syncMailLink: document.querySelector("#syncMailLink"),
  syncActions: document.querySelector("#syncActions"),
  signOutButton: document.querySelector("#signOutButton"),
  syncNowButton: document.querySelector("#syncNowButton"),
  undoMigrationButton: document.querySelector("#undoMigrationButton"),
  accountMigration: document.querySelector("#accountMigration"),
  accountMigrationTitle: document.querySelector("#accountMigrationTitle"),
  accountMigrationDetail: document.querySelector("#accountMigrationDetail"),
  accountMigrationButton: document.querySelector("#accountMigrationButton"),
  migrationBackdrop: document.querySelector("#migrationBackdrop"),
  migrationDialog: document.querySelector("#migrationDialog"),
  closeMigrationButton: document.querySelector("#closeMigrationButton"),
  migrationTitle: document.querySelector("#migrationTitle"),
  migrationSummary: document.querySelector("#migrationSummary"),
  migrationTotal: document.querySelector("#migrationTotal"),
  migrationMedia: document.querySelector("#migrationMedia"),
  migrationReading: document.querySelector("#migrationReading"),
  startMigrationButton: document.querySelector("#startMigrationButton"),
  deferMigrationButton: document.querySelector("#deferMigrationButton"),
  cloudUsage: document.querySelector("#cloudUsage"),
  cloudUsageTitle: document.querySelector("#cloudUsageTitle"),
  cloudUsageValue: document.querySelector("#cloudUsageValue"),
  cloudUsageMeter: document.querySelector("#cloudUsageMeter"),
  cloudUsageHint: document.querySelector("#cloudUsageHint"),
  captureTokenStatus: document.querySelector("#captureTokenStatus"),
  captureTokenActions: document.querySelector("#captureTokenActions"),
  createCaptureTokenButton: document.querySelector("#createCaptureTokenButton"),
  copyCaptureUrlButton: document.querySelector("#copyCaptureUrlButton"),
  revokeCaptureTokenButton: document.querySelector("#revokeCaptureTokenButton"),
  createAgentTokenButton: document.querySelector("#createAgentTokenButton"),
  agentTokenStatus: document.querySelector("#agentTokenStatus"),
  mobileInbox: document.querySelector("#mobileInbox"),
  mobileInboxList: document.querySelector("#mobileInboxList"),
  mobileInboxEmpty: document.querySelector("#mobileInboxEmpty"),
  mobileInboxCount: document.querySelector("#mobileInboxCount"),
  mobileInboxUnsorted: document.querySelector("#mobileInboxUnsorted"),
  mobileAddButton: document.querySelector("#mobileAddButton"),
  mobileCanvasButton: document.querySelector("#mobileCanvasButton"),
  mobileSyncButton: document.querySelector("#mobileSyncButton"),
};

const WORKFLOW_STATUSES = new Set(["inbox", "unread", "inspired", "action", "read"]);

function guestWorkspaceId() {
  let id = localStorage.getItem(GUEST_WORKSPACE_KEY);
  if (!id) {
    id = `guest:${makeId()}`;
    localStorage.setItem(GUEST_WORKSPACE_KEY, id);
  }
  return id;
}

function userWorkspaceId(userId) {
  return `user:${userId}`;
}

function activeWorkspaceId() {
  return state.workspaceId || guestWorkspaceId();
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      const transaction = request.transaction;
      const recordStore = db.objectStoreNames.contains(STORE_NAME)
        ? transaction.objectStore(STORE_NAME)
        : db.createObjectStore(STORE_NAME, { keyPath: "id" });
      const assetStore = db.objectStoreNames.contains(ASSET_STORE_NAME)
        ? transaction.objectStore(ASSET_STORE_NAME)
        : db.createObjectStore(ASSET_STORE_NAME, { keyPath: "id" });
      if (!recordStore.indexNames.contains("workspaceId")) recordStore.createIndex("workspaceId", "workspaceId", { unique: false });
      if (!assetStore.indexNames.contains("workspaceId")) assetStore.createIndex("workspaceId", "workspaceId", { unique: false });
      const guestId = guestWorkspaceId();
      [recordStore, assetStore].forEach((store) => {
        const cursorRequest = store.openCursor();
        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result;
          if (!cursor) return;
          if (!cursor.value.workspaceId) cursor.update({ ...cursor.value, workspaceId: guestId });
          cursor.continue();
        };
      });
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
      if ((cursor.value?.workspaceId || guestWorkspaceId()) === activeWorkspaceId()) total += cursor.value?.blob?.size || 0;
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

async function optimizeImageFile(file, maximumSide = 1920) {
  if (!file?.type?.startsWith("image/")) return file;
  let image;
  try {
    image = await createImageBitmap(file);
  } catch {
    if (file.size <= 5 * 1024 * 1024 && ["image/jpeg", "image/png", "image/webp"].includes(file.type)) return file;
    throw new Error("图片无法处理");
  }
  const scale = Math.min(1, maximumSide / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext("2d", { alpha: true });
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();

  const encode = (type, quality) => new Promise((resolve) => canvas.toBlob(resolve, type, quality));
  let blob = await encode("image/webp", .84);
  if (!blob) blob = await encode("image/jpeg", .84);
  if (blob?.size > 5 * 1024 * 1024) blob = await encode(blob.type || "image/jpeg", .72);
  if (!blob || blob.size > 5 * 1024 * 1024) throw new Error("图片优化后仍然超过 5 MB");
  const extension = blob.type === "image/webp" ? "webp" : "jpg";
  const name = `${(file.name || "Later Space").replace(/\.[^.]+$/, "")}.${extension}`;
  return new File([blob], name, { type: blob.type, lastModified: Date.now() });
}

async function originalBlob(record) {
  if (record.kind === "text" || record.kind === "link") return null;
  const asset = await transactAsset("readonly", (store) => store.get(record.id));
  return asset?.blob || record.blob || null;
}

async function storeImageAsset(record, blob) {
  await transactAsset("readwrite", (store) => store.put({ id: record.id, workspaceId: record.workspaceId || activeWorkspaceId(), blob }));
}

async function backupImageAssets() {
  try {
    const response = await fetch("/api/backups/latest");
    if (!response.ok) return new Map();
    const payload = await response.json();
    return new Map((payload.images || [])
      .filter((record) => record.kind !== "text" && record.kind !== "link" && record.dataUrl)
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

async function videoUrl(record) {
  if (state.assetUrls.has(record.id)) return state.assetUrls.get(record.id);
  const blob = await originalBlob(record);
  if (!blob) return record.assetHash ? `/api/backups/assets/${record.assetHash}` : "";
  const url = URL.createObjectURL(blob);
  state.assetUrls.set(record.id, url);
  return url;
}

function isImageRecord(record) {
  return record.kind !== "text" && record.kind !== "link" && record.kind !== "video";
}

function isMediaRecord(record) {
  return isImageRecord(record) || record.kind === "video";
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
      || (state.activeView === "reading" && ["link", "text"].includes(record.kind))
      || (state.activeView === "media" && isMediaRecord(record));
    const matchesType = state.filters.type === "all"
      || (state.filters.type === "links" && record.kind === "link")
      || (state.filters.type === "texts" && record.kind === "text")
      || (state.filters.type === "videos" && record.kind === "video")
      || (state.filters.type === "images" && isImageRecord(record));
    const isUnsorted = !(record.tags || []).length;
    const matchesWorkflow = state.workflow === "all"
      || (state.workflow === "inbox" && isUnsorted)
      || (state.workflow.startsWith("tag:") && (record.tags || []).includes(state.workflow.slice(4)));
    if (!matchesView || !matchesType || !matchesWorkflow || (query && !recordSearchText(record).includes(query))) return false;
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
    || state.activeView !== "reading"
    || state.filters.type !== "all"
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

function renderTypeOptions() {
  const options = state.activeView === "reading"
    ? [["all", "全部类型"], ["links", "链接"], ["texts", "文字"]]
    : state.activeView === "media"
      ? [["all", "全部类型"], ["images", "图片"], ["videos", "视频"]]
      : [["all", "全部类型"], ["links", "链接"], ["texts", "文字"], ["images", "图片"], ["videos", "视频"]];
  if (!options.some(([value]) => value === state.filters.type)) state.filters.type = "all";
  elements.typeFilter.replaceChildren(...options.map(([value, label]) => new Option(label, value)));
  elements.typeFilter.value = state.filters.type;
}

function renderFilterControls() {
  renderTypeOptions();
  renderSourceOptions();
  const supportsLinkFilters = state.activeView !== "media" && !["texts", "images", "videos"].includes(state.filters.type);
  elements.sourceFilterGroup.hidden = !supportsLinkFilters;
  elements.purposeFilterGroup.hidden = !supportsLinkFilters;
  elements.searchInput.value = state.filters.query;
  elements.purposeFilter.value = state.filters.purpose;
  elements.timeFilter.value = state.filters.time;
  elements.clearSearchButton.hidden = !state.filters.query;
  const advancedCount = [state.filters.type, state.filters.source, state.filters.purpose, state.filters.time].filter((value) => value !== "all").length;
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

function currentCanvasTarget() {
  if (state.workflow === "inbox") return { value: "inbox", label: "未整理", tags: [] };
  if (state.workflow.startsWith("tag:")) {
    const label = state.workflow.slice(4);
    return { value: state.workflow, label, tags: label ? [label] : [] };
  }
  return { value: "all", label: "全部", tags: [] };
}

function currentCanvasTags(extraTags = []) {
  return [...new Set([...currentCanvasTarget().tags, ...extraTags].filter(Boolean))];
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

function longTextTitle(text) {
  const normalized = String(text || "").replace(/\r/g, "").trim();
  const firstLine = normalized.split("\n").map((line) => line.trim()).find(Boolean) || "";
  const firstSentence = normalized.split(/[。！？!?；;\n]/).map((part) => part.trim()).find((part) => [...part].length >= 6) || firstLine;
  const weakOpening = /^(?:好的|然后|所以|其实|就是|我觉得|我想|突然觉得|想要说一下)[，,：:\s]*/u;
  const candidate = weakOpening.test(firstLine) && firstSentence !== firstLine ? firstSentence : firstLine || firstSentence;
  const cleaned = candidate.replace(/^[-—–•·\d.、\s]+/u, "").replace(/\s+/g, " ").trim();
  const characters = [...(cleaned || "文字收藏")];
  return characters.length > 24 ? `${characters.slice(0, 23).join("")}…` : characters.join("");
}

function longTextPreview(text) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  const title = longTextTitle(text).replace(/…$/, "");
  const preview = normalized.startsWith(title) ? normalized.slice(title.length).replace(/^[，,。！？!?；;：:\s]+/u, "") : normalized;
  return preview || normalized;
}

function textCard(record, expanded) {
  if (expanded) return `<div class="text-block long-text-full" tabindex="0"><button class="long-text-collapse" type="button" data-toggle-long-text>收起</button><div>${escapeHtml(record.text)}</div></div>`;
  return `<div class="long-text-card">
    <span class="long-text-type">文字</span>
    <h2><button class="long-text-open" type="button" data-open-long-text>${escapeHtml(longTextTitle(record.text))}</button></h2>
    <p>${escapeHtml(longTextPreview(record.text))}</p>
  </div>`;
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

async function recordsForWorkspace(workspaceId = activeWorkspaceId(), { includeHidden = false } = {}) {
  const records = await transact("readonly", (store) => store.getAll());
  return records.filter((record) => (
    (record.workspaceId || guestWorkspaceId()) === workspaceId
    && (includeHidden || !record.hiddenByMigration)
  ));
}

async function loadImages(workspaceId = activeWorkspaceId()) {
  state.workspaceId = workspaceId;
  const records = await recordsForWorkspace(workspaceId);
  records.sort((a, b) => a.createdAt - b.createdAt);
  let migrated = false;
  const needsAssetRecovery = records.some((record) => isMediaRecord(record) && record.thumbnailVersion !== THUMBNAIL_VERSION);
  const recoveredAssets = needsAssetRecovery ? await backupImageAssets() : new Map();
  state.images = records.map((record, index) => {
    if (!record.workspaceId) {
      record.workspaceId = workspaceId;
      migrated = true;
    }
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
    } else if (isMediaRecord(record)) {
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
          record.thumbnail = record.kind === "video" ? await createVideoThumbnail(original) : original;
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

async function clearWorkspace(workspaceId) {
  const records = await transact("readonly", (store) => store.getAll());
  const targets = records.filter((record) => (record.workspaceId || guestWorkspaceId()) === workspaceId);
  for (const record of targets) {
    await transact("readwrite", (store) => store.delete(record.id));
    await transactAsset("readwrite", (store) => store.delete(record.id));
  }
}

async function switchWorkspace(workspaceId) {
  state.objectUrls.forEach((url) => URL.revokeObjectURL(url));
  state.objectUrls.clear();
  state.assetUrls.forEach((url) => URL.revokeObjectURL(url));
  state.assetUrls.clear();
  state.selectedId = null;
  state.selectedIds.clear();
  await loadImages(workspaceId);
}

function showWelcomeScreen() {
  if (!state.images.length) elements.canvasGuide.hidden = false;
  elements.welcomeScreen.hidden = false;
  renderWelcomeEmailSuggestion();
  requestAnimationFrame(() => {
    elements.welcomeEmailInput.focus();
    showWelcomeEmailSuggestion();
  });
}

function rememberedLoginEmail() {
  return localStorage.getItem(LAST_LOGIN_EMAIL_KEY)?.trim() || "";
}

function rememberLoginEmail(email) {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return;
  localStorage.setItem(LAST_LOGIN_EMAIL_KEY, normalized);
  renderWelcomeEmailSuggestion();
}

function renderWelcomeEmailSuggestion() {
  const email = rememberedLoginEmail();
  elements.welcomeEmailSuggestionValue.textContent = email;
  elements.welcomeEmailSuggestion.hidden = !email;
}

function showWelcomeEmailSuggestion() {
  const email = rememberedLoginEmail();
  elements.welcomeEmailSuggestion.hidden = !email || elements.welcomeEmailInput.value.trim().toLowerCase() === email;
}

function chooseWelcomeEmailSuggestion() {
  const email = rememberedLoginEmail();
  if (!email) return;
  elements.welcomeEmailInput.value = email;
  elements.welcomeEmailSuggestion.hidden = true;
  elements.welcomeEmailInput.focus();
}

function closeWelcomeScreen() {
  localStorage.setItem(WELCOME_COMPLETED_KEY, "true");
  elements.welcomeScreen.hidden = true;
  showCanvasGuide();
}

function showInitialWelcome() {
  if (state.authReturnActive) return;
  if (state.onboardingForced) return showWelcomeScreen();
  if (state.cloudSession?.user || state.images.length || localStorage.getItem(WELCOME_COMPLETED_KEY) === "true") return showCanvasGuide();
  showWelcomeScreen();
}

function showAuthReturnScreen(status = "pending", detail = "正在确认你的邮箱，并带你回到刚才的画布。") {
  state.authReturnActive = true;
  elements.welcomeScreen.hidden = true;
  elements.authReturnScreen.hidden = false;
  elements.authReturnScreen.dataset.status = status;
  elements.authReturnTitle.textContent = status === "error" ? "登录没有完成" : "正在完成登录";
  elements.authReturnDetail.textContent = detail;
  elements.authReturnRetryButton.hidden = status !== "error";
}

function saveAuthReturnState() {
  localStorage.setItem(AUTH_RETURN_STATE_KEY, JSON.stringify({
    view: state.view,
    savedAt: Date.now(),
  }));
}

function restoreAuthReturnState() {
  try {
    const saved = JSON.parse(localStorage.getItem(AUTH_RETURN_STATE_KEY));
    if (saved?.view && Date.now() - Number(saved.savedAt || 0) < 24 * 60 * 60 * 1000) {
      state.view = { ...state.view, ...saved.view };
      updateView();
    }
  } catch {
  }
  localStorage.removeItem(AUTH_RETURN_STATE_KEY);
}

function closeWelcomeAfterAuthentication() {
  localStorage.setItem(WELCOME_COMPLETED_KEY, "true");
  elements.welcomeScreen.hidden = true;
  elements.authReturnScreen.hidden = true;
  state.authReturnActive = false;
  restoreAuthReturnState();
  renderAccountEntry();
  showToast("登录成功，内容已开始同步");
  showCanvasGuide();
}

function showCanvasGuide() {
  const forced = new URLSearchParams(location.search).get("guide") === "1";
  elements.canvasGuide.hidden = !forced && localStorage.getItem(CANVAS_GUIDE_DISMISSED_KEY) === "true";
}

function finishCanvasGuide() {
  localStorage.setItem(CANVAS_GUIDE_DISMISSED_KEY, "true");
  elements.canvasGuide.hidden = true;
}

function accountDisplayName(user = state.cloudSession?.user) {
  return user?.user_metadata?.display_name || user?.email?.split("@")[0] || "我的";
}

function renderAccountEntry() {
  const user = state.cloudSession?.user;
  const name = accountDisplayName(user);
  elements.accountAvatar.textContent = user ? name.trim().slice(0, 1).toUpperCase() : "L";
  elements.accountName.textContent = user ? name : "登录";
  elements.accountStatus.textContent = user ? (state.cloudLastSyncAt ? "已同步" : "同步中") : "开启同步";
  elements.accountButton.classList.toggle("is-signed-in", Boolean(user));
  elements.accountProfile.hidden = !user;
  if (user) {
    elements.accountPanelAvatar.textContent = name.trim().slice(0, 1).toUpperCase();
    if (document.activeElement !== elements.accountNameInput) elements.accountNameInput.value = name;
  }
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
        if (state.assetUrls.has(id)) URL.revokeObjectURL(state.assetUrls.get(id));
        state.assetUrls.delete(id);
      }
    });
  }
  const showsSubset = filteredRecords.length !== state.images.length;
  elements.imageCount.textContent = filtersAreActive() || showsSubset ? `${filteredRecords.length}/${state.images.length}` : state.images.length;
  elements.emptyCue.hidden = filteredRecords.length > 0;
  elements.emptyCue.setAttribute("aria-hidden", filteredRecords.length > 0 ? "true" : "false");
  elements.emptyTitle.textContent = state.images.length ? "没有找到匹配内容" : "粘贴图片、链接或文字";
  elements.emptyHint.innerHTML = state.images.length ? "换个关键词，或者重置筛选" : "<kbd>⌘</kbd><kbd>V</kbd>";
  if (state.selectedId && !filteredRecords.some((record) => record.id === state.selectedId)) state.selectedId = null;
  const filteredIds = new Set(filteredRecords.map((record) => record.id));
  state.selectedIds.forEach((id) => { if (!filteredIds.has(id)) state.selectedIds.delete(id); });
  elements.world.innerHTML = renderedRecords.map((record) => {
    const selected = record.id === state.selectedId;
    const multiSelected = state.selectedIds.has(record.id);
    const isLink = record.kind === "link";
    const isText = record.kind === "text";
    const isVideo = record.kind === "video";
    const expanded = isText && state.expandedTextIds.has(record.id);
    const content = isLink ? linkCard(record) : isText ? textCard(record, expanded) : isVideo ? `<span class="video-drag-handle" aria-hidden="true"></span><video class="video-preview" controls preload="metadata" poster="${imageUrl(record)}" aria-label="${escapeHtml(record.note || record.name || "收藏视频")}"></video>` : `<img src="${imageUrl(record)}" alt="${escapeHtml(record.note || record.name || "收藏图片")}" draggable="false" />`;
    const transform = `translate(${record.canvasX}px,${record.canvasY}px)`;
    const textWidth = expanded ? record.expandedWidth || EXPANDED_TEXT_WIDTH : TEXT_CARD_WIDTH;
    const textHeight = isText ? `height:${expanded ? record.expandedHeight || EXPANDED_TEXT_HEIGHT : TEXT_CARD_HEIGHT}px;` : "";
    const textTheme = record.textTheme || state.globalTextPreference;
    return `<article class="canvas-item${isLink ? " link-item" : ""}${isText ? ` text-item text-card-item text-theme-${textTheme}` : ""}${expanded ? " is-expanded" : ""}${isVideo ? " video-item" : ""}${selected ? " is-selected" : ""}${multiSelected ? " is-multi-selected" : ""}${state.recentIds.has(record.id) ? " is-new" : ""}${state.arrivingIds.has(record.id) ? " is-arriving" : ""}${state.duplicateFocusId === record.id ? " is-duplicate-focus" : ""}" data-id="${record.id}" data-status="${record.status || "unread"}" tabindex="0" aria-label="${escapeHtml(record.title || longTextTitle(record.text) || record.text || record.name || "收藏内容")}" style="width:${isText ? textWidth : record.canvasWidth}px;${textHeight}transform:${transform};z-index:${record.zIndex || 1}">
      ${content}
      ${isText && expanded ? textResizeHandles() : isText ? "" : `<span class="resize-handle" data-resize aria-hidden="true"></span>`}
      <span class="item-caption">${escapeHtml(record.title || record.note || record.name || "内容")}</span>
    </article>`;
  }).join("");
  renderedRecords.filter((record) => record.kind === "video").forEach((record) => {
    videoUrl(record).then((url) => {
      const node = elements.world.querySelector(`[data-id="${record.id}"] video`);
      if (node && url) node.src = url;
    }).catch(() => {});
  });
  renderFilterControls();
  renderWorkflowControls();
  renderSelection();
  renderGlobalCoverMode();
  renderGlobalTextTheme();
  renderMobileInbox();
  renderAccountEntry();
}

function mobileRecordTitle(record) {
  if (record.kind === "link") return displayLinkTitle(record.title || record.url || "收藏的链接");
  if (record.kind === "text") return longTextTitle(record.text || "文字收藏");
  return record.name || (record.kind === "video" ? "收藏的视频" : "收藏的图片");
}

function mobileRecordMeta(record) {
  const kind = record.kind === "link" ? "链接" : record.kind === "text" ? "文字" : record.kind === "video" ? "视频" : "图片";
  const status = (record.tags || []).length ? `#${record.tags[0]}` : "未整理";
  return `${kind} · ${status}`;
}

function renderMobileInbox() {
  if (!elements.mobileInboxList) return;
  const records = [...state.images].sort((left, right) => Number(right.createdAt || 0) - Number(left.createdAt || 0));
  const recent = records.slice(0, 40);
  elements.mobileInboxCount.textContent = `${records.length} 条收藏`;
  elements.mobileInboxUnsorted.textContent = `${records.filter((record) => !(record.tags || []).length).length} 条未整理`;
  elements.mobileInboxEmpty.hidden = recent.length > 0;
  elements.mobileInboxList.innerHTML = recent.map((record) => {
    const media = isMediaRecord(record) && record.kind !== "video" ? `<img src="${escapeHtml(imageUrl(record))}" alt="" />` : "";
    const icon = record.kind === "link" ? "↗" : record.kind === "text" ? "✎" : record.kind === "video" ? "▶" : "▧";
    return `<button class="mobile-inbox-item" type="button" data-mobile-record-id="${escapeHtml(record.id)}"><span class="mobile-inbox-thumb">${media || icon}</span><span class="mobile-inbox-meta"><strong>${escapeHtml(mobileRecordTitle(record))}</strong><span>${escapeHtml(mobileRecordMeta(record))}</span></span><span class="mobile-inbox-arrow" aria-hidden="true">›</span></button>`;
  }).join("");
}

function renderGlobalCoverMode() {
  const links = state.images.filter((record) => record.kind === "link");
  elements.appearanceSwitcher.hidden = state.activeView === "media";
  elements.globalCoverSwitcher.hidden = !links.length;
  const modes = new Set(links.map((record) => record.coverMode || "editorial"));
  elements.globalCoverSwitcher.dataset.state = modes.size > 1 ? "mixed" : (modes.values().next().value || "editorial");
  elements.globalCoverButtons.forEach((button) => {
    const active = links.length > 0 && modes.size === 1 && modes.has(button.dataset.globalCoverMode);
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function renderGlobalTextTheme() {
  const texts = state.images.filter((record) => record.kind === "text");
  elements.globalTextSwitcher.hidden = !texts.length;
  const themes = new Set(texts.map((record) => record.textTheme || state.globalTextPreference));
  elements.globalTextSwitcher.dataset.state = themes.size > 1 ? "mixed" : (themes.values().next().value || state.globalTextPreference);
  elements.globalTextButtons.forEach((button) => {
    const active = texts.length > 0 && themes.size === 1 && themes.has(button.dataset.globalTextTheme);
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
  elements.copyImageButton.hidden = !isImageRecord(record);
  elements.cropImageButton.hidden = !isImageRecord(record);
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
    : "Later Space 保存清晰优化版；导出时也是优化版。登录后还会同步到云端。";
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
  setCaptureTags(currentCanvasTags());
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
      await saveText(text, arrivalOrigin, currentCanvasTags([...state.captureTags]));
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
    await saveLinks(urls, text, "", "", arrivalOrigin, currentCanvasTags([...state.captureTags]));
  } finally {
    state.captureSubmitting = false;
    elements.addContentButton.disabled = false;
  }
}

function setView(view) {
  state.activeView = view;
  state.filters.type = "all";
  state.filters.source = "all";
  state.filters.purpose = "all";
  elements.viewButtons.forEach((button) => {
    const active = button.dataset.view === view;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  render();
  fitAll();
}

function updateFilters() {
  state.filters.type = elements.typeFilter.value;
  state.filters.source = elements.sourceFilter.value;
  state.filters.purpose = elements.purposeFilter.value;
  state.filters.time = elements.timeFilter.value;
  render();
  fitAll();
}

function resetFilters() {
  state.filters = { query: "", type: "all", source: "all", purpose: "all", time: "all" };
  state.activeView = "reading";
  state.workflow = "all";
  elements.viewButtons.forEach((button) => {
    const active = button.dataset.view === "reading";
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

function getVideoInfo(blob) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      resolve({ width: video.videoWidth || 0, height: video.videoHeight || 0, duration: video.duration || 0 });
      URL.revokeObjectURL(url);
    };
    video.onerror = () => { resolve({ width: 0, height: 0, duration: 0 }); URL.revokeObjectURL(url); };
    video.src = url;
  });
}

function createVideoThumbnail(blob) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const video = document.createElement("video");
    video.muted = true;
    video.preload = "metadata";
    let finished = false;
    const finish = (thumbnail = null) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      URL.revokeObjectURL(url);
      resolve(thumbnail);
    };
    const timeout = setTimeout(() => finish(), 5000);
    video.onerror = () => finish();
    video.onloadedmetadata = () => { video.currentTime = Math.min(.1, video.duration || 0); };
    video.onseeked = () => {
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 960 / Math.max(video.videoWidth || 1, video.videoHeight || 1));
      canvas.width = Math.max(1, Math.round((video.videoWidth || 320) * scale));
      canvas.height = Math.max(1, Math.round((video.videoHeight || 180) * scale));
      canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((thumbnail) => finish(thumbnail), "image/jpeg", .82);
    };
    video.src = url;
  });
}

async function saveFiles(fileList, source, screenPoint, purpose = "", tags = [], confirmDuplicates = true) {
  const files = Array.from(fileList).filter((file) => file?.type?.startsWith("image/"));
  if (!files.length) return showToast("第一版暂时只支持图片");
  if (state.cloudSession?.user && files.some((file) => file.type.startsWith("image/")) && cloudUsageRatio() >= .85) {
    return showToast("图片空间已满，请先删除一些图片；文字和链接仍可收藏");
  }
  const center = screenPoint ? screenToWorld(screenPoint.x, screenPoint.y) : worldCenter();
  const baseOffset = state.pasteOffset;
  const savedRecords = [];
  for (const [index, sourceFile] of files.entries()) {
    let file = sourceFile;
    const isVideo = file.type.startsWith("video/");
    if (!isVideo) {
      try {
        file = await optimizeImageFile(file);
      } catch (error) {
        showToast(error.message || "图片无法处理");
        continue;
      }
    }
    const fingerprint = await blobFingerprint(file);
    const duplicate = state.images.find((record) => isMediaRecord(record) && record.fingerprint === fingerprint);
    if (duplicate && (!confirmDuplicates || !await confirmDuplicateUpload(isVideo ? "这个视频" : "这张图片", duplicate))) continue;
    const dimensions = isVideo ? await getVideoInfo(file) : await getDimensions(file);
    const thumbnail = isVideo ? await createVideoThumbnail(file) : file;
    const canvasWidth = Math.min(360, Math.max(180, dimensions.width ? Math.min(dimensions.width, 320) : 280));
    const ratio = dimensions.width ? dimensions.height / dimensions.width : 1;
    const placement = openPlacement(center, canvasWidth, canvasWidth * ratio);
    const now = Date.now() + index;
    const record = {
      id: makeId(), workspaceId: activeWorkspaceId(), ...(isVideo ? { kind: "video" } : {}), thumbnail, thumbnailVersion: THUMBNAIL_VERSION, name: file.name || `${isVideo ? "粘贴视频" : "粘贴图片"} ${new Date(now).toLocaleTimeString("zh-CN")}`,
      type: file.type, size: file.size, width: dimensions.width, height: dimensions.height, duration: dimensions.duration || 0, fingerprint,
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
    showToast(`${savedRecords.length} 个媒体已放入画布`);
  }
  return savedRecords;
}

async function saveText(text, arrivalOrigin = screenCenter(), tags = [], confirmDuplicates = true) {
  const fingerprint = normalizedTextFingerprint(text);
  const duplicate = state.images.find((record) => record.kind === "text" && normalizedTextFingerprint(record.text) === fingerprint);
  if (duplicate && (!confirmDuplicates || !await confirmDuplicateUpload("这段文字", duplicate))) return null;
  const center = worldCenter();
  const size = { width: TEXT_CARD_WIDTH, height: TEXT_CARD_HEIGHT };
  const placement = openPlacement(center, size.width, size.height);
  const now = Date.now();
  const record = {
    id: makeId(), workspaceId: activeWorkspaceId(), kind: "text", text, name: text.slice(0, 32),
    textTheme: state.globalTextPreference,
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
  return record;
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
    return state.expandedTextIds.has(record.id) ? record.expandedHeight || EXPANDED_TEXT_HEIGHT : TEXT_CARD_HEIGHT;
  }
  return record.canvasWidth * (record.height && record.width ? record.height / record.width : 1);
}

function itemWidth(record) {
  if (record.kind === "text") return state.expandedTextIds.has(record.id) ? record.expandedWidth || EXPANDED_TEXT_WIDTH : TEXT_CARD_WIDTH;
  return record.canvasWidth;
}

function toggleTextCard(record) {
  if (record?.kind !== "text") return;
  if (state.expandedTextIds.has(record.id)) state.expandedTextIds.delete(record.id);
  else state.expandedTextIds.add(record.id);
  state.selectedId = record.id;
  state.selectedIds.clear();
  state.selectedIds.add(record.id);
  render();
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

function revealRecord(record, message = "已定位到这条内容") {
  if (!record) return false;
  state.selectedId = record.id;
  state.selectedIds.clear();
  state.selectedIds.add(record.id);
  state.duplicateFocusId = record.id;
  state.activeView = record.kind === "link" || record.kind === "text" ? "reading" : "media";
  state.filters = { query: "", type: "all", source: "all", purpose: "all", time: "all" };
  const centerX = record.canvasX + itemWidth(record) / 2;
  const centerY = record.canvasY + itemHeight(record) / 2;
  state.view.x = innerWidth / 2 - centerX * state.view.zoom;
  state.view.y = innerHeight / 2 - centerY * state.view.zoom;
  render();
  updateView();
  showToast(message);
  setTimeout(() => {
    if (state.duplicateFocusId !== record.id) return;
    state.duplicateFocusId = null;
    render();
  }, 1100);
  return true;
}

function revealDuplicate(record, label) {
  revealRecord(record, `${label}已经收藏过，已带你找到原内容`);
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

async function saveLinks(urls, sourceText = "", purpose = "", customTitle = "", arrivalOrigin = screenCenter(), tags = [], confirmDuplicates = true) {
  const center = worldCenter();
  const baseOffset = state.pasteOffset;
  const savedRecords = [];
  for (const [index, value] of urls.entries()) {
    let normalized;
    try { normalized = new URL(value).href; } catch { continue; }
    const canonical = canonicalUrl(normalized);
    const duplicate = state.images.find((record) => record.kind === "link" && canonicalUrl(record.url) === canonical);
    if (duplicate && (!confirmDuplicates || !await confirmDuplicateUpload("这个链接", duplicate))) continue;
    const placement = openPlacement(center, 300, 375);
    const now = Date.now() + index;
    const shareTitle = titleFromShareText(sourceText, value);
    const record = {
      id: makeId(), workspaceId: activeWorkspaceId(), kind: "link", url: normalized, canonicalUrl: canonical, name: linkHostname(normalized),
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
  return savedRecords;
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
  record.workspaceId = record.workspaceId || activeWorkspaceId();
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

async function setAllTextThemes(theme) {
  if (!["paper", "dark"].includes(theme)) return;
  const texts = state.images.filter((record) => record.kind === "text");
  state.globalTextPreference = theme;
  localStorage.setItem("later-space-global-text-theme", theme);
  texts.forEach((record) => { record.textTheme = theme; });
  render();
  for (const record of texts) await persistRecord(record);
  showToast(theme === "dark" ? "全部文字已切换为深色" : "全部文字已切换为纸张");
}

function selectItem(id) {
  state.selectedIds.clear();
  state.selectedIds.add(id);
  state.selectedId = id;
  const top = Math.max(0, ...state.images.map((item) => item.zIndex || 0)) + 1;
  const record = state.images.find((image) => image.id === id);
  if (record) record.zIndex = top;
  elements.world.querySelectorAll(".canvas-item.is-selected, .canvas-item.is-multi-selected").forEach((item) => item.classList.remove("is-selected", "is-multi-selected"));
  const node = elements.world.querySelector(`[data-id="${id}"]`);
  if (node) {
    node.classList.add("is-selected");
    node.style.zIndex = String(top);
  }
  renderSelection();
  if (record) persistRecord(record);
}

function beginPointer(event) {
  if (event.button !== 0) return;
  if (event.target.closest(".text-card-item.is-expanded .long-text-full")) return;
  if (event.target.closest("button, a, input, textarea, select, label")) return;
  if (event.target.closest("video")) return;
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
    const record = state.images.find((image) => image.id === id);
    if (event.shiftKey && !resize) {
      if (state.selectedIds.has(id)) state.selectedIds.delete(id);
      else state.selectedIds.add(id);
      state.selectedId = state.selectedIds.size === 1 ? [...state.selectedIds][0] : null;
      render();
      return;
    }
    if (state.selectedId !== id) selectItem(id);
    state.pointer = {
      mode: resize ? "resize" : "item",
      resizeDirection: resize?.dataset.resizeDirection || "se",
      id, startX: event.clientX, startY: event.clientY,
      moved: false,
      originX: record.canvasX, originY: record.canvasY, originWidth: itemWidth(record),
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
  if (Math.hypot(dx, dy) > 5) state.pointer.moved = true;
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
  } else if (record.kind === "text" && state.expandedTextIds.has(record.id)) {
    const direction = state.pointer.resizeDirection;
    const worldDx = dx / state.view.zoom;
    const worldDy = dy / state.view.zoom;
    const minimumWidth = 120;
    const minimumHeight = 72;
    if (direction.includes("e")) record.expandedWidth = Math.max(minimumWidth, state.pointer.originWidth + worldDx);
    if (direction.includes("s")) record.expandedHeight = Math.max(minimumHeight, state.pointer.originHeight + worldDy);
    if (direction.includes("w")) {
      const nextWidth = Math.max(minimumWidth, state.pointer.originWidth - worldDx);
      record.canvasX = state.pointer.originX + state.pointer.originWidth - nextWidth;
      record.expandedWidth = nextWidth;
    }
    if (direction.includes("n")) {
      const nextHeight = Math.max(minimumHeight, state.pointer.originHeight - worldDy);
      record.canvasY = state.pointer.originY + state.pointer.originHeight - nextHeight;
      record.expandedHeight = nextHeight;
    }
  } else {
    record.canvasWidth = Math.max(72, state.pointer.originWidth + dx / state.view.zoom);
  }
  const node = elements.world.querySelector(`[data-id="${record.id}"]`);
  if (node) {
    node.style.width = `${itemWidth(record)}px`;
    if (record.kind === "text") node.style.height = `${itemHeight(record)}px`;
    node.style.transform = `translate(${record.canvasX}px,${record.canvasY}px)`;
  }
  renderSelection();
}

function endPointer() {
  if (!state.pointer) return;
  const pointer = state.pointer;
  const record = state.images.find((image) => image.id === pointer.id);
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
    if (isMediaRecord(record)) {
      const blob = await originalBlob(record);
      if (blob) assets.set(record.id, blob);
    }
  }
  state.deletionUndoSnapshot = {
    records: structuredClone(records),
    assets,
    restoring: false,
  };
  const cloudDeletions = cloudDeletionMap();
  records.forEach((record) => { cloudDeletions[record.id] = Date.now(); });
  saveCloudDeletionMap(cloudDeletions);
  for (const id of ids) {
    await transact("readwrite", (store) => store.delete(id));
    await transactAsset("readwrite", (store) => store.delete(id));
    if (state.objectUrls.has(id)) URL.revokeObjectURL(state.objectUrls.get(id));
    state.objectUrls.delete(id);
    if (state.assetUrls.has(id)) URL.revokeObjectURL(state.assetUrls.get(id));
    state.assetUrls.delete(id);
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
      record.updatedAt = Date.now();
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
    const cloudDeletions = cloudDeletionMap();
    snapshot.records.forEach((record) => { delete cloudDeletions[record.id]; });
    saveCloudDeletionMap(cloudDeletions);
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
  scheduleCloudSync();
  if (!STATIC_DEPLOYMENT) {
    clearTimeout(state.backupTimer);
    state.backupTimer = setTimeout(saveAutomaticBackup, 900);
  }
}

async function restorePayload(payload) {
  if (!payload || payload.app !== "Later Space" || !Array.isArray(payload.images)) throw new Error("invalid backup");
  await clearWorkspace(activeWorkspaceId());
  const records = [];
  for (const record of payload.images) {
    const restored = { ...record, workspaceId: activeWorkspaceId() };
    if (restored.dataUrl) {
      const blob = dataUrlToBlob(restored.dataUrl);
      await storeImageAsset(restored, blob);
      restored.thumbnail = restored.kind === "video" ? await createVideoThumbnail(blob) : blob;
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
  state.assetUrls.forEach((url) => URL.revokeObjectURL(url));
  state.assetUrls.clear();
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

const CLOUD_SESSION_KEY = "later-space-cloud-session-v1";
const CLOUD_DELETIONS_KEY = "later-space-cloud-deletions-v1";
const CLOUD_DEVICE_KEY = "later-space-cloud-device-v1";

function cloudConfig() {
  return window.LATER_SPACE_CLOUD || {};
}

function cloudConfigured() {
  const config = cloudConfig();
  return Boolean(config.supabaseUrl && config.supabaseAnonKey);
}

async function loadCloudUsage() {
  const user = state.cloudSession?.user;
  if (!user) {
    state.cloudUsage = null;
    return null;
  }
  const response = await cloudRequest(`/rest/v1/later_space_usage?user_id=eq.${encodeURIComponent(user.id)}&select=used_bytes,quota_bytes`);
  if (!response.ok) return state.cloudUsage;
  const rows = await response.json();
  state.cloudUsage = rows[0] || { used_bytes: 0, quota_bytes: 50 * 1024 * 1024 };
  return state.cloudUsage;
}

function cloudUsageRatio() {
  if (!state.cloudUsage?.quota_bytes) return 0;
  return Number(state.cloudUsage.used_bytes || 0) / Number(state.cloudUsage.quota_bytes);
}

function renderCloudUsage() {
  if (!elements.cloudUsage) return;
  const user = state.cloudSession?.user;
  elements.cloudUsage.hidden = !user;
  if (!user) return;
  const usage = state.cloudUsage || { used_bytes: 0, quota_bytes: 50 * 1024 * 1024 };
  const ratio = Math.min(1, Number(usage.used_bytes || 0) / Number(usage.quota_bytes || 1));
  elements.cloudUsageValue.textContent = `${formatBytes(Number(usage.used_bytes || 0))} / ${formatBytes(Number(usage.quota_bytes || 0))}`;
  elements.cloudUsageMeter.style.width = `${ratio * 100}%`;
  elements.cloudUsage.dataset.level = ratio >= .85 ? "blocked" : ratio >= .8 ? "urgent" : ratio >= .7 ? "warning" : "normal";
  elements.cloudUsageTitle.textContent = ratio >= .85 ? "图片空间已满" : ratio >= .8 ? "图片空间快满了" : "图片空间";
  elements.cloudUsageHint.textContent = ratio >= .85
    ? "请先删除一些图片；文字和链接仍可继续收藏。"
    : ratio >= .8
      ? "建议现在清理图片，达到 85% 后会暂停新增图片。"
      : ratio >= .7
        ? "空间正在变满，可以开始整理不需要的图片。"
        : "达到 85% 后暂停新增图片，文字和链接不受影响。";
}

function notifyCloudUsage() {
  const user = state.cloudSession?.user;
  if (!user) return;
  const ratio = cloudUsageRatio();
  const level = ratio >= .85 ? 3 : ratio >= .8 ? 2 : ratio >= .7 ? 1 : 0;
  const key = `later-space-usage-notice-v1:${user.id}`;
  const previous = Number(localStorage.getItem(key) || 0);
  if (level === 0) {
    localStorage.removeItem(key);
    return;
  }
  if (level <= previous) return;
  localStorage.setItem(key, String(level));
  const message = level === 3
    ? "图片空间已满，请先清理；文字和链接仍可收藏"
    : level === 2
      ? "图片空间已经使用 80%，建议现在清理"
      : "图片空间已经使用 70%，可以开始整理了";
  showToast(message, "查看空间", openSyncPanel);
}

function captureTokenLocalKey(userId) {
  return `later-space-capture-token-v1:${userId}`;
}

async function hashText(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function newCaptureToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function personalCaptureUrl(token = state.captureToken) {
  if (!token) return "";
  return `${cloudConfig().supabaseUrl}/functions/v1/mobile-inbox?token=${encodeURIComponent(token)}`;
}

async function loadCaptureTokenState() {
  const user = state.cloudSession?.user;
  state.captureToken = user ? localStorage.getItem(captureTokenLocalKey(user.id)) : null;
  if (!user) return;
  const response = await cloudRequest(`/rest/v1/later_space_capture_tokens?user_id=eq.${encodeURIComponent(user.id)}&revoked_at=is.null&select=id,token_hint,last_used_at&order=created_at.desc&limit=1`);
  const rows = response.ok ? await response.json() : [];
  const active = rows[0] || null;
  elements.captureTokenActions.hidden = false;
  elements.copyCaptureUrlButton.hidden = !state.captureToken;
  elements.revokeCaptureTokenButton.hidden = !active;
  elements.createCaptureTokenButton.textContent = active ? "重新生成地址" : "生成专属地址";
  elements.captureTokenStatus.textContent = active
    ? state.captureToken
      ? `已连接 · 尾号 ${active.token_hint}${active.last_used_at ? ` · 最近使用 ${new Date(active.last_used_at).toLocaleDateString("zh-CN")}` : ""}`
      : `这台设备没有保存地址 · 请重新生成（尾号 ${active.token_hint}）`
    : "生成后只需在快捷指令里粘贴一次";
}

async function revokeActiveCaptureTokens() {
  const user = state.cloudSession?.user;
  if (!user) return;
  await cloudRequest(`/rest/v1/later_space_capture_tokens?user_id=eq.${encodeURIComponent(user.id)}&revoked_at=is.null`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ revoked_at: new Date().toISOString() }),
  });
  localStorage.removeItem(captureTokenLocalKey(user.id));
  state.captureToken = null;
}

async function createCaptureToken() {
  const user = state.cloudSession?.user;
  if (!user) return;
  elements.createCaptureTokenButton.disabled = true;
  try {
    await revokeActiveCaptureTokens();
    const token = newCaptureToken();
    const tokenHash = await hashText(token);
    const response = await cloudRequest("/rest/v1/later_space_capture_tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ user_id: user.id, token_hash: tokenHash, token_hint: token.slice(-6) }),
    });
    if (!response.ok) throw new Error(await response.text());
    localStorage.setItem(captureTokenLocalKey(user.id), token);
    state.captureToken = token;
    await loadCaptureTokenState();
    showToast("专属收件地址已生成", "复制", copyPersonalCaptureUrl);
  } catch (error) {
    console.error(error);
    showToast("生成失败，请稍后重试");
  } finally {
    elements.createCaptureTokenButton.disabled = false;
  }
}

async function createAgentToken() {
  const user = state.cloudSession?.user;
  if (!user || !elements.createAgentTokenButton) return;
  elements.createAgentTokenButton.disabled = true;
  try {
    const response = await cloudRequest("/functions/v1/agent-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Later Space Agent" }),
    });
    const result = await response.json();
    if (!response.ok || !result.token) throw new Error(result.error || "token_create_failed");
    await navigator.clipboard.writeText(result.token);
    elements.agentTokenStatus.textContent = "Token 已复制；只显示这一次，请粘贴到 CLI 的 auth 命令";
    elements.createAgentTokenButton.textContent = "重新生成";
    showToast("Agent Token 已复制");
  } catch (error) {
    console.error(error);
    showToast("Agent Token 生成失败，请先部署 agent-read 函数");
  } finally {
    elements.createAgentTokenButton.disabled = false;
  }
}

async function copyPersonalCaptureUrl() {
  const url = personalCaptureUrl();
  if (!url) return showToast("请先生成专属收件地址");
  try {
    await navigator.clipboard.writeText(url);
    showToast("收件地址已复制");
  } catch {
    window.prompt("长按复制这条收件地址", url);
  }
}

async function stopCaptureToken() {
  await revokeActiveCaptureTokens();
  await loadCaptureTokenState();
  showToast("手机快捷收件已停用");
}

async function subscribeCloudRealtime() {
  unsubscribeCloudRealtime();
  const user = state.cloudSession?.user;
  if (!user || !window.supabase?.createClient) return;
  const client = window.supabase.createClient(cloudConfig().supabaseUrl, cloudConfig().supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await client.auth.setSession({
    access_token: state.cloudSession.access_token,
    refresh_token: state.cloudSession.refresh_token,
  });
  const channel = client
    .channel(`later-space-items-${user.id}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "later_space_items", filter: `user_id=eq.${user.id}` }, () => syncCloud())
    .subscribe();
  state.cloudRealtime = { client, channel };
}

function unsubscribeCloudRealtime() {
  if (!state.cloudRealtime) return;
  state.cloudRealtime.client.removeChannel(state.cloudRealtime.channel);
  state.cloudRealtime = null;
}

function cloudDeviceId() {
  let id = localStorage.getItem(CLOUD_DEVICE_KEY);
  if (!id) {
    id = makeId();
    localStorage.setItem(CLOUD_DEVICE_KEY, id);
  }
  return id;
}

function cloudDeletionMap() {
  const owner = state.cloudSession?.user?.id || "guest";
  try { return JSON.parse(localStorage.getItem(`${CLOUD_DELETIONS_KEY}:${owner}`)) || {}; }
  catch { return {}; }
}

function saveCloudDeletionMap(value) {
  const owner = state.cloudSession?.user?.id || "guest";
  localStorage.setItem(`${CLOUD_DELETIONS_KEY}:${owner}`, JSON.stringify(value));
}

function cloudMigrationStorageKey(userId) {
  return `${CLOUD_MIGRATION_KEY}:${userId}`;
}

function readCloudMigration(userId) {
  try { return JSON.parse(localStorage.getItem(cloudMigrationStorageKey(userId))) || null; }
  catch { return null; }
}

function saveCloudMigration(userId, value) {
  if (value) localStorage.setItem(cloudMigrationStorageKey(userId), JSON.stringify(value));
  else localStorage.removeItem(cloudMigrationStorageKey(userId));
}

function migrationCounts(records) {
  const eligible = records.filter((record) => record.kind !== "video" && !record.hiddenByMigration);
  return {
    total: eligible.length,
    media: eligible.filter((record) => isImageRecord(record)).length,
    reading: eligible.filter((record) => record.kind === "link" || record.kind === "text").length,
  };
}

function migrationFingerprint(record) {
  if (record.kind === "link") return `link:${canonicalUrl(record.url || "")}`;
  if (record.kind === "text") return `text:${normalizedTextFingerprint(record.text || "")}`;
  if (isImageRecord(record)) return `image:${record.fingerprint || ""}`;
  return "";
}

function migrationEligibleRecords(records) {
  const existingFingerprints = new Set(state.images.map(migrationFingerprint).filter(Boolean));
  return records.filter((record) => {
    if (record.kind === "video" || record.hiddenByMigration) return false;
    const fingerprint = migrationFingerprint(record);
    if (fingerprint && existingFingerprints.has(fingerprint)) return false;
    if (fingerprint) existingFingerprints.add(fingerprint);
    return true;
  });
}

function closeMigrationDialog() {
  elements.migrationDialog.hidden = true;
  elements.migrationBackdrop.hidden = true;
}

async function migrationGuestRecords() {
  return recordsForWorkspace(guestWorkspaceId(), { includeHidden: true });
}

async function openMigrationDialog() {
  const records = await migrationGuestRecords();
  const counts = migrationCounts(records);
  if (!counts.total) return showToast("这台设备没有待迁移的旧收藏");
  elements.migrationTitle.textContent = `发现本机旧收藏 ${counts.total} 条`;
  elements.migrationSummary.textContent = "可以把它们带入当前账号，在其他设备继续查看。";
  elements.migrationTotal.textContent = counts.total;
  elements.migrationMedia.textContent = counts.media;
  elements.migrationReading.textContent = counts.reading;
  elements.migrationBackdrop.hidden = false;
  elements.migrationDialog.hidden = false;
}

async function deferGuestMigration() {
  const user = state.cloudSession?.user;
  if (!user) return;
  const existing = readCloudMigration(user.id) || {};
  saveCloudMigration(user.id, { ...existing, status: "deferred", deferredAt: Date.now() });
  closeMigrationDialog();
  await refreshMigrationOffer();
  showToast("可以随时在「我的」里继续迁移");
}

async function refreshMigrationOffer({ prompt = false } = {}) {
  const user = state.cloudSession?.user;
  if (!user) {
    elements.accountMigration.hidden = true;
    return;
  }
  const records = await migrationGuestRecords();
  const counts = migrationCounts(records);
  const migration = readCloudMigration(user.id);
  const canMigrate = counts.total > 0 && migration?.status !== "complete" && migration?.status !== "pending";
  elements.accountMigration.hidden = !canMigrate;
  if (canMigrate) {
    elements.accountMigrationTitle.textContent = `发现本机旧收藏 ${counts.total} 条`;
    elements.accountMigrationDetail.textContent = migration?.status === "deferred" ? "已暂缓，准备好时随时可以继续。" : "可以安全迁移到当前账号。";
  }
  if (prompt && canMigrate && migration?.status !== "deferred") {
    saveCloudMigration(user.id, { ...(migration || {}), status: "available", detectedAt: migration?.detectedAt || Date.now() });
    await openMigrationDialog();
  }
}

async function deleteLocalRecords(ids) {
  for (const id of ids) {
    await transact("readwrite", (store) => store.delete(id));
    await transactAsset("readwrite", (store) => store.delete(id));
  }
  const targets = new Set(ids);
  state.images = state.images.filter((record) => !targets.has(record.id));
}

async function startGuestMigration(user, guestRecords) {
  if (!guestRecords.length) return;
  const existing = readCloudMigration(user.id);
  if (existing?.status === "complete") return;
  if (existing?.status === "pending") {
    showToast(`还有 ${existing.pairs?.length || 0} 条本机内容等待同步`);
    return;
  }

  const eligible = migrationEligibleRecords(guestRecords);
  if (!eligible.length) {
    showToast("本机收藏都已存在，无需重复迁移");
    return;
  }
  const batchId = makeId();
  const pairs = [];
  state.migrationCancelled = false;
  showToast(`正在带入 0 / ${eligible.length} 条`, "取消", () => { state.migrationCancelled = true; });

  for (const [index, source] of eligible.entries()) {
    if (state.migrationCancelled) break;
    const copy = {
      ...source,
      id: makeId(),
      workspaceId: userWorkspaceId(user.id),
      migrationSourceId: source.id,
      migrationBatchId: batchId,
      updatedAt: Date.now() + index,
    };
    delete copy.hiddenByMigration;
    const asset = isMediaRecord(source) ? await transactAsset("readonly", (store) => store.get(source.id)) : null;
    if (asset?.blob) await storeImageAsset(copy, asset.blob);
    await transact("readwrite", (store) => store.put(copy));
    state.images.push(copy);
    pairs.push({ sourceId: source.id, copyId: copy.id });
    showToast(`正在带入 ${index + 1} / ${eligible.length} 条`, "取消", () => { state.migrationCancelled = true; });
  }

  if (state.migrationCancelled) {
    await deleteLocalRecords(pairs.map((pair) => pair.copyId));
    render();
    showToast("已取消，本机内容仍然保留");
    return;
  }

  saveCloudMigration(user.id, { status: "pending", batchId, pairs, startedAt: Date.now() });
  render();
}

async function confirmGuestMigration() {
  const user = state.cloudSession?.user;
  if (!user) return showWelcomeScreen();
  const records = await migrationGuestRecords();
  closeMigrationDialog();
  await startGuestMigration(user, records);
  await refreshMigrationOffer();
  scheduleCloudSync();
}

async function finalizePendingMigration(userId) {
  const migration = readCloudMigration(userId);
  if (migration?.status !== "pending") return;
  const sources = await recordsForWorkspace(guestWorkspaceId(), { includeHidden: true });
  const sourceById = new Map(sources.map((record) => [record.id, record]));
  for (const pair of migration.pairs || []) {
    const source = sourceById.get(pair.sourceId);
    if (!source) continue;
    source.hiddenByMigration = { userId, batchId: migration.batchId, hiddenAt: Date.now() };
    await transact("readwrite", (store) => store.put(source));
  }
  saveCloudMigration(userId, { ...migration, status: "complete", completedAt: Date.now() });
  showToast(`已带入 ${migration.pairs?.length || 0} 条本机内容`, "撤销", () => undoGuestMigration(userId));
}

async function undoGuestMigration(userId) {
  const migration = readCloudMigration(userId);
  if (!migration?.pairs?.length) return;
  const copyIds = migration.pairs.map((pair) => pair.copyId);
  const deletions = cloudDeletionMap();
  copyIds.forEach((id, index) => { deletions[id] = Date.now() + index; });
  saveCloudDeletionMap(deletions);
  await deleteLocalRecords(copyIds);
  const sources = await recordsForWorkspace(guestWorkspaceId(), { includeHidden: true });
  const sourceIds = new Set(migration.pairs.map((pair) => pair.sourceId));
  for (const source of sources.filter((record) => sourceIds.has(record.id))) {
    delete source.hiddenByMigration;
    await transact("readwrite", (store) => store.put(source));
  }
  saveCloudMigration(userId, null);
  render();
  scheduleCloudSync();
  showToast("已撤销，原来的本机内容仍然保留");
}

function saveCloudSession(session) {
  state.cloudSession = session;
  if (session?.user?.email) rememberLoginEmail(session.user.email);
  if (session) localStorage.setItem(CLOUD_SESSION_KEY, JSON.stringify(session));
  else localStorage.removeItem(CLOUD_SESSION_KEY);
}

function cloudAuthClient() {
  if (!state.cloudAuthClient && window.supabase?.createClient) {
    state.cloudAuthClient = window.supabase.createClient(cloudConfig().supabaseUrl, cloudConfig().supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, flowType: "pkce" },
    });
  }
  return state.cloudAuthClient;
}

function cloudHeaders(extra = {}) {
  const config = cloudConfig();
  return { apikey: config.supabaseAnonKey, Authorization: `Bearer ${state.cloudSession?.access_token || config.supabaseAnonKey}`, ...extra };
}

async function cloudRequest(path, options = {}) {
  const response = await fetch(`${cloudConfig().supabaseUrl}${path}`, { ...options, headers: cloudHeaders(options.headers) });
  if (response.status === 401 && state.cloudSession?.refresh_token && !options.skipRefresh) {
    await refreshCloudSession();
    return cloudRequest(path, { ...options, skipRefresh: true });
  }
  return response;
}

async function refreshCloudSession() {
  const response = await fetch(`${cloudConfig().supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { apikey: cloudConfig().supabaseAnonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: state.cloudSession.refresh_token }),
  });
  if (!response.ok) {
    saveCloudSession(null);
    throw new Error("session expired");
  }
  saveCloudSession(await response.json());
}

function hasCloudAuthParameters() {
  const searchParams = new URLSearchParams(location.search);
  const hash = new URLSearchParams(location.hash.replace(/^#/, ""));
  return Boolean(searchParams.get("code") || searchParams.get("error") || hash.get("access_token") || hash.get("error"));
}

function clearCloudAuthParameters() {
  const clean = new URL(location.href);
  ["code", "error", "error_code", "error_description", "type", "onboarding", "guide"].forEach((key) => clean.searchParams.delete(key));
  clean.hash = "";
  history.replaceState(null, "", `${clean.pathname}${clean.search}`);
}

async function exchangeCodeForSession(code) {
  const client = cloudAuthClient();
  if (!client) throw new Error("登录组件还没有准备好");
  const { data, error } = await client.auth.exchangeCodeForSession(code);
  if (error || !data?.session) throw error || new Error("登录链接无效");
  saveCloudSession(data.session);
  return true;
}

async function captureCloudSessionFromUrl() {
  const searchParams = new URLSearchParams(location.search);
  if (searchParams.get("error")) throw new Error(searchParams.get("error_description") || "登录链接已失效");
  const code = searchParams.get("code");
  if (code) return exchangeCodeForSession(code);
  const values = new URLSearchParams(location.hash.replace(/^#/, ""));
  if (values.get("error")) throw new Error(values.get("error_description") || "登录链接已失效");
  if (!values.get("access_token")) return false;
  saveCloudSession({
    access_token: values.get("access_token"),
    refresh_token: values.get("refresh_token"),
    expires_at: Math.floor(Date.now() / 1000) + Number(values.get("expires_in") || 3600),
    user: null,
  });
  return true;
}

async function completeCloudAuthReturn() {
  const returningFromEmail = hasCloudAuthParameters();
  if (!returningFromEmail) return { returningFromEmail: false, arrivedFromEmail: false };
  showAuthReturnScreen();
  try {
    const arrivedFromEmail = await captureCloudSessionFromUrl();
    if (arrivedFromEmail) clearCloudAuthParameters();
    return { returningFromEmail: true, arrivedFromEmail };
  } catch (error) {
    clearCloudAuthParameters();
    showAuthReturnScreen("error", error.message || "这个登录链接可能已经失效，请重新发送一封。");
    return { returningFromEmail: true, arrivedFromEmail: false, failed: true };
  }
}

async function loadCloudUser() {
  if (!state.cloudSession) return null;
  const response = await cloudRequest("/auth/v1/user");
  if (!response.ok) {
    saveCloudSession(null);
    return null;
  }
  const user = await response.json();
  state.cloudSession.user = user;
  saveCloudSession(state.cloudSession);
  return user;
}

async function initializeCloud() {
  if (!cloudConfigured()) return;
  const { returningFromEmail, arrivedFromEmail, failed } = await completeCloudAuthReturn();
  if (failed) return;
  if (!state.cloudSession) {
    try { saveCloudSession(JSON.parse(localStorage.getItem(CLOUD_SESSION_KEY))); }
    catch { saveCloudSession(null); }
  }
  const user = await loadCloudUser();
  if (!user) {
    if (returningFromEmail) showAuthReturnScreen("error", "没有成功确认账号，请重新发送登录链接。");
    return;
  }
  await switchWorkspace(userWorkspaceId(user.id));
  if (arrivedFromEmail) closeWelcomeAfterAuthentication();
  clearInterval(state.cloudPollTimer);
  state.cloudPollTimer = window.setInterval(() => syncCloud(), 30000);
  await syncCloud({ notify: arrivedFromEmail });
  await refreshMigrationOffer({ prompt: true });
  await subscribeCloudRealtime();
}

function cleanAuthRedirectUrl() {
  const redirectUrl = new URL(location.href);
  redirectUrl.search = "";
  redirectUrl.hash = "";
  return redirectUrl.toString();
}

function mailboxUrl(email) {
  const domain = email.split("@")[1]?.toLowerCase() || "";
  if (["gmail.com", "googlemail.com"].includes(domain)) return "https://mail.google.com/";
  if (["outlook.com", "hotmail.com", "live.com"].includes(domain)) return "https://outlook.live.com/mail/";
  if (["qq.com", "foxmail.com"].includes(domain)) return "https://mail.qq.com/";
  if (domain === "163.com") return "https://mail.163.com/";
  if (domain === "126.com") return "https://mail.126.com/";
  if (["icloud.com", "me.com", "mac.com"].includes(domain)) return "https://www.icloud.com/mail/";
  return "";
}

async function sendMagicLink(email, feedback = {}) {
  if (!email) {
    if (feedback.failure) feedback.failure("请输入邮箱地址");
    return;
  }
  if (feedback.pending) feedback.pending();
  saveAuthReturnState();
  const redirectTo = cleanAuthRedirectUrl();
  const client = cloudAuthClient();
  if (!client) {
    if (feedback.failure) feedback.failure("登录服务暂时没有准备好，请刷新页面后重试");
    return;
  }
  let timeoutId;
  let result;
  try {
    result = await Promise.race([
      client.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
      }),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error("timeout")), 15000);
      }),
    ]);
  } catch (error) {
    if (feedback.failure) feedback.failure(error.message === "timeout" ? "发送时间有点久，请检查网络后重试" : "邮件发送失败，请稍后重试");
    return;
  } finally {
    clearTimeout(timeoutId);
  }
  const { error } = result;
  if (!error) {
    rememberLoginEmail(email);
    if (feedback.success) feedback.success();
  } else {
    const limited = error.status === 429 || /rate|limit/i.test(error.message || "");
    if (feedback.failure) feedback.failure(limited ? "发送得太频繁了，请稍等一分钟再试" : "邮件发送失败，请稍后重试");
  }
}

async function signInWithGoogle(button) {
  const client = cloudAuthClient();
  if (!client) return showToast("云端登录组件还没有准备好");
  saveAuthReturnState();
  button.disabled = true;
  const { error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: cleanAuthRedirectUrl() },
  });
  if (error) {
    button.disabled = false;
    showToast("Google 登录暂时不可用，请改用邮箱登录");
  }
}

async function requestMagicLink(event) {
  event.preventDefault();
  const email = elements.syncEmailInput.value.trim();
  await sendMagicLink(email, {
    pending: () => { elements.syncStatusDetail.textContent = "正在发送登录邮件…"; },
    success: () => {
      elements.syncStatusTitle.textContent = "登录链接已发送";
      elements.syncStatusDetail.textContent = "打开邮件中的链接，即可回到 Later Space 完成登录";
      if (elements.syncMailLink) elements.syncMailLink.hidden = false;
    },
    failure: () => {
      elements.syncStatus.classList.add("is-error");
      elements.syncStatusDetail.textContent = "邮件发送失败，请稍后重试";
    },
  });
}

async function requestWelcomeMagicLink(event) {
  event.preventDefault();
  const button = elements.welcomeLoginForm.querySelector('button[type="submit"]');
  if (button.dataset.action === "open-mail") {
    if (button.dataset.mailboxUrl) window.open(button.dataset.mailboxUrl, "_blank", "noopener,noreferrer");
    else showToast("请打开你的邮箱，点击 Later Space 登录链接");
    return;
  }
  const email = elements.welcomeEmailInput.value.trim();
  await sendMagicLink(email, {
    pending: () => {
      button.disabled = true;
      button.textContent = "正在发送登录邮件…";
    },
    success: () => {
      button.disabled = false;
      button.dataset.action = "open-mail";
      button.dataset.mailboxUrl = mailboxUrl(email);
      button.textContent = "打开邮箱查看";
      showToast("登录邮件已发送，请在邮箱中完成登录");
    },
    failure: (message = "邮件发送失败，请稍后重试") => {
      button.disabled = false;
      delete button.dataset.action;
      delete button.dataset.mailboxUrl;
      button.textContent = "登录 / 注册";
      showToast(message);
    },
  });
}

async function saveAccountProfile(event) {
  event.preventDefault();
  const name = elements.accountNameInput.value.trim();
  if (!name || !state.cloudSession?.user) return;
  const response = await cloudRequest("/auth/v1/user", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: { display_name: name } }),
  });
  if (!response.ok) return showToast("昵称保存失败，请稍后重试");
  state.cloudSession.user = await response.json();
  saveCloudSession(state.cloudSession);
  renderAccountEntry();
  showToast("昵称已更新");
}

async function signOutCloud() {
  const user = state.cloudSession?.user;
  if (user && !navigator.onLine) return showToast("请联网后再退出，避免未同步内容丢失");
  if (user) {
    const synced = await syncCloud();
    if (!synced) return showToast("还有内容没有同步，请稍后再退出");
  }
  if (state.cloudSession) await cloudRequest("/auth/v1/logout", { method: "POST" }).catch(() => {});
  saveCloudSession(null);
  clearTimeout(state.cloudSyncTimer);
  clearInterval(state.cloudPollTimer);
  unsubscribeCloudRealtime();
  if (user) await clearWorkspace(userWorkspaceId(user.id));
  await switchWorkspace(guestWorkspaceId());
  openSyncPanel();
}

function cloudRecordData(record) {
  const stored = { ...record, thumbnail: undefined, blob: undefined, workspaceId: undefined, migrationSourceId: undefined, migrationBatchId: undefined, hiddenByMigration: undefined };
  delete stored.id;
  return stored;
}

function cloudKind(record) {
  return record.kind || "image";
}

function cloudFunctionUrl(parameters = {}) {
  const url = new URL(`${cloudConfig().supabaseUrl}/functions/v1/mobile-inbox`);
  Object.entries(parameters).forEach(([key, value]) => url.searchParams.set(key, value));
  return url;
}

async function uploadCloudAsset(userId, record) {
  if (!isMediaRecord(record)) return null;
  if (record.kind === "video") throw new Error("第一版云端暂不支持视频");
  let blob = await originalBlob(record);
  if (!blob) return null;
  const input = new File([blob], record.name || "Later Space image", { type: blob.type || record.type || "image/jpeg" });
  const optimized = await optimizeImageFile(input);
  blob = optimized;
  record.type = blob.type;
  record.size = blob.size;
  record.name = optimized.name;
  await storeImageAsset(record, blob);
  const response = await fetch(cloudFunctionUrl({ mode: "asset", record_id: record.id }), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${state.cloudSession.access_token}`,
      "Content-Type": blob.type || "image/jpeg",
      "X-Later-Space-Kind": "image",
      "X-Later-Space-Name": record.name || "Later Space image",
    },
    body: blob,
  });
  if (!response.ok) throw new Error(await response.text() || "图片上传失败");
  return response.json();
}

async function discardCloudAsset(assetPath, assetBytes) {
  if (!assetPath || !assetBytes) return;
  await fetch(cloudFunctionUrl({ mode: "discard" }), {
    method: "POST",
    headers: { Authorization: `Bearer ${state.cloudSession.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ assetPath, assetBytes }),
  });
}

async function downloadCloudAsset(path) {
  const response = await cloudRequest(`/storage/v1/object/authenticated/later-space-media/${path}`);
  if (!response.ok) throw new Error("asset download failed");
  return response.blob();
}

async function upsertCloudRows(rows) {
  if (!rows.length) return;
  const response = await cloudRequest("/rest/v1/later_space_items?on_conflict=id", {
    method: "POST",
    headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows),
  });
  if (!response.ok) throw new Error(await response.text());
}

async function fetchCloudRows() {
  const response = await cloudRequest("/rest/v1/later_space_items?select=*");
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

async function applyCloudRow(row) {
  const record = { ...row.data, id: row.id, workspaceId: userWorkspaceId(row.user_id), updatedAt: row.client_updated_at };
  if (row.asset_path && isMediaRecord(record)) {
    const blob = await downloadCloudAsset(row.asset_path);
    await storeImageAsset(record, blob);
    record.thumbnail = record.kind === "video" ? await createVideoThumbnail(blob) : blob;
    record.thumbnailVersion = THUMBNAIL_VERSION;
  }
  await transact("readwrite", (store) => store.put(record));
  return record;
}

async function syncCloud({ notify = false } = {}) {
  const user = state.cloudSession?.user;
  if (!user || state.cloudSyncing || !navigator.onLine) return false;
  state.cloudSyncing = true;
  try {
    let remoteRows = await fetchCloudRows();
    const remoteById = new Map(remoteRows.map((row) => [row.id, row]));
    const deletions = cloudDeletionMap();
    const uploadRows = [];
    const uploadedAssets = [];
    const deletedAssets = [];
    for (const [id, deletedAt] of Object.entries(deletions)) {
      const remote = remoteById.get(id);
      if (!remote || deletedAt >= Number(remote.client_updated_at || 0)) {
        if (remote?.asset_path && remote?.asset_bytes) deletedAssets.push({ assetPath: remote.asset_path, assetBytes: remote.asset_bytes });
        uploadRows.push({ id, user_id: user.id, kind: remote?.kind || "text", data: remote?.data || {}, asset_path: null, asset_bytes: 0, content_hash: null, source_device_id: cloudDeviceId(), client_updated_at: deletedAt, deleted_at: new Date(deletedAt).toISOString() });
      }
    }
    for (const record of state.images) {
      const remote = remoteById.get(record.id);
      const localUpdatedAt = Number(record.updatedAt || record.createdAt || 0);
      if (!remote || localUpdatedAt > Number(remote.client_updated_at || 0)) {
        if (record.kind === "video") continue;
        const asset = isMediaRecord(record) ? await uploadCloudAsset(user.id, record) : null;
        if (asset) uploadedAssets.push({ current: asset, previous: remote ? { assetPath: remote.asset_path, assetBytes: remote.asset_bytes } : null });
        uploadRows.push({
          id: record.id,
          user_id: user.id,
          kind: cloudKind(record),
          data: cloudRecordData(record),
          asset_path: asset?.assetPath || null,
          asset_bytes: asset?.assetBytes || 0,
          content_hash: asset?.contentHash || null,
          source_device_id: cloudDeviceId(),
          client_updated_at: localUpdatedAt,
          deleted_at: null,
        });
      }
    }
    try {
      await upsertCloudRows(uploadRows);
    } catch (error) {
      await Promise.all(uploadedAssets.map(({ current }) => discardCloudAsset(current.assetPath, current.assetBytes)));
      throw error;
    }
    await Promise.all(uploadedAssets
      .filter(({ current, previous }) => previous?.assetPath && previous.assetPath !== current.assetPath)
      .map(({ previous }) => discardCloudAsset(previous.assetPath, previous.assetBytes)));
    await Promise.all(deletedAssets.map(({ assetPath, assetBytes }) => discardCloudAsset(assetPath, assetBytes)));
    Object.keys(deletions).forEach((id) => {
      if (uploadRows.some((row) => row.id === id && row.deleted_at)) delete deletions[id];
    });
    saveCloudDeletionMap(deletions);
    if (uploadRows.length) remoteRows = await fetchCloudRows();
    const localById = new Map(state.images.map((record) => [record.id, record]));
    for (const row of remoteRows) {
      const local = localById.get(row.id);
      const localUpdatedAt = Number(local?.updatedAt || local?.createdAt || 0);
      if (Number(row.client_updated_at || 0) < localUpdatedAt) continue;
      if (Number(row.client_updated_at || 0) === localUpdatedAt && !row.deleted_at) continue;
      if (row.deleted_at) {
        await transact("readwrite", (store) => store.delete(row.id));
        await transactAsset("readwrite", (store) => store.delete(row.id));
        localById.delete(row.id);
      } else {
        localById.set(row.id, await applyCloudRow(row));
      }
    }
    state.images = [...localById.values()].sort((left, right) => left.createdAt - right.createdAt);
    state.cloudLastSyncAt = Date.now();
    await loadCloudUsage();
    renderCloudUsage();
    notifyCloudUsage();
    await finalizePendingMigration(user.id);
    render();
    if (notify) showToast("多设备画布已同步");
    return true;
  } catch (error) {
    console.warn("Cloud sync unavailable", error);
    if (notify) showToast("云端暂时不可用，本地收藏不受影响");
    return false;
  } finally {
    state.cloudSyncing = false;
    if (!elements.syncPanel.hidden) openSyncPanel();
  }
}

async function syncNow() {
  const user = state.cloudSession?.user;
  if (!user) return;
  clearInterval(state.cloudPollTimer);
  state.cloudPollTimer = window.setInterval(() => syncCloud(), 30000);
  showToast("正在同步多设备画布…");
  await syncCloud({ notify: true });
}

function scheduleCloudSync() {
  if (!state.cloudSession?.user) return;
  clearTimeout(state.cloudSyncTimer);
  state.cloudSyncTimer = setTimeout(() => syncCloud(), 1200);
}

async function openSyncPanel() {
  elements.syncPanel.hidden = false;
  elements.storagePanel.hidden = true;
  elements.syncStatus.className = "sync-status";
  if (!cloudConfigured()) {
    elements.syncStatusTitle.textContent = "当前为本地模式";
    elements.syncStatusDetail.textContent = "云端同步尚未配置";
    elements.syncLoginForm.hidden = true;
    elements.syncActions.hidden = true;
    return;
  }
  const user = state.cloudSession?.user;
  if (!user) {
    elements.syncPanel.hidden = true;
    showWelcomeScreen();
    return;
  }
  if (user) {
    await loadCloudUsage();
    await loadCaptureTokenState();
  } else {
    state.captureToken = null;
    elements.captureTokenActions.hidden = true;
    elements.captureTokenStatus.textContent = "登录后生成你的专属收件地址";
  }
  renderCloudUsage();
  const migration = user ? readCloudMigration(user.id) : null;
  elements.undoMigrationButton.hidden = migration?.status !== "complete" || Date.now() - Number(migration.completedAt || 0) > 30 * 24 * 60 * 60 * 1000;
  elements.syncLoginForm.hidden = true;
  if (elements.syncMailLink) elements.syncMailLink.hidden = true;
  elements.syncActions.hidden = false;
  elements.syncStatus.classList.toggle("is-ready", Boolean(user));
  elements.syncStatusTitle.textContent = "多设备同步已开启";
  elements.syncStatusDetail.textContent = `${user.email} · ${state.cloudLastSyncAt ? `最近同步 ${new Date(state.cloudLastSyncAt).toLocaleTimeString("zh-CN")}` : "等待首次同步"}`;
  await refreshMigrationOffer();
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

async function importExtensionCapture(capture) {
  if (!capture || capture.source !== "chrome-extension") return { state: "invalid" };
  if (capture.kind === "image" && capture.imageData) {
    const blob = dataUrlToBlob(capture.imageData);
    const fingerprint = await blobFingerprint(blob);
    const duplicate = state.images.find((record) => isMediaRecord(record) && record.fingerprint === fingerprint);
    if (duplicate) return { state: "duplicate", recordIds: [duplicate.id] };
    const file = new File([blob], capture.name || "网页图片.jpg", { type: capture.mimeType || blob.type || "image/jpeg" });
    const records = await saveFiles([file], "chrome-extension", screenCenter(), capture.purpose || "", [], false);
    return { state: records.length ? "saved" : "duplicate", recordIds: records.map((record) => record.id) };
  }
  if (capture.kind === "link" && capture.url) {
    const canonical = canonicalUrl(capture.url);
    const duplicate = state.images.find((record) => record.kind === "link" && canonicalUrl(record.url) === canonical);
    if (duplicate) return { state: "duplicate", recordIds: [duplicate.id] };
    const records = await saveLinks([capture.url], capture.title || capture.url, capture.purpose || "", capture.title || "", screenCenter(), [], false);
    return { state: records.length ? "saved" : "duplicate", recordIds: records.map((record) => record.id) };
  }
  if (capture.kind === "text" && capture.text) {
    const fingerprint = normalizedTextFingerprint(capture.text);
    const duplicate = state.images.find((record) => record.kind === "text" && normalizedTextFingerprint(record.text) === fingerprint);
    if (duplicate) return { state: "duplicate", recordIds: [duplicate.id] };
    const record = await saveText(capture.text, screenCenter(), [], false);
    return { state: record ? "saved" : "duplicate", recordIds: record ? [record.id] : [] };
  }
  return { state: "invalid" };
}

async function undoExtensionCapture(recordIds) {
  const ids = new Set(recordIds || []);
  const records = state.images.filter((record) => ids.has(record.id));
  if (!records.length) return { state: "unavailable" };
  const cloudDeletions = cloudDeletionMap();
  records.forEach((record) => { cloudDeletions[record.id] = Date.now(); });
  saveCloudDeletionMap(cloudDeletions);
  for (const record of records) {
    await transact("readwrite", (store) => store.delete(record.id));
    await transactAsset("readwrite", (store) => store.delete(record.id));
    if (state.objectUrls.has(record.id)) URL.revokeObjectURL(state.objectUrls.get(record.id));
    if (state.assetUrls.has(record.id)) URL.revokeObjectURL(state.assetUrls.get(record.id));
    state.objectUrls.delete(record.id);
    state.assetUrls.delete(record.id);
    state.expandedTextIds.delete(record.id);
  }
  state.images = state.images.filter((record) => !ids.has(record.id));
  state.selectedId = null;
  state.selectedIds.clear();
  render();
  scheduleBackup();
  scheduleCloudSync();
  return { state: "undone" };
}

function bindExtensionBridge() {
  window.addEventListener("message", async (event) => {
    if (event.source !== window || event.origin !== location.origin) return;
    if (event.data?.source !== "later-space-extension" || !["capture", "status", "undo", "view", "auth"].includes(event.data?.type)) return;
    const user = state.cloudSession?.user;
    const destination = user
      ? { label: `${user.email} · 云端同步已开启`, email: user.email, synced: true }
      : { label: "当前浏览器 · 本地保存", email: null, synced: false };
    if (event.data.type === "auth") {
      window.postMessage({
        source: "later-space-page",
        requestId: event.data.requestId,
        result: state.cloudSession?.access_token
          ? { state: "auth", session: state.cloudSession }
          : { state: "unauthenticated" },
      }, location.origin);
      return;
    }
    if (event.data.type === "status") {
      window.postMessage({ source: "later-space-page", requestId: event.data.requestId, result: { state: "ready", destination } }, location.origin);
      return;
    }
    if (event.data.type === "undo") {
      const result = await undoExtensionCapture(event.data.capture?.recordIds);
      window.postMessage({ source: "later-space-page", requestId: event.data.requestId, result }, location.origin);
      return;
    }
    if (event.data.type === "view") {
      const record = state.images.find((item) => event.data.capture?.recordIds?.includes(item.id));
      const result = revealRecord(record, "已定位到刚刚加入的内容") ? { state: "viewed" } : { state: "unavailable" };
      window.postMessage({ source: "later-space-page", requestId: event.data.requestId, result }, location.origin);
      return;
    }
    let result;
    try {
      result = await importExtensionCapture(event.data.capture);
    } catch {
      result = { state: "unavailable" };
    }
    window.postMessage({ source: "later-space-page", requestId: event.data.requestId, result: { ...result, destination } }, location.origin);
  });
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
  if (!isImageRecord(record)) return;
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
  if (!record || !isImageRecord(record)) return;
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
  elements.welcomeLoginForm.addEventListener("submit", requestWelcomeMagicLink);
  elements.welcomeGoogleButton.addEventListener("click", () => signInWithGoogle(elements.welcomeGoogleButton));
  elements.welcomeEmailInput.addEventListener("focus", showWelcomeEmailSuggestion);
  elements.welcomeEmailInput.addEventListener("input", showWelcomeEmailSuggestion);
  elements.welcomeEmailInput.addEventListener("blur", () => setTimeout(() => { elements.welcomeEmailSuggestion.hidden = true; }, 120));
  elements.welcomeEmailSuggestion.addEventListener("mousedown", (event) => event.preventDefault());
  elements.welcomeEmailSuggestion.addEventListener("click", chooseWelcomeEmailSuggestion);
  elements.welcomeGuestButton.addEventListener("click", closeWelcomeScreen);
  elements.closeWelcomeButton.addEventListener("click", closeWelcomeScreen);
  elements.welcomeScreen.addEventListener("click", (event) => {
    if (event.target === elements.welcomeScreen) closeWelcomeScreen();
  });
  elements.authReturnRetryButton.addEventListener("click", () => {
    elements.authReturnScreen.hidden = true;
    state.authReturnActive = false;
    showWelcomeScreen();
  });
  elements.closeCanvasGuideButton.addEventListener("click", finishCanvasGuide);
  elements.accountButton.addEventListener("click", () => {
    if (state.cloudSession?.user) openSyncPanel();
    else showWelcomeScreen();
  });
  elements.syncGoogleButton.addEventListener("click", () => signInWithGoogle(elements.syncGoogleButton));
  elements.accountMigrationButton.addEventListener("click", openMigrationDialog);
  elements.closeMigrationButton.addEventListener("click", closeMigrationDialog);
  elements.migrationBackdrop.addEventListener("click", closeMigrationDialog);
  elements.deferMigrationButton.addEventListener("click", deferGuestMigration);
  elements.startMigrationButton.addEventListener("click", confirmGuestMigration);
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
  [elements.typeFilter, elements.sourceFilter, elements.purposeFilter, elements.timeFilter].forEach((select) => select.addEventListener("change", updateFilters));
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
  elements.globalTextButtons.forEach((button) => button.addEventListener("click", () => {
    setAllTextThemes(button.dataset.globalTextTheme);
  }));
  elements.fileInput.addEventListener("change", () => {
    if (elements.fileInput.files.length) {
      saveFiles(elements.fileInput.files, "upload", buttonCenter(elements.addButton), "", currentCanvasTags([...state.captureTags]));
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
  elements.syncLoginForm.addEventListener("submit", requestMagicLink);
  elements.accountProfile.addEventListener("submit", saveAccountProfile);
  elements.signOutButton.addEventListener("click", signOutCloud);
  elements.syncNowButton.addEventListener("click", syncNow);
  elements.undoMigrationButton?.addEventListener("click", () => {
    const user = state.cloudSession?.user;
    if (user) undoGuestMigration(user.id);
  });
  elements.createCaptureTokenButton?.addEventListener("click", createCaptureToken);
  elements.createAgentTokenButton?.addEventListener("click", createAgentToken);
  elements.copyCaptureUrlButton?.addEventListener("click", copyPersonalCaptureUrl);
  elements.revokeCaptureTokenButton?.addEventListener("click", stopCaptureToken);
  elements.mobileAddButton?.addEventListener("click", openCapture);
  elements.mobileSyncButton?.addEventListener("click", openSyncPanel);
  elements.mobileCanvasButton?.addEventListener("click", () => {
    document.body.classList.toggle("mobile-show-canvas");
    elements.mobileCanvasButton.textContent = document.body.classList.contains("mobile-show-canvas") ? "返回收件箱" : "打开画布";
    if (document.body.classList.contains("mobile-show-canvas")) fitAll();
  });
  elements.mobileInboxList?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-mobile-record-id]");
    if (!button) return;
    const record = state.images.find((entry) => entry.id === button.dataset.mobileRecordId);
    if (!record) return;
    if (record.kind === "link" && record.url) window.open(record.url, "_blank", "noopener,noreferrer");
    else {
      document.body.classList.add("mobile-show-canvas");
      elements.mobileCanvasButton.textContent = "返回收件箱";
      state.selectedId = record.id;
      fitAll();
      render();
    }
  });
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
    const target = currentCanvasTarget();
    if (target.value !== "all") showToast(target.value === "inbox" ? "已进入未整理子画布" : `已进入「${target.label}」子画布`);
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
  elements.canvas.addEventListener("click", (event) => {
    const open = event.target.closest("[data-open-long-text]");
    if (open) {
      const record = state.images.find((entry) => entry.id === open.closest(".canvas-item")?.dataset.id);
      if (record && !state.expandedTextIds.has(record.id)) toggleTextCard(record);
      return;
    }
    const toggle = event.target.closest("[data-toggle-long-text]");
    if (toggle) {
      const record = state.images.find((entry) => entry.id === toggle.closest(".canvas-item")?.dataset.id);
      if (record) toggleTextCard(record);
      return;
    }
  });
  elements.canvas.addEventListener("dblclick", (event) => {
    if (event.target.closest(".canvas-item, button, a, input, textarea, select, label")) return;
    if (!state.expandedTextIds.size) return;
    state.expandedTextIds.clear();
    state.selectedId = null;
    state.selectedIds.clear();
    render();
  });
  elements.canvas.addEventListener("wheel", (event) => {
    if (event.target.closest(".text-card-item.is-expanded .long-text-full")) return;
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
    if (files.length) { event.preventDefault(); saveFiles(files, "paste", screenCenter(), "", currentCanvasTags()); }
    else if (urls.length) { event.preventDefault(); saveLinks(urls, text, "", "", screenCenter(), currentCanvasTags()); }
    else if (text.trim()) { event.preventDefault(); saveText(text.trim(), screenCenter(), currentCanvasTags()); }
  });

  window.addEventListener("keydown", (event) => {
    const isEditing = event.target.matches?.("input, textarea, [contenteditable='true']");
    const selectedRecord = state.images.find((record) => record.id === state.selectedId);
    if (!isEditing && !event.shiftKey && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z" && state.deletionUndoSnapshot) {
      event.preventDefault();
      undoDeletion();
      return;
    }
    if (!isEditing && event.key.toLowerCase() === "c" && (event.metaKey || event.ctrlKey) && selectedRecord && isImageRecord(selectedRecord)) {
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
    else if (event.key === "Escape" && !elements.migrationDialog.hidden) closeMigrationDialog();
    else if (event.key === "Escape" && !elements.batchDialog.hidden) closeBatchEditor();
    else if (event.key === "Escape" && !elements.duplicateDialog.hidden) closeDuplicatePrompt(false);
    else if (event.key === "Escape" && !elements.cropDialog.hidden) closeCropEditor();
    else if (event.key === "Escape" && !elements.captureDialog.hidden) closeCapture();
    else if (event.key === "Escape" && !elements.filterPanel.hidden) {
      elements.filterPanel.hidden = true;
      elements.filterToggleButton.setAttribute("aria-expanded", "false");
      renderFilterControls();
    }
    else if (event.key === "Escape" && state.expandedTextIds.size) { state.expandedTextIds.clear(); render(); }
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
    saveFiles(event.dataTransfer.files, "drop", { x: event.clientX, y: event.clientY }, "", currentCanvasTags());
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
    }
    bindEvents();
    updateView();
    await loadImages();
    bindExtensionBridge();
    try {
      await initializeCloud();
    } catch (error) {
      console.error("Cloud initialization failed", error);
      showToast("云端同步暂时不可用，本地画布仍可使用");
    }
    showInitialWelcome();
    renderAccountEntry();
    if (new URLSearchParams(location.search).get("extension") === "connect") {
      openSyncPanel();
    }
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
    window.addEventListener("online", () => syncCloud());
    window.addEventListener("focus", () => syncCloud());
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) syncCloud();
    });
  } catch (error) {
    console.error(error);
    showToast("画布打开失败，请刷新重试");
  }
}

init();
