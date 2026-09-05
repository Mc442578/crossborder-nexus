# Project brief

## Users and problem

CrossBorder Nexus is designed for cross-border e-commerce operators and support staff who currently switch between seller-platform data, policy documents, customer messages, and spreadsheets. The demo presents one workspace where an AI supervisor can route work to specialized agents while deterministic services enforce permissions and outbound-action rules.

## Deliverable

A public portfolio repository whose code, documentation, sample data, architecture, and evaluation assets visibly cover seven capabilities: multi-agent orchestration, product-selection research, operational tools and analytics, multi-channel customer support, RAG knowledge, conversation memory, and reliability/evaluation.

## Primary demonstration journey

An operator can first research an apparel category in the product-selection workbench, compare channel listings, trends, review evidence and simplified unit economics, then save an evidence-linked report. In the agent workspace, the operator can ask why a product's customer sentiment is declining; the supervisor delegates to the operations and review agents, retrieves mock Amazon customer-feedback insights, consults the policy knowledge base when needed, and returns a consolidated answer with evidence and tool traces. A support conversation can separately query an order and create a human handoff ticket when confidence or policy conditions require it.

## Scope

- Typed Python interfaces and representative core logic.
- Mock Amazon provider with realistic sample responses.
- FastAPI contracts, LangGraph orchestration, RAG pipeline, memory interfaces, and evaluation harnesses.
- Static operator-workbench demonstration and complete documentation.
- Independently runnable Vue and Node product-selection module with mock/live modes and explicit provider boundaries.

## Non-goals

- Production Amazon authorization or access to seller data.
- Guaranteed access to Tavily, DeepSeek, SerpApi or TikTok without valid credentials and channel authorization.
- Unrestricted buyer messaging or scraping Amazon reviews.
- A production security/compliance certification.
- Claims that illustrative evaluation numbers were measured.
- Guaranteed one-command production deployment.

## Acceptance

The static verifier must map every resume capability to code and documentation. Python files must parse successfully. The product-selection tests, type check and production build must pass. README and design documentation must identify mock boundaries, source attribution, and the difference between measured and illustrative evaluation output.
