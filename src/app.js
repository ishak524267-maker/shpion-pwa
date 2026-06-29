const themeColors = {
  historical_figures: "#d4af37",
  clash_royale: "#3b82f6",
  anime: "#ec4899",
  anime_characters: "#f43f5e",
  movies: "#eab308",
  teachers: "#8b5cf6",
  superheroes: "#ef4444",
  villains: "#7c3aed",
  countries: "#10b981",
  celebrities: "#f59e0b",
  cartoons: "#06b6d4",
  tv_series: "#6366f1",
  brawl_stars: "#f59e0b",
  cs2_weapons: "#f97316",
  games: "#22c55e",
  memes: "#14b8a6",
  food: "#fb923c",
  cartoon_characters: "#84cc16",
  bobiki: "#a855f7",
  cars: "#64748b",
  moto: "#dc2626",
  prof: "#0ea5e9",
  random: "#3b82f6",
  custom: "#a855f7",
};

function vibrate(pattern) {
  if (!navigator.vibrate) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // ignore
  }
}

function clickFeedback() {
  vibrate(20);
}

function qs(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el;
}

// Toast (замена alert)
let toastTimer = null;
function showToast(message, options = {}) {
  const toast = qs("toast");
  const toastText = qs("toast-text");
  const toastActions = qs("toast-actions");

  toastText.textContent = message;
  toastActions.innerHTML = "";

  const actions = Array.isArray(options.actions) ? options.actions : [];
  for (const action of actions) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = action.variant === "secondary" ? "button-secondary" : "";
    btn.textContent = action.label;
    btn.addEventListener("click", () => action.onClick?.());
    toastActions.appendChild(btn);
  }

  toast.classList.add("show");
  toast.addEventListener(
    "click",
    () => {
      toast.classList.remove("show");
    },
    { once: true }
  );
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("show"), options.durationMs ?? 2800);
}

function hideAllScreens(screens) {
  for (const s of screens) s.classList.add("hidden");
}

// Safe PWA register (работает и в подпапке)
function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  const swUrl = new URL("./service-worker.js", window.location.href);
  navigator.serviceWorker.register(swUrl, { scope: "./" }).catch(err => {
    // мягко, без консольного шума для игрока
    console.log("Ошибка PWA:", err);
  });
}

function fillRandomTheme(themesData) {
  themesData.random = [];
  for (const key in themesData) {
    if (Array.isArray(themesData[key])) {
      themesData.random = themesData.random.concat(themesData[key]);
    }
  }
}

