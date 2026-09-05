# Product selection workbench integration

## Purpose

CrossBorder Nexus now includes the product-selection workbench as an independently runnable submodule. The integration keeps the original Vue and Node architecture intact while giving operators one repository, one navigation entry and one continuous-integration gate for agent operations and product research.

## Runtime boundary

The main platform remains a Python FastAPI and LangGraph application. The selection module runs as a Vue 3 client on port 5273 and a Node BFF on port 8787. The BFF holds external credentials, validates requests, runs the live pipeline, normalizes provider responses, caches successful results and sends progress to the browser with server-sent events.

The two runtimes are linked at the product and repository level, not through a hidden cross-process dependency. Opening “选品工作台” from the main dashboard starts an explicit research workflow; FastAPI requests do not silently invoke the selection module.

## Data flow

1. The operator enters an English apparel category, target channels and controllable cost inputs.
2. In mock mode, the browser executes the complete deterministic demonstration flow without credentials.
3. In live mode, the Node BFF creates a run and combines public web evidence, an evidence-grounded category profile, marketplace listings, trend signals and a small review sample.
4. Adapters normalize Amazon, Walmart and authorized TikTok results into shared contracts.
5. Ordinary code computes price bands, channel economics, demand signals, review pain points, confidence and the final score.
6. The interface shows sources, cache state, incomplete-data warnings and a report saved to browser local storage.

## Failure and truth boundaries

- Missing provider keys, timeouts, invalid input and unavailable channel authorization produce explicit errors or degraded results.
- TikTok live product access requires valid Seller or Partner credentials; TikTok competitor reviews are not implemented.
- A small review sample identifies hypotheses for manual review and is not evidence of category-wide prevalence.
- Unit economics are simplified contribution estimates based on user inputs and configured channel fees, not final net profit.
- The live adapters are a portfolio demonstration and do not claim production marketplace access.

## Verification

From `product-selection/`, run `npm test`, `npm run typecheck` and `npm run build`. The root GitHub Actions workflow runs these checks together with the Python repository audit, unit tests and evaluation gate.
