/* The offline copy: lets the guides open without a connection, using only this site's own files.

   - Pages and their data (HTML, _next/data): network first. Online visits always get the latest dates;
     the saved copy is used only when the network fails.
   - Build files (_next/static): saved on first use and served from the copy. Their names change whenever
     their content does, so a saved one is never out of date.
   - Fonts, images, icons and the manifest: served from the copy and refreshed in the background.
   - After a visit, every route and the build files its HTML names are saved, at most every six hours, so
     a course not opened yet still opens offline.

   Nothing here contacts another host. To remove the copy from every browser, replace this file with one
   that calls self.registration.unregister() and deletes its caches. */
const VERSION = 'v1';
const PAGES = `guides-pages-${VERSION}`;
const FILES = `guides-files-${VERSION}`;
const SCOPE = new URL('./', self.location).pathname; // e.g. /tmu-course-guides/
const ROUTES = ['', 'courses/', 'cen100/', 'mth140/', 'mth141/', 'privacy/', 'updates/'];
const REFRESH_MS = 6 * 3600e3;
const MAX_FILES = 160;
const STAMP = `${SCOPE}__offline-saved`;

const sameScope = (url) => url.origin === self.location.origin && url.pathname.startsWith(SCOPE);
const pageKey = (url) => `${url.origin}${url.pathname}`; // queries and hashes share one saved page
const isBuildFile = (url) => url.pathname.startsWith(`${SCOPE}_next/static/`);
const isPageData = (url) => url.pathname.startsWith(`${SCOPE}_next/data/`);
const usable = (response) => response && response.ok && response.type === 'basic' && !response.redirected;

const OFFLINE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Offline | TMU Course Guides</title><style>body{margin:0;padding:2rem 1rem;font:1rem/1.5 system-ui,sans-serif;color:#18181b;background:#f4f4f5}a{color:#004c9b}</style></head><body><h1>You're offline</h1><p>This page hasn't been saved on this device yet. <a href="${SCOPE}">Open the Desk</a>, or try again when you're connected.</p></body></html>`;

// Keeps the build-file copy bounded: the oldest saved entries go first.
async function trim(cache) {
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_FILES)).map((key) => cache.delete(key)));
}

// A file the copy may keep: this site's own fonts, images, scripts and styles, not pages or their data.
const savable = (href) => {
  const url = new URL(href, self.location.origin);
  return sameScope(url) && !isPageData(url) && url.pathname !== `${SCOPE}sw.js` && /\.(?:js|css|woff2|png|webp|jpe?g|svg|webmanifest)$/.test(url.pathname);
};

// Saves every route, the build files its HTML names, the fonts and images its styles name, and the files
// the page reports it has already loaded (`loaded`; a first visit loads them before this worker is in
// control). Failures are skipped: a later visit tries again.
async function saveAll(loaded = []) {
  const [pages, files] = await Promise.all([caches.open(PAGES), caches.open(FILES)]);
  const wanted = new Set(loaded.filter((href) => typeof href === 'string' && savable(href)).map((href) => new URL(href, self.location.origin).href));
  await Promise.all(
    ROUTES.map(async (route) => {
      const url = new URL(`${SCOPE}${route}`, self.location.origin);
      try {
        const response = await fetch(url, { cache: 'no-cache' });
        if (!usable(response)) return;
        const html = await response.clone().text();
        await pages.put(pageKey(url), response);
        for (const match of html.matchAll(/(?:src|href)="([^"]*\/_next\/static\/[^"]+)"/g)) wanted.add(new URL(match[1], url).href);
      } catch {
        // offline or a failed request: keep the previous copy
      }
    }),
  );
  const save = async (href) => {
    const saved = await files.match(href);
    if (saved) return saved;
    try {
      const response = await fetch(href);
      if (usable(response)) await files.put(href, response.clone());
      return response;
    } catch {
      return null; // saved on first use instead
    }
  };
  const styles = await Promise.all([...wanted].filter((href) => href.endsWith('.css')).map(save));
  for (const [index, href] of [...wanted].filter((item) => item.endsWith('.css')).entries()) {
    const css = styles[index] ? await styles[index].clone().text() : '';
    for (const match of css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) if (savable(new URL(match[1], href).href)) wanted.add(new URL(match[1], href).href);
  }
  await Promise.all([...wanted].map(save));
  await trim(files);
  await pages.put(STAMP, new Response(String(Date.now())));
}

async function saveIfDue(loaded) {
  const stamp = await (await caches.open(PAGES)).match(STAMP);
  const last = stamp ? Number(await stamp.text()) : 0;
  if (!(Date.now() - last < REFRESH_MS)) await saveAll(loaded);
}

async function networkFirst(request, url) {
  const pages = await caches.open(PAGES);
  try {
    const response = await fetch(request);
    if (usable(response)) await pages.put(pageKey(url), response.clone());
    return response;
  } catch (error) {
    // A folder address without its slash (GitHub Pages redirects it) uses the folder's saved page.
    const folder = !url.pathname.endsWith('/') && !/\.[a-z0-9]+$/i.test(url.pathname);
    const saved = (await pages.match(pageKey(url))) || (folder && (await pages.match(`${pageKey(url)}/`)));
    if (saved) return saved;
    if (request.mode === 'navigate') return new Response(OFFLINE, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    throw error;
  }
}

async function savedFirst(request) {
  const files = await caches.open(FILES);
  const saved = await files.match(request);
  if (saved) return saved;
  const response = await fetch(request);
  if (usable(response)) await files.put(request, response.clone());
  return response;
}

async function refreshInBackground(event, request) {
  const files = await caches.open(FILES);
  const saved = await files.match(request);
  const update = fetch(request)
    .then(async (response) => {
      if (usable(response)) await files.put(request, response.clone());
      return response;
    })
    .catch(() => saved);
  if (!saved) return update;
  event.waitUntil(update);
  return saved;
}

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([PAGES, FILES]);
      await Promise.all((await caches.keys()).filter((key) => key.startsWith('guides-') && !keep.has(key)).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

// The page asks after it has loaded, so saving never competes with the visit itself.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'save-offline-copy') event.waitUntil(saveIfDue(Array.isArray(event.data.loaded) ? event.data.loaded : []));
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || request.headers.has('range')) return;
  const url = new URL(request.url);
  if (!sameScope(url) || url.pathname === `${SCOPE}sw.js`) return;
  if (request.mode === 'navigate' || isPageData(url)) event.respondWith(networkFirst(request, url));
  else if (isBuildFile(url)) event.respondWith(savedFirst(request));
  else event.respondWith(refreshInBackground(event, request));
});
