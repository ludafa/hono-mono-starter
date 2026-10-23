# 0002 — Claude-driven commit workflow (commitlint + husky), no changesets

- Status: Accepted
- Date: 2026-07-19

## Context

需求是"给仓库加 git 提交相关能力"，参考的是一份完整的 _monorepo 版本与发布_ 指南
——用 **changesets** 管理每个包的独立版本、独立 changelog，并 `pnpm changeset publish`
发到 npm / 私有 registry，配 `/commit`、`/split-commits`、`/release` 三条 slash command
驱动全流程。

但这份指南是为"**每个包独立版本 + 发 registry**"的场景写的，与本仓库现状不符：

1. **三个包全部 `private: true`** —— 根、`apps/server`、`apps/client` 都是应用，不是要
   发布的 npm 包；也没有 `packages/*` 下的可发布包。
2. **`/release` 的核心是 `pnpm changeset publish`**，对纯私有包是空操作——changesets 会
   跳过 private 包的发布。整套"版本号由 changeset 决定"的机制，在没有对外发布物的仓库里
   没有承载对象。

即：changesets 解决的是"多包独立发版归属"问题，而这个仓库现在**根本没有发版动作**。
硬套会引入一套空转的机制（`.changeset/`、`/release`、config），徒增维护面。

## Decision

**只落地指南里的"提交工作流"部分，不引入 changesets、不建 `/release`。**（用户在两个
选项间明确选择了"只做提交工作流"。）具体：

| 指南组件                                            | 本仓库取舍                                                                         |
| --------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `@changesets/cli` + `.changeset/config.json`        | **不装** —— 无发版对象                                                             |
| `/commit` 生成 changeset + 提交                     | 改写为**只提交**：分析 staged 改动 → 定 type/scope → 写 Conventional Commit → 提交 |
| `/split-commits`                                    | 保留（去掉"changeset 跟随功能 commit"那条）                                        |
| `/release`（bump 版本 / changelog / publish / tag） | **不建**                                                                           |
| commitlint + husky 兜底                             | **装**（用户选择安装）                                                             |

**版本号与 changelog 暂不由提交流程管理**，commit message 只影响历史可读性。若将来在
`packages/*` 放要发布的包，再评估引入 changesets——那才是它的正确适用场景。

## What was set up

- `commitlint.config.js`（根，ESM）：`extends: ['@commitlint/config-conventional']`。
- husky v9：`.husky/commit-msg` → `pnpm exec commitlint --edit "$1"`，每次提交校验 message。
  - husky init 顺带生成的 `pnpm test` 版 `pre-commit` 示例钩子已**删除**——对 starter 而言
    每次提交跑全量测试太重，且会让下游用户意外；只保留 commit-msg 校验。
- 根 `package.json` 的 `"prepare": "husky"`（husky init 自动写入）：clone 后 `pnpm install`
  自动激活钩子，无需手动 `husky init`。CI 里若因 `--ignore-scripts` 报错，设 `HUSKY=0`。
- devDependencies 装在**根**（`-Dw`）：`@commitlint/cli`、`@commitlint/config-conventional`、
  `husky`。不装进子包。
- Slash command：`.claude/commands/commit.md`、`.claude/commands/split-commits.md`。
- `CLAUDE.md` 增补「Git 提交约定」一节。

## Verification

- 坏 message：`echo "added some stuff" | pnpm exec commitlint` → 退出码 **1**（报
  `type-empty` / `subject-empty`）。
- 好 message：`echo "feat(server): add health check endpoint" | pnpm exec commitlint` →
  退出码 **0**。
- 钩子经由 husky 的 `.husky/_/commit-msg` 包装器在 `commit-msg` 阶段调用上述命令。

## Consequences

- 提交格式有机器兜底，历史整洁、可读，未来若接 changesets / 语义化发版有干净的 commit 基础。
- 想开启发版时的迁移路径清晰：装 `@changesets/cli` → `changeset init` → 补 `/release` →
  （若发私有 registry）配 `access: "restricted"` 与登录态。
- 代价：`/commit` 不再自动记录"改动影响哪些包 / 该 bump 什么"，因为当前无版本语义——这是
  与"无发版对象"现状匹配的有意简化，不是缺失。
