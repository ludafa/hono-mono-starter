# 0001 — Migrate the client to Vite 8 (drop rolldown-vite) & fix pnpm 11 config

- Status: Accepted
- Date: 2026-07-19

## Context

`apps/client` was pinned to `rolldown-vite@7.2.5` via `pnpm.overrides` in the root
`package.json`. The request was to bring the Vite/rolldown toolchain to the
current latest. Investigation surfaced three facts:

1. **The override was silently dead.** pnpm 10.x+ no longer reads the `pnpm`
   field in `package.json` (`overrides`, `onlyBuiltDependencies`, …). The client
   only stayed on rolldown-vite because its own devDependency aliased
   `vite` → `rolldown-vite`. See <https://pnpm.io/settings>.
2. **pnpm was bumped to v11**, which deprecates `onlyBuiltDependencies` in favour
   of the `allowBuilds` map, and gates build scripts more strictly.
3. **The ecosystem is on Vite 8.** Real `vite` is at `8.1.5`; **Vite 8 ships the
   Rolldown bundler + Oxc transformer natively.** `rolldown-vite` was the
   _transitional_ package that backported Rolldown onto the Vite 7 line — on
   Vite 8 it is redundant.

## Decision

**Migrate `apps/client` to real `vite@^8` and remove `rolldown-vite` entirely.**

Because Vite 8 has Rolldown built in, moving off the `rolldown-vite` package loses
no bundler benefit while dropping an experimental dependency _and_ the override
pin. (An earlier, more conservative step landed on `rolldown-vite@7.3.1`; the user
then explicitly opted into the full Vite 8 migration, which this record reflects.)

Upgraded the whole vite-adjacent set to their Vite 8-compatible latests:

| Package                   | Before                    | After                            |
| ------------------------- | ------------------------- | -------------------------------- |
| `vite`                    | `npm:rolldown-vite@7.2.5` | `^8.1.5` (real vite)             |
| `@vitejs/plugin-react`    | `^6.0.1`                  | `^6.0.3` (peer `vite@^8`)        |
| `@tailwindcss/vite`       | `^4.2.4`                  | `^4.3.3`                         |
| `tailwindcss`             | `^4.2.4`                  | `^4.3.3` (kept in lockstep)      |
| `@tanstack/router-plugin` | `^1.167.32`               | `^1.168.22`                      |
| `@tanstack/react-router`  | `^1.169.1`                | `^1.170.18` (router-plugin peer) |

**No `vite.config.ts` change was needed** — the config uses no `rollupOptions`/
`esbuild` options (only `plugins`, `resolve.alias`, `server.proxy`, `define`), so
there was nothing to rename to `rolldownOptions`/`oxc`.

**pnpm config** now lives in `pnpm-workspace.yaml`:

- The `vite` override is **removed** (no longer needed).
- Build scripts are approved via the pnpm v11 `allowBuilds` map
  (`better-sqlite3`, `esbuild`, `msw`, `es5-ext` → `true`).

## Consequences

- Client toolchain: `vite@8.1.5` (Rolldown/Oxc), `@vitejs/plugin-react@6.0.3`,
  `@tailwindcss/vite@4.3.3`, `@tanstack/router-plugin@1.168.22`.
- The whole workspace dedupes to a **single** `vite@8.1.5` (verified via
  `pnpm --filter …/client why vite` → "Found 1 version of vite"). The server's
  `vitest` shares it. No `rolldown-vite` remains.
- `packageManager` is `pnpm@11.15.0`. A fresh non-TTY `pnpm install` that
  restructures `node_modules` needs `CI=true`; changing overrides needs
  `--no-frozen-lockfile`.
- Remaining peer warnings (`eslint-plugin-import` vs eslint 10,
  `@typescript-eslint/*` vs typescript 7) are **pre-existing and unrelated** to
  Vite — they predate this change.

## Verification

- `pnpm --filter …/client exec vite --version` → `vite/8.1.5`
- `pnpm --filter …/client build` (`tsc -b && vite build`) → typecheck + bundle OK
- `pnpm --filter …/client lint` → clean (0 warnings)
- `pnpm --filter …/client dev` → `VITE v8.1.5 ready`, root + module both HTTP 200

## Touched files

- `apps/client/package.json` — vite → `^8.1.5`; ecosystem bumps; pin-note updated
- `pnpm-workspace.yaml` — removed `vite` override; `allowBuilds` map (pnpm v11)
- `package.json` — removed the dead `pnpm` field
- `CLAUDE.md` — client is now real Vite 8, not rolldown-vite
- `pnpm-lock.yaml` — regenerated
