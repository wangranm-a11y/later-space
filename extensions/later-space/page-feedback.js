let contextImage = { url: "" };
let selectionButton = null;
let imageButton = null;
let selectionTimer = null;
let selectingWithPointer = false;

function backgroundImageUrl(element) {
  const value = getComputedStyle(element).backgroundImage;
  const match = value && value !== "none" ? value.match(/^url\(["']?(.*?)["']?\)$/) : null;
  return match?.[1] || "";
}

function findImage(target, clientX, clientY) {
  const candidates = [];
  const seen = new Set();
  for (const origin of [...document.elementsFromPoint(clientX, clientY), target]) {
    let element = origin;
    for (let depth = 0; element && element !== document.documentElement && depth < 8; depth += 1) {
      if (!seen.has(element)) {
        seen.add(element);
        candidates.push(element);
      }
      element = element.parentElement;
    }
  }
  for (const element of candidates) {
    if (element instanceof HTMLImageElement) return { url: element.currentSrc || element.src, element };
    const nestedImage = element.querySelector?.(":scope > img, :scope > picture img");
    if (nestedImage) return { url: nestedImage.currentSrc || nestedImage.src, element: nestedImage };
    const background = backgroundImageUrl(element);
    if (background) return { url: background, element };
  }
  return null;
}

function rememberContextImage(event) {
  const image = findImage(event.target, event.clientX, event.clientY);
  const rect = image?.element.getBoundingClientRect();
  contextImage = image && rect?.width > 0 && rect?.height > 0 ? {
    url: image.url,
    rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    viewport: { width: innerWidth, height: innerHeight },
  } : { url: "" };
  chrome.runtime.sendMessage({ type: "context-image", image: contextImage }).catch(() => {});
}

function imageAtViewportCenter() {
  const image = findImage(document.elementFromPoint(innerWidth / 2, innerHeight / 2), innerWidth / 2, innerHeight / 2);
  const rect = image?.element.getBoundingClientRect();
  return image && rect?.width > 0 && rect?.height > 0 ? {
    url: image.url,
    rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    viewport: { width: innerWidth, height: innerHeight },
  } : contextImage;
}

document.addEventListener("pointerdown", (event) => {
  if (event.button === 2) rememberContextImage(event);
}, true);
document.addEventListener("contextmenu", rememberContextImage, true);

function floatingButton(label) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.laterSpaceFloating = "true";
  button.setAttribute("aria-label", label);
  button.innerHTML = `<svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"><rect x="3" y="3" width="11" height="11" rx="2.5" fill="#1d1d1f"/><rect x="10" y="10" width="11" height="11" rx="2.5" fill="#a7add8"/></svg>`;
  button.style.cssText = "position:fixed;z-index:2147483646;width:30px;height:30px;display:grid;place-items:center;padding:0;border:1px solid rgba(25,25,27,.13);border-radius:8px;background:#fff;box-shadow:0 6px 20px rgba(20,20,22,.16);cursor:pointer;transition:transform .14s ease,box-shadow .14s ease";
  button.addEventListener("mouseenter", () => { button.style.transform = "translateY(-1px)"; button.style.boxShadow = "0 8px 24px rgba(20,20,22,.2)"; });
  button.addEventListener("mouseleave", () => { button.style.transform = ""; button.style.boxShadow = "0 6px 20px rgba(20,20,22,.16)"; });
  document.documentElement.append(button);
  return button;
}

function removeSelectionButton() {
  clearTimeout(selectionTimer);
  selectionTimer = null;
  selectionButton?.remove();
  selectionButton = null;
}

function scheduleSelectionButton() {
  clearTimeout(selectionTimer);
  if (selectingWithPointer) return;
  selectionTimer = setTimeout(() => {
    const selection = getSelection();
    const text = selection?.toString().trim();
    if (!text || selection.rangeCount === 0) return removeSelectionButton();
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    if (!rect.width && !rect.height) return removeSelectionButton();
    removeSelectionButton();
    selectionButton = floatingButton("加入 Later Space");
    selectionButton.style.left = `${Math.min(innerWidth - 38, Math.max(8, rect.right + 7))}px`;
    selectionButton.style.top = `${Math.min(innerHeight - 38, Math.max(8, rect.top - 2))}px`;
    selectionButton.addEventListener("mousedown", (event) => event.preventDefault());
    selectionButton.addEventListener("click", async () => {
      selectionButton.disabled = true;
      await chrome.runtime.sendMessage({ type: "capture-selection", text }).catch(() => {});
      removeSelectionButton();
      selection.removeAllRanges();
    });
  }, 380);
}

document.addEventListener("pointerdown", (event) => {
  if (event.button !== 0 || event.target.closest?.("#later-space-feedback, [data-later-space-floating]")) return;
  selectingWithPointer = true;
  removeSelectionButton();
}, true);
document.addEventListener("pointerup", (event) => {
  if (event.button !== 0) return;
  selectingWithPointer = false;
  scheduleSelectionButton();
}, true);
document.addEventListener("pointercancel", () => {
  selectingWithPointer = false;
  scheduleSelectionButton();
}, true);
document.addEventListener("selectionchange", scheduleSelectionButton);

document.addEventListener("pointermove", (event) => {
  if (!location.hostname.includes("xiaohongshu.com")) return;
  const image = findImage(event.target, event.clientX, event.clientY);
  const rect = image?.element.getBoundingClientRect();
  if (!image || !rect || rect.width < 120 || rect.height < 120) {
    if (imageButton && !imageButton.matches(":hover")) { imageButton.remove(); imageButton = null; }
    return;
  }
  const key = `${image.url}|${Math.round(rect.x)}|${Math.round(rect.y)}`;
  if (imageButton?.dataset.imageKey === key) return;
  imageButton?.remove();
  imageButton = floatingButton("收藏这张图片到 Later Space");
  imageButton.dataset.imageKey = key;
  imageButton.style.left = `${Math.min(innerWidth - 38, Math.max(8, rect.right - 38))}px`;
  imageButton.style.top = `${Math.min(innerHeight - 38, Math.max(8, rect.top + 8))}px`;
  const payload = { url: image.url, rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, viewport: { width: innerWidth, height: innerHeight } };
  imageButton.addEventListener("click", async () => {
    imageButton.disabled = true;
    await chrome.runtime.sendMessage({ type: "capture-image", image: payload }).catch(() => {});
    imageButton?.remove();
    imageButton = null;
  });
}, { passive: true, capture: true });

function showFeedback(message) {
  document.querySelector("#later-space-feedback")?.remove();
  const toast = document.createElement("div");
  toast.id = "later-space-feedback";
  toast.style.cssText = "position:fixed;right:20px;top:20px;z-index:2147483647;display:flex;align-items:center;gap:10px;min-width:178px;max-width:340px;padding:10px 11px;border:1px solid rgba(25,25,27,.11);border-radius:9px;background:#fff;color:#202124;box-shadow:0 10px 30px rgba(20,20,22,.16);font:12px/1.4 -apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif;transform:translateY(0);opacity:1;transition:transform .18s ease-out,opacity .18s ease-out";
  const check = document.createElement("span");
  check.textContent = "✓";
  check.style.cssText = "font-size:16px;line-height:1";
  toast.append(check);
  const label = document.createElement("span");
  label.textContent = message.text;
  toast.append(label);
  const actions = document.createElement("div");
  actions.style.cssText = "display:flex;gap:8px;margin-left:auto";
  if (message.recordIds?.length) {
    const view = document.createElement("button");
    view.type = "button";
    view.textContent = "↗";
    view.setAttribute("aria-label", "查看刚刚加入的内容");
    view.style.cssText = "width:28px;height:28px;padding:0;border:1px solid rgba(25,25,27,.11);border-radius:7px;background:#fafaf8;color:#202124;font:600 16px/1 -apple-system,BlinkMacSystemFont,sans-serif;cursor:pointer";
    view.addEventListener("click", () => chrome.runtime.sendMessage({ type: "view-capture", recordIds: message.recordIds }));
    actions.append(view);
  }
  if (message.undoToken) {
    const undo = document.createElement("button");
    undo.type = "button";
    undo.textContent = "撤销";
    undo.style.cssText = "padding:0;border:0;background:transparent;color:#6f6e69;font:10px/1.4 -apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif;cursor:pointer";
    undo.addEventListener("click", async () => {
      undo.disabled = true;
      const result = await chrome.runtime.sendMessage({ type: "undo-capture", token: message.undoToken });
      label.textContent = result?.state === "undone" ? "已撤销" : result?.state === "expired" ? "撤销时间已过" : "暂时无法撤销";
      undo.remove();
      setTimeout(() => toast.remove(), 1400);
    });
    actions.append(undo);
  }
  if (actions.childElementCount) toast.append(actions);
  toast.style.transform = "translateY(-8px)";
  toast.style.opacity = "0";
  document.documentElement.append(toast);
  requestAnimationFrame(() => {
    toast.style.transform = "translateY(0)";
    toast.style.opacity = "1";
  });
  setTimeout(() => toast.remove(), message.undoToken ? 6000 : 3200);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "later-space-feedback") showFeedback(message);
  if (message.type === "later-space-context-image") {
    sendResponse({ image: contextImage?.rect ? contextImage : imageAtViewportCenter() });
    return false;
  }
  return undefined;
});
