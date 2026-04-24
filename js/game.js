// game.js (complete) — image-based board + step-by-step token movement
(() => {
  const boardStage = document.getElementById("boardStage");
  const board = document.getElementById("board");
  const boardImageEl = document.getElementById("boardImage");
  if (!boardStage || !board || !boardImageEl) return;

  // UI
  const rollBtn = document.getElementById("rollBtn");
  const startBtn = document.getElementById("startBtn");
  const diceEl = document.getElementById("dice");
  const messageEl = document.getElementById("message");

  const turnLabel = document.getElementById("turnLabel");
  const turnCountEl = document.getElementById("turnCount");
  const posSummaryEl = document.getElementById("posSummary");

  const playerCountEl = document.getElementById("playerCount");
  const boardSelectEl = document.getElementById("boardSelect");
  const soundOnEl = document.getElementById("soundOn");
  const restartBtn = document.getElementById("restartBtn");
  const playAgainBtn = document.getElementById("playAgainBtn");
  const winModalEl = document.getElementById("winModal");
  const winTextEl = document.getElementById("winText");
  const exactWinEl = document.getElementById("exactWin");
  const showLinesEl = document.getElementById("showLines");

  const mapListEl = document.getElementById("mapList");
  const nameFieldsEl = document.getElementById("nameFields");
  const legendEl = document.getElementById("legend");

  // Canvas overlay (optional)
  const overlay = document.getElementById("overlay");
  const ctx = overlay ? overlay.getContext("2d") : null;

  const BOARD_STORAGE_KEY = "sl_board";

  // key = start, value = end
  const BOARD_CONFIGS = {
    classic: {
      name: "Classic Board",
      image: "images/board.png",
      jumps: {
        // 🐍 Snakes
        16: 7,
        67: 30,
        59: 17,
        63: 19,
        99: 77,
        95: 75,
        93: 69,
        87: 24,

        // 🪜 Ladders
        9: 27,
        18: 37,
        28: 51,
        25: 54,
        56: 64,
        68: 88,
        76: 97,
        79: 100
      }
    },
    green: {
      name: "Green Board",
      image: "images/board5.png",
      jumps: {
        // 🐍 Snakes
        40: 2,
        43: 17,
        27: 5,
        66: 45,
        54: 31,
        89: 53,
        95: 76,
        99: 41,

        // 🪜 Ladders
        4: 23,
        13: 46,
        33: 52,
        50: 69,
        74: 93,
        42: 63,
        62: 81
      }
    },
    pastel: {
      name: "Pastel Board",
      image: "images/board6.png",
      jumps: {
        // 🐍 Snakes
        99: 80,
        95: 75,
        92: 88,
        89: 68,
        62: 19,
        64: 60,
        46: 25,
        16: 6,
        49: 11,
        74: 53,

        // 🪜 Ladders
        78: 98,
        21: 42,
        2: 38,
        36: 44,
        15: 26,
        7: 14,
        8: 31,
        51: 67,
        71: 91,
        87: 94
      }
    }
  };

  let currentBoardKey = localStorage.getItem(BOARD_STORAGE_KEY) || "classic";
  if (!BOARD_CONFIGS[currentBoardKey]) currentBoardKey = "classic";

  function getCurrentBoard() {
    return BOARD_CONFIGS[currentBoardKey] || BOARD_CONFIGS.classic;
  }

  function getCurrentJumps() {
    return getCurrentBoard().jumps;
  }

  function syncBoardImage() {
    const activeBoard = getCurrentBoard();
    boardImageEl.src = activeBoard.image;
    boardImageEl.alt = activeBoard.name;
    if (boardSelectEl) boardSelectEl.value = currentBoardKey;
  }

  const PLAYER_COLORS = ["#ff3b7a", "#2a86ff", "#2ecc71", "#f39c12"];

  // Game state
  let players = []; // {name, pos, color}
  let currentIndex = 0;
  let totalTurns = 0;
  let busy = false;

  const isLadder = (from, to) => to > from;
  const isSnake = (from, to) => to < from;

  function setMessage(text) {
    if (messageEl) messageEl.textContent = text;
  }

  // ---------------- Sound effects ----------------
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  let audioCtx = null;

  function ensureAudioReady() {
    if (!soundOnEl || !soundOnEl.checked || !AudioCtx) return null;
    if (!audioCtx) audioCtx = new AudioCtx();
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  }

  function playTone({
    startTime,
    frequency,
    duration = 0.08,
    type = "sine",
    gain = 0.06,
    endFrequency = null
  }) {
    const ctxReady = ensureAudioReady();
    if (!ctxReady) return;

    const osc = ctxReady.createOscillator();
    const amp = ctxReady.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, startTime);
    if (endFrequency != null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), startTime + duration);
    }

    amp.gain.setValueAtTime(0.0001, startTime);
    amp.gain.exponentialRampToValueAtTime(gain, startTime + 0.015);
    amp.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(amp);
    amp.connect(ctxReady.destination);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }

  function beep(type) {
    const ctxReady = ensureAudioReady();
    if (!ctxReady) return;

    const now = ctxReady.currentTime + 0.005;

    if (type === "roll") {
      [220, 280, 340].forEach((freq, i) => {
        playTone({ startTime: now + i * 0.045, frequency: freq, duration: 0.05, type: "triangle", gain: 0.05 });
      });
      return;
    }

    if (type === "step") {
      playTone({ startTime: now, frequency: 520, duration: 0.045, type: "square", gain: 0.03, endFrequency: 560 });
      return;
    }

    if (type === "ladder") {
      [420, 560, 700, 880].forEach((freq, i) => {
        playTone({ startTime: now + i * 0.06, frequency: freq, duration: 0.12, type: "triangle", gain: 0.05 });
      });
      return;
    }

    if (type === "snake") {
      playTone({ startTime: now, frequency: 260, duration: 0.34, type: "sawtooth", gain: 0.06, endFrequency: 70 });
      playTone({ startTime: now + 0.07, frequency: 180, duration: 0.28, type: "sawtooth", gain: 0.035, endFrequency: 60 });
      return;
    }

    if (type === "win") {
      [523, 659, 784, 1046].forEach((freq, i) => {
        playTone({ startTime: now + i * 0.09, frequency: freq, duration: 0.16, type: "triangle", gain: 0.055 });
      });
    }
  }

  // ---------------- Dice ----------------
  function diceEmoji(n) {
    return ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"][n];
  }

  async function animatedRoll() {
    return new Promise((resolve) => {
      let ticks = 0;
      const interval = setInterval(() => {
        const temp = 1 + Math.floor(Math.random() * 6);
        if (diceEl) diceEl.textContent = diceEmoji(temp);
        ticks++;
        if (ticks >= 12) {
          clearInterval(interval);
          const final = 1 + Math.floor(Math.random() * 6);
          if (diceEl) diceEl.textContent = diceEmoji(final);
          resolve(final);
        }
      }, 60);
    });
  }

  // ---------------- Board coordinates (serpentine) ----------------
  // square: 1..100
  // bottom row is 1..10 LTR, next row is 11..20 RTL, etc.
  function getCoordinates(square) {
    const size = 10;
    const row = Math.floor((square - 1) / size);
    let col = (square - 1) % size;

    // reverse every odd row (0-based)
    if (row % 2 === 1) col = size - 1 - col;

    const x = (col + 0.5) * (100 / size);
    const y = 100 - (row + 0.5) * (100 / size);
    return { x, y };
  }

  // ---------------- UI rendering ----------------
  function renderLegend() {
    if (!legendEl) return;
    legendEl.innerHTML = "";
    players.forEach((p, idx) => {
      const item = document.createElement("div");
      item.className = "legendItem" + (idx === currentIndex ? " activeTurn" : "");

      const sw = document.createElement("span");
      sw.className = "legendSwatch";
      sw.style.background = p.color;

      const txt = document.createElement("span");
      txt.textContent = p.name || `Player ${idx + 1}`;

      const badge = document.createElement("span");
      badge.className = "turnBadge";
      badge.textContent = idx === currentIndex ? "Playing" : `P${idx + 1}`;

      item.append(sw, txt, badge);
      legendEl.appendChild(item);
    });
  }

  function renderNameFields() {
    if (!nameFieldsEl || !playerCountEl) return;

    const count = Number(playerCountEl.value || 2);
    nameFieldsEl.innerHTML = "";

    for (let i = 0; i < count; i++) {
      const row = document.createElement("div");
      row.className = "nameRow";

      const input = document.createElement("input");
      input.type = "text";
      input.className = "input playerNameInput";
      input.placeholder = `Player ${i + 1} name`;
      input.value = players[i]?.name || "";
      input.dataset.idx = String(i);

      const dot = document.createElement("span");
      dot.className = "nameDot";
      dot.style.background = PLAYER_COLORS[i % PLAYER_COLORS.length];
      dot.setAttribute("aria-hidden", "true");

      row.append(dot, input);
      nameFieldsEl.appendChild(row);
    }
  }

  function readNamesIntoPlayers() {
    if (!nameFieldsEl) return;
    const inputs = nameFieldsEl.querySelectorAll("input[data-idx]");
    inputs.forEach((inp) => {
      const idx = Number(inp.dataset.idx);
      if (players[idx]) players[idx].name = inp.value.trim() || `Player ${idx + 1}`;
    });
  }

  function renderMapList() {
    if (!mapListEl) return;

    mapListEl.innerHTML = "";
    const entries = Object.entries(getCurrentJumps())
      .map(([a, b]) => [Number(a), Number(b)])
      .sort((x, y) => x[0] - y[0]);

    for (const [from, to] of entries) {
      const row = document.createElement("div");
      row.className = "mapRow";

      const left = document.createElement("span");
      left.textContent = `${from} → ${to}`;

      const right = document.createElement("span");
      right.textContent = isLadder(from, to) ? "🪜 Ladder" : "🐍 Snake";

      row.append(left, right);
      mapListEl.appendChild(row);
    }
  }

  function renderTokens() {
    // clear token layer
    board.innerHTML = "";

    players.forEach((p, i) => {
      const token = document.createElement("div");
      token.className = "token";
      token.style.background = p.color;
      token.title = p.name;

      const pos = getCoordinates(p.pos);

      // if multiple players on same square, offset slightly
      const spread = 1.2; // percent of board
      const offsets = [
        { dx: -spread, dy: -spread },
        { dx:  spread, dy: -spread },
        { dx: -spread, dy:  spread },
        { dx:  spread, dy:  spread },
      ];
      const off = offsets[i % offsets.length];

      token.style.left = (pos.x + off.dx) + "%";
      token.style.top = (pos.y + off.dy) + "%";

      board.appendChild(token);
    });

    const current = players[currentIndex];
    if (turnLabel) turnLabel.textContent = current?.name ?? "—";
    if (turnCountEl) turnCountEl.textContent = String(totalTurns);
    if (posSummaryEl) posSummaryEl.textContent = players.map(p => `${p.name}:${p.pos}`).join(" • ");
  }

  function switchTurn() {
    currentIndex = (currentIndex + 1) % players.length;
    renderTokens();
  }

  // ---------------- Jump logic ----------------
  function applyJump(position) {
    const jumps = getCurrentJumps();
    if (!jumps[position]) return position;

    const to = jumps[position];
    if (isLadder(position, to)) {
      beep("ladder");
      setMessage(`🪜 Ladder! ${position} → ${to}`);
    } else {
      beep("snake");
      setMessage(`🐍 Snake! ${position} → ${to}`);
    }
    return to;
  }

  // ---------------- Step-by-step movement ----------------
  function sleep(ms) {
    return new Promise(res => setTimeout(res, ms));
  }

  async function moveStepByStep(player, steps) {
    for (let i = 0; i < steps; i++) {
      if (player.pos >= 100) break;
      player.pos += 1;
      renderTokens();
      beep("step");
      await sleep(220); // ✅ speed per step (lower = faster)
    }
  }

  // ---------------- Overlay (optional) ----------------
  function resizeOverlay() {
    if (!overlay || !ctx) return;
    const rect = boardStage.getBoundingClientRect();
    overlay.width = Math.max(1, Math.floor(rect.width * devicePixelRatio));
    overlay.height = Math.max(1, Math.floor(rect.height * devicePixelRatio));
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  }

  function centerOfSquare(n) {
    // use percentage coords, convert to pixels in boardStage
    const rect = boardStage.getBoundingClientRect();
    const p = getCoordinates(n);
    return {
      x: (p.x / 100) * rect.width,
      y: (p.y / 100) * rect.height
    };
  }

  function drawArrowhead(x1, y1, x2, y2, size) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const a1 = angle + Math.PI * 0.85;
    const a2 = angle - Math.PI * 0.85;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 + Math.cos(a1) * size, y2 + Math.sin(a1) * size);
    ctx.lineTo(x2 + Math.cos(a2) * size, y2 + Math.sin(a2) * size);
    ctx.closePath();
    ctx.fill();
  }

  function drawCurvedLine(from, to, kind) {
    if (!ctx) return;
    const a = centerOfSquare(from);
    const b = centerOfSquare(to);
    if (!a || !b) return;

    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.max(1, Math.hypot(dx, dy));
    const nx = -dy / len;
    const ny = dx / len;

    const bend = Math.min(70, 18 + len * 0.08);
    const cx = mx + nx * bend;
    const cy = my + ny * bend;

    ctx.save();
    ctx.lineWidth = 4;
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = (kind === "ladder") ? "rgba(46,204,113,0.95)" : "rgba(255,77,77,0.95)";
    ctx.fillStyle = ctx.strokeStyle;
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 10;

    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo(cx, cy, b.x, b.y);
    ctx.stroke();

    drawArrowhead(cx, cy, b.x, b.y, 10);
    ctx.restore();
  }

  function drawOverlay() {
    if (!overlay || !ctx) return;

    resizeOverlay();
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    if (!showLinesEl || !showLinesEl.checked) return;

    for (const [fromStr, toVal] of Object.entries(getCurrentJumps())) {
      const from = Number(fromStr);
      const to = Number(toVal);
      drawCurvedLine(from, to, isLadder(from, to) ? "ladder" : "snake");
    }
  }

  // ---------------- Game loop ----------------
  function openWinModal(winnerName) {
    if (!winModalEl) return;
    if (winTextEl) winTextEl.textContent = `${winnerName} wins in ${totalTurns} turns and takes the spotlight.`;
    winModalEl.classList.add("show");
    winModalEl.setAttribute("aria-hidden", "false");
  }

  function closeWinModal() {
    if (!winModalEl) return;
    winModalEl.classList.remove("show");
    winModalEl.setAttribute("aria-hidden", "true");
  }

  function handleWin(winnerName) {
    beep("win");
    setMessage(`🎉 ${winnerName} wins in ${totalTurns} turns!`);
    if (rollBtn) rollBtn.disabled = true;
    openWinModal(winnerName);

    // Save to High Scores (top list)
    try {
      const winner = players.find(x => x.name === winnerName);
      const rec = {
        name: winnerName,
        moves: totalTurns,
        color: winner ? winner.color : undefined,
        date: Date.now()
      };

      const list = JSON.parse(localStorage.getItem("sl_highscores") || "[]");
      const next = Array.isArray(list) ? list : [];
      next.push(rec);

      // Sort: fewest moves first
      next.sort((a, b) => (a.moves ?? 999999) - (b.moves ?? 999999));

      // Keep top 10 (you can change this)
      localStorage.setItem("sl_highscores", JSON.stringify(next.slice(0, 10)));
    } catch (e) {
      // ignore storage errors
    }
  }

  async function takeTurn() {
    if (busy || !rollBtn || rollBtn.disabled) return;
    busy = true;
    rollBtn.disabled = true;

    const p = players[currentIndex];
    setMessage(`Rolling…`);
    beep("roll");

    const roll = await animatedRoll();
    setMessage(`${p.name} rolled a ${roll}.`);

    // exact win option (if checkbox exists)
    if (exactWinEl && exactWinEl.checked && p.pos + roll > 100) {
      setMessage(`${p.name} rolled ${roll}, but needs exact 100. Stay on ${p.pos}.`);
      totalTurns++;
      renderTokens();
      await sleep(350);
      switchTurn();
      rollBtn.disabled = false;
      busy = false;
      return;
    }

    // compute how many steps to walk (cap to 100)
    const target = Math.min(100, p.pos + roll);
    const steps = target - p.pos;

    // ✅ step-by-step walk
    await moveStepByStep(p, steps);

    // ✅ snake/ladder after landing
    const before = p.pos;
    const after = applyJump(p.pos);
    if (after !== before) {
      p.pos = after;
      renderTokens();
      await sleep(450);
    }

    totalTurns++;
    renderTokens();

    if (p.pos === 100) {
      handleWin(p.name);
      busy = false;
      return;
    }

    await sleep(300);
    switchTurn();
    rollBtn.disabled = false;
    busy = false;
  }

  // ---------------- Start / Reset ----------------
  function startGame() {
    closeWinModal();
    syncBoardImage();
    const count = Number(playerCountEl?.value || 2);
    const preservedNames = players.map(p => p.name).slice(0, count);

    players = Array.from({ length: count }, (_, i) => ({
      name: preservedNames[i] || `Player ${i + 1}`,
      pos: 1,
      color: PLAYER_COLORS[i % PLAYER_COLORS.length]
    }));

    renderNameFields();
    readNamesIntoPlayers();
    renderLegend();
    renderMapList();

    currentIndex = 0;
    totalTurns = 0;

    if (rollBtn) rollBtn.disabled = false;
    if (diceEl) diceEl.textContent = "🎲";

    setMessage(`${players[0].name} rolls first.`);
    renderTokens();

    setTimeout(drawOverlay, 50);
  }

  // ---------------- Events ----------------
  if (rollBtn) rollBtn.addEventListener("click", async () => {
    ensureAudioReady();
    await takeTurn();
  });

  if (startBtn) startBtn.addEventListener("click", () => {
    ensureAudioReady();
    readNamesIntoPlayers();
    startGame();
  });

  if (restartBtn) restartBtn.addEventListener("click", () => {
    readNamesIntoPlayers();
    startGame();
  });

  if (playAgainBtn) playAgainBtn.addEventListener("click", () => {
    readNamesIntoPlayers();
    startGame();
  });

  if (boardSelectEl) boardSelectEl.addEventListener("change", () => {
    currentBoardKey = boardSelectEl.value in BOARD_CONFIGS ? boardSelectEl.value : "classic";
    localStorage.setItem(BOARD_STORAGE_KEY, currentBoardKey);
    startGame();
  });

  if (playerCountEl) playerCountEl.addEventListener("change", () => {
  // keep any typed names before rebuilding
  readNamesIntoPlayers();

  const oldNames = players.map(p => p.name);
  const newCount = Number(playerCountEl.value || 2);

  // rebuild players with new count
  players = Array.from({ length: newCount }, (_, i) => ({
    name: oldNames[i] || `Player ${i + 1}`,
    pos: 1,
    color: PLAYER_COLORS[i % PLAYER_COLORS.length]
  }));

  currentIndex = 0;
  totalTurns = 0;

  if (rollBtn) rollBtn.disabled = false;
  if (diceEl) diceEl.textContent = "🎲";

  renderNameFields();
  renderLegend();
  renderMapList();
  renderTokens();
  setMessage(`${players[0].name} rolls first.`);

  setTimeout(drawOverlay, 50);
});

  if (nameFieldsEl) nameFieldsEl.addEventListener("input", () => {
    readNamesIntoPlayers();
    renderLegend();
    renderTokens();
  });

  if (showLinesEl) showLinesEl.addEventListener("change", drawOverlay);

  if (winModalEl) {
    winModalEl.addEventListener("click", (e) => {
      if (e.target === winModalEl) closeWinModal();
    });
  }

  window.addEventListener("resize", () => {
    clearTimeout(window.__sl_resize_timer);
    window.__sl_resize_timer = setTimeout(drawOverlay, 80);
  });

  const themeSelect = document.getElementById("themeSelect");
  if (themeSelect) themeSelect.addEventListener("change", () => setTimeout(drawOverlay, 60));

  // Init
  syncBoardImage();
  startGame();
  drawOverlay();
})();

const bgMusic = document.getElementById("bgMusic");
const musicBtn = document.getElementById("musicToggle");
let musicPlaying = false;

if (bgMusic) bgMusic.volume = 0.4;

if (musicBtn && bgMusic) {
  musicBtn.addEventListener("click", async () => {
    if (!musicPlaying) {
      await bgMusic.play();
      musicPlaying = true;
      musicBtn.textContent = "🔇";
    } else {
      bgMusic.pause();
      musicPlaying = false;
      musicBtn.textContent = "🎵";
    }
  });
}