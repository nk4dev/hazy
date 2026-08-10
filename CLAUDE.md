@AGENTS.md

# Package manager

Use `bun`, not `npm` or `yarn`, for everything in this repo: `bun install` to
install dependencies, `bun add <pkg>` / `bun remove <pkg>` to change them,
and `bun run <script>` (or `bun <script>`) for `package.json` scripts —
e.g. `bun run dev`, `bun run db:push`. Commit `bun.lockb`, not
`package-lock.json`.
