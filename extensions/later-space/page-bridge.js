(() => {
try { globalThis.__laterSpacePageBridgeCleanup?.(); } catch {}

const pageOrigin = "https://wangranm-a11y.github.io";

function receiveCapture(message, _sender, sendResponse) {
  if (!["later-space-capture", "later-space-auth"].includes(message.type)) return undefined;
  const requestId = crypto.randomUUID();
  let retryTimer;
  const type = message.type === "later-space-auth" ? "auth" : "capture";
  const postCapture = () => window.postMessage({ source: "later-space-extension", type, requestId, capture: message.capture }, pageOrigin);
  const timeout = setTimeout(() => {
    clearInterval(retryTimer);
    window.removeEventListener("message", receiveResult);
    sendResponse({ state: "unavailable" });
  }, 10000);
  function receiveResult(event) {
    if (event.source !== window || event.origin !== pageOrigin) return;
    if (event.data?.source !== "later-space-page" || event.data?.requestId !== requestId) return;
    clearTimeout(timeout);
    clearInterval(retryTimer);
    window.removeEventListener("message", receiveResult);
    sendResponse(event.data.result);
  }
  window.addEventListener("message", receiveResult);
  if (message.type === "later-space-auth") {
    postCapture();
    return true;
  }
  const bridgeType = ["status", "undo", "view"].includes(message.capture?.type) ? message.capture.type : "capture";
  // Keep the legacy command envelope for capture/status/undo/view.
  function postLegacy() { window.postMessage({ source: "later-space-extension", type: bridgeType, requestId, capture: message.capture }, pageOrigin); }
  postLegacy();
  retryTimer = setInterval(postLegacy, 250);
  return true;
}

globalThis.__laterSpacePageBridgeCleanup = () => {
  try { chrome.runtime.onMessage.removeListener(receiveCapture); } catch {}
};
chrome.runtime.onMessage.addListener(receiveCapture);
})();
