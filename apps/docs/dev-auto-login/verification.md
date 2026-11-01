# 开发环境自动登录：验证方案

> 相关：[模块说明](README.md) · [技术实现](tech.md) · [施工计划](plan.md)

## 1. 自动测试

没有单测：server 配了 vitest，但仓库里还没有测试文件。靠 `pnpm typecheck`、`pnpm lint` 和下面的检查兜底。

## 2. 端到端检查

| 检查                                                                                                                         | 预期                                                                           | 日期       |
| ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------- |
| `pnpm typecheck`、`pnpm lint`；client 的 `tsc -b`                                                                            | 通过                                                                           | 2026-11-01 |
| `DEV_AUTO_LOGIN=true vite build --mode production`、`--mode development`，在产物里搜 `dev/sign-in`、`devSignIn`、`dev-login` | 两种 mode 都搜不到                                                             | 2026-11-01 |
| server 启动日志                                                                                                              | 生效 / 被忽略两种 warning，内容见 [tech.md §1](tech.md#1-用法和行为2026-11-01) | 2026-11-01 |

## 3. 手动验收清单

准备：用临时数据库起 server，不碰 `apps/server/data.db`：

```sh
DATABASE_PATH=/tmp/dev-login.db pnpm --filter @hono-mono-starter/server db:migrate
DEV_AUTO_LOGIN=true NODE_ENV=dev DATABASE_PATH=/tmp/dev-login.db pnpm dev:server
```

下面 `$P` 是 `/api/auth/dev/sign-in`，curl 都用 `curl -X POST`，不需要 body。

1. `NODE_ENV` 不设、`development`、`production`，或者不开 `DEV_AUTO_LOGIN` → `$P` 返回 404。只开了 `DEV_AUTO_LOGIN` 时，启动日志提示被忽略并打印当前的 `NODE_ENV`。（`production` 要设 `BETTER_AUTH_SECRET`，否则 better-auth 直接拒绝启动。）
2. 两个都设 → 请求 `localhost` 和 `127.0.0.1` 都返回 200；`Set-Cookie` 里的 `session_token` 带 `Max-Age=604800`；带着这个 cookie 请求 `/api/auth/get-session`，返回 `test@test.com`。
3. 用本机局域网 IP 请求 → 403（`Host` 不是本地名字）；加 `-H 'Host: localhost:<端口>'` → 200。把 `SERVER_URL` 设成这个局域网 IP 后重启，直接用 IP 请求 → 200。
4. `-H 'Host: evil.example'` → 403。
5. 路径变体，都带 `-H 'Host: evil.example' --path-as-is`：`$P/`、`/api/auth/dev//sign-in`、`/api/auth//dev/sign-in`、`/api/auth/DEV/sign-in`、`/api/auth/dev/Sign-In`、`/api/auth/dev/sign-in%2F`、`/api/auth/dev/%73ign-in`、`/api/auth/dev/./sign-in`、`/api/auth/x/../dev/sign-in`、`$P?a=1`、`$P;x` → 只能是 404 或 403，**不能出现 200**。`GET $P` → 404。
6. `-H 'Origin: <CLIENT_URL>'` → 200；`-H 'Origin: http://evil.example'` → 403，body 是 `INVALID_ORIGIN`；`Sec-Fetch-Site: cross-site` + `Sec-Fetch-Mode: navigate` 的表单请求 → 403；`Origin: http://localhost:8080` + `Sec-Fetch-Site: same-site` → 403。
7. 带 `-H 'Cookie: better-auth.dont_remember=x'` → 响应里有 `better-auth.dont_remember=; Max-Age=0`，`session_token` 仍然带 `Max-Age=604800`。
8. 在空数据库上同时发 3 个请求 → 都返回 200，`user` 表只有一行。
9. 起 Vite（同样设 `DEV_AUTO_LOGIN=true`），没登录时打开 `/` → 停在 `/`，页面右上角是 `test@test.com`；Network 里 `localhost:<CLIENT_PORT>/api/auth/dev/sign-in` 返回 200（走代理）。
10. 点 Sign out → 停在 `/login`；刷新后还在 `/login`。
11. 拦掉 `/api/auth/dev/sign-in`（DevTools 的 request blocking），再打开 `/` → 跳 `/login`，控制台有 `DEV_AUTO_LOGIN: dev sign-in request failed`，没有错误页。
12. 停掉 server 再打开 `/`（代理返回 502）→ 不发 `dev/sign-in` 请求，跳 `/login`。
13. server 不设 `NODE_ENV=dev`、Vite 开着开关 → 控制台有 `DEV_AUTO_LOGIN: dev sign-in failed (HTTP 404)`，跳 `/login`。

## 4. 各次实际结果

### 2026-11-01

环境：macOS，Node 26.12.1，pnpm 11.15.0，better-auth 1.6.23。测试用的 server 端口 3917、Vite 端口 5917，数据库是 scratchpad 里的临时文件；浏览器测试用 agent-browser（Chromium）。

- 初版和 `NODE_ENV=dev`（plan.md 阶段 1～2）：第 1 条的各种组合通过。
- 第一轮 code review 修复后（阶段 3）：
  - 第 8 条最早是在进程内用 `Promise.all` 测的。修复前 3 个请求里有 2 个撞上唯一约束；修复后都返回 200，只有一个用户，临时加的日志确认 catch 分支走了 2 次，之后删掉了。
  - 第 9、10、12、13 条通过。
  - 构建检查通过。
- 第二轮 code review 修复后（阶段 4）：第 2～7 条、第 9～11 条通过。
- 合入远端 main、改完注释和 `body: {}` 之后（阶段 5～6），全部重跑：
  - `pnpm typecheck`、`oxlint`、`oxfmt --check`、client `tsc -b` 通过。
  - 第 1 条：`NODE_ENV` 不设、`development` 返回 404，日志提示被忽略；`production` 第一次没起来，因为本机没有 `apps/server/.env`，better-auth 报 "You are using the default secret"，用临时 secret 重启后返回 404；只设 `NODE_ENV=dev` 返回 404，没有 warning；两个都设返回 200，日志是 "any local client can sign in as test@test.com"。
  - 第 2～8 条通过。第 5 条的 11 种写法里，6 种返回 404（没有路由能匹配），5 种（`%73ign-in`、`./`、`x/../`、`?a=1` 这类 Hono 归一化后匹配到新路由的）返回 403，没有 200。第 8 条用 3 个并发 curl，在空数据库上测。
  - 第 9～13 条通过。第 9 条的请求不带 body，经代理时 `Origin` 是 `http://localhost:5917`，通过了 CSRF 检查。
  - 构建：两种 mode 的产物里都没有 dev-login 代码。
