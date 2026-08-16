const PAGE_ORIGIN = "https://wangranm-a11y.github.io";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== "later-space-capture") return undefined;
  const requestId = crypto.randomUUID();
  const timeout = setTimeout(() => {
    window.removeEventListener("message", receiveResult);
    sendResponse({ state: "unavailable" });
  }, 1200);
  function receiveResult(event) {
    if (event.source !== window || event.origin !== PAGE_ORIGIN) return;
    if (event.data?.source !== "later-space-page" || event.data?.requestId !== requestId) return;
    clearTimeout(timeout);
    window.removeEventListener("message", receiveResult);
    sendResponse(event.data.result);
  }
  window.addEventListener("message", receiveResult);
  window.postMessage({ source: "later-space-extension", type: "capture", requestId, capture: message.capture }, PAGE_ORIGIN);
  return true;
});
