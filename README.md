# Sharon Nduku Mutiso: personal research website

A static website with no dependencies to install. It needs Node 18 or newer only to build.

```bash
npm run preview   # build, then serve at http://localhost:4173
npm run check     # build, then test links, page basics, and content rules
```

## Add a research update

Edit [content/research.json](content/research.json). Everything on the Progress page comes from this file.

**Progress log.** Add an entry to `log`. The page sorts entries by date, newest first.

```json
{
  "date": "2027-01-15",
  "category": "Dataset audit",
  "title": "A short statement of what happened",
  "summary": "One or two sentences. Separate what was done from what is still planned.",
  "links": [{ "label": "Audit report", "url": "https://real-link.example" }]
}
```

**Resources.** Each section (`methods`, `dataset-audits`, `code`, `reports`, `publications`) has an `items` list. While a list is empty, the page shows that section's `emptyText`. Once you add an item, the link appears instead. `date` and `note` are optional.

```json
{ "title": "Dataset audit v1", "url": "https://real-link.example", "date": "2027-01-15", "note": "PDF" }
```

**Publish.** Run the check, then commit and push. GitHub rebuilds and deploys the site automatically.

```bash
npm run check
git add -A
git commit -m "Add research update"
git push
```

Also update the stage list on [src/pages/research.html](src/pages/research.html) when a stage changes. Change `status-planned` and its "Planned" label to `status-progress` and "In progress", or to `status-done` and "Done".

## Where things live

| Path | Contents |
| --- | --- |
| `content/research.json` | Progress log and resources |
| `src/pages/*.html` | Page text. The comment at the top of each file holds its title, description, and path |
| `src/assets/styles.css` | Colors, type, and layout. The palette is at the top of the file |
| `site.config.json` | Name, email, LinkedIn, navigation |
| `scripts/` | Build, preview server, and checks |
| `.github/workflows/deploy.yml` | Deployment to GitHub Pages |

## Public URL, canonical links, and sitemap

Canonical links and `sitemap.xml` use `siteUrl` in `site.config.json`, currently `https://sharonmutiso.com`. If you ever move the site, update that value only after you own the new domain and it is deployed. If `siteUrl` is empty, canonical links and the sitemap are left out.

## Custom domain

`sharonmutiso.com` is registered at Porkbun and uses these DNS records. Keep them in place, and renew the domain before it expires on November 5, 2027 (unless auto-renew is on):

| Type | Host | Value |
| --- | --- | --- |
| A | (root) | 185.199.108.153 |
| A | (root) | 185.199.109.153 |
| A | (root) | 185.199.110.153 |
| A | (root) | 185.199.111.153 |
| CNAME | www | musyawaflorah.github.io |

The domain is set in the repository under **Settings > Pages**, along with the **Enforce HTTPS** option.

## Content rules

- Only publish facts that are true, and only link to things that exist.
- Keep planned work clearly separate from completed work.
- Keep out company logos, confidential project information, patient records, and internal screenshots.
- This is exploratory research, not a clinical diagnostic service.
