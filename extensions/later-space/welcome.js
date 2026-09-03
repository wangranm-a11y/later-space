const steps = [...document.querySelectorAll(".step")];
const progressBar = document.querySelector("#progressBar");
const stepLabel = document.querySelector("#stepLabel");
const textStatus = document.querySelector("#textStatus");
const imageStatus = document.querySelector("#imageStatus");
const cleanupStatus = document.querySelector("#cleanupStatus");
const destination = document.querySelector("#destination");
let currentStep = 1;
let selectionButton = null;
let onboarding = null;

function showStep(step) {
  selectionButton?.remove();
  selectionButton = null;
  currentStep = Math.min(4, Math.max(1, Number(step || 1)));
  steps.forEach((section) => section.classList.toggle("is-active", Number(section.dataset.step) === currentStep));
  progressBar.style.width = `${Math.min(100, currentStep * 25)}%`;
  stepLabel.textContent = currentStep < 4 ? `第 ${currentStep} 步，共 3 步` : "引导完成";
  chrome.runtime.sendMessage({ type: "onboarding-progress", patch: { step: currentStep } }).catch(() => {});
}

function updateStatus(element, result) {
  element.classList.remove("is-success", "is-warning");
  if (["saved", "duplicate"].includes(result?.state)) {
    element.textContent = "已加入 Later Space";
    element.classList.add("is-success");
    globalThis.laterSpaceSound?.play(result.state);
    return true;
  }
  if (result?.state === "queued") {
    element.textContent = "已暂存，连接后自动加入";
    element.classList.add("is-warning");
    return true;
  }
  element.textContent = "暂时没有加入成功，请重试";
  element.classList.add("is-warning");
  return false;
}

function positionSelectionButton(range) {
  selectionButton?.remove();
  const rects = [...range.getClientRects()].filter((rect) => rect.width || rect.height);
  const rect = rects.at(-1) || range.getBoundingClientRect();
  if (!rect.width && !rect.height) return;
  selectionButton = document.createElement("button");
  selectionButton.type = "button";
  selectionButton.className = "float-capture selection-capture-v2";
  selectionButton.id = "selectionCapture";
  selectionButton.setAttribute("aria-label", "收藏选中文字");
  selectionButton.innerHTML = '<span class="selection-plus" aria-hidden="true"></span>';
  selectionButton.style.display = "grid";
  selectionButton.style.left = `${Math.min(innerWidth - 38, rect.right + 6)}px`;
  selectionButton.style.top = `${Math.min(innerHeight - 38, rect.bottom + 6)}px`;
  selectionButton.addEventListener("pointerdown", (event) => { event.preventDefault(); globalThis.laterSpaceSound?.prepare(); });
  selectionButton.addEventListener("click", async () => {
    const text = getSelection()?.toString().trim();
    if (!text) return;
    selectionButton.disabled = true;
    textStatus.textContent = "正在加入…";
    const result = await chrome.runtime.sendMessage({ type: "onboarding-capture", capture: { kind: "text", text, nextStep: 2 } }).catch(() => ({ state: "unavailable" }));
    if (result?.onboarding) onboarding = result.onboarding;
    if (updateStatus(textStatus, result)) setTimeout(() => showStep(2), 650);
  });
  document.body.append(selectionButton);
}

document.addEventListener("selectionchange", () => {
  if (currentStep !== 1) return selectionButton?.remove();
  const selection = getSelection();
  const text = selection?.toString().trim();
  if (!text || selection.rangeCount !== 1 || selection.isCollapsed || !document.querySelector("#practiceText")?.contains(selection.anchorNode)) {
    selectionButton?.remove();
    selectionButton = null;
    return;
  }
  textStatus.textContent = "松开后点击右下角图标";
  setTimeout(() => positionSelectionButton(selection.getRangeAt(0)), 10);
});

function practiceImageData() {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 900;
  const context = canvas.getContext("2d");
  context.fillStyle = "#242527";
  context.fillRect(0, 0, canvas.width, canvas.height);
  const glow = context.createRadialGradient(920, 170, 20, 920, 170, 420);
  glow.addColorStop(0, "rgba(167,173,216,.8)");
  glow.addColorStop(1, "rgba(167,173,216,0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#f5f3ed";
  context.font = "500 78px Georgia";
  context.fillText("Save the thought,", 110, 400);
  context.fillText("not the interruption.", 110, 495);
  context.font = "24px sans-serif";
  context.fillText("LATER SPACE · PRACTICE", 110, 760);
  return canvas.toDataURL("image/jpeg", .88);
}

document.querySelector("#imageCapture").addEventListener("pointerdown", () => globalThis.laterSpaceSound?.prepare());
document.querySelector("#imageCapture").addEventListener("click", async () => {
  imageStatus.textContent = "正在加入…";
  const result = await chrome.runtime.sendMessage({ type: "onboarding-capture", capture: { kind: "image", imageData: practiceImageData(), mimeType: "image/jpeg", name: "Later Space 新手练习.jpg", nextStep: 3 } }).catch(() => ({ state: "unavailable" }));
  if (result?.onboarding) onboarding = result.onboarding;
  if (updateStatus(imageStatus, result)) setTimeout(() => showStep(3), 650);
});

document.querySelector("#connect").addEventListener("click", async () => {
  const button = document.querySelector("#connect");
  button.disabled = true;
  button.textContent = "正在连接…";
  const result = await chrome.runtime.sendMessage({ type: "connect-auth" }).catch(() => null);
  if (result?.state === "connected") {
    destination.textContent = `${result.email || "Later Space"} · 云端同步已开启`;
    setTimeout(() => showStep(4), 400);
  } else {
    destination.textContent = "已打开同步中心，完成邮箱登录后可以回来继续";
    button.textContent = "再次检查连接";
    button.disabled = false;
  }
});

document.querySelector("#continueWithoutLogin").addEventListener("click", () => showStep(4));
document.querySelector("#skip").addEventListener("click", () => window.close());
document.querySelector("#viewPractice").addEventListener("click", () => chrome.runtime.sendMessage({ type: "view-capture", recordIds: onboarding?.recordIds || [] }));
document.querySelector("#deletePractice").addEventListener("click", async () => {
  cleanupStatus.textContent = "正在删除练习内容…";
  const result = await chrome.runtime.sendMessage({ type: "onboarding-cleanup" }).catch(() => ({ state: "partial" }));
  if (result?.state === "cleaned") {
    onboarding = result.onboarding;
    cleanupStatus.textContent = "练习内容已删除";
    cleanupStatus.className = "status is-success";
    await chrome.runtime.sendMessage({ type: "onboarding-progress", patch: { completed: true, keepPractice: false } });
    document.querySelector("#deletePractice").hidden = true;
  } else {
    cleanupStatus.textContent = "还有内容没有删除，请再试一次";
    cleanupStatus.className = "status is-warning";
  }
});
document.querySelector("#keepPractice").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "onboarding-progress", patch: { completed: true, keepPractice: true } });
  cleanupStatus.textContent = "已完成，你可以关闭这个页面";
  cleanupStatus.className = "status is-success";
});

chrome.runtime.sendMessage({ type: "onboarding-status" }).then((result) => {
  onboarding = result?.onboarding;
  destination.textContent = result?.destination?.label || "当前浏览器 · 本地保存";
  showStep(onboarding?.completed ? 1 : onboarding?.step || 1);
});
