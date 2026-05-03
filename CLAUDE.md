# CLAUDE.md

Guidance for Claude Code working in projects derived from `hono-mono-starter`.

## What this project is

A pnpm monorepo with two apps:

- **`apps/server`** — Hono + `@hono/zod-openapi` + better-auth + Drizzle (SQLite). Source of truth for the API contract. Generates `openapi.yml`.
- **`apps/client`** — Vite (rolldown-vite) + React 19 + TanStack Router (file-based) + Tailwind v4 + shadcn/ui. Consumes the API via Kubb-generated typed clients (`src/gen/`).

Module type: ESM. Package manager: pnpm. Node imports use `.js` extensions for TS (`verbatimModuleSyntax` is on).

## On startup

If `apps/docs/` has any files, run the **`read-docs`** skill before doing other work. It is intentionally light — the directory may be empty in a fresh template.

## Skills available

The `.claude/skills/` directory ships with skills for the most common tasks. Each skill describes a workflow you should follow exactly when its trigger fires:

- `read-docs` — read `apps/docs/{features,solutions,decisions}/` at session start
- `bootstrap` — first-run setup (env file, drizzle migrate, openapi spec, kubb client)
- `add-api-endpoint` — full server-to-client endpoint flow, including codegen refresh
- `add-db-table` — add a Drizzle table and run `db:generate` + `db:migrate`
- `add-page` — add a TanStack Router file-based page with the right layout
- `add-shadcn-component` — install a shadcn primitive into `src/components/ui/`
- `regen-api-client` — refresh `openapi.yml` and the Kubb client after server changes
- `boot-dev` — start both dev servers and verify they're up
- `rename-template` — rename `hono-mono-starter` → `<your-app>` everywhere

## Architecture invariants

These are load-bearing — change them only with the user's explicit go-ahead.

### Server

- **Routes are defined with `createRoute(...)` from `@hono/zod-openapi`** and registered with `app.openapi(route, handler)`. Plain `app.get/post(...)` is fine for non-API endpoints (e.g. better-auth's `/api/auth/*`) but everything under `/api/<resource>/*` must go through `createRoute` so it shows up in `openapi.yml`.
- **Zod schemas exposed in the OpenAPI doc must call `.openapi('Name')`.** The string becomes the schema's name in the spec; without it, Kubb generates inline anonymous types and clients lose readability.
- **Authentication.** `requireAuth` middleware (`src/middleware/auth.ts`) reads the session via `auth.api.getSession({ headers })` and sets `c.set('userId', ...)`. Apply it to any `/api/<resource>/*` group that needs login. Routes that read `userId` should type their app as `OpenAPIHono<{ Variables: { userId: string } }>`.
- **`better-auth` tables (`user`, `session`, `account`, `verification`) are managed by better-auth.** Do not edit those table definitions — adjust only the schema's *new* tables. If better-auth is upgraded and table shape changes, run `pnpm db:generate` and review the diff before applying.
- **`openapi.yml` is committed.** The client's Kubb codegen reads it. Anytime a route or a `.openapi('...')`-named schema changes, run `pnpm --filter @hono-mono-starter/server generate:openapi` and commit the result alongside the server change.
- **GitHub OAuth is opt-in.** `auth.ts` only registers the GitHub provider if both `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are set. The login page's "Continue with GitHub" button always renders — that's intentional; users who haven't configured it will get a clear error from better-auth on click.

### Client

- **Routes are file-based.** The TanStack Router Vite plugin rewrites `src/routeTree.gen.ts` whenever route files change. Don't hand-edit `routeTree.gen.ts`. Don't reintroduce the imperative `createRouter`/`createRoute` style.
- **Auth guards live in `_app.tsx` / `_auth.tsx`.** `beforeLoad` does a `authClient.getSession()` and `redirect(...)` based on whether a session exists. Page components do not re-check.
- **API access goes through `src/gen/clients`.** Never `fetch('/api/...')` directly — Kubb-generated functions carry types and credentials. If a function you need doesn't exist, regenerate (see `regen-api-client` skill) or add the missing route on the server first.
- **Vite is `rolldown-vite`** (pinned via `package.json#pnpm.overrides`). Build/bundle bugs may differ from upstream Vite docs.
- **Tailwind v4 is CSS-first.** No `tailwind.config.*`. Theme tokens are CSS custom properties in `src/main.css`. Add new tokens under both `:root` and `.dark`.
- **`main.css` is loaded via `<link>` in `index.html`**, not via `import` from `main.tsx`. Don't change that — the cold-load FOUC story relies on it.
- **shadcn config:** `components.json` aliases `@/components`, `@/components/ui`, `@/lib/utils`, `@/hooks`. New shadcn components install into `src/components/ui/`.

### Tooling

- **ESLint flat config.** Both packages use `eslint.config.js` (flat). Lint runs with `--max-warnings 0` — CI fails on any warning.
- **`simple-import-sort`** rewrites import order. Don't hand-sort imports.
- **Prettier** is integrated via `eslint-plugin-prettier`. Server uses double quotes (no plugin config); client uses single quotes + `prettier-plugin-tailwindcss` for class sorting.
- **TypeScript strict mode** with `verbatimModuleSyntax` and (client only) `erasableSyntaxOnly`. Use `import type` for type-only imports.

## Bootstrap sequence

A fresh checkout requires:

1. `pnpm install`
2. `cp apps/server/.env.example apps/server/.env` and fill in `BETTER_AUTH_SECRET`
3. `pnpm bootstrap` (runs drizzle migrate + openapi spec + kubb codegen)
4. `pnpm dev:server` and `pnpm dev:client` in separate terminals

The `bootstrap` skill walks Claude through this and surfaces typical first-run errors.

## Documentation

Every conversation that introduces a feature or non-trivial solution should produce or update a doc in `apps/docs/`:

- `apps/docs/features/<name>.md` — what it does, user-facing behavior
- `apps/docs/solutions/<topic>.md` — algorithms, data flow, integration patterns
- `apps/docs/decisions/NNNN-<title>.md` — ADRs

Keep docs concise (1–2 pages), reference source paths, and update existing docs rather than duplicating.
