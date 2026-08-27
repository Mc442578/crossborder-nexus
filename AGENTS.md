# CrossBorder Repository Instructions

## Project boundary

This repository is a portfolio demonstration of a cross-border e-commerce AI Agent platform. It must clearly separate implemented demo code, mock integrations, reference designs, and unverified future work.

## Engineering rules

- Keep business rules, permissions, idempotency, and outbound messaging restrictions deterministic.
- Use LangGraph only for orchestration and state transitions; do not hide ordinary service logic inside prompts.
- Amazon integrations must default to mock adapters. Never commit credentials or claim production SP-API access.
- Evaluation reports must identify the dataset, evaluator, model, date, and whether a result is measured or illustrative.
- Preserve third-party notices and file-level attribution when code is copied or substantially adapted.
- Prefer small modules, typed Pydantic contracts, and explicit failure paths.

## Verification

- Python syntax: `python -m compileall backend evaluation`
- Unit tests: `pytest`
- Static project audit: `python scripts/verify_portfolio.py`
