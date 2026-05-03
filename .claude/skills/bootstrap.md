---
description: First-run setup for a fresh checkout — copies env file, generates and applies the Drizzle migration, emits openapi.yml, and generates the Kubb client. Triggers on phrases like "bootstrap", "first run", "set up the project", "I just cloned this", or when commands fail because src/gen/ or routeTree.gen.ts are missing.
---

# Bootstrap

A fresh checkout has no `.env`, no `data.db`, no `openapi.yml`, no `apps/client/src/gen/`, and no `apps/client/src/routeTree.gen.ts`. This skill walks through the minimum to get `pnpm dev:server` and `pnpm dev:client` working.

## Steps

1. **Install** if not already: `pnpm install`.
2. **Create the server env file:**
   - If `apps/server/.env` does not exist, run: `cp apps/server/.env.example apps/server/.env`.
   - Generate a secret: `openssl rand -base64 32`. Edit `apps/server/.env` and set `BETTER_AUTH_SECRET` to that value. Do this with the Edit tool, not by asking the user to do it.
   - Leave `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` commented out unless the user asks for GitHub OAuth.
3. **Run the bootstrap script:** `pnpm bootstrap`. This does, in order:
   - `pnpm --filter @hono-mono-starter/server run db:generate` (drizzle reads `src/db/schema.ts` and writes `apps/server/drizzle/`)
   - `pnpm --filter @hono-mono-starter/server run db:migrate` (creates `apps/server/data.db`)
   - `pnpm --filter @hono-mono-starter/server run generate:openapi` (writes `apps/server/openapi.yml`)
   - `pnpm --filter @hono-mono-starter/client run generate:api` (Kubb writes `apps/client/src/gen/`)
4. **Trigger TanStack Router code generation** for `routeTree.gen.ts`:
   - The Vite plugin generates it on dev start. Easiest way to materialize it without leaving a process running: `pnpm --filter @hono-mono-starter/client exec vite build` once, OR briefly start `pnpm dev:client` and stop it after `routeTree.gen.ts` appears.
5. **Typecheck both apps** to confirm: `pnpm typecheck`. Resolve any errors before declaring success.

## Common errors

- `"Cannot find module './gen/clients'"` — step 3 didn't run or failed. Re-run `pnpm --filter @hono-mono-starter/client run generate:api` and check that `apps/server/openapi.yml` exists first.
- `"Cannot find module './routeTree.gen'"` — step 4 didn't run. Start `pnpm dev:client` once.
- `"BETTER_AUTH_SECRET is not set"` — step 2 was skipped.
- Drizzle `"no such table: user"` — `db:migrate` didn't run; check `apps/server/data.db` exists.

## Notes

- The user may have renamed the package (`@hono-mono-starter/*`). If `pnpm --filter @hono-mono-starter/server …` fails, run `pnpm -r ls --depth=0` and use the actual package names.
- Don't commit `.env`, `data.db`, or `node_modules/`. They're already gitignored.
