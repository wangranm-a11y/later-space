const slides = [...document.querySelectorAll(".slide")];
const stage = document.querySelector("#stage");
const currentPage = document.querySelector("#currentPage");
const totalPages = document.querySelector("#totalPages");
const progressBar = document.querySelector("#progressBar");
const prevButton = document.querySelector("#prevButton");
const nextButton = document.querySelector("#nextButton");
const fullscreenButton = document.querySelector("#fullscreenButton");
let index = Math.max(0, Math.min(slides.length - 1, Number(location.hash.slice(1)) - 1 || 0));
let overview = false;
let touchStartX = 0;

function resizeStage() {
  if (overview) return;
  const scale = Math.min(innerWidth / 1440, innerHeight / 810);
  stage.style.transform = `translate(-50%, -50%) scale(${scale})`;
}

function showSlide(nextIndex, pushHash = true) {
  index = Math.max(0, Math.min(slides.length - 1, nextIndex));
  slides.forEach((slide, slideIndex) => {
    slide.classList.toggle("active", slideIndex === index);
    slide.setAttribute("aria-hidden", String(slideIndex !== index));
  });
  currentPage.textContent = String(index + 1).padStart(2, "0");
  totalPages.textContent = String(slides.length).padStart(2, "0");
  progressBar.style.width = `${((index + 1) / slides.length) * 100}%`;
  prevButton.disabled = index === 0;
  nextButton.disabled = index === slides.length - 1;
  document.title = `${slides[index].dataset.title} · Later Space`;
  if (pushHash) history.replaceState(null, "", `#${index + 1}`);
}

function toggleOverview() {
  overview = !overview;
  document.body.classList.toggle("overview", overview);
  if (overview) {
    stage.style.transform = "none";
    slides.forEach((slide) => slide.classList.add("active"));
    slides[index].scrollIntoView({ block: "center" });
  } else {
    showSlide(index, false);
    resizeStage();
  }
}

function toggleFullscreen() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
  else document.exitFullscreen?.();
}

prevButton.addEventListener("click", () => showSlide(index - 1));
nextButton.addEventListener("click", () => showSlide(index + 1));
fullscreenButton.addEventListener("click", toggleFullscreen);
slides.forEach((slide, slideIndex) => slide.addEventListener("click", () => {
  if (!overview) return;
  index = slideIndex;
  toggleOverview();
}));

addEventListener("keydown", (event) => {
  if (["ArrowRight", "ArrowDown", "PageDown", " "].includes(event.key)) {
    event.preventDefault();
    if (overview) toggleOverview();
    else showSlide(index + 1);
  } else if (["ArrowLeft", "ArrowUp", "PageUp"].includes(event.key)) {
    event.preventDefault();
    if (overview) toggleOverview();
    else showSlide(index - 1);
  } else if (event.key === "Home") showSlide(0);
  else if (event.key === "End") showSlide(slides.length - 1);
  else if (event.key.toLowerCase() === "f") toggleFullscreen();
  else if (event.key.toLowerCase() === "o" || event.key === "Escape" && overview) toggleOverview();
});

addEventListener("hashchange", () => showSlide(Number(location.hash.slice(1)) - 1, false));
addEventListener("resize", resizeStage);
addEventListener("touchstart", (event) => { touchStartX = event.changedTouches[0].clientX; }, { passive: true });
addEventListener("touchend", (event) => {
  const distance = event.changedTouches[0].clientX - touchStartX;
  if (Math.abs(distance) < 50) return;
  showSlide(index + (distance < 0 ? 1 : -1));
}, { passive: true });

showSlide(index, false);
resizeStage();
