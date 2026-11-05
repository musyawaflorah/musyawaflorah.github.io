// Checks dist/ for broken internal links, missing page basics, and content that the
// site's ground rules forbid. Run with: npm run check
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const problems = [];

const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : [p];
});
const htmlFiles = walk(dist).filter((f) => f.endsWith('.html'));
const titles = new Map();

for (const file of htmlFiles) {
  const rel = file.slice(dist.length + 1).replaceAll('\\', '/');
  const html = readFileSync(file, 'utf8');
  const fail = (msg) => problems.push(`${rel}: ${msg}`);

  const title = html.match(/<title>(.*?)<\/title>/)?.[1];
  if (!title) fail('missing <title>');
  else if (titles.has(title)) fail(`duplicate title also used by ${titles.get(title)}`);
  else titles.set(title, rel);

  if (!/<html lang="en">/.test(html)) fail('missing lang attribute');
  if (!/<meta name="description" content="[^"]{20,}/.test(html)) fail('missing description');
  if (!/<meta name="viewport"/.test(html)) fail('missing viewport meta');
  if ((html.match(/<h1[\s>]/g) || []).length !== 1) fail('must have exactly one <h1>');
  if (!/href="#main"/.test(html) || !/<main id="main"/.test(html)) fail('missing skip link target');
  if (/\{\{\w+\}\}/.test(html)) fail('unreplaced placeholder');
  if (!html.includes('not sponsored or endorsed')) fail('missing independence statement');

  // Heading levels must not skip (for example h1 straight to h3).
  let last = 0;
  for (const m of html.matchAll(/<h([1-6])[\s>]/g)) {
    const level = Number(m[1]);
    if (level > last + 1) fail(`heading jumps from h${last} to h${level}`);
    last = level;
  }

  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  for (const [, href] of html.matchAll(/<(?:a|link)\b[^>]*\shref="([^"]+)"/g)) {
    if (/^(https?:|mailto:)/.test(href)) continue;
    if (href.startsWith('#')) {
      if (!ids.has(href.slice(1))) fail(`broken anchor ${href}`);
      continue;
    }
    const clean = href.split(/[?#]/)[0];
    const target = clean.startsWith('/') ? join(dist, clean) : resolve(dirname(file), clean);
    const exists = existsSync(target) && (statSync(target).isFile() || existsSync(join(target, 'index.html')));
    if (!exists) fail(`broken link ${href}`);
  }

  // Ground rules: nothing here should appear on the public site.
  const text = html.replace(/<[^>]+>/g, ' ');
  for (const banned of [/lorem ipsum/i, /placeholder/i, /\bTODO\b/, /doi\.org/i, /\bSKYRIZI\b/i, /\bELAHERE\b/i, /<form\b/i, /<img\b/i]) {
    if (banned.test(html) || banned.test(text)) fail(`contains forbidden content: ${banned}`);
  }
}

if (!existsSync(join(dist, 'robots.txt'))) problems.push('dist/robots.txt is missing');

if (problems.length) {
  console.error(`${problems.length} problem(s):\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(`Checked ${htmlFiles.length} pages: no problems found.`);
