(() => {
try { globalThis.__laterSpaceFeedbackCleanup?.(); } catch {}

let contextImage = { url: "" };
let selectionButton = null;
let imageButton = null;
let floatingButtonElement = null;
let selectionTimer = null;
let selectingWithPointer = false;
const SELECTION_BUTTON_DELAY_MS = 10;
const SELECTION_SAVED_HOLD_MS = 1400;
const SELECTION_SAVED_FADE_MS = 220;
const FLOATING_BUTTON_SIZE = 30;
const FLOATING_BUTTON_GAP = 6;
const VIEWPORT_GUTTER = 8;
const IMAGE_HOVER_HOSTS = /(^|\.)((xiaohongshu\.com)|(x\.com)|(twitter\.com)|(google\.[a-z.]+)|(bing\.com)|(pinterest\.(com|co\.[a-z]+))|(reddit\.com))$/i;
const listenerController = new AbortController();
const listenerOptions = { signal: listenerController.signal };
globalThis.__laterSpaceFeedbackCleanup = () => {
  listenerController.abort();
  try { chrome.runtime.onMessage.removeListener(receiveRuntimeMessage); } catch {}
  clearTimeout(selectionTimer);
  document.querySelectorAll("[data-later-space-floating], #later-space-feedback").forEach((node) => node.remove());
};

function sendRuntimeMessage(message) {
  try {
    if (!chrome.runtime?.id) return Promise.resolve({ state: "unavailable" });
    return chrome.runtime.sendMessage(message).catch(() => ({ state: "unavailable" }));
  } catch {
    return Promise.resolve({ state: "unavailable" });
  }
}

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
}, { capture: true, signal: listenerController.signal });
document.addEventListener("contextmenu", rememberContextImage, { capture: true, signal: listenerController.signal });

function selectionMark() {
  const mark = document.createElement("span");
  mark.dataset.laterSpaceSelectionMark = "plus";
  mark.style.cssText = "position:relative;width:14px;height:14px;display:block;pointer-events:none";
  const horizontal = document.createElement("i");
  const vertical = document.createElement("i");
  horizontal.style.cssText = "position:absolute;left:1px;top:6px;width:12px;height:2px;border-radius:2px;background:#718e64;pointer-events:none";
  vertical.style.cssText = "position:absolute;left:6px;top:1px;width:2px;height:12px;border-radius:2px;background:#718e64;pointer-events:none";
  mark.append(horizontal, vertical);
  return mark;
}

function setSelectionButtonSaved(button) {
  const mark = button.querySelector("[data-later-space-selection-mark]");
  if (!mark) return;
  mark.dataset.laterSpaceSelectionMark = "saved";
  mark.replaceChildren();
  mark.textContent = "✓";
  mark.style.cssText = "width:16px;height:16px;display:grid;place-items:center;color:#fff;font:700 15px/16px -apple-system,BlinkMacSystemFont,sans-serif;pointer-events:none";
  button.style.background = "#718e64";
  button.style.borderColor = "#718e64";
}

function setSelectionButtonHover(button, active) {
  button.style.setProperty("background", active ? "#8faa80" : "#fff", "important");
  button.style.setProperty("border-color", active ? "#8faa80" : "#d9ded5", "important");
  button.querySelectorAll("i").forEach((bar) => { bar.style.background = active ? "#fff" : "#718e64"; });
}

