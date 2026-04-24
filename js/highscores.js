(() => {
  const clearBtn = document.getElementById("clearBtn");

  const slots = [
    { name: "name1", moves: "moves1", color: "color1", swatch: "swatch1" },
    { name: "name2", moves: "moves2", color: "color2", swatch: "swatch2" },
    { name: "name3", moves: "moves3", color: "color3", swatch: "swatch3" }
  ];

  function setSlot(i, rec) {
    const s = slots[i];
    const nameEl = document.getElementById(s.name);
    const movesEl = document.getElementById(s.moves);
    const colorEl = document.getElementById(s.color);
    const swatchEl = document.getElementById(s.swatch);

    if (!nameEl || !movesEl || !colorEl || !swatchEl) return;

    if (!rec) {
      nameEl.textContent = "-";
      movesEl.textContent = "-";
      colorEl.textContent = "-";
      swatchEl.style.background = "transparent";
      swatchEl.style.borderColor = "transparent";
      return;
    }

    nameEl.textContent = rec.name || "-";
    movesEl.textContent = String(rec.moves ?? rec.turns ?? "-");

    const c = rec.color || "-";
    colorEl.textContent = c;

    if (rec.color) {
      swatchEl.style.background = rec.color;
      swatchEl.style.borderColor = "rgba(0,0,0,.15)";
    } else {
      swatchEl.style.background = "transparent";
      swatchEl.style.borderColor = "transparent";
    }
  }

  function readScores() {
    // New format (top list)
    const list = JSON.parse(localStorage.getItem("sl_highscores") || "[]");
    if (Array.isArray(list) && list.length) return list;

    // Backward compatibility (single record, if ever used)
    const rec = JSON.parse(localStorage.getItem("sl_fastest_win") || "null");
    if (rec) {
      return [{
        name: rec.winner || rec.name,
        moves: rec.turns,
        color: rec.color
      }];
    }

    return [];
  }

  function render() {
    const scores = readScores().slice(0, 3);
    for (let i = 0; i < 3; i++) setSlot(i, scores[i]);
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      localStorage.removeItem("sl_highscores");
      localStorage.removeItem("sl_fastest_win");
      render();
    });
  }

  render();
})();
