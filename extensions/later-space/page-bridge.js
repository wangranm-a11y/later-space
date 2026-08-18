(() => {
try { globalThis.__laterSpacePageBridgeCleanup?.(); } catch {}

const pageOrigin = "https://wangranm-a11y.github.io";

function receiveCapture(message, _sender, sendResponse) {
  if (message.type !== "later-space-capture") return undefined;
  const requestId = crypto.randomUUID();
  const timeout = setTimeout(() => {
    window.removeEventListener("message", receiveResult);
    sendResponse({ state: "unavailable" });
  }, 10000);
  function receiveResult(event) {
    if (event.source !== window || event.origin !== pageOrigin) return;
    if (event.data?.source !== "later-space-page" || event.data?.requestId !== requestId) return;
    clearTimeout(timeout);
    window.removeEventListener("message", receiveResult);
    sendResponse(event.data.result);
  }
  window.addEventListener("message", receiveResult);
  const type = ["status", "undo", "view"].includes(message.capture?.type) ? message.capture.type : "capture";
  window.postMessage({ source: "later-space-extension", type, requestId, capture: message.capture }, pageOrigin);
  return true;
}

globalThis.__laterSpacePageBridgeCleanup = () => {
  try { chrome.runtime.onMessage.removeListener(receiveCapture); } catch {}
};
chrome.runtime.onMessage.addListener(receiveCapture);
})();