function floatingButton(label, kind = "image") {
  document.querySelectorAll("[data-later-space-floating]").forEach((node) => node.remove());
  selectionButton = null;
  imageButton = null;
  floatingButtonElement = null;
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.laterSpaceFloating = "true";
  button.setAttribute("aria-label", label);
  const isSelection = kind === "selection";
  if (isSelection) button.append(selectionMark());
  else button.innerHTML = `<svg viewBox="0 0 128 128" width="22" height="22" aria-hidden="true"><path d="M28 37v54c0 7 5 12 12 12h54" fill="none" stroke="#1c1c1e" stroke-width="15" stroke-linecap="square"/><rect x="62" y="24" width="39" height="45" rx="7" fill="#a8c49a" transform="rotate(7 81.5 46.5)"/></svg>`;
  button.style.cssText = isSelection
    ? "position:fixed;z-index:2147483646;width:28px;height:28px;display:grid;place-items:center;padding:0;border:1px solid #d9ded5;border-radius:50%;background:#fff;box-shadow:0 5px 13px rgba(66,85,58,.13);cursor:pointer;transition:transform .14s ease,opacity .22s ease,background .14s ease,box-shadow .14s ease,border-color .14s ease"
    : "position:fixed;z-index:2147483646;width:30px;height:30px;display:grid;place-items:center;padding:0;border:1px solid #d8d8d2;border-radius:8px;background:#f8f7f2;box-shadow:0 5px 14px rgba(37,38,49,.11);cursor:pointer;transition:transform .14s ease,background .14s ease,box-shadow .14s ease";
  button.addEventListener("mouseenter", () => {
    if (button.disabled) return;
    button.style.transform = "translateY(-1px) scale(1.06)";
    if (isSelection) setSelectionButtonHover(button, true);
    else button.style.background = "#ffffff";
    button.style.boxShadow = "0 7px 18px rgba(37,38,49,.15)";
  });
  button.addEventListener("mouseleave", () => {
    button.style.transform = "";
    if (button.disabled) return;
    if (isSelection) setSelectionButtonHover(button, false);
    else button.style.background = "#f8f7f2";
    button.style.boxShadow = isSelection ? "0 5px 13px rgba(66,85,58,.13)" : "0 5px 14px rgba(37,38,49,.11)";
  });
  button.addEventListener("pointerdown", () => { globalThis.laterSpaceSound?.prepare(); button.style.transform = "translateY(-1px) scale(.96)"; });
  button.addEventListener("pointerup", () => { button.style.transform = "translateY(-1px)"; });
  document.documentElement.append(button);
  floatingButtonElement = button;
  return button;
}

function removeFloatingButton(button = floatingButtonElement) {
  button?.remove();
  if (floatingButtonElement === button) floatingButtonElement = null;
  if (selectionButton === button) selectionButton = null;
  if (imageButton === button) imageButton = null;
}

function removeSelectionButton() {
  clearTimeout(selectionTimer);
  selectionTimer = null;
  if (selectionButton?.disabled) return;
  removeFloatingButton(selectionButton);
}

function lastVisibleSelectionRect(range) {
  const rects = Array.from(range.getClientRects()).filter((rect) => rect.width || rect.height);
  return rects.at(-1) || range.getBoundingClientRect();
}

function positionSelectionButton(button, rect) {
  const preferredLeft = rect.right + FLOATING_BUTTON_GAP;
  const preferredTop = rect.bottom + FLOATING_BUTTON_GAP;
  const left = preferredLeft + FLOATING_BUTTON_SIZE <= innerWidth - VIEWPORT_GUTTER
    ? preferredLeft
    : Math.max(VIEWPORT_GUTTER, rect.right - FLOATING_BUTTON_SIZE);
  const top = preferredTop + FLOATING_BUTTON_SIZE <= innerHeight - VIEWPORT_GUTTER
    ? preferredTop
    : Math.max(VIEWPORT_GUTTER, rect.top - FLOATING_BUTTON_SIZE - FLOATING_BUTTON_GAP);
  button.style.left = `${left}px`;
  button.style.top = `${top}px`;
}

function scheduleSelectionButton() {
  clearTimeout(selectionTimer);
  if (getSelection()?.toString().trim()) {
    removeFloatingButton(imageButton);
  }
  if (selectingWithPointer) return;
  selectionTimer = setTimeout(() => {
    const selection = getSelection();
    const text = selection?.toString().trim();
    if (!text || selection.rangeCount !== 1 || selection.isCollapsed) return removeSelectionButton();
    const rect = lastVisibleSelectionRect(selection.getRangeAt(0));
    if (!rect.width && !rect.height) return removeSelectionButton();
    removeSelectionButton();
    removeFloatingButton(imageButton);
    selectionButton = floatingButton("加入 Later Space", "selection");
    selectionButton.dataset.laterSpaceKind = "selection";
    positionSelectionButton(selectionButton, rect);
    selectionButton.addEventListener("mousedown", (event) => event.preventDefault());
    selectionButton.addEventListener("click", async () => {
      const savedButton = selectionButton;
      savedButton.disabled = true;
      setSelectionButtonSaved(savedButton);
      await Promise.all([
        sendRuntimeMessage({ type: "capture-selection", text }),
        new Promise((resolve) => setTimeout(resolve, SELECTION_SAVED_HOLD_MS)),
      ]);
      savedButton.style.opacity = "0";
      savedButton.style.transform = "scale(.86)";
      await new Promise((resolve) => setTimeout(resolve, SELECTION_SAVED_FADE_MS));
      removeFloatingButton(savedButton);
      selection.removeAllRanges();
    });
  }, SELECTION_BUTTON_DELAY_MS);
}

