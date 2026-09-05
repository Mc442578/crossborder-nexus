# 2026-08-29 项目进展与明日续接

## 今天完成了什么

项目已经从 mock 骨架推进到第一条完整的真实数据链路。四个后端接口全部实现：`/api/search` 通过 Tavily 查找品类背景和真实网页来源；`/api/profile` 使用确定性规则整理品类画像；`/api/listings` 通过 SerpApi 查询 Amazon 商品；`/api/trend` 通过 SerpApi 查询美国市场近两年的 Google Trends 热度。

Amazon 商品接口已经完成字段映射、价格清洗、无效商品过滤、按 ASIN/标题去重，以及多个检索词每批最多并发 3 个。Google Trends 接口已经把外部每周热度聚合为月度点，避免 Pipeline 把 12 周误当成 12 个月，并完成空参数、超时、第三方错误和空结果处理。

本地 `.env` 已切换为 `VITE_DATA_SOURCE=live`，且仍被 Git 忽略。后端测试 15/15 通过，TypeScript 类型检查和正式构建通过。学习者在 Chrome 输入 `women yoga pants`，第一次完整 live 流程成功：四个 Pipeline 步骤全绿，耗时约 10.9 秒，取得 125 个 Amazon listing、真实趋势，并生成 44 分报告。

## 学习者今天亲手完成了什么

- 配置本地 `.env` 并确认它没有进入 Git。
- 在 Cursor 中定位和阅读 `server/index.mjs`。
- 亲手完成 Tavily 请求、HTTP 状态判断、JSON 转换和搜索结果映射的关键代码。
- 亲手完成 Amazon SerpApi 请求和第一条商品映射。
- 在 PowerShell 测试后端接口并观察真实第三方响应。
- 在 Chrome 亲自运行第一次完整 live 选品流程。
- 能够初步说明四个接口、BFF、Pipeline、mock、环境变量、HTTP、JSON 和映射的作用。

## AI 今天完成了什么

- 补齐确定性 `/api/profile`、Amazon 的机械映射/清洗/去重/限并发和 Google Trends `/api/trend`。
- 按测试驱动方式补充 Tavily、Profile、Amazon 和 Trend 测试。
- 定位并处理 8787 端口旧 Node 进程导致“代码已修改但运行的仍是旧版本”的问题。
- 完成真实 Tavily、Amazon、Google Trends 验证、类型检查和正式构建。
- 持续维护执行计划和概念学习账本。

## 已确认的边界

- 第一版只支持美国市场、Amazon 渠道和英文服装品类。
- 纯中文关键词会在确定性 `/api/profile` 主动失败；不是 Tavily 不能搜中文，也不是只能搜索 `women yoga pants`。
- 页面虽然可以点亮 Walmart/TikTok，但后端目前只实现 Amazon；界面选中不代表渠道已经接入。
- Google Trends 的 0～100 是相对热度，不是搜索次数或销量。
- “程序跑通”只证明技术链路成功，不等于评分和商业结论已经可信。

## 尚未 Review 的问题（明天从这里继续）

1. 需求量为 0：Amazon 搜索结果没有精确 `monthlySales`，现有需求评分会把缺失数据当成 0，需要改成明确的“数据缺失/降级”，不能解释成市场没有需求。
2. 利润分不是真实毛利：当前只根据中位售价打分，尚未加入采购、头程、平台佣金和广告成本。
3. CR4 可信度有限：商品缺少月销量时，集中度使用每个 listing 权重 1，实际更接近品牌 listing 数占比，不是真实销售集中度。
4. 趋势计算需要测试：必须验证 `rising/flat/declining`、近 12 个月同比和季节峰值；当前季节峰值使用数组位置 `1～12`，需要确认是否对应真实日历月份。
5. 渠道选择与能力不一致：第一版应禁用或明确标记 Walmart/TikTok 尚未接入，避免用户误以为 125 个 listing 来自多个渠道。
6. 品类画像仍是简单规则：`outfit`、`plus size` 等检索词是固定拼接，不代表 Tavily 已从资料中真正抽取这些词。
7. 报告可信度提示不足：需要展示数据来源、抓取时间、样本量和缺失维度，避免把 44 分当成精确商业判断。

## 明天的开始位置

继续阶段四 Review。先为市场、趋势和评分函数补测试并核对 44 分的形成过程；再修复第一版必须解决的误导性问题，重新用 Chrome 跑一次 live 验收。完成后输出阶段四“做了什么、收获了什么、证据和遗留问题”，然后进入阶段五的测试、CI 和首次 Review。
