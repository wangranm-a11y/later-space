let contextImage = { url: "" };

function backgroundImageUrl(element) {
  const value = getComputedStyle(element).backgroundImage;
  const match = value && value !== "none" ? value.match(/^url\(["']?(.*?)["']?\)$/) : null;
  return match?.[1] || "";
}

function findImage(target) {
  const candidates = [];
  for (let element = target; element && element !== document.documentElement; element = element.parentElement) {
    candidates.push(element);
    if (candidates.length >= 5) break;
  }
  for (const element of candidates) {
    if (element instanceof HTMLImageElement) return { url: element.currentSrc || element.src, element };
    const nestedImage = element.querySelector?.("img");
    if (nestedImage) return { url: nestedImage.currentSrc || nestedImage.src, element: nestedImage };
    const background = backgroundImageUrl(element);
    if (background) return { url: background, element };
  }
  return null;
}

document.addEventListener("contextmenu", (event) => {
  const image = findImage(event.target);
  const rect = image?.element.getBoundingClientRect();
  contextImage = image && rect?.width > 0 && rect?.height > 0 ? {
    url: image.url,
    rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    viewport: { width: innerWidth, height: innerHeight },
  } : { url: "" };
  chrome.runtime.sendMessage({ type: "context-image", image: contextImage }).catch(() => {});
}, true);

function showFeedback(message) {
  document.querySelector("#later-space-feedback")?.remove();
  const toast = document.createElement("div");
  toast.id = "later-space-feedback";
  toast.style.cssText = "position:fixed;right:20px;top:20px;z-index:2147483647;display:flex;align-items:center;gap:14px;max-width:340px;padding:12px 14px;border:1px solid rgba(255,255,255,.14);border-radius:10px;background:#202124;color:#f7f7f5;box-shadow:0 14px 36px rgba(0,0,0,.24);font:12px/1.4 -apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif;transform:translateY(0);opacity:1;transition:transform .18s ease-out,opacity .18s ease-out";
  const label = document.createElement("span");
  label.textContent = message.text;
  toast.append(label);
  if (message.undoToken) {
    const undo = document.createElement("button");
    undo.type = "button";
    undo.textContent = "撤销";
    undo.style.cssText = "padding:0;border:0;background:transparent;color:#adb7ff;font:inherit;font-weight:600;cursor:pointer";
    undo.addEventListener("click", async () => {
      undo.disabled = true;
      const result = await chrome.runtime.sendMessage({ type: "undo-capture", token: message.undoToken });
      label.textContent = result?.state === "undone" ? "已撤销" : "暂时无法撤销";
      undo.remove();
      setTimeout(() => toast.remove(), 1400);
    });
    toast.append(undo);
  }
  toast.style.transform = "translateY(-8px)";
  toast.style.opacity = "0";
  document.documentElement.append(toast);
  requestAnimationFrame(() => {
    toast.style.transform = "translateY(0)";
    toast.style.opacity = "1";
  });
  setTimeout(() => toast.remove(), message.undoToken ? 6000 : 3200);
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "later-space-feedback") showFeedback(message);
  return undefined;
});
