@AGENTS.md

# Monorepo

This is `apps/hazy` in a Turborepo (`hazy-repo/`). The Drizzle schema, DB
client and migrations live in `packages/db` (`@repo/db`), not here — see
`packages/db/README.md`.

# Package manager

Use `bun`, not `npm` or `yarn`: `bun install` at the repo root, `bun add <pkg>`
/ `bun remove <pkg>` to change deps, `bun run <task>` for scripts. Tasks run
through `turbo` from the root (`bun run dev`, `bun run check-types`, …); add
`--filter=hazy` to scope to this app. One `bun.lock` at the repo root.
