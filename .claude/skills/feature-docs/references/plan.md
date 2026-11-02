# 文档体系：施工计划

> 相关：[操作指南](../SKILL.md) · [技术实现](tech.md)

## 2026-10-21（分支 `ludafa/add-oxlint-eslint-config`）

起因：用户要求「/Users/oliver/code/ludict/.claude/skills/feature-docs 把这个 skill 集成到当前的项目里，并且用这个 skill 重写我们的 docs 文档」。

### 阶段 1：移植 skill

- 文件：`.claude/skills/feature-docs/SKILL.md`（新）、`.claude/skills/feature-docs/references/templates.md`（新）。
- 状态：✅ 完成（2026-10-21）
- 实际改动：按 [tech.md §5](tech.md#5-从-ludict-移植时改了什么2026-10-21) 的对照表改写。"版本改日期"和"注释规则一起引入"是用户在两个选项里选的（用户拍板）。
- 检查：skill 用"目录 + `SKILL.md`"的格式放好后，立刻出现在 Claude Code 的可用 skill 列表里。

### 阶段 2：移植检查脚本

- 文件：`scripts/docs/index.mjs`（新）、`scripts/docs/check-refs.mjs`（新）、根 `package.json`（`docs:index`、`docs:check-refs`、`docs:check` 三个脚本；`lint` 末尾加 `pnpm docs:check`；`zod` 加进根 devDependencies）。
- 状态：✅ 完成（2026-10-21）
- 实际改动：路径改成 `apps/docs/`；`versions` 改成 `changes` 并按日期排序；输出格式化从 Prettier 换成 oxfmt（[tech.md §2.3](tech.md#23-输出与格式化)）；脚本里的说明性注释换成 `See apps/docs/doc-system/tech.md §…` 引用；代码风格由 PostToolUse hook 统一成本仓库的（分号、`curly`）。

### 阶段 3：改写现有文档

- 文件：`apps/docs/{toolchain,commit-workflow,lint-format,doc-system}/`（新）、`apps/docs/README.md`（从写法说明改成生成的索引）；删除 `apps/docs/decisions/`。
- 状态：✅ 完成（2026-10-21）
- 原内容的去向：

| 原文件                                                                  | 去向                                                                                       |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `decisions/0001-vite-rolldown-upgrade-and-pnpm11-config.md`             | [toolchain](../../toolchain/SKILL.md)：tech.md §1～§2、plan.md 2026-07-19、verification.md |
| `decisions/0002-commit-workflow-commitlint-no-changesets.md`            | [commit-workflow](../../commit-workflow/SKILL.md)：全部                                    |
| `decisions/0003-oxlint-oxfmt-replace-eslint-prettier.md`                | [lint-format](../../lint-format/SKILL.md)：全部，并补上之后几轮的改动                      |
| 本会话的 TypeScript 7 调研（原来只在对话里）                            | [toolchain/probe-typescript-7.md](../../toolchain/references/probe-typescript-7.md)        |
| 原 `apps/docs/README.md`（features / solutions / decisions 的写法说明） | 被 feature-docs skill 取代                                                                 |

- 偏差：ADR 只有"决定 + 后果"，改写时按 skill 拆成 tech（选型和现状）、plan（按日期的施工记录）、verification（检查和实测结果）。ADR 0002 里写的日期是 2026-07-19，实际提交 `9ee5658` 在 2026-07-25，plan.md 按开始日期 2026-07-19 记，注明合入日期。

### 阶段 4：改 CLAUDE.md 和旧 skill

- 文件：`CLAUDE.md`（新增「文档」「代码注释」两节，取代原来的 On startup 和 Documentation；Skills 列表把 `read-docs` 换成 `feature-docs`；Tooling、Git 两节里指向 ADR 的链接改成模块链接）、`.claude/skills/read-docs.md`（删除）、`.oxlintrc.json`（说明注释换成引用）、`apps/client/kubb.config.ts`（加引用）。
- 状态：✅ 完成（2026-10-21）

### 阶段 5：验证

- 状态：✅ 完成（2026-10-21）
- 检查：见下面"结果"。

结果：

- `pnpm docs:index` 生成 4 个模块的索引；再跑 `pnpm format` 后 `pnpm docs:check` 仍通过（索引已经是 oxfmt 的格式）。
- `pnpm lint` 通过（含 `pnpm docs:check`）：13 处代码引用、128 个文档链接全部对得上。`pnpm docs:check` 两个脚本合计约 0.15 秒，`pnpm lint` 整体约 0.9 秒（实测）。
- 故意改坏三处，都被报出并退出码非 0，改回后通过：`kubb.config.ts` 的引用改成 `§9` → `apps/client/kubb.config.ts:14: apps/docs/lint-format/tech.md has no section §9`；lint-format README 里一个锚点改错一位 → `has no heading for #1-选型2026-10-22`；toolchain 的 `code` 里 `pnpm-workspace.yaml` 改成 `.yml` → `code paths not found: pnpm-workspace.yml`。
- 偏差：做上面的破坏测试时，两个 `README.md` 备份到了同一个文件名，恢复时把 toolchain 的 README 写进了 lint-format；`index.mjs` 立刻报 `name "toolchain" ≠ directory`，已按原内容恢复，再测一遍通过。

### 阶段 6：其余 skill 改成目录格式（用户追加）

- 现象：项目原有的 8 个 skill（`bootstrap`、`add-api-endpoint` 等）是平铺在 `.claude/skills/` 下的单个 `.md` 文件，会话的可用 skill 列表里一个都没有；`feature-docs` 用"目录 + `SKILL.md`"放好后立刻出现。
- 原因：Claude Code 只认 `.claude/skills/<名字>/SKILL.md`，平铺的文件从来没被加载过。CLAUDE.md 列着它们，Claude 实际调不到。
- 文件：8 个 `.claude/skills/<名字>.md` 用 `git mv` 移到 `.claude/skills/<名字>/SKILL.md`，frontmatter 补 `name`；`rename-template` 里的路径通配改成 `.claude/skills/*/SKILL.md`；CLAUDE.md「Skills available」写明格式要求。
- 状态：✅ 完成（2026-10-21）
- 检查：移动后 8 个 skill 立刻全部出现在 Claude Code 的可用 skill 列表里（加上 `feature-docs` 共 9 个）。

## 2026-10-22（分支 `ludafa/add-oxlint-eslint-config`）

起因：用户跑了 `/code-review high`，核实后要求「10 条都修复」。本模块管其中 4 条（2、3、5、10）；其余 6 条记在 [代码规范与格式化的施工计划](../../lint-format/references/plan.md)。

### 阶段 1：修 `check-refs.mjs`

- 文件：`scripts/docs/check-refs.mjs`。
- 状态：✅ 完成（2026-10-22）
- 实际改动：
  1. 第 2 条：`git grep` 和 `git ls-files` 加 `-z`，中文文件名原样输出（[tech.md §3.1](tech.md#31-代码里的文档引用)）。
  2. 第 3 条：开头先检查是不是在 git 仓库里，不是就打印提示、跳过（[tech.md §3.4](tech.md#34-不在-git-仓库里时)）。
  3. 第 5 条：以 `/` 开头的链接按仓库根目录解析；`decodeURI` / `decodeURIComponent` 抛异常时报 `malformed link`（[tech.md §3.3](tech.md#33-markdown-相对链接与锚点)）。
  4. 第 10 条：加 `textOf()` 缓存，每个文件只读一次。
- 偏差：测试时发现引用正则 `See (apps\/docs\/[\w./-]+\.md)` 匹配不到中文路径，`-z` 修好之后这类引用照样被漏掉。改成 `[\p{L}\p{N}_./-]+` 并加 `u` 标志（Claude 发现，计划外）。
- 检查：在 scratchpad 里建了一个临时目录，放一份文件名是中文的文档（`apps/docs/中文/说明.md`）和一个引用它 `§9` 的 `引用.ts`。还没 `git init` 时打印跳过提示、退出码 0；`git init` 之后报出全部 5 个问题：中文引用的 `§9` 不存在、`/nope.md` 不存在、两个坏的 `%` 转义、一个不存在的相对链接。指向 `/apps/docs/中文/说明.md#1-选型` 的根路径链接没有报错。仓库里 `pnpm docs:check` 通过。

## 2026-11-01（分支 `docs/maintenance-skills`）

起因：用户提出 toolchain、commit-workflow、lint-format、doc-system 四个模块不算功能文档，更像项目维护的 skill；讨论后用户问「这些模块如果有 skill、让注释指向 skill 不行么」，最后拍板「直接4个都改了吧，一步到位，脚本和引用也都改」。方案对比见 [tech.md §7](tech.md#7-维护类文档放进-skill2026-11-01)。

### 阶段 1：搬文件

- 文件：四个模块的 tech、plan、verification、probe 用 `git mv` 搬进 `.claude/skills/{toolchain,lint-format,commit-workflow,feature-docs}/references/`；toolchain、lint-format、commit-workflow 的 `README.md` 用 `git mv` 变成各自的 `SKILL.md`；删除 `apps/docs/doc-system/README.md`。
- 状态：✅ 完成（2026-11-01）
- 实际改动：对照表见 [tech.md §7.1](tech.md#71-对照表)。搬过去的文档内容不变，只把开头"相关"行的 `[模块说明](README.md)` 换成 `[操作指南](../SKILL.md)`，跨模块链接换成新路径（`../lint-format/tech.md` → `../../lint-format/references/tech.md`）。

### 阶段 2：写三个 SKILL.md，改 feature-docs

- 文件：`.claude/skills/{toolchain,lint-format,commit-workflow}/SKILL.md`（改写）、`.claude/skills/feature-docs/SKILL.md`、`references/templates.md`、本文件和 [tech.md](tech.md)。
- 状态：✅ 完成（2026-11-01）
- 实际改动：三个 SKILL.md 从"概要 + 关键决定 + 文件表"改成操作指南（按场景分的步骤、改完要跑什么、改完记到哪），关键决定和文件表留在末尾。feature-docs 的 SKILL.md 开头说明两处放法，§1 加"先分功能还是维护"，§2 的示例换成 dev-auto-login，新增 §8 维护类 skill 的写法、§9 关键决定、§10 参考资料；templates.md 加 SKILL.md 骨架。tech.md §1～§4 按新结构修订，新增 §7，风险表加 4 行。

### 阶段 3：脚本和引用

- 文件：`scripts/docs/check-refs.mjs`、`scripts/docs/index.mjs`、`.oxlintrc.json`、`scripts/format.sh`、`apps/client/kubb.config.ts`、CLAUDE.md（文档、代码注释、Skills available、Tooling、Git 提交约定）、根 README（Claude Code 一节）、`apps/docs/dev-auto-login/README.md`（相关模块的链接）、`apps/docs/README.md`（重新生成）。
- 状态：✅ 完成（2026-11-01）
- 实际改动：脚本见 [tech.md §7.2](tech.md#72-脚本的改动)。16 处代码注释的路径换成 `.claude/skills/<skill>/references/`，编号不变。CLAUDE.md 里找引用的命令从 `grep -rn "apps/docs/" apps scripts .claude *.json *.md` 换成 `git grep -nE "apps/docs/|\.claude/skills/"`：原来的 `*.json` 匹配不到 `.oxlintrc.json` 这类点开头的文件。
- 偏差：第一版排除 pathspec 写的是 `':!.claude/skills/*/references'`，实测排除不了里面的文件，改成 `references/*`（Claude 发现）。perl 批量改链接不会触发 PostToolUse hook，两个表格列宽变了的文件被 `oxfmt --check` 报出来，补跑了一次 `scripts/format.sh`。

### 阶段 4：验证

- 状态：✅ 完成（2026-11-01）
- 检查：`pnpm docs:check-refs` 报 `33 code references, 191 doc links OK`。改脚本、改引用之前跑过一次，报出 6 处失效（CLAUDE.md 4 处、dev-auto-login README 1 处、指向还没写的 §7 的 1 处），和预期一致。故意改坏三处，都被报出、退出码 1，恢复后通过：`.oxlintrc.json` 的引用改成 `§99` → `has no section §99`；toolchain 的 references/tech.md 末尾加一个 `## 2.` → `section §2 appears 2 times`；lint-format SKILL.md 的一个锚点改错 → `has no heading for #22-命令x`。改完后新的三个 skill 立刻出现在 Claude Code 的可用 skill 列表里，description 是新写的。`pnpm lint`、`pnpm typecheck` 通过。
