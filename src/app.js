const themeColors = {
  historical_figures: "#d4af37", 
  clash_royale: "#2563eb",       
  anime: "#ec4899",              
  anime_characters: "#e11d48",   
  movies: "#eab308",             
  teachers: "#8b5cf6",           
  superheroes: "#ef4444",        
  villains: "#9333ea",           
  countries: "#10b981",          
  celebrities: "#facc15",        
  cartoons: "#06b6d4",           
  tv_series: "#6366f1",          
  brawl_stars: "#ff9800",       
  cs2_weapons: "#ea580c",        
  games: "#22c55e",              
  memes: "#14b8a6",              
  food: "#ff7849",               
  cartoon_characters: "#84cc16", 
  bobiki: "#a855f7",             
  cars: "#38bdf8",               
  moto: "#be123c",              
  prof: "#0284c7",               
  weapons: "#78716c",
  liminals: "#94a3b8",
  creepypasta: "#7f1d1d",
  myth_cr: "#b45309",
  horrors: "#295556",
  film_places: "#c026d3",
  cities: "#0ea5e9",
  music: "#db2777",
  books: "#a16207",
  mel_seasons: "#16a34a",
  dota_2: "#1d4ed8",
  genshin: "#2dd4bf",
  phones: "#475569",
  random: "#818cf8",          
  custom: "#d946ef",             
};

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  const num = Number.parseInt(clean, 16);
  return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`;
}

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
  const themePickerTrigger = qs("theme-picker-trigger");
  const themeTriggerEmoji = qs("theme-trigger-emoji");
  const themeTriggerText = qs("theme-trigger-text");
  const themePickerOverlay = qs("theme-picker-overlay");
  const themePickerPanel = themePickerOverlay?.querySelector(".theme-picker-panel");
  const themePickerList = qs("theme-picker-list");
  const customContainer = qs("custom-theme-container");
  const customWordsInput = qs("custom-words");
  const playersInput = qs("players-input");
  const spiesInput = qs("spies-input");
  const falseLocationMode = qs("false-location-mode");
  const timerSelect = qs("timer-select");
  const timerDisplay = qs("timer-display");
  const revealOverlay = qs("reveal-overlay");
  const cinematicRole = qs("cinematic-role");
  const whoIsThisBtn = qs("who-is-this-btn");

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
  let themePickerClosing = false;
  let whoIsThisWord = "";

  function parseThemeOptionLabel(raw) {
    const text = String(raw || "").trim();
    const match = text.match(/^(\S+)\s+(.+)$/u);
    if (!match) return { emoji: "🎲", label: text || "Тема" };
    return { emoji: match[1], label: match[2] };
  }

  function syncThemeTrigger() {
    const option = themeSelect.selectedOptions[0];
    const { emoji, label } = parseThemeOptionLabel(option?.textContent);
    themeTriggerEmoji.textContent = emoji;
    themeTriggerText.textContent = label;
  }

  // ---- Поиск тем: нормализация, нечёткое сравнение, подсветка ----
  // Всё строится из themeSelect.options, поэтому новые темы
  // (новый <option> + ключ в themesData) подхватываются без изменения кода.
  const themeSearchInput = document.getElementById("theme-search-input");
  const themeSearchClear = document.getElementById("theme-search-clear");
  const themeSearchCount = document.getElementById("theme-search-count");
  const themeSearchEmpty = document.getElementById("theme-search-empty");
  let themeSearchDebounce = null;

  function normalizeThemeText(raw) {
    return String(raw || "")
      .toLowerCase()
      .replace(/ё/g, "е")
      .replace(/[^a-zа-я0-9\s-]+/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeKeepLength(raw) {
    return String(raw || "").toLowerCase().replace(/ё/g, "е");
  }

  // Транслит кириллица -> латиница для поиска "бравл" ~ "brawl", "старс" ~ "stars"
  const RU_TRANSLIT_MAP = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo",
    ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m",
    н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u",
    ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch",
    ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  };

  function translitRu(s) {
    return String(s || "").replace(/[а-яё]/g, ch => RU_TRANSLIT_MAP[ch] ?? ch);
  }

  function escapeHtml(raw) {
    return String(raw || "").replace(/[&<>"']/g, ch => {
      switch (ch) {
        case "&": return "&amp;";
        case "<": return "&lt;";
        case ">": return "&gt;";
        case '"': return "&quot;";
        case "'": return "&#39;";
        default: return ch;
      }
    });
  }

  function fuzzyThreshold(queryLen) {
    if (queryLen <= 1) return 0;
    if (queryLen <= 4) return 1;
    if (queryLen <= 7) return 2;
    return 3;
  }

  // Дистанция Левенштейна с ранним выходом: верну > maxDist если далеко
  function levenshteinCapped(a, b, maxDist) {
    if (a === b) return 0;
    if (Math.abs(a.length - b.length) > maxDist) return maxDist + 1;
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    let prev = new Array(b.length + 1);
    let curr = new Array(b.length + 1);
    for (let j = 0; j <= b.length; j++) prev[j] = j;

    for (let i = 1; i <= a.length; i++) {
      curr[0] = i;
      let rowMin = curr[0];
      const ca = a.charCodeAt(i - 1);
      for (let j = 1; j <= b.length; j++) {
        const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
        const del = prev[j] + 1;
        const ins = curr[j - 1] + 1;
        const sub = prev[j - 1] + cost;
        const val = del < ins ? (del < sub ? del : sub) : (ins < sub ? ins : sub);
        curr[j] = val;
        if (val < rowMin) rowMin = val;
      }
      if (rowMin > maxDist) return maxDist + 1;
      const tmp = prev;
      prev = curr;
      curr = tmp;
    }
    return prev[b.length];
  }

  function scoreTokenAgainstLabelToken(queryToken, labelToken) {
    if (!queryToken || !labelToken) return 0;
    if (labelToken === queryToken) return 100;
    if (labelToken.startsWith(queryToken)) return 80;
    if (labelToken.includes(queryToken)) return 65;

    // Транслит-вариант: ищем и по "bravl" ~ "brawl"
    const tq = translitRu(queryToken);
    const tl = translitRu(labelToken);
    if (tq !== queryToken || tl !== labelToken) {
      if (tl === tq) return 90;
      if (tl.startsWith(tq)) return 70;
      if (tl.includes(tq)) return 55;
    }

    const threshold = fuzzyThreshold(queryToken.length);
    let best = 0;
    if (threshold > 0) {
      const dist = levenshteinCapped(queryToken, labelToken, threshold);
      if (dist <= threshold) best = 45 - dist * 8;
    }
    if (tq !== queryToken || tl !== labelToken) {
      const tThreshold = fuzzyThreshold(tq.length);
      if (tThreshold > 0) {
        const tDist = levenshteinCapped(tq, tl, tThreshold);
        if (tDist <= tThreshold) best = Math.max(best, 40 - tDist * 8);
      }
    }
    return best;
  }

  // 0 = не подходит, больше = лучше
  function scoreThemeMatch(normalizedLabel, normalizedQuery) {
    if (!normalizedQuery) return 50;
    if (normalizedLabel === normalizedQuery) return 120;
    if (normalizedLabel.startsWith(normalizedQuery)) return 100;
    if (normalizedLabel.includes(normalizedQuery)) return 80;

    const labelTokens = normalizedLabel.split(/[\s-]+/).filter(Boolean);
    const queryTokens = normalizedQuery.split(/[\s-]+/).filter(Boolean);
    if (queryTokens.length === 0) return 50;

    // Слитное написание: "анимеперсонажи" ~ "аниме персонажи"
    const compactLabel = normalizedLabel.replace(/[\s-]+/g, "");
    const compactQuery = normalizedQuery.replace(/[\s-]+/g, "");
    if (compactLabel.includes(compactQuery) && compactQuery.length >= 3) return 60;
    if (compactQuery.length >= 4) {
      const compactDist = levenshteinCapped(compactQuery, compactLabel, fuzzyThreshold(compactQuery.length));
      if (compactDist <= fuzzyThreshold(compactQuery.length)) return 42 - compactDist * 5;
    }

    if (queryTokens.length === 1) {
      let best = 0;
      for (const lt of labelTokens) {
        const s = scoreTokenAgainstLabelToken(queryTokens[0], lt);
        if (s > best) best = s;
      }
      return best;
    }

    // Многословный запрос: в идеале каждое слово находится в теме,
    // но при частичном совпадении (например "оружие кс" ~ "Оружие CS 2")
    // тоже показываем результат с пониженным скором, а не пустой список
    let total = 0;
    let matched = 0;
    for (const qt of queryTokens) {
      let best = 0;
      for (const lt of labelTokens) {
        const s = scoreTokenAgainstLabelToken(qt, lt);
        if (s > best) best = s;
      }
      total += best;
      if (best > 0) matched++;
    }
    if (matched === queryTokens.length) return Math.round(total / queryTokens.length) - 2;
    if (matched > 0) return Math.round((total / queryTokens.length) * 0.5);
    return 0;
  }

  function highlightThemeLabel(label, rawQuery) {
    const plain = escapeHtml(label);
    const q = normalizeKeepLength(rawQuery).trim();
    if (!q) return plain;
    const tokens = q.split(/\s+/).filter(t => t.length >= 2).sort((a, b) => b.length - a.length);
    if (tokens.length === 0) return plain;

    const normLabel = normalizeKeepLength(label);
    const ranges = [];
    for (const token of tokens) {
      let from = 0;
      while (from <= normLabel.length - token.length) {
        const idx = normLabel.indexOf(token, from);
        if (idx === -1) break;
        ranges.push([idx, idx + token.length]);
        from = idx + token.length;
      }
    }
    if (ranges.length === 0) return plain;

    ranges.sort((a, b) => a[0] - b[0]);
    const merged = [];
    for (const r of ranges) {
      const last = merged[merged.length - 1];
      if (last && r[0] <= last[1]) {
        last[1] = Math.max(last[1], r[1]);
      } else {
        merged.push([r[0], r[1]]);
      }
    }

    let html = "";
    let pos = 0;
    for (const [start, end] of merged) {
      html += escapeHtml(label.slice(pos, start));
      html += `<mark>${escapeHtml(label.slice(start, end))}</mark>`;
      pos = end;
    }
    html += escapeHtml(label.slice(pos));
    return html;
  }

  function getVisibleThemeOptions() {
    return Array.from(themePickerList.querySelectorAll(".theme-picker-option"));
  }

  function lockThemePanelTop() {
    if (!themePickerPanel || themePickerPanel.classList.contains("top-locked")) return;
    if (!themePickerOverlay || !themePickerOverlay.classList.contains("open")) return;
    const overlayRect = themePickerOverlay.getBoundingClientRect();
    const panelRect = themePickerPanel.getBoundingClientRect();
    const overlayPaddingTop = parseFloat(getComputedStyle(themePickerOverlay).paddingTop) || 0;
    const marginTop = Math.max(0, (panelRect.top - overlayRect.top) - overlayPaddingTop);
    themePickerPanel.style.setProperty("--locked-top", `${marginTop}px`);
    themePickerPanel.classList.add("top-locked");
  }

  function unlockThemePanelTop() {
    if (!themePickerPanel || !themePickerPanel.classList.contains("top-locked")) return;
    themePickerPanel.classList.remove("top-locked");
    themePickerPanel.style.removeProperty("--locked-top");
  }

  function renderThemeOptions(rawQuery) {
    const query = String(rawQuery ?? "");
    const normalizedQuery = normalizeThemeText(query);
    const total = themeSelect.options.length;

    if (normalizedQuery.length > 0) {
      lockThemePanelTop();
    } else {
      unlockThemePanelTop();
    }

    const items = [];
    for (const option of themeSelect.options) {
      const { emoji, label } = parseThemeOptionLabel(option.textContent);
      const normalized = normalizeThemeText(label);
      const score = scoreThemeMatch(normalized, normalizedQuery);
      items.push({ value: option.value, emoji, label, score, selected: option.selected });
    }

    const filtered = normalizedQuery
      ? items.filter(i => i.score > 0).sort((a, b) => b.score - a.score || a.label.localeCompare(b.label, "ru"))
      : items;

    themePickerList.innerHTML = "";
    const selectedValue = themeSelect.value;
    filtered.forEach((item, i) => {
      const li = document.createElement("li");
      li.setAttribute("role", "presentation");

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "theme-picker-option";
      btn.setAttribute("role", "option");
      btn.dataset.value = item.value;
      btn.setAttribute("aria-selected", (item.selected || item.value === selectedValue) ? "true" : "false");
      btn.style.setProperty("--i", String(Math.min(i, 12)));

      const emojiEl = document.createElement("span");
      emojiEl.className = "theme-picker-option-emoji";
      emojiEl.setAttribute("aria-hidden", "true");
      emojiEl.textContent = item.emoji;

      const textEl = document.createElement("span");
      textEl.className = "theme-picker-option-text";
      if (normalizedQuery) {
        textEl.innerHTML = highlightThemeLabel(item.label, query);
      } else {
        textEl.textContent = item.label;
      }

      const checkEl = document.createElement("span");
      checkEl.className = "theme-picker-option-check";
      checkEl.setAttribute("aria-hidden", "true");

      btn.append(emojiEl, textEl, checkEl);
      btn.addEventListener("click", () => {
        clickFeedback();
        selectTheme(item.value);
        closeThemePicker();
      });

      li.appendChild(btn);
      themePickerList.appendChild(li);
    });

    const hasQuery = normalizedQuery.length > 0;
    themePickerList.classList.toggle("is-filtering", hasQuery && filtered.length > 0);

    if (themeSearchCount) {
      themeSearchCount.textContent = hasQuery
        ? (filtered.length > 0 ? `Найдено: ${filtered.length} из ${total}` : "")
        : `Всего тем: ${total}`;
    }
    if (themeSearchClear) {
      themeSearchClear.hidden = query.length === 0;
    }
    if (themeSearchEmpty) {
      themeSearchEmpty.hidden = filtered.length !== 0;
    }
    themePickerList.style.display = filtered.length === 0 ? "none" : "";
  }

  function buildThemePickerList() {
    renderThemeOptions(themeSearchInput ? themeSearchInput.value : "");
  }

  function clearThemeSearch(focusInput = true) {
    if (!themeSearchInput) return;
    unlockThemePanelTop();
    themeSearchInput.value = "";
    renderThemeOptions("");
    if (themeSearchInput && focusInput && themePickerOverlay.classList.contains("open")) {
      themeSearchInput.focus({ preventScroll: true });
    }
  }

  function initThemeSearch() {
    if (!themeSearchInput) return;

    themeSearchInput.addEventListener("input", () => {
      window.clearTimeout(themeSearchDebounce);
      if (themeSearchInput.value.trim().length > 0) {
        lockThemePanelTop();
      }
      themeSearchDebounce = window.setTimeout(() => {
        renderThemeOptions(themeSearchInput.value);
      }, 90);
    });

    themeSearchInput.addEventListener("keydown", event => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        const first = getVisibleThemeOptions()[0];
        first?.focus();
      } else if (event.key === "Enter") {
        // На мобильных: прячем клавиатуру, чтобы было видно результаты
        event.preventDefault();
        themeSearchInput.blur();
      }
    });

    themeSearchClear?.addEventListener("click", () => {
      clickFeedback();
      clearThemeSearch(true);
    });

    themePickerList.addEventListener("keydown", event => {
      const options = getVisibleThemeOptions();
      if (options.length === 0) return;
      const active = document.activeElement;
      const idx = options.indexOf(active);
      if (idx === -1) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        (options[idx + 1] || options[0]).focus();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        if (idx === 0) {
          themeSearchInput.focus();
        } else {
          options[idx - 1].focus();
        }
      } else if (event.key === "Home") {
        event.preventDefault();
        options[0].focus();
      } else if (event.key === "End") {
        event.preventDefault();
        options[options.length - 1].focus();
      }
    });
  }

  function markSelectedThemeOption() {
    const value = themeSelect.value;
    for (const btn of themePickerList.querySelectorAll(".theme-picker-option")) {
      btn.setAttribute("aria-selected", btn.dataset.value === value ? "true" : "false");
    }
  }

  function openThemePicker() {
    if (themePickerClosing || themePickerOverlay.classList.contains("open")) return;

    if (themeSearchInput) {
      themeSearchInput.value = "";
      renderThemeOptions("");
    } else {
      markSelectedThemeOption();
    }
    themePickerOverlay.hidden = false;
    themePickerOverlay.classList.remove("closing");
    themePickerTrigger.setAttribute("aria-expanded", "true");
    document.body.classList.add("modal-open");

    themePickerOverlay.offsetHeight;
    requestAnimationFrame(() => {
      themePickerOverlay.classList.add("open");
      const selected = themePickerList.querySelector('.theme-picker-option[aria-selected="true"]');
      selected?.scrollIntoView({ block: "nearest" });
      if (themeSearchInput) {
        // Фокус в поиск — клавиатура открыта сразу, список крутится под ним
        themeSearchInput.focus({ preventScroll: true });
      } else {
        selected?.focus();
      }
    });
  }

  function closeThemePicker() {
    if (!themePickerOverlay.classList.contains("open") || themePickerClosing) return;

    themePickerClosing = true;
    unlockThemePanelTop();
    themePickerOverlay.classList.add("closing");
    themePickerOverlay.classList.remove("open");
    themePickerTrigger.setAttribute("aria-expanded", "false");

    const finish = () => {
      themePickerOverlay.classList.remove("closing");
      themePickerOverlay.hidden = true;
      themePickerClosing = false;
      if (!revealOverlay.classList.contains("active")) {
        document.body.classList.remove("modal-open");
      }
      themeSearchInput?.blur();
      themePickerTrigger.focus();
    };

    const onEnd = event => {
      if (event.target !== themePickerOverlay) return;
      themePickerOverlay.removeEventListener("transitionend", onEnd);
      window.clearTimeout(fallbackTimer);
      finish();
    };

    themePickerOverlay.addEventListener("transitionend", onEnd);
    const fallbackTimer = window.setTimeout(() => {
      themePickerOverlay.removeEventListener("transitionend", onEnd);
      finish();
    }, 280);
  }

  function selectTheme(value) {
    if (themeSelect.value === value) {
      syncThemeTrigger();
      return;
    }
    themeSelect.value = value;
    themeSelect.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function setAccentForTheme(theme) {
    const newColor = themeColors[theme] || "#a855f7";
    const rgb = hexToRgb(newColor);
    document.documentElement.style.setProperty("--accent-color", newColor);
    document.documentElement.style.setProperty("--accent-rgb", rgb);

    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute("content", "#0c0e16");
    }
  }

  buildThemePickerList();
  initThemeSearch();
  syncThemeTrigger();
  setAccentForTheme(themeSelect.value);

  themePickerTrigger.addEventListener("click", () => {
    clickFeedback();
    if (themePickerOverlay.classList.contains("open")) {
      closeThemePicker();
    } else {
      openThemePicker();
    }
  });

  themePickerOverlay.querySelectorAll("[data-theme-picker-close]").forEach(el => {
    el.addEventListener("click", () => closeThemePicker());
  });

  document.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    if (!themePickerOverlay.classList.contains("open")) return;
    event.preventDefault();
    // Первый Esc очищает поиск, второй — закрывает
    if (themeSearchInput && themeSearchInput.value) {
      clearThemeSearch(true);
      return;
    }
    closeThemePicker();
  });

  themeSelect.addEventListener("change", () => {
    const isCustom = themeSelect.value === "custom";
    customContainer.classList.toggle("hidden", !isCustom);
    setAccentForTheme(themeSelect.value);
    syncThemeTrigger();
    markSelectedThemeOption();
  });
  function getSelectedThemeLabel() {
    const option = themeSelect.selectedOptions[0];
    return parseThemeOptionLabel(option?.textContent).label;
  }

  function syncInGameThemeBadges() {
    const label = getSelectedThemeLabel();
    qs("pass-theme-name").textContent = label;
    qs("reveal-theme-name").textContent = label;
  }

  function showPassScreen() {
    hideAllScreens(Object.values(screens));
    syncInGameThemeBadges();
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

  function hideWhoIsThisBtn() {
    whoIsThisBtn.classList.remove("is-visible");
    whoIsThisBtn.hidden = true;
    whoIsThisWord = "";
  }

  function showWhoIsThisBtn(word) {
    whoIsThisWord = String(word || "").trim();
    if (!whoIsThisWord) {
      hideWhoIsThisBtn();
      return;
    }

    whoIsThisBtn.hidden = false;
    whoIsThisBtn.classList.remove("is-visible");
    whoIsThisBtn.offsetHeight;
    requestAnimationFrame(() => {
      whoIsThisBtn.classList.add("is-visible");
    });
  }

  function openWordSearch(themeLabel, word) {
    const query = `${themeLabel} ${word}`.trim();
    if (!query) return;

    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (opened) return;

    // Fallback для Android / PWA, если popup заблокирован
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  whoIsThisBtn.addEventListener("click", event => {
    event.stopPropagation();
    clickFeedback();
    openWordSearch(getSelectedThemeLabel(), whoIsThisWord);
  });

  qs("show-role-btn").addEventListener("click", () => {
    clickFeedback();
    hideAllScreens(Object.values(screens));
    hideWhoIsThisBtn();

    let text = "";
    let className = "";
    const isSpy = spyPlayerNumbers.includes(currentPlayerIndex);
    const isPlainSpy = isSpy && !falseLocationMode.checked;

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
    requestAnimationFrame(() => {
      revealOverlay.classList.add("active");
      // Кнопка только когда показывают слово: мирный или шпион с ложной локацией
      if (!isPlainSpy) {
        showWhoIsThisBtn(text);
      }
    });
    vibrate([60, 40, 60]);
  });

  revealOverlay.addEventListener("click", () => {
    hideWhoIsThisBtn();
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

