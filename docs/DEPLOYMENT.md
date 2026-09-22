# GitHub Pages review deployment

The review package is compatible with a GitHub Pages project site. Production
builds use hash-based routes, so Pages does not need an `index.html` rewrite:

- Homepage: `https://<owner>.github.io/<repository>/`
- Client review: `https://<owner>.github.io/<repository>/#/review`

## Preview the production routing locally

```sh
npm run build
npm run preview:pages
```

Open `http://127.0.0.1:4173/TrueMark/` for the homepage or
`http://127.0.0.1:4173/TrueMark/#/review` for the client index. The default port
can change if 4173 is already occupied; Vite prints the active URL.

## Publish manually

This checkout does not currently have a Git remote. Before the workflow can be
run, create or choose the destination repository and push the project,
including `.github/workflows/pages.yml`, to its default branch.

1. In the destination GitHub repository, open **Settings → Pages** and select **GitHub
   Actions** as the source.
2. Open **Actions → Deploy review to GitHub Pages → Run workflow**.
3. After the deployment finishes, use the URL reported by the `github-pages`
   environment.

The workflow is intentionally manual (`workflow_dispatch` only). It installs
the locked dependencies, builds `dist/`, uploads that directory as the Pages
artifact, and deploys it with the Pages environment and minimum required write
permissions.
