# Kokio documentation

Source for [docs.kokio.app](https://docs.kokio.app), built with [Docusaurus](https://docusaurus.io/).

npm only. There is one lockfile, `package-lock.json`, and Vercel picks the package manager from it.

### Install

```
npm ci
```

### Local development

```
npm start
```

Starts a dev server on port 3000 and reloads on save.

### Build

```
npm run build
```

Writes the static site to `build/`. The prebuild step regenerates the plain-text surfaces that AI crawlers read: one `.md` file per page under `static/md/`, plus `static/llms-full.txt`. Both are gitignored, so build before serving locally or those routes 404.

Serve the result with:

```
npm run serve
```

### Deployment

Vercel builds `main` and deploys it. Nothing to run by hand. Open a PR, merge it, and the change is live.

### Other commands

```
npm run typecheck          # tsc, no emit
npm run write-heading-ids  # regenerate explicit heading anchors after editing headings
npm run clear              # drop the .docusaurus cache
```
