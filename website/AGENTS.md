# AGENTS.md — SFMC docs site (Rspress)

You maintain the Rspress documentation site for ScriptsForMinecraftServer.

## Commands

- `cd website && npm install` — install docs-site deps
- `npm run docs -- serve` — TypeDoc + Rspress dev (from monorepo root)
- `npm run docs -- build` — TypeDoc + Rspress build → `doc_build/`
- `npm run docs -- api` — TypeDoc only → `docs/zh/reference/sdk/`

## Layout

- Content: `docs/zh/**` (default lang), `docs/en/**`
- Config: `website/rspress.config.ts`, `i18n.json`
- Components: `website/components/`
- Internal specs: `docs/superpowers/**` (excluded from routes)

## Notes

- If the monorepo path contains `#`, `docs.mjs` mirrors to `%TEMP%/sfmc-rspress-build` before Rspack runs.
- Module catalog is built from `sfmc-modules` `index.json` (local sibling or GitHub raw).
- Prefer Rspress `llms.txt`: https://rspress.rs/llms.txt
