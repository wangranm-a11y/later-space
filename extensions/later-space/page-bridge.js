const PAGE_ORIGIN = "https://wangranm-a11y.github.io";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== "later-space-capture") return undefined;
  const requestId = crypto.randomUUID();
  const timeout = setTimeout(() => {
    window.removeEventListener("message", receiveResult);
    sendResponse({ state: "unavailable" });
  }, 10000);
  function receiveResult(event) {
    if (event.source !== window || event.origin !== PAGE_ORIGIN) return;
    if (event.data?.source !== "later-space-page" || event.data?.requestId !== requestId) return;
    clearTimeout(timeout);
    window.removeEventListener("message", receiveResult);
    sendResponse(event.data.result);
  }
  window.addEventListener("message", receiveResult);
  const type = ["status", "undo", "view"].includes(message.capture?.type) ? message.capture.type : "capture";
  window.postMessage({ source: "later-space-extension", type, requestId, capture: message.capture }, PAGE_ORIGIN);
  return true;
});
