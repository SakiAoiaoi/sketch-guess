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

// ——— room handling ———
function getParam(name) {
  return new URLSearchParams(location.search).get(name);
}
function ensureRoom() {
  let room = getParam("room");
  if (!room) {
    room = Math.floor(100000 + Math.random() * 900000).toString();
    const url = new URL(location.href);
    url.searchParams.set("room", room);
    history.replaceState({}, "", url);
  }
  return room;
}
const currentRoom = ensureRoom();

// banner
(function showRoomBanner(room) {
  const div = document.createElement("div");
  div.textContent = `🎮 Room: ${room}`;
  div.style = "margin:8px 0;padding:6px 10px;background:#eee;border-radius:8px;font-weight:bold;";
  document.body.prepend(div);
})(currentRoom);

// ——— utils ———
function randWord() { return WORDS[Math.floor(Math.random() * WORDS.length)]; }
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
function stopTimer() { if (timerId) clearInterval(timerId); timerId = null; }
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
  url.searchParams.set("room", currentRoom);
  history.replaceState({}, "", url);
  setWord(w);
}
function shareCurrent() {
  const url = new URL(location.href);
  url.searchParams.set("word", answer);
  url.searchParams.set("room", currentRoom);
  navigator.clipboard.writeText(url.href).then(() => {
    msgEl.textContent = "🔗 Link copied!";
    setTimeout(() => (msgEl.textContent = ""), 1200);
  }).catch(() => { msgEl.textContent = url.href; });
}

// ——— canvas helpers ———
function clearCanvas() {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, c.width, c.height);
  setStroke();
}
// 端末差を吸収するため座標は 0..1 に正規化して送る
function toNorm({x, y}) { return { nx: x / c.width, ny: y / c.height }; }
function fromNorm({nx, ny}) { return { x: nx * c.width, y: ny * c.height }; }

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

// ——— socket.io (optional fallback) ———
const socket = (typeof io !== "undefined") ? io() : null;
if (socket) socket.emit("joinRoom", currentRoom);

// 送信ユーティリティ
function emit(type, payload) {
  if (!socket) return;
  socket.emit(type, Object.assign({ roomId: currentRoom }, payload));
}

// ——— drawing (local) ———
function beginPathAt(x, y, useEraser=false) {
  // 受信側用にツールも反映
  const prev = erasing;
  erasing = !!useEraser;
  setStroke();
  ctx.beginPath();
  ctx.moveTo(x, y);
  erasing = prev; // 自分の状態は保持
}
function drawLineTo(x, y) {
  setStroke();
  ctx.lineTo(x, y);
  ctx.stroke();
}

function down(e) {
  drawing = true;
  const p = pos(e);
  setStroke();
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);

  // 他参加者へ "begin"
  emit("begin", { point: toNorm(p), eraser: erasing });
}
function move(e) {
  if (!drawing) return;
  const p = pos(e);
  ctx.lineTo(p.x, p.y);
  ctx.stroke();

  // 他参加者へ "draw"
  emit("draw", { point: toNorm(p) });
}
function up() {
  drawing = false;
  emit("end", {});
}

// ——— guess ———
function check() {
  const g = guessInput.value.trim().toLowerCase();
  if (!g) return;
  const elapsed = Math.round((Date.now() - startTime) / 1000);
  if (g === answer) {
    msgEl.textContent = `✅ Correct! ${sec(elapsed)}`;
    updateStats(elapsed);
    startTimer();
  } else {
    msgEl.textContent = "❌ Try again";
  }
}

// ——— wire ———
window.addEventListener("load", () => {
  // devicePixelRatio に合わせて内部解像度を上げる
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
  c.addEventListener("touchend",   (e) => { e.preventDefault(); up(); },   { passive:false });

  // tools
  penBtn.onclick = () => { erasing = false; setStroke(); };
  eraserBtn.onclick = () => { erasing = true; setStroke(); };
  clearBtn.onclick = () => { clearCanvas(); emit("clear", {}); };

  // word + share
  newWordBtn.onclick = newRandomWord;
  shareBtn.onclick = shareCurrent;

  // guess
  checkBtn.onclick = check;
  guessInput.addEventListener("keydown", (e) => { if (e.key === "Enter") check(); });
});

// ——— socket receivers ———
if (socket) {
  socket.on("begin", ({ point, eraser }) => {
    const p = fromNorm(point);
    beginPathAt(p.x, p.y, eraser);
  });
  socket.on("draw", ({ point }) => {
    const p = fromNorm(point);
    drawLineTo(p.x, p.y);
  });
  socket.on("end", () => { /* no-op for now */ });
  socket.on("clear", () => { clearCanvas(); });
}
