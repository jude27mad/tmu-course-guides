// A local server that behaves like GitHub Pages for this project site, for the browser checks in
// check-pages-site.mjs and check-palette-site.mjs: the published folder is served under /tmu-course-guides/,
// a folder without its trailing slash redirects, a folder serves its index.html, and anything missing gets
// the site's 404.html with status 404.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';

export const BASE = '/tmu-course-guides';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.txt': 'text/plain',
};

export function pagesServer(folder) {
  const root = resolve(folder);
  return createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const notFound = async () => {
      res.writeHead(404, { 'Content-Type': TYPES['.html'] });
      res.end(await readFile(join(root, '404.html')));
    };
    try {
      const pathname = decodeURIComponent(url.pathname);
      if (pathname !== BASE && !pathname.startsWith(`${BASE}/`)) return notFound();
      let path = resolve(root, `.${pathname.slice(BASE.length)}`);
      if (path !== root && !path.startsWith(`${root}${sep}`)) return notFound();
      if ((await stat(path)).isDirectory()) {
        if (!pathname.endsWith('/')) {
          res.writeHead(301, { Location: `${url.pathname}/${url.search}` });
          return res.end();
        }
        path = join(path, 'index.html');
      }
      const body = await readFile(path);
      res.writeHead(200, { 'Content-Type': TYPES[extname(path)] || 'application/octet-stream' });
      return res.end(body);
    } catch {
      return notFound();
    }
  });
}

// Starts the server on a free port; resolves to { server, site } where site is the published root URL.
export async function servePages(folder) {
  const server = pagesServer(folder);
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  return { server, site: `http://127.0.0.1:${server.address().port}${BASE}/` };
}
