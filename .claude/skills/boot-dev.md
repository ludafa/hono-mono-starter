---
description: Start the server and client dev processes and verify both are responding. Use when the user asks to "run the app", "start the dev server", "boot it up", or wants to manually QA a change.
---

# Boot the dev environment

The server runs on `http://localhost:3000` (Hono via `@hono/node-server`, with `--watch`). The client runs on `http://localhost:5173` (Vite). The client's Vite config proxies `/api/*` to the server, so the browser only ever talks to `:5173`.

## Steps

1. **Verify prerequisites.** If `apps/server/.env` is missing or `apps/client/src/gen/` is missing, run the `bootstrap` skill first.

2. **Start the server in the background:**
   ```bash
   pnpm dev:server
   ```
   Use the Bash tool with `run_in_background: true`. Wait for `Server running at http://localhost:3000` in the output.

3. **Start the client in the background:**
   ```bash
   pnpm dev:client
   ```
   Wait for Vite to print `ready in <ms> ms` and the URL `http://localhost:5173/`.

4. **Verify both are up:**
   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/doc      # expect 200
   curl -s -o /dev/null -w '%{http_code}\n' http://localhost:5173/         # expect 200
   ```
   Open the Swagger UI at `http://localhost:3000/reference` to confirm endpoints are registered.

5. **Tell the user the URLs** they should open. If something fails, surface the relevant log line, don't dump the whole output.

## Notes

- The server uses `node --import tsx --watch` — code changes auto-reload. No manual restart needed for source edits, but new env vars require a restart.
- TanStack Router's plugin regenerates `routeTree.gen.ts` on dev start. If the client process is still running, route file changes hot-reload too.
- On port conflicts (`EADDRINUSE`): find the offender with `lsof -ti :3000` (or `:5173`) and `kill` it. Don't move the server to a new port — the Vite proxy and CORS config both assume `:3000`.
