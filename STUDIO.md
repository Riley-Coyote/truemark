# The portable TrueMark Studio

The Studio page and its curated content are now in this repository. Pull the latest `main`, run `npm ci` with Node 22, then:

```sh
npm run dev:studio
```

Open **http://127.0.0.1:5292/design-lab/universe/index.html**. To choose another port, use `npm run dev:studio -- --port 5295`. No Supabase configuration or access to Riley's machine is required. Studio runs with sample records and ignores `.env` files.

## What is included

- Editable Studio React/CSS, its catalog, and the landing-scene helpers in `design-lab/universe/` and `design-lab/client-walkthrough/`.
- The entire previously published `studio-2026-10-16-v25` content package in `studio-content/`: 3,179 files, approximately 610 MB. This includes 289 photographs, six films, 39 brand assets, captured designs, interactive historical designs, 13 checkpoints, and the packaged design tools.
- The current storefront and platform source remains in `src/`. Local Studio embeds that checkout, so current application changes can be reviewed there.

Historical versions are preserved compiled snapshots, not editable copies of their original source branches. The Studio catalog has 54 design records; some are concepts or captures rather than interactive builds. The optional native Ghost app's source and the broader private recovery archive are separate items. This delivery contains everything in the published Studio content package, not every file ever created during development.

## Work on it

Edit `design-lab/universe/universe.jsx` and `universe.css` for the Studio itself. Edit `inventory/catalog.json` for its displayed catalog. Read `studio-content/design-lab/universe/inventory/runtime.json` for the historical preview routes.

Images and other files shared by several historical versions are deduplicated. `studio-content/asset-map.json` maps the original URL to a physical file under `studio-content/history/shared/`. For example, find an image's `url` in the catalog, look that URL up in the mapping, then open the mapped file under `studio-content`. The local server handles this mapping automatically. Do not substitute Riley's original absolute paths or launch old local ports.

```sh
npm run test:studio
npm run build:studio
npm run preview:studio
```

The rebuilt Studio opens at **http://127.0.0.1:5293/**. `PORT=5296 npm run preview:studio` selects a different preview port on macOS/Linux. The build uses only this checkout and installed npm dependencies, with no historical Git refs or worktrees. Serve it through the supplied preview server: the asset aliases require routing, so opening HTML files directly or using an arbitrary static server is insufficient.

## Publication and provenance

`inventory/content-manifest.json` records the verified release URL, archive checksum and hashes of all committed content. `test:studio` checks the package's integrity, every alias, catalog media, historical routes and the local delivery behavior. Keep the frozen package intact; add new assets separately or deliberately update its inventory when replacing it.

This local editable build does not replace the hosted Studio. The existing Pages workflow still installs the checksum-pinned public release through `scripts/install-studio.mjs`. Publishing an updated hosted Studio requires a separately verified release/build process. Repository transfer must also update any remaining download links. No production database or provider changes are part of starting this preview.
