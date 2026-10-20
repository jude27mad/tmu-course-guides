// QA-only static server. The exported _document retains the site's exact CSP.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const base = '/tmu-course-guides/next';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../out');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };

export async function startServer(port = 0) {
  const server = createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (!pathname.startsWith(`${base}/`)) return void res.writeHead(404).end();
      let path = resolve(root, `.${pathname.slice(base.length)}`);
      if (!path.startsWith(`${root}${sep}`)) return void res.writeHead(403).end();
      if ((await stat(path)).isDirectory()) path = join(path, 'index.html');
      res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream' });
      res.end(await readFile(path));
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((done) => server.listen(port, '127.0.0.1', done));
  return { server, origin: `http://127.0.0.1:${server.address().port}`, base };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { origin } = await startServer(Number(process.env.PORT) || 4174);
  console.log(`${origin}${base}/spike/`);
}
