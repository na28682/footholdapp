# Foothold

A prototype for finding people at a target company and drafting a warm-intro
message, ranked by relevance to your background. All data in this build is
synthetic (deterministically generated placeholder profiles) — no scraping,
no real people, no real contact info. See the in-app notice for why.

## Run it locally

Requires [Node.js](https://nodejs.org) 18+.

```bash
npm install
npm run dev
```

Then open the URL it prints (usually `http://localhost:5173`).

## Build for production

```bash
npm run build
```

This outputs a static site to `dist/`. Preview it locally with `npm run preview`.

## Deploying

`dist/` is a plain static site, so any static host works. Two easy options:

### Vercel
1. Push this repo to GitHub.
2. Go to [vercel.com/new](https://vercel.com/new), import the repo.
3. Framework preset: Vite. Leave build command (`npm run build`) and output
   directory (`dist`) as detected. Deploy.

### GitHub Pages
1. `npm install --save-dev gh-pages`
2. Add to `package.json` scripts: `"deploy": "vite build && gh-pages -d dist"`
3. In `vite.config.js`, add `base: "/your-repo-name/"` inside `defineConfig`.
4. `npm run deploy`, then enable Pages on the `gh-pages` branch in repo settings.

## Project structure

```
index.html        Vite entry HTML
src/main.jsx       Mounts the app
src/App.jsx         All app logic and UI (single-file prototype)
src/index.css      Minimal global reset
```

## Notes for extending this beyond a prototype

- `generatePeopleBase()` in `App.jsx` is where synthetic profiles are made up.
  Swapping in a real data source (public professional profiles people have
  made discoverable, or an official platform API) replaces just this
  function and the shape of `signals` it returns.
- Profile data (name, skills, target roles, etc.) currently lives only in
  React state — refreshing the page clears it. Persisting it would mean
  adding a backend or browser storage.
- Outreach is drafted as text for the user to copy and send themselves. Any
  move toward sending on the user's behalf should go through a platform's
  own messaging API with the recipient's consent, not raw email/phone
  contact info.
