# 选品工作台项目总复盘

更新时间：2026-09-01。

## 1. 项目解决了什么

人话解释：用户输入一个美国服装品类和自己的经营成本，系统用公开网页、电商商品、趋势、少量真实评论和固定财务规则，生成一份带来源、能解释、会诚实降级的选品报告。大模型只负责理解文字和扩展搜索词，不负责编造售价、销量或利润。

代码位置：`src/stores/research.ts`、`src/core/pipeline/engine.ts`、`server/index.mjs`。

个人复述：浏览器提交品类 → BFF 保护密钥并执行 Pipeline → Tavily 找公开资料 → DeepSeek 整理画像和搜索词 → SerpApi/TikTok 官方接口找商品、趋势和评论 → 适配器清洗映射 → 普通代码计算分渠道利润、评分、可信度和风险 → SSE 推进度 → 页面保存并展示报告。

## 2. L1 数据入口、映射和模型增强

人话解释：Amazon、Walmart、TikTok 的原始字段不同，先用 `filter` 删除空标题、无效价格和重复商品，再用 `map` 翻译成统一 `CompetitorListing`。Tavily 返回网页标题、链接和摘要；DeepSeek 根据这些证据生成品类画像和英文搜索词；SerpApi 再用这些词搜索 Amazon/Walmart 和 Google Trends。TikTok 商品代码使用官方 Affiliate Marketplace，但 live 仍需 Seller 授权。

代码位置：`server/amazon.mjs`、`server/walmart.mjs`、`server/tiktok.mjs`、`server/profile-service.mjs`、`src/core/pipeline/steps/discover.ts`、`src/core/pipeline/steps/market.ts`。

个人复述：映射不是 JSON 和 JS 互转，而是“数据清洗 + 字段翻译”。Prompt 规定任务，JSON Schema 检查输出外形，validator 检查证据 ID 等业务合法性，人工 Review 判断文字是否真的被证据支持。

学习者实际完成：Amazon 第一条映射、Walmart 正常和无效价格测试、Walmart `filter + map` 核心、DeepSeek System Prompt、非法 evidence ID 测试和 validator 核心校验。

AI完成：第三方接口接线、DeepSeek 请求与降级、渠道失败处理、边界测试、页面与 Review。

## 3. L2 分渠道利润

人话解释：三个平台售价和抽成都不同，所以不能把全部商品混在一起算一次利润。程序先按渠道取商品中位售价，再确定该平台美国服装费率，扣采购、头程、平台费、广告费和 TikTok 联盟佣金，得到简化单件毛利；综合评分使用各渠道最低毛利率，避免平均值掩盖亏损渠道。

代码位置：`src/core/analysis/channel-economics.ts`、`src/core/pipeline/steps/scoring.ts`、`src/components/panels/VerdictPanel.vue`。

个人复述：`resolveUsApparelReferralRate` 根据平台和售价确定抽成率，不负责联网；`calculateChannelEconomics` 按平台分组并计算单位经济。结果不含末端履约、仓储、退货、税费和促销，所以不能叫最终净利润。

学习者实际完成：早期 `CostInputs`、单位利润固定案例和测试。

AI完成：三平台费率、TikTok 联盟佣金、分渠道利润、保守评分、页面和测试。

## 4. L3 真实评论证据

人话解释：系统从 Amazon 和 Walmart 各选一个评价数较高的代表商品，总共保留最多 20 条公开评论。只把低评分评论中的明确负面表达归入尺码、面料、做工、舒适度和外观候选主题，并保存支持它的 review ID、评分、商品链接和抓取时间。TikTok 评论按产品决定跳过，并在页面明确标注，不伪造。

代码位置：`server/reviews.mjs`、`src/core/pipeline/steps/reviews.ts`、`src/core/analysis/review-pain-points.ts`、`src/components/panels/ReviewPanel.vue`。

个人复述：Walmart 搜索用的 `product_id` 和评论 API 需要的 `us_item_id` 用途不同，所以单独保存 `reviewProductId`。低评分加关键词只能得到“待复核痛点”，不能证明整个品类普遍存在问题；系统只保留 300 字证据摘录且不保存评论者身份。

学习者实际完成：决定跳过 TikTok 评论并要求明确标注。

AI完成：评论接口、ID 合同、映射、痛点规则、来源页面、测试、live 烟测和独立 Review。

## 5. L4 缓存

人话解释：相同请求在有效期内直接读取服务端保存的成功结果，避免再次花费 API 额度；过期后重新联网。缓存只保存合格成功结果，不保存报错、取消、模型降级或不完整渠道结果。

代码位置：`server/ttl-cache.mjs`、`server/server-data-source.mjs`。

个人复述：cache key 回答“是不是同一个请求”，TTL 回答“结果是否还新鲜”。key 存在且没过期就是 hit；否则是 miss，执行真实请求，成功后写缓存。当前是单进程内存缓存，BFF 重启会丢失，生产环境应使用 Redis。

学习者实际完成：本轮没有亲手编码；原定缓存判断练习改为项目复盘走读。

AI完成：key、TTL、容量、克隆、成功写入策略、页面命中提示、测试与 live 验收。

## 6. SSE 实时进度

人话解释：live Pipeline 现在在 BFF 执行。浏览器创建任务后使用 EventSource 保持一个 HTTP 连接，BFF 每当步骤状态变化就推一条事件；页面无需定时询问“完成了吗”。最终完成后浏览器只读取一次结果，不属于轮询。

代码位置：`server/run-manager.mjs`、`server/index.mjs`、`src/core/pipeline/remote.ts`、`src/stores/research.ts`、`src/views/WorkbenchView.vue`。

个人复述：`POST /api/runs` 创建任务，`GET /events` 接收 SSE，`GET /result` 完成后取报告，`DELETE /api/runs/:id` 取消。事件有递增 ID，断线后浏览器带 `Last-Event-ID` 重连，只补漏掉的事件；断开进度连接不等于取消任务。

学习者实际完成：提出必须使用 SSE 实时推送、不使用轮询的产品要求。

AI完成：远程 Pipeline、任务注册表、事件重放、心跳、取消、前端 EventSource、测试与真实验收。

## 7. 证据、限制和面试边界

自动证据：最终 `npm test` 为 117/117 通过，`npm run typecheck`、`git diff --check` 和生产构建通过；L3 live 取得 Amazon 8 条、Walmart 10 条评论；L4/SSE 第一次查询 5 个 cache miss，第二次相同查询 5 个 cache hit。独立 Review 进一步修复了缓存输入合同、SSE 持续断线、创建期间取消、核心报告缺失、事件重放、任务超时、取消确认和并发请求合并边界。

明确限制：TikTok 商品 live 需要 Seller/Partner 授权；TikTok 竞品评论不接入；评论是小样本待复核证据；利润是简化毛利而非净利润；内存任务和缓存会随 BFF 重启丢失；报告仍保存在浏览器 localStorage，没有生产数据库、账号权限和多实例共享。

面试时应说：这是一个已经实现并通过本地 live 验证的面试演示项目，不应包装成生产级 SaaS。Amazon/Walmart、Tavily、DeepSeek、Google Trends、评论、缓存和 SSE 有代码与测试证据；TikTok 商品只有官方适配代码和测试，真实授权仍受阻。
