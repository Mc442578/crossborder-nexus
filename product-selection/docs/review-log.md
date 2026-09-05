# Code Review 记录

## 2026-08-30：阶段四可信度修复

Reviewer：毛晨（学习者）

作者：AI Coding 助手
分支：`codex/stage4-live-review`

### `market.ts`：无品牌商品集中度

- Review 结论：接受。
- 学习者判断：不同的无品牌商品肯定应该区别对待，不能全部合并成同一个 `unknown` 品牌。
- 对应修改：无品牌商品使用 `unknown:${listing.id}` 作为独立分组键。
- 自动化证据：`does not group every unbranded listing into one brand` 测试通过。

### `trend.ts`：季节高峰的真实月份

- Review 结论：接受。
- 学习者判断：季节高峰必须按照数据中的真实日历月份，不能按照数组中的排列位置。
- 对应修改：从 `YYYY-MM` 的 `period` 字段读取月份；例如 `2025-12` 得到 12，而不是因为排在第 10 个就显示成 10 月。
- 自动化证据：`reports seasonal peaks as calendar months` 测试通过。

### `scoring.ts`：缺失数据与评分含义

- Review 结论：接受。
- 学习者判断一：没有月销量时必须显示“缺少月销量，0 分只是占位，不代表没有需求”，不能写成“月销约 0 件”。
- 学习者判断二：只有中位售价、没有采购和物流等成本时，只能叫“售价空间（非毛利）”，不能解释成真实利润。
- 学习者判断三：缺少销量或完整成本时，报告必须明确加入风险提示。
- 对应修改：调整需求量、竞争格局和售价空间说明，并在 `risks` 中加入销量与成本缺失提示。
- 自动化证据：`labels missing sales and cost inputs without presenting them as real demand or profit` 测试通过。

## Review 结果

本轮三个文件全部由学习者人工接受。自动化测试负责验证行为，学习者负责确认业务含义；下一步可以继续处理渠道 UI 与后端实际能力不一致的问题。

## 2026-08-31：PR #1 独立复审

Reviewer：独立只读子 Agent

- 第一轮发现四项问题：缺失关键数据仍产生商业结论、Amazon 空结果仍可进入评分、界面可选非美国市场、本地 BFF 默认监听所有网卡。
- 修复后复审确认后三项通过；第一项仍发现“数据不足 0 分”和“可提前备货”会误导用户，因此再次拦截提交。
- 最终修复：总分改为 `null` 并在页面显示“—”；季节高峰只陈述观察事实，不给出备货建议。
- 学习者已接受本轮人工 Review 方向；最终合并仍以本地验证、GitHub CI 和精确 PR 头提交为准。

## 2026-08-31：阶段 7A 三路独立 Review

本轮由 AI 主 Agent 分配三个只读子 Agent，学习者明确授权 AI 完成余下阶段收尾。子 Agent 均不修改文件：整体 Reviewer 检查业务真实性与全部 diff；测试 Reviewer 检查异常路径和覆盖盲区；前端 Reviewer 检查 `SearchBar → CategoryQuery → Pipeline → Verdict → Report` 数据流。这样能并行引入独立视角并减少作者盲区，代价是意见可能重复或超出范围，最终仍由主 Agent 按 7A 目标去重和判断。

- 发现并修复零真实引用仍可能显示高可信：现在零引用最高 59 分、低可信。
- 发现并修复稀疏评价覆盖借用全部 listing 数抬高置信度：现在按实际需求信号样本数计分，并明确提示覆盖不完整。
- 发现并修复 `dataCompleteness` 与缺成本、缺来源状态矛盾：现在只有需求、成本、趋势和来源关联均无缺失时才是 `complete`。
- 发现并修复市场表和评分对部分月销量采用不同口径：只有全部 listing 具有有效月销量时显示月销，否则统一显示评价数代理。
- 修复执行计划中三条 7A 要求的断句，并补充针对性回归测试。

复核结论：原 Reviewer 确认全部 findings 关闭，没有发现新阻断问题。自动化证据为 46/46 测试、类型检查和正式构建通过；本地前端返回 200，BFF 对无效 profile 请求返回 400。本轮没有重新调用 Tavily/SerpApi 正常 live 流程，因为这会向第三方发送数据并可能消耗额度，当前没有针对该次外呼的明确授权；不得把本地 HTTP 烟测表述为 Chrome live 验收。

Git 交付证据：PR #3 的 `verify` CI 通过后已合并，merge commit 为 `fbbf73326db17aa2d44208acd5769bfb70c91bb0`；`codex/advanced-core` 的本地和远端分支均已清理，本地 `main` 与 `origin/main` 同步。
