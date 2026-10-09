/* =========================================
NABZ CRYPTO NEWS
Service Worker
Version: 1.0
========================================= */

"use strict";

const CACHE_VERSION = "nabz-crypto-v1";

const APP_ROOT = new URL("./", self.registration.scope);

const APP_FILES = [
"./",
"./index.html",
"./manifest.json",
"./assets/css/style.css",
"./assets/js/app.js",
"./data/news.json"
].map((path) => new URL(path, APP_ROOT).href);

const NEWS_FILE = new URL(
"./data/news.json",
APP_ROOT
).href;

const STATIC_CACHE = "${CACHE_VERSION}-static";
const NEWS_CACHE = "${CACHE_VERSION}-news";

/* Install */

self.addEventListener("install", (event) => {
event.waitUntil(
(async () => {
const cache = await caches.open(STATIC_CACHE);

  await Promise.allSettled(
    APP_FILES.map(async (url) => {
      const response = await fetch(url, {
        cache: "reload"
      });

      if (response.ok) {
        await cache.put(url, response);
      }
    })
  );

  await self.skipWaiting();
})()

);
});

/* Activate */

self.addEventListener("activate", (event) => {
event.waitUntil(
(async () => {
const validCaches = [
STATIC_CACHE,
NEWS_CACHE
];

  const cacheNames = await caches.keys();

  await Promise.all(
    cacheNames
      .filter((name) =>
        name.startsWith("nabz-crypto-") &&
        !validCaches.includes(name)
      )
      .map((name) => caches.delete(name))
  );

  await self.clients.claim();
})()

);
});

/* Fetch */

self.addEventListener("fetch", (event) => {
const request = event.request;

if (request.method !== "GET") return;

const requestUrl = new URL(request.url);

/* Never intercept external websites. */
if (requestUrl.origin !== self.location.origin) {
return;
}

/* News: try network first, then use cached data. */
if (requestUrl.href.split("?")[0] === NEWS_FILE) {
event.respondWith(
(async () => {
try {
const response = await fetch(request);

      if (response.ok) {
        const cache = await caches.open(NEWS_CACHE);

        await cache.put(
          NEWS_FILE,
          response.clone()
        );
      }

      return response;
    } catch {
      const cached = await caches.match(NEWS_FILE);

      if (cached) return cached;

      return new Response(
        JSON.stringify({
          updatedAt: null,
          news: []
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store"
          }
        }
      );
    }
  })()
);

return;

}

/* Other local files: cache first, then network. */
event.respondWith(
(async () => {
const cached = await caches.match(request);

  if (cached) return cached;

  try {
    const response = await fetch(request);

    if (
      response.ok &&
      response.type === "basic"
    ) {
      const cache = await caches.open(STATIC_CACHE);

      await cache.put(
        request,
        response.clone()
      );
    }

    return response;
  } catch {
    if (request.mode === "navigate") {
      const fallback = await caches.match(
        new URL("./index.html", APP_ROOT).href
      );

      if (fallback) return fallback;
    }

    return new Response(
      "اتصال برقرار نیست. لطفاً بعداً دوباره تلاش کن.",
      {
        status: 503,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store"
        }
      }
    );
  }
})()

);
});
