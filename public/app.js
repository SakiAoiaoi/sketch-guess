// ——— settings ———
const WORDS = ["apple","cat","car","house","tree","boat","sun","cloud","fish","phone","book","star","dog","cup","bird","leaf"];
const LS_KEYS = { correct: "sg_correctCount", best: "sg_bestTimeSec" };

// ——— state ———
let answer = "";
let drawing = false;
let erasing = false;
let startTime = Date.now();
let timerId = null;

// ——— dom ———
const promptEl = document.getElementById("prompt");
const newWordBtn = document.getElementById("newWord");
const shareBtn = document.getElementById("shareLink");
const c = document.getElementById("c");
const ctx = c.getContext("2d");
const penBtn = document.getElementById("penBtn");
const eraserBtn = document.getElementById("eraserBtn");
const clearBtn = document.getElementById("clearBtn");
const guessInput = document.getElementById("guess");
const checkBtn = document.getElementById("check");
const msgEl = document.getElementById("msg");
const countEl = document.getElementById("count");
const bestEl = document.getElementById("best");
const timerEl = document.getElementById("timer");

// ——— utils ———
function randWord() {
  return WORDS[Math.floor(Math.random() * WORDS.length)];
}
function getParam(name) {
  return new URLSearchParams(location.search).get(name);
}
function sec(n) { return `${n}s`; }
function setStroke() {
  ctx.lineWidth = erasing ? 16 : 3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = erasing ? "#ffffff" : "#111111";
}
function startTimer() {
  stopTimer();
  startTime = Date.now();
  timerId = setInterval(() => {
    const s = Math.round((Date.now() - startTime) / 1000);
    timerEl.textContent = `Time: ${sec(s)}`;
  }, 200);
}
function stopTimer() {
  if (timerId) clearInterval(timerId);
  timerId = null;
}
function loadStats() {
  const c = Number(localStorage.getItem(LS_KEYS.correct)) || 0;
  const b = Number(localStorage.getItem(LS_KEYS.best)) || 0;
  countEl.textContent = `Correct: ${c}`;
  bestEl.textContent = `Best: ${b > 0 ? sec(b) : "–"}`;
}
function updateStats(elapsedSec) {
  const c = Number(localStorage.getItem(LS_KEYS.correct)) || 0;
  localStorage.setItem(LS_KEYS.correct, c + 1);
  const best = Number(localStorage.getItem(LS_KEYS.best)) || 0;
  if (!best || elapsedSec < best) localStorage.setItem(LS_KEYS.best, elapsedSec);
  loadStats();
}

// ——— word init ———
function setWord(w) {
  answer = (w || randWord()).toLowerCase();
  promptEl.textContent = `Draw: ${answer}`;
  startTimer();
  clearCanvas();
}
function newRandomWord() {
  const w = randWord();
  const url = new URL(location.href);
  url.searchParams.set("word", w);
  history.replaceState({}, "", url);
  setWord(w);
}
function shareCurrent() {
  const url = new URL(location.href);
  url.searchParams.set("word", answer);
  navigator.clipboard.writeText(url.href).then(() => {
    msgEl.textContent = "🔗 Link copied!";
    setTimeout(() => (msgEl.textContent = ""), 1200);
  }).catch(() => {
    // fallback: show the URL
    msgEl.textContent = url.href;
  });
}

// ——— canvas ———
function clearCanvas() {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, c.width, c.height);
  setStroke();
}
function pos(e) {
  if (e.touches && e.touches[0]) {
    const rect = c.getBoundingClientRect();
    return {
      x: (e.touches[0].clientX - rect.left) * (c.width / rect.width),
      y: (e.touches[0].clientY - rect.top) * (c.height / rect.height),
    };
  }
  return { x: e.offsetX, y: e.offsetY };
}
function down(e) {
  drawing = true;
  setStroke();
  const { x, y } = pos(e);
  ctx.beginPath();
  ctx.moveTo(x, y);
}
function move(e) {
  if (!drawing) return;
  const { x, y } = pos(e);
  ctx.lineTo(x, y);
  ctx.stroke();
}
function up() { drawing = false; }

// ——— guess ———
function check() {
  const g = guessInput.value.trim().toLowerCase();
  if (!g) return;
  const elapsed = Math.round((Date.now() - startTime) / 1000);
  if (g === answer) {
    msgEl.textContent = `✅ Correct! ${sec(elapsed)}`;
    updateStats(elapsed);
    startTimer(); // next round timing (keeps counting if user keeps playing)
  } else {
    msgEl.textContent = "❌ Try again";
  }
}

// ——— wire ———
window.addEventListener("load", () => {
  // set canvas to device pixel ratio for crisp lines
  const ratio = Math.max(1, Math.floor(window.devicePixelRatio || 1));
  c.width = c.width * ratio;
  c.height = c.height * ratio;
  c.style.width = "100%";

  clearCanvas();
  loadStats();

  const q = getParam("word");
  setWord(q || randWord());

  // mouse
  c.addEventListener("mousedown", down);
  c.addEventListener("mousemove", move);
  c.addEventListener("mouseup", up);
  c.addEventListener("mouseleave", up);
  // touch
  c.addEventListener("touchstart", (e) => { e.preventDefault(); down(e); }, { passive:false });
  c.addEventListener("touchmove",  (e) => { e.preventDefault(); move(e); }, { passive:false });
  c.addEventListener("touchend",   (e) => { e.preventDefault(); up(e); },   { passive:false });

  // tools
  penBtn.onclick = () => { erasing = false; setStroke(); };
  eraserBtn.onclick = () => { erasing = true; setStroke(); };
  clearBtn.onclick = clearCanvas;

  // word + share
  newWordBtn.onclick = newRandomWord;
  shareBtn.onclick = shareCurrent;

  // guess
  checkBtn.onclick = check;
  guessInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") check();
  });
});
