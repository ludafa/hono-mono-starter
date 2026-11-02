---
name: toolchain
description: 构建与依赖的操作指南和设计记录：client 的 vite@8（Rolldown 打包 + Oxc 转换）、pnpm 11 的配置（只写在 pnpm-workspace.yaml：allowBuilds、minimumReleaseAgeExclude）、packageManager、TypeScript 版本（现在是 6，升 7 已调研）。新增或升级依赖、升级 Vite / pnpm / TypeScript、pnpm install 报构建脚本被拦或版本发布太新、排查打包问题时使用。
---

# 构建与依赖

client 用真正的 `vite@8`：打包是 Rolldown，转换是 Oxc，没有 `rolldown-vite`，也没有 overrides。pnpm 是 11（根 `package.json` 的 `packageManager`），配置全部写在 `pnpm-workspace.yaml`。两个 app 都是 TypeScript 6；TS 7 调研过，可以直接升，还没升。

## 装依赖、升依赖

1. 依赖装进用它的包：`pnpm --filter @hono-mono-starter/<server|client> add <包>`。全仓库共用的工具（lint、提交钩子、文档脚本用的）装在根目录：`pnpm add -Dw <包>`。
2. pnpm 的配置只写在 `pnpm-workspace.yaml`。**不要往 `package.json` 里加 `pnpm` 字段**：pnpm 10 起不再读它，写了也是静默失效。改完用 `pnpm why <包>` 确认生效。
3. 安装时提示某个依赖的构建脚本被拦下：确认它确实要跑脚本（原生模块、平台二进制、postinstall），再加进 `allowBuilds`，值为 `true`。`pnpm approve-builds` 改的也是这张表。
4. 安装时提示某个版本发布太新、被拦下：能等就等，或者换一个早一点的版本。确实要用，就把 `<包>@<版本>` 加进 `minimumReleaseAgeExclude`；不再需要豁免时删掉。
5. 非交互环境里做需要重建 `node_modules` 的全新安装，加 `CI=true`；改了 overrides 加 `--no-frozen-lockfile`。

## 升级 Vite 和它的插件

- `@vitejs/plugin-react`、`@tailwindcss/vite`（和 `tailwindcss` 同步）、`@tanstack/router-plugin`（和 `@tanstack/react-router` 同步）跟着 Vite 一起升，选 peer 支持当前 Vite 主版本的版本。插件出问题先查它的 peer 范围。
- `apps/client/vite.config.ts` 只用了 `plugins`、`resolve.alias`、`server.proxy`、`define`。以后要加打包或转换选项，写 Vite 8 的 `build.rolldownOptions` / `oxc`，不要照旧教程写 `rollupOptions` / `esbuild`（[tech.md §1.3](references/tech.md#13-配置不用改)）。
- 排查打包问题时记住：底层是 Rolldown，不是 Rollup 加 esbuild。

## 升级 TypeScript 到 7

已调研可行，构建、codegen、lint、提交钩子都实测通过（[references/probe-typescript-7.md](references/probe-typescript-7.md)）。要做的事：

1. 两个 app 的 `typescript` 改成 `^7`（调研时是 7.0.2）。
2. 删掉 `hono-mono-starter.code-workspace` 里的 `typescript.tsdk` 和 `typescript.enablePromptUseWorkspaceTsdk`（TS 7 的包里没有 `lib/tsserver.js`），VS Code 改用 `TypeScriptTeam.native-preview` 扩展。
3. 可选：开类型感知 lint，见 `lint-format` skill。

以后引入依赖老 Compiler API 的工具（typescript-eslint、Volar、`vite-plugin-dts` 等）时，用官方 alias 让 6 和 7 并存：`"typescript": "npm:@typescript/typescript6"` + `"@typescript/native": "npm:typescript@^7"`。

## 改完要跑

- `pnpm typecheck`、`pnpm lint`、`pnpm build`。
- 动了 client 的构建链：`pnpm dev:client` 能起来，页面样式正常（Tailwind 在工作），改路由文件后 `routeTree.gen.ts` 会被重写。
- 动了 lockfile：`CI=true pnpm install --frozen-lockfile` 通过。
- 记录：在 [references/plan.md](references/plan.md) 加一个日期小节，[references/tech.md](references/tech.md) 里变了的版本、配置项一起改，写法按 `feature-docs` skill。

## 关键决定

- client 从 `rolldown-vite@7.2.5` 迁到真正的 `vite@^8`，删掉 `rolldown-vite` 和 override（用户拍板，2026-07-19，见 [tech.md §1](references/tech.md#1-vite-82026-07-19)）
- pnpm 配置从 `package.json` 的 `pnpm` 字段搬到 `pnpm-workspace.yaml`：pnpm 10 起不再读那个字段，原来的 override 早就静默失效了（2026-07-19，见 [tech.md §2](references/tech.md#2-pnpm-11-的配置2026-07-19)）
- TypeScript 7 可以直接升，暂不升级（2026-10-21，见 [probe-typescript-7.md](references/probe-typescript-7.md)）

## 参考资料

| 文件                                                      | 内容                                                                                                    |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| [tech.md](references/tech.md)                             | §1 Vite 8 选型、一起升级的包、配置为什么不用改；§2 pnpm 11 的配置项和坑；§3 TypeScript 版本现状；风险表 |
| [probe-typescript-7.md](references/probe-typescript-7.md) | 能不能升 TS 7：逐个环节的实测结果和耗时、谁在运行时用 `typescript`、tsconfig、编辑器、peer 依赖、建议   |
| [plan.md](references/plan.md)                             | 模板的施工记录：2026-07-19 迁到 Vite 8；2026-07-25 依赖小升级；2026-10-21 TS 7 调研、去掉 eslint 的豁免 |
| [verification.md](references/verification.md)             | Vite 8 迁移的检查表；手动验收；2026-07-19 和 2026-10-21 的实际结果                                      |

## 相关

- `lint-format`：类型感知 lint 规则要 TS 7；Vite 8 用的 Oxc 和 lint 用的 Oxc 是同一个工具链。
- `commit-workflow`：和 Vite 8 迁移在同一个分支 `chore/vite8-migration` 上做的。
- [开发环境自动登录](../../../apps/docs/dev-auto-login/README.md)：`vite.config.ts` 里 `define` 和 dev 代理的写法。
