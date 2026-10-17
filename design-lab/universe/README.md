# Studio source

See [STUDIO.md](../../STUDIO.md) for startup, content locations, editing and verification.

`vite.config.mjs` starts the editable fixture preview. `content-server.mjs` serves committed asset aliases and historical pages locally. `package.mjs` builds the current Studio and application alongside that content; `serve.mjs` previews the result. No private worktrees or original source-history reconstruction scripts are needed.
