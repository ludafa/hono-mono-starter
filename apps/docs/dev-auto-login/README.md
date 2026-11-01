---
name: dev-auto-login
title: 开发环境自动登录
description: 开发时跳过注册登录，直接以 test@test.com 进入应用：两个开关（根 .env 的 DEV_AUTO_LOGIN=true 加 apps/server/.env 的 NODE_ENV=dev）、server-only 的 better-auth 插件（apps/server/src/dev-login.ts）和 Hono 单独注册的 POST /api/auth/dev/sign-in、只接受本机请求的检查和 CSRF 检查、client 插件 devSignIn() 和 _app.tsx 守卫、vite.config.ts 按 command（vite / vite build）注入 VITE_DEV_AUTO_LOGIN 并决定 VITE_API_URL、构建产物不含这段代码、为什么不要配合 vite --host。想开或排查自动登录、改登录守卫、改 vite.config.ts 的 define 或 dev 代理、动 better-auth 插件或升级 better-auth 时来读。
changes: [2026-11-01]
status: 已上线
code:
  - apps/server/src/dev-login.ts
  - apps/server/src/routes/auth.ts
  - apps/server/src/auth.ts
  - apps/server/src/index.ts
  - apps/client/src/lib/auth-client.ts
  - apps/client/src/routes/_app.tsx
  - apps/client/vite.config.ts
---

# 开发环境自动登录

在根 `.env` 设 `DEV_AUTO_LOGIN=true`、在 `apps/server/.env` 设 `NODE_ENV=dev` 之后，没登录时打开受保护页面就会自动以 `test@test.com` 登录，第一次用时自动创建这个用户。server 端是一个 better-auth 插件，端点只能经 Hono 单独注册的 `POST /api/auth/dev/sign-in` 访问：先确认请求来自本机，再走和 email 登录同一套 CSRF 检查。client 端由 `_app.tsx` 的守卫在确实没有 session 时调用 `authClient.devSignIn()`，`vite build` 的产物里没有这段代码。两个开关缺一个，端点就不存在。

## 关键决定

- 必须同时满足 `DEV_AUTO_LOGIN=true` 和 `NODE_ENV=dev`（白名单），server 是唯一的闸门（用户追加，2026-11-01，见 [tech.md §2](tech.md#2-开关2026-11-01)）
- 端点是 server-only 的，HTTP 入口是 Hono 单独注册的路由，本机检查不依赖两套路由的路径匹配（code review 指出，见 [tech.md §3.1](tech.md#31-server-only-端点和单独的路由)）
- "本机"指 socket 来自 loopback 或本机网卡地址，并且 `Host` 是本地名字（code review 指出，见 [tech.md §3.2](tech.md#32-只接受本机请求)）
- 补上 better-auth 的 `formCsrfMiddleware`：直接调用 `auth.api.*` 会跳过路由层的 origin 检查（Claude 发现，见 [tech.md §3.3](tech.md#33-csrf-检查)）
- client 按 `command`（`vite` / `vite build`）判断 dev，不按 `mode`；任何 `vite build` 都不含这段代码（code review 指出，见 [tech.md §4.1](tech.md#41-viteconfigts注入开关和-dev--build-的判断)）
- client 和 server 各读一次开关，所以 `DEV_AUTO_LOGIN` 必须写在根 `.env`（保留现状，见 [tech.md §6](tech.md#6-没采用的方案2026-11-01)）
- 开着这个功能时不要用 `vite --host`（见 [tech.md §5](tech.md#5-安全边界2026-11-01)）

## 文件

| 文件                               | 内容                                                                                                                                                                                                                                                              |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [tech.md](tech.md)                 | §1 用法和行为；§2 两个开关、启动日志；§3 server：server-only 端点和路由、本机检查、CSRF、首次使用的并发、`dont_remember` cookie、不进 `openapi.yml`；§4 client：`vite.config.ts`、`devSignIn()`、`_app.tsx` 守卫、构建产物；§5 安全边界；§6 没采用的方案；§7 风险 |
| [plan.md](plan.md)                 | 2026-11-01 一次施工的 5 个阶段：初版、`NODE_ENV=dev`（用户追加）、两轮 code review 的修复、合入远端 main 后按新约定调整                                                                                                                                           |
| [verification.md](verification.md) | 没有单测；端到端检查；13 条手动验收（curl 测开关、本机检查、路径变体、CSRF、cookie，浏览器测自动登录、登出、失败时跳转）；2026-11-01 的实测结果                                                                                                                   |

## 相关模块

- [构建与依赖](../toolchain/README.md)：`vite.config.ts` 的其余配置。
