# GitHub Pages review deployment

The review package is compatible with a GitHub Pages project site. Production
builds use hash-based routes, so Pages does not need an `index.html` rewrite:

- Client share URL: `https://riley-coyote.github.io/truemark/`
- Explicit website route: `https://riley-coyote.github.io/truemark/#/`

In production, a visit without a hash is replaced with `#/review` before the
router mounts. Existing hash routes remain unchanged, so `#/` continues to open
the website directly. Development routes keep using normal browser paths.

## Preview the production routing locally

```sh
npm run build
npm run preview:pages
```

Open `http://127.0.0.1:4173/TrueMark/` for the client presentation or
`http://127.0.0.1:4173/TrueMark/#/` for the website. The default port can change
if 4173 is already occupied; Vite prints the active URL.

## Publish manually

The project is stored in the public GitHub repository
[Riley-Coyote/truemark](https://github.com/Riley-Coyote/truemark), with `main`
as the default branch. The Pages workflow is included; publishing it will make
the client presentation available at the share URL above.

1. In the destination GitHub repository, open **Settings → Pages** and select **GitHub
   Actions** as the source.
2. Open **Actions → Deploy review to GitHub Pages → Run workflow**.
3. After the deployment finishes, use the URL reported by the `github-pages`
   environment.

The workflow is intentionally manual (`workflow_dispatch` only). It installs
the locked dependencies, builds `dist/`, uploads that directory as the Pages
artifact, and deploys it with the Pages environment and minimum required write
permissions.