function main() {
  const themesData = globalThis.themesData;
  if (!themesData) {
    console.error("words.js не загружен — проверьте порядок <script> в index.html");
    return;
  }

  registerServiceWorker();
  fillRandomTheme(themesData);

  const screens = {
    setup: qs("setup-screen"),
    pass: qs("pass-screen"),
    timer: qs("timer-screen"),
    timeout: qs("timeout-screen"),
  };

  const themeSelect = qs("theme-select");
  const customContainer = qs("custom-theme-container");
  const customWordsInput = qs("custom-words");
  const playersInput = qs("players-input");
  const spiesInput = qs("spies-input");
  const falseLocationMode = qs("false-location-mode");
  const timerSelect = qs("timer-select");
  const timerDisplay = qs("timer-display");
  const revealOverlay = qs("reveal-overlay");
  const cinematicRole = qs("cinematic-role");

  // state
  const wordsBag = {};
  let totalPlayers = 0;
  let currentPlayerIndex = 1;
  let spyPlayerNumbers = [];
  let currentSecretWord = "";
  let spyFakeWord = "";
  let timerInterval = null;
  let timeLeft = 300;
  let isTimerRunning = false;

  function setAccentForTheme(theme) {
    const newColor = themeColors[theme] || "#a855f7";
    document.documentElement.style.setProperty("--accent-color", newColor);
  }

  setAccentForTheme(themeSelect.value);

  themeSelect.addEventListener("change", () => {
    const isCustom = themeSelect.value === "custom";
    customContainer.classList.toggle("hidden", !isCustom);
    setAccentForTheme(themeSelect.value);
  });

  function showPassScreen() {
    hideAllScreens(Object.values(screens));
    qs("pass-player-number").textContent = `Игроку №${currentPlayerIndex}`;
    screens.pass.classList.remove("hidden");
  }

  function updateTimerUI() {
    const minutes = Math.floor(timeLeft / 60)
      .toString()
      .padStart(2, "0");
    const seconds = (timeLeft % 60).toString().padStart(2, "0");
    timerDisplay.textContent = `${minutes}:${seconds}`;
    timerDisplay.style.color = timeLeft <= 10 ? "var(--danger-color)" : "var(--text-main)";
  }

  function runTimer() {
    window.clearInterval(timerInterval);
    timerInterval = window.setInterval(() => {
      if (!isTimerRunning) return;

      if (timeLeft <= 0) {
        window.clearInterval(timerInterval);
        isTimerRunning = false;
        updateTimerUI();
        vibrate([200, 100, 200]);
        hideAllScreens(Object.values(screens));
        screens.timeout.classList.remove("hidden");
        return;
      }

      timeLeft--;
      updateTimerUI();
    }, 1000);
  }

  function startTimer() {
    hideAllScreens(Object.values(screens));
    screens.timer.classList.remove("hidden");

    const selectedTime = Number.parseInt(timerSelect.value, 10);
    timeLeft = Number.isNaN(selectedTime) ? 300 : selectedTime;
    isTimerRunning = true;
    updateTimerUI();
    runTimer();
    qs("toggle-timer-btn").textContent = "Пауза";
  }

  qs("start-game-btn").addEventListener("click", () => {
    totalPlayers = Number.parseInt(playersInput.value, 10);
    const numSpies = Number.parseInt(spiesInput.value, 10);

    if (Number.isNaN(totalPlayers) || totalPlayers < 3) {
      showToast("Минимум игроков: 3");
      return;
    }
    if (Number.isNaN(numSpies) || numSpies < 1) {
      showToast("Минимум шпионов: 1");
      return;
    }
    if (numSpies >= totalPlayers) {
      showToast("Шпионов не может быть столько же или больше, чем игроков!");
      return;
    }

    let words = [];
    const currentTheme = themeSelect.value;

    if (currentTheme === "custom") {
      words = customWordsInput.value
        .split(",")
        .map(w => w.trim())
        .filter(w => w !== "");
    } else {
      words = themesData[currentTheme];
    }

    if (!Array.isArray(words) || words.length < 2) {
      showToast("В выбранной теме слишком мало слов — нужно хотя бы 2.");
      return;
    }

    // Fisher-Yates: перемешиваем индексы игроков и берём первые numSpies
    const playerIndices = Array.from({ length: totalPlayers }, (_, i) => i + 1);
    for (let i = playerIndices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [playerIndices[i], playerIndices[j]] = [playerIndices[j], playerIndices[i]];
    }
    spyPlayerNumbers = playerIndices.slice(0, numSpies);

    if (currentTheme === "custom") {
      const wordIdx = Math.floor(Math.random() * words.length);
      currentSecretWord = words[wordIdx];
    } else {
      if (!wordsBag[currentTheme] || wordsBag[currentTheme].length === 0) {
        wordsBag[currentTheme] = [...words];
        for (let i = wordsBag[currentTheme].length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [wordsBag[currentTheme][i], wordsBag[currentTheme][j]] = [
            wordsBag[currentTheme][j],
            wordsBag[currentTheme][i],
          ];
        }
      }
      currentSecretWord = wordsBag[currentTheme].pop();
    }

    spyFakeWord = "";
    if (falseLocationMode.checked) {
      const otherWords = words.filter(w => w !== currentSecretWord);
      spyFakeWord =
        otherWords.length > 0 ? otherWords[Math.floor(Math.random() * otherWords.length)] : "ОШИБКА ЛОКАЦИИ";
    }

    currentPlayerIndex = 1;
    showPassScreen();
  });

  qs("show-role-btn").addEventListener("click", () => {
    clickFeedback();
    hideAllScreens(Object.values(screens));

    let text = "";
    let className = "";
    const isSpy = spyPlayerNumbers.includes(currentPlayerIndex);

    if (isSpy) {
      if (falseLocationMode.checked) {
        text = spyFakeWord;
        className = "reveal-word civilian-effect";
      } else {
        text = "ТЫ ШПИОН";
        className = "reveal-word spy-effect";
      }
    } else {
      text = currentSecretWord;
      className = "reveal-word civilian-effect";
    }

    cinematicRole.textContent = text;
    cinematicRole.className = className;

    document.body.classList.add("modal-open");
    // форс-рефлоу, чтобы анимация стабильно проигрывалась
    revealOverlay.offsetHeight;
    requestAnimationFrame(() => revealOverlay.classList.add("active"));
    vibrate([60, 40, 60]);
  });

  revealOverlay.addEventListener("click", () => {
    revealOverlay.classList.remove("active");
    document.body.classList.remove("modal-open");

    window.setTimeout(() => {
      cinematicRole.textContent = "";
      if (currentPlayerIndex < totalPlayers) {
        currentPlayerIndex++;
        showPassScreen();
      } else {
        startTimer();
      }
    }, 250);
  });

  qs("toggle-timer-btn").addEventListener("click", () => {
    clickFeedback();
    isTimerRunning = !isTimerRunning;
    qs("toggle-timer-btn").textContent = isTimerRunning ? "Пауза" : "Продолжить";
  });

  qs("new-game-btn").addEventListener("click", () => {
    window.clearInterval(timerInterval);
    isTimerRunning = false;
    hideAllScreens(Object.values(screens));
    screens.setup.classList.remove("hidden");
  });

  qs("timeout-new-game-btn").addEventListener("click", () => {
    hideAllScreens(Object.values(screens));
    screens.setup.classList.remove("hidden");
  });
}

main();

