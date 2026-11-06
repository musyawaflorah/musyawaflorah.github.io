// Builds the static site into dist/. No dependencies.
// The public URL comes from the SITE_URL environment variable, or siteUrl in site.config.json.
// While neither is set, canonical links and sitemap.xml are left out on purpose, so
// an unconfirmed domain is never published in the site's metadata.
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const readJson = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));

const config = readJson('site.config.json');
const research = readJson('content/research.json');
const siteUrl = (process.env.SITE_URL || config.siteUrl || '').replace(/\/+$/, '');

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function assertDate(date, where) {
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T00:00:00Z`));
  if (!valid) throw new Error(`${where}: date must look like 2026-11-05, got "${date}"`);
}

const longDate = (date) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });

function linkList(links, className) {
  if (!links?.length) return '';
  const items = links.map((l) => `<li><a href="${esc(l.url)}">${esc(l.label)}</a></li>`).join('');
  return `<ul${className ? ` class="${className}"` : ''}>${items}</ul>`;
}

function renderLog() {
  const entries = [...research.log].sort((a, b) => b.date.localeCompare(a.date));
  const html = entries.map((e) => {
    assertDate(e.date, `Log entry "${e.title}"`);
    return `<li class="log-entry">
      <time class="log-date" datetime="${esc(e.date)}">${esc(longDate(e.date))}</time>
      <div>
        <span class="log-category">${esc(e.category)}</span>
        <h3>${esc(e.title)}</h3>
        <p>${esc(e.summary)}</p>
        ${linkList(e.links, 'log-links')}
      </div>
    </li>`;
  }).join('\n');
  return `<ol class="log" reversed>\n${html}\n</ol>`;
}

function renderResources() {
  return research.resources.map((r) => {
    const items = (r.items || []).map((i) => {
      if (i.date) assertDate(i.date, `Resource "${i.title}"`);
      const meta = [i.date && longDate(i.date), i.note].filter(Boolean).map(esc).join('. ');
      return `<li><a href="${esc(i.url)}">${esc(i.title)}</a>${meta ? ` <span>${meta}</span>` : ''}</li>`;
    }).join('');
    const body = items ? `<ul>${items}</ul>` : `<p class="empty">${esc(r.emptyText)}</p>`;
    return `<section class="resource" id="${esc(r.id)}">
      <h3>${esc(r.title)}</h3>
      <p>${esc(r.description)}</p>
      ${body}
    </section>`;
  }).join('\n');
}

function parsePage(file) {
  const text = readFileSync(join(root, 'src/pages', file), 'utf8');
  const match = text.match(/^<!--\n([\s\S]*?)\n-->\n([\s\S]*)$/);
  if (!match) throw new Error(`${file}: missing the metadata comment at the top`);
  const meta = {};
  for (const line of match[1].split('\n')) {
    const i = line.indexOf(':');
    meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { ...meta, body: match[2] };
}

function renderPage(page) {
  const depth = page.path.endsWith('/') ? page.path.split('/').length - 1 : 0;
  const rootPath = '../'.repeat(depth) || './';
  // The 404 page can be served at any depth, so its asset and nav links are root-absolute.
  const base = page.noindex ? '/' : rootPath;

  const nav = config.nav.map((n) => {
    const current = n.href === page.path ? ' aria-current="page"' : '';
    return `<li><a href="${base}${n.href}"${current}>${esc(n.label)}</a></li>`;
  }).join('\n          ');

  const canonical = siteUrl && !page.noindex ? `${siteUrl}/${page.path}` : '';
  const replacements = {
    root: base,
    email: esc(config.email),
    linkedin: esc(config.linkedin),
    log: page.path === 'progress/' ? renderLog() : '',
    resources: page.path === 'progress/' ? renderResources() : '',
  };
  const body = page.body.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    if (!(k in replacements)) throw new Error(`Unknown placeholder {{${k}}} in ${page.path}`);
    return replacements[k];
  });

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(page.title)}</title>
  <meta name="description" content="${esc(page.description)}">
  <meta name="author" content="${esc(config.name)}">
  ${page.noindex ? '<meta name="robots" content="noindex">' : ''}
  ${canonical ? `<link rel="canonical" href="${esc(canonical)}">\n  <meta property="og:url" content="${esc(canonical)}">` : ''}
  <meta property="og:type" content="website">
  <meta property="og:title" content="${esc(page.title)}">
  <meta property="og:description" content="${esc(page.description)}">
  <meta name="theme-color" content="#12294a">
  <link rel="icon" href="${base}assets/favicon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&display=swap">
  <link rel="stylesheet" href="${base}assets/styles.css">
  <script>document.documentElement.classList.add('js')</script>
  <script src="${base}assets/site.js" defer></script>
</head>
<body>
  <a class="skip-link" href="#main">Skip to main content</a>
  <div class="progress-line" aria-hidden="true"></div>
  <header class="site-header">
    <div class="wrap">
      <a class="site-name" href="${base}">${esc(config.name)}</a>
      <nav class="site-nav" aria-label="Main">
        <ul>
          ${nav}
        </ul>
      </nav>
    </div>
  </header>
  <main id="main">
${body}
  </main>
  <footer class="site-footer">
    <div class="wrap">
      <p>This is an independent personal website. It is not sponsored or endorsed by my employer. Research described here is exploratory and is not medical advice.</p>
      <p>&copy; ${new Date().getFullYear()} ${esc(config.name)} &middot; <a href="mailto:${esc(config.email)}">Email</a> &middot; <a href="${esc(config.linkedin)}">LinkedIn</a></p>
    </div>
  </footer>
  <button class="motion-toggle" type="button" aria-pressed="false">Pause motion</button>
</body>
</html>
`;
}

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
cpSync(join(root, 'src/assets'), join(dist, 'assets'), { recursive: true });

const pages = readdirSync(join(root, 'src/pages')).filter((f) => f.endsWith('.html')).map(parsePage);
for (const page of pages) {
  const out = page.path.endsWith('.html') ? join(dist, page.path) : join(dist, page.path, 'index.html');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, renderPage(page).replace(/\n\s*\n(\s*<)/g, '\n$1'));
}

if (siteUrl) {
  const urls = pages.filter((p) => !p.noindex)
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((p) => `  <url><loc>${esc(`${siteUrl}/${p.path}`)}</loc></url>`).join('\n');
  writeFileSync(join(dist, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
}
writeFileSync(join(dist, 'robots.txt'),
  `User-agent: *\nAllow: /\n${siteUrl ? `\nSitemap: ${siteUrl}/sitemap.xml\n` : ''}`);

console.log(`Built ${pages.length} pages into dist/ (${siteUrl ? `public URL: ${siteUrl}` : 'no public URL set: canonical links and sitemap.xml omitted'})`);
