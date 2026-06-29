// Меняй версию при каждом деплое — это автоматически сбросит кеш у всех пользователей
const CACHE_VERSION = "spy-pro-v12";

const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./words.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./src/styles.css",
  "./src/app.js"
];

// ─── Установка: кешируем все статические файлы ────────────────────────────────
self.addEventListener("install", event => {
  self.skipWaiting(); // новый воркер активируется немедленно, не ждёт закрытия вкладок

  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => cache.addAll(STATIC_ASSETS))
  );
});

// ─── Активация: удаляем все старые кеши ───────────────────────────────────────
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_VERSION)
          .map(key => caches.delete(key))
      )
    ).then(() => clients.claim()) // берём контроль над всеми открытыми вкладками
  );
});

// ─── Стратегии кеширования ─────────────────────────────────────────────────────
self.addEventListener("fetch", event => {
  const { request } = event;
  const url = new URL(request.url);

  // Игнорируем не-GET запросы и запросы к другим доменам (аналитика и т.п.)
  if (request.method !== "GET" || url.origin !== location.origin) return;

  // HTML-страницы: Network First → при офлайне отдаём кеш
  // Так пользователи всегда получают свежую версию игры при наличии сети
  if (request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Всё остальное (иконки, манифест и т.д.): Cache First → быстро и без трафика
  event.respondWith(cacheFirst(request));
});

// ─── Network First: пробуем сеть, при ошибке — кеш ───────────────────────────
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);

    // Кешируем свежий ответ для офлайн-доступа
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_VERSION);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch {
    const cached = await caches.match(request);
    return cached ?? Response.error();
  }
}

// ─── Cache First: отдаём кеш, при промахе — сеть + кешируем ──────────────────
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_VERSION);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch {
    return Response.error();
  }
}
