# Research record

Research date: 2026-08-27

## Official platform constraints

- Amazon Selling Partner API supports catalog, listing, order, pricing, inventory, reports, notifications, and related seller workflows. Production access requires application registration, authorization, roles, and rate-limit handling.
- Amazon Messaging API first returns message actions available for a specific order. It does not grant an agent unrestricted permission to contact buyers.
- Customer Feedback API returns review-topic insights, trends, and snippets for supported marketplaces. The demo therefore models customer-feedback insights and does not claim to download every raw product review.

## Architecture decisions influenced by references

- E-Commerce Agents: specialist domains and explicit route/tool evaluation.
- AWS multi-agent customer support: centralized supervisor, specialized support agents, memory separation, identity propagation, and traces.
- JoyAgent-JDGenie: task planning and multi-step execution concepts.
- fastapi-langgraph-ai-agent: compact package-by-feature structure and checkpoint/HITL patterns.
- Ragas: RAG faithfulness and context-quality terminology.
- langgraph-production: score tool arguments separately from tool names and test recovery at interruption boundaries.

## Evidence boundaries

Reference repositories prove that a pattern has an implementation elsewhere. They do not prove this repository has run successfully. This repository uses independent demo code unless a file is later identified as copied or adapted in `THIRD_PARTY_NOTICES.md`.
