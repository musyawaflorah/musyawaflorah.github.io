// Minimal local preview server for dist/. Listens on localhost only.
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const port = Number(process.env.PORT) || 4173;
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8' };

createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  let file = normalize(join(dist, pathname));
  if (file !== dist && !file.startsWith(dist + sep)) { res.writeHead(403).end(); return; }
  if (existsSync(file) && statSync(file).isDirectory()) {
    if (!pathname.endsWith('/')) { res.writeHead(301, { Location: `${pathname}/` }).end(); return; }
    file = join(file, 'index.html');
  }
  const found = existsSync(file);
  if (!found) file = join(dist, '404.html');
  res.writeHead(found ? 200 : 404, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
  createReadStream(file).pipe(res);
}).listen(port, '127.0.0.1', () => console.log(`Preview: http://localhost:${port}/`));
