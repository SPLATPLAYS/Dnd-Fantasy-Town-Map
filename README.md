# DND Town Builder

Lightweight static town builder for Dungeons & Dragons campaigns. Client-side only, stores data as JSON that can be committed to a Git repository.

Quick start (no build):

1. Open `index.html` in a browser (modern browsers support ES modules).

Optional development with Bun + Rspack:

1. Install bun and rspack (optional):

```
bun install
bun run dev
```

Build for deployment:

```
bun run build
```

Deploy to GitHub Pages:

- Put generated site in `dist/` (or use the root `index.html`) into the `gh-pages` branch or the repository's `docs/` folder.
- Or just push the repo containing `index.html` to GitHub and enable GitHub Pages from the repository settings (use `main` branch / `docs` folder).

Files produced by the app:

- maps/{town-name}.json — full map and tiles
- entities/{town-name}.json — inhabitants
- buildings/{town-name}.json — building list

Extending the system:

- Add new terrain types in `src/mapCanvas.js` -> `_terrainColor` and ensure the UI select includes them in `src/sidebar.js`.
- Add richer building properties in `src/mapCanvas.js` and render labels in `_render`.
- Improve GitHub integration in `src/sidebar.js` — currently uses REST `PUT /contents/:path` and a token.

Files to inspect:

- [index.html](index.html)
- [src/main.js](src/main.js)
- [src/mapCanvas.js](src/mapCanvas.js)
- [src/sidebar.js](src/sidebar.js)
- [src/dataModels.js](src/dataModels.js)
- [src/storage.js](src/storage.js)
