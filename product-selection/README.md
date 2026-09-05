# 选品工作台

> 本目录是集成到 CrossBorder Nexus 的独立运行子模块，保留原工作台的前端、BFF、mock/live 数据源和测试。CrossBorder Nexus 主控制台通过“选品工作台”入口打开本模块；来源与许可边界见 [NOTICE.md](NOTICE.md) 和仓库根目录的 [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md)。

面向美国服装市场的跨境电商选品研究工作台。用户输入英文品类、目标渠道和经营成本，系统会组合公开网页、电商商品、Google Trends、少量真实评论与确定性财务规则，生成一份带来源、可解释、会诚实降级的选品报告。

项目支持 Amazon、Walmart 和 TikTok 三个渠道。Amazon/Walmart 已完成真实商品与评论链路；TikTok 已实现官方 Affiliate Marketplace 适配器与测试，但真实商品调用仍需要 Seller/Partner 授权，TikTok 竞品评论当前明确不接入。

## 核心能力

- Tavily 搜索公开网页资料，为品类研究提供可追溯证据。
- DeepSeek 根据证据生成目标人群、购买驱动、待验证问题和美国电商英文搜索词。
- Prompt 约束任务，JSON Schema 约束输出结构，validator 校验证据 ID 等业务规则。
- SerpApi 获取 Amazon/Walmart 商品、Google Trends 和少量公开评论。
- Amazon、Walmart、TikTok 适配器完成数据清洗、字段映射和渠道状态标注。
- 按渠道计算中位售价、平台费、广告费、TikTok 联盟佣金、单件毛利和毛利率。
- 从低评分评论提取带 review ID 和商品来源的“待复核痛点”，不把小样本包装成品类事实。
- BFF 端 TTL 缓存减少重复第三方调用，并合并同一时刻的相同请求。
- live Pipeline 在 BFF 执行，通过 SSE 将步骤和缓存状态实时推送到浏览器，不轮询进度。
- 保留 mock 离线模式，没有 API Key 也能演示完整页面。

## 完整数据流

`浏览器输入 → BFF 创建任务 → Tavily 找公开资料 → DeepSeek 生成证据画像和搜索词 → SerpApi/TikTok 官方接口找商品、趋势和评论 → 适配器清洗映射 → 普通代码计算利润、评分和可信度 → SSE 推送进度 → 页面展示并保存报告`

DeepSeek 是文字理解增强层，不直接连接三个电商平台，也不负责计算售价、销量、利润或最终分数。财务结果和评分由可测试的确定性代码完成。

## 快速开始

需要 Node.js 24 或更高版本。

```bash
npm install
copy .env.example .env
npm run dev
```

启动后访问 `http://localhost:5273/`。`npm run dev` 会同时启动 Vue 前端（5273）和 Node.js BFF（8787）。BFF 默认只监听 `127.0.0.1`，真实 API Key 只存在于被 Git 忽略的 `.env`，不会进入前端包。

### 数据模式

在 `.env` 中设置：

- `VITE_DATA_SOURCE=mock`：全量假数据，适合离线演示，不需要 Key。
- `VITE_DATA_SOURCE=live`：通过 BFF 调用真实第三方服务。

live 模式可配置：

- `TAVILY_API_KEY`：公开网页证据。
- `SERPAPI_API_KEY`：Amazon/Walmart 商品、趋势和评论。
- `DEEPSEEK_API_KEY`：证据画像与搜索词增强；缺失时会明确降级到固定规则。
- `TIKTOK_SHOP_APP_KEY`、`TIKTOK_SHOP_APP_SECRET`、`TIKTOK_SHOP_ACCESS_TOKEN`、`TIKTOK_SHOP_CIPHER`：TikTok Shop 官方授权凭据。

页面当前限定美国市场，建议输入英文服装品类，例如 `blouses`、`women yoga pants`、`plus size jeans` 或 `puffer jackets`。采购成本、头程物流成本和广告费率由用户填写，因为它们取决于供应商、运输方案和经营策略，商品搜索接口无法准确获知。

## 架构

### Pipeline

`src/core/pipeline/` 负责安排 discover、market、trend、reviews、scoring 和 verdict 等步骤的依赖、并行、重试、取消、降级和进度上报。非关键环节失败时保留已有结果并标记数据不完整；关键报告字段缺失时任务失败，不编造结论。

mock 模式在浏览器本地运行 Pipeline；live 模式通过 `POST /api/runs` 在 BFF 创建任务，由 `EventSource` 订阅 `GET /api/runs/:id/events`。完成后只读取一次 `GET /api/runs/:id/result`，取消使用 `DELETE /api/runs/:id`。

### BFF 与数据适配

`server/index.mjs` 是使用 Node.js 原生 HTTP 实现的 BFF（Backend for Frontend）。它保护密钥、校验输入、调用第三方 API、执行 live Pipeline、管理任务和缓存，并把第三方返回整理成前端需要的统一 JSON。

Amazon、Walmart、TikTok 的原始字段不同。各适配器先过滤空标题、无效价格和重复项，再映射成统一 `CompetitorListing`。因此映射不是简单的 JSON/JavaScript 转换，而是“数据清洗 + 字段翻译 + 业务筛选”。

### 缓存与 SSE

服务端内存缓存为不同资源设置 TTL：公开网页 30 分钟、商品 15 分钟、评论 30 分钟、趋势 6 小时、合格 DeepSeek 画像 12 小时。错误、取消、降级画像和不完整渠道结果不会写入缓存。当前缓存和任务注册表在 BFF 重启后清空，生产环境应迁移到 Redis 或其他共享存储。

SSE 事件带递增 ID，支持 `Last-Event-ID` 断线补发、15 秒心跳、任务取消和最长运行时间。持续断线时前端会尝试停止后端任务；取消未确认时不会声称已经安全停止。

## 关键目录

- `src/types/domain.ts`：统一业务数据合同。
- `src/core/pipeline/`：Pipeline 引擎、远程 SSE 客户端和步骤。
- `src/core/analysis/`：分渠道利润、需求代理、价格带、评论痛点和评分规则。
- `src/core/datasource/`：mock/live 数据源合同。
- `src/components/panels/`：市场、评论证据和最终结论页面。
- `server/`：BFF、第三方请求、适配器、任务注册表和 TTL 缓存。
- `docs/execution-plan.md`：阶段计划、真实完成状态和分工。
- `docs/learning-notes.md`：关键概念与阶段学习账本。
- `docs/project-retrospective.md`：项目总复盘、代码位置和个人复述。

## 验证

```bash
npm test
npm run typecheck
npm run build
```

当前验收证据：

- 117/117 自动测试通过。
- TypeScript 类型检查和生产构建通过。
- L3 live 验证取得 Amazon 8 条、Walmart 10 条评论。
- 两次相同 live 查询验证第一次五类缓存 miss，第二次 5/5 hit。
- 独立 Review 覆盖数据真实性、缓存隔离、任务终态、SSE 断线/取消和测试盲区。

## 真实边界

- TikTok 商品 live 需要合法 Seller/Partner 授权；没有凭据时页面显示未授权，不用假数据冒充。
- TikTok 竞品评论当前不接入。
- 评论是少量代表商品样本，只能形成待复核主题，不能证明整个品类普遍存在问题。
- 利润是简化单件毛利，不包含末端履约、仓储、退货损耗、税费和促销，不能等同最终净利润。
- 报告目前保存在浏览器 `localStorage`，没有账号、团队共享、生产数据库和多实例任务持久化。
- 这是已完成真实链路和本地 live 验证的面试演示项目，不应包装成生产级 SaaS。