document.addEventListener("pointerdown", (event) => {
  if (event.button !== 0 || event.target.closest?.("#later-space-feedback, [data-later-space-floating]")) return;
  selectingWithPointer = true;
  removeSelectionButton();
  removeFloatingButton(imageButton);
}, { capture: true, signal: listenerController.signal });
document.addEventListener("pointerup", (event) => {
  if (event.button !== 0) return;
  selectingWithPointer = false;
  scheduleSelectionButton();
}, { capture: true, signal: listenerController.signal });
document.addEventListener("pointercancel", () => {
  selectingWithPointer = false;
  scheduleSelectionButton();
}, { capture: true, signal: listenerController.signal });
document.addEventListener("selectionchange", scheduleSelectionButton, listenerOptions);

document.addEventListener("pointermove", (event) => {
  if (!IMAGE_HOVER_HOSTS.test(location.hostname)) return;
  if (getSelection()?.toString().trim() || selectionButton) {
    removeFloatingButton(imageButton);
    return;
  }
  const image = findImage(event.target, event.clientX, event.clientY);
  const rect = image?.element.getBoundingClientRect();
  if (!image || !rect || rect.width < 120 || rect.height < 120) {
    if (imageButton && !imageButton.matches(":hover")) removeFloatingButton(imageButton);
    return;
  }
  const key = `${image.url}|${Math.round(rect.x)}|${Math.round(rect.y)}`;
  if (imageButton?.dataset.imageKey === key) return;
  removeFloatingButton(imageButton);
  imageButton = floatingButton("收藏这张图片到 Later Space");
  imageButton.dataset.laterSpaceKind = "image";
  imageButton.dataset.imageKey = key;
  imageButton.style.left = `${Math.min(innerWidth - 38, Math.max(8, rect.right - 38))}px`;
  imageButton.style.top = `${Math.min(innerHeight - 38, Math.max(8, rect.top + 8))}px`;
  const payload = { url: image.url, rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, viewport: { width: innerWidth, height: innerHeight } };
  imageButton.addEventListener("click", async () => {
    imageButton.disabled = true;
    await sendRuntimeMessage({ type: "capture-image", image: payload });
    removeFloatingButton(imageButton);
  });
}, { passive: true, capture: true, signal: listenerController.signal });

function showFeedback(message) {
  if (message.playSound !== false) globalThis.laterSpaceSound?.play(message.state);
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
    view.innerHTML = '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M6 14 14 6M8 6h6v6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    view.setAttribute("aria-label", "查看刚刚加入的内容");
    view.style.cssText = "width:28px;height:28px;display:grid;place-items:center;padding:0;border:1px solid rgba(25,25,27,.11);border-radius:7px;background:#fafaf8;color:#202124;cursor:pointer";
    view.addEventListener("click", () => sendRuntimeMessage({ type: "view-capture", recordIds: message.recordIds }));
    actions.append(view);
  }
  if (message.undoToken) {
    const undo = document.createElement("button");
    undo.type = "button";
    undo.textContent = "撤销";
    undo.style.cssText = "padding:0;border:0;background:transparent;color:#6f6e69;font:10px/1.4 -apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif;cursor:pointer";
    undo.addEventListener("click", async () => {
      undo.disabled = true;
      const result = await sendRuntimeMessage({ type: "undo-capture", token: message.undoToken });
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

function receiveRuntimeMessage(message, _sender, sendResponse) {
  if (message.type === "later-space-feedback") showFeedback(message);
  if (message.type === "later-space-context-image") {
    sendResponse({ image: contextImage?.rect ? contextImage : imageAtViewportCenter() });
    return false;
  }
  return undefined;
}
chrome.runtime.onMessage.addListener(receiveRuntimeMessage);
})();
