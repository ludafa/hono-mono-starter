# 开发环境自动登录：施工计划

> 相关：[模块说明](README.md) · [技术实现](tech.md) · [验证方案](verification.md)

## 2026-11-01（分支 `main`）

起因：用户要求「我想要加一个功能，在开发环境中可以跳过注册登录，直接以 test@test.com 这个用户的身份登录。需要一个环境变量来控制。」

### 阶段 1：初版

- 文件：`apps/server/src/dev-login.ts`（新）、`apps/server/src/auth.ts`、`apps/server/src/routes/auth.ts`；`apps/client/src/lib/auth-client.ts`、`apps/client/src/routes/_app.tsx`、`apps/client/src/vite-env.d.ts`、`apps/client/vite.config.ts`；根 `.env.example`、CLAUDE.md。
- 状态：✅ 完成（2026-11-01）
- 实际改动：better-auth 插件提供 `POST /api/auth/dev/sign-in`（找不到用户就创建，再建 session、下发 cookie）；client 插件 `devSignIn()`；`_app.tsx` 的守卫没有 session 时调它；`vite.config.ts` 把根 `.env` 的 `DEV_AUTO_LOGIN` 注入成 `import.meta.env.VITE_DEV_AUTO_LOGIN`。
- 偏差：better-auth 拒绝没有 JSON content type 的 POST（415），client 只好带 `body: {}`。阶段 4 之后请求不再经过 better-auth 的路由，阶段 5 去掉了它。

### 阶段 2：必须配合 `NODE_ENV=dev`（用户追加）

- 用户原话：「这个环境变量必须配合 NODE_ENV=dev 才能生效」。
- 文件：`dev-login.ts`、`apps/server/src/index.ts`、`apps/server/.env.example`、根 `.env.example`、CLAUDE.md。
- 状态：✅ 完成（2026-11-01）
- 实际改动：`devAutoLoginEnabled` 要求 `NODE_ENV === 'dev'`（白名单，[tech.md §2](tech.md#2-开关2026-11-01)）；启动日志区分"生效"和"被忽略"；`NODE_ENV=dev` 写在 `apps/server/.env`，因为 Vite 读根 `.env` 时会对非 `development` 的 `NODE_ENV` 报 warning（实测）。
- 检查：`NODE_ENV` 不设、`development`、`production`、`dev` 四种，加上开关开 / 关，只有 `dev` + 开关打开时端点返回 200，其余都是 404（实测）。

### 阶段 3：第一轮 code review（`/code-review xhigh`，13 条，修 7 条）

- 用户决定：「建议的 7 条修复掉」。
- 实际改动：
  1. 只接受本机请求：socket 必须来自 loopback，`Host` 必须是本地名字。原来 server 监听所有网卡，不带 cookie 的请求 better-auth 又不查来源，同一局域网的人发个 POST 就能拿到 session（实测用陌生的 `Origin` 返回 200）。
  2. `getSession()` 出错时不自动登录（[tech.md §4.3](tech.md#43-守卫-appsclientsrcroutes_apptsx)）。
  3. 开关改按 `command === 'serve'` 判断，原来按 `mode`（[tech.md §4.1](tech.md#41-viteconfigts注入开关和-dev--build-的判断)）。
  4. 首次使用的并发：`createUser` 失败后再查一次（[tech.md §3.4](tech.md#34-首次使用的并发)）。
  5. 自动登录失败时打带状态码的 warning；改正文档里"只试一次"的错误说法。
  6. `setSessionCookie` 显式传 `dontRememberMe=false`。
  7. 文档不再把 client 构建算成安全防线；生产包不注册 client 插件。
- 没改：client 和 server 各读一次开关（[tech.md §6](tech.md#6-没采用的方案2026-11-01)）；`auth.api.devSignIn` 的类型始终存在（没有代码这样调用）；每次自动登录都新建 session 记录。
- 检查：空数据库上 3 个并发首次登录都返回 200、只有一个用户，临时加日志确认走了 catch 分支，之后删掉；局域网 IP 和伪造的 `Host` 返回 403；浏览器里自动登录、登出后停在 `/login`、server 停掉（代理返回 502）时不自动登录、端点不存在时打 warning 并跳 `/login`；两种 mode 的构建产物里都没有 dev-login 代码（均为实测）。
- 状态：✅ 完成（2026-11-01）

### 阶段 4：第二轮 code review（`/code-review high`，9 条，修 6 条）

- 用户决定：「按你的建议改，第 8 条我选统一，5 6 不改。」
- 实际改动（编号是 review 里的）：
  - 1：本机判断加上本机网卡地址，`SERVER_URL` 设成局域网 IP 时不再 403（[tech.md §3.2](tech.md#32-只接受本机请求)）。
  - 2：`SERVER_URL` 只在功能开启时解析。
  - 3：把残留的 `dont_remember` cookie 过期掉（[tech.md §3.5](tech.md#35-残留的-dont_remember-cookie)）。
  - 4：`devSignIn()` 抛异常时也跳 `/login`。
  - 7：端点改成 server-only，HTTP 入口改成 Hono 单独注册的路由（[tech.md §3.1](tech.md#31-server-only-端点和单独的路由)）。
  - 9：启动日志改成 "any local client can sign in"。
- 没改：5、6，见 [tech.md §6](tech.md#6-没采用的方案2026-11-01)。
- 偏差：
  - 改第 7 条时发现直接调用 `auth.api.*` 会跳过 better-auth 路由层的 origin 检查，计划外补上 `formCsrfMiddleware`（[tech.md §3.3](tech.md#33-csrf-检查)）。
  - 第 2 条实际收益很小：better-auth 自己也会在启动时拒绝格式错误的 `SERVER_URL`（实测）。
  - 列 review 结果时发现 `vite --host` 会让"只限本机"失效，写进文档，代码没改（[tech.md §5](tech.md#5-安全边界2026-11-01)）。
- 检查：见 [verification.md §4](verification.md#4-各次实际结果)。
- 状态：✅ 完成（2026-11-01）

### 阶段 5：合入远端 main，按新约定调整

- 起因：用户要求提交并 rebase 到远端 main。远端这时多了 5 个提交：文档改成按模块组织、代码注释只写文档引用、ESLint + Prettier 换成 Oxlint + Oxfmt。
- 文件：本模块文档（新，原来是 `apps/docs/features/dev-auto-login.md`）；上面各代码文件的注释；根 `.env.example`、`apps/server/.env.example`、CLAUDE.md。
- 实际改动：本地 main 没有自己的提交，先 fast-forward 到远端 main，再恢复改动；`vite.config.ts`、`auth.ts` 的冲突只是格式差异；说明性注释挪进 tech.md，原处换成 `See apps/docs/dev-auto-login/tech.md §…`；去掉 client 里已经过时的 `body: {}`（[tech.md §4.2](tech.md#42-client-插件-devsignin)）。最后拆成两个提交（用户确认）。
- 检查：见 [verification.md §4](verification.md#4-各次实际结果)。
- 状态：✅ 完成（2026-11-01）
