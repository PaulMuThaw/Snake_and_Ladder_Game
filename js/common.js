(function () {
  const THEME_KEY = "sl_theme";

  function applyTheme(themeClass) {
    const body = document.body;
    body.classList.remove("theme-classic", "theme-dark", "theme-jungle", "theme-space");
    body.classList.add(themeClass);
  }

  // Load saved theme
  const saved = localStorage.getItem(THEME_KEY) || "theme-classic";
  applyTheme(saved);

  // Hook dropdown if present
  const sel = document.getElementById("themeSelect");
  if (sel) {
    sel.value = saved;
    sel.addEventListener("change", () => {
      localStorage.setItem(THEME_KEY, sel.value);
      applyTheme(sel.value);
    });
  }
})();
