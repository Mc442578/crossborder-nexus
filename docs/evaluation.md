# Evaluation design

CrossBorder Nexus uses layered evaluation because a correct final sentence can hide a wrong route, wrong tool arguments, an inefficient trajectory, unsupported evidence, or a duplicated side effect. The local harness therefore separates five failure surfaces and preserves per-case mistakes instead of reducing the system to one aggregate score.

## 1. Router evaluation

`router_eval.jsonl` contains 100 labelled business queries, including single-intent and multi-intent requests. Exact route accuracy requires the ordered Agent list and execution mode to match. Agent Set F1 gives partial credit when one of several specialists is correct, while Macro F1 prevents a high-volume intent from hiding a weak specialist.

Reported metrics: exact route accuracy, execution-mode accuracy, Agent Set F1 and primary-route Macro F1.

## 2. Tool evaluation

`tool_eval.jsonl` evaluates the first business action chosen by a specialist. Tool name and arguments are scored separately because selecting `get_order` with the wrong order ID is still an incorrect action. Tool Call F1 provides a set-based summary that can later support multiple calls per task.

Reported metrics: tool-name accuracy, exact argument accuracy and Tool Call F1.

## 3. Agent trajectory evaluation

`trajectory_eval.jsonl` covers the complete local path from routing through specialist execution, tool calls and human handoff. It follows the common trajectory-evaluation pattern of offering more than one comparison mode:

- strict match: Agents, execution mode, ordered tools and handoff must all match;
- unordered match: the expected tools must be present regardless of independent-call order;
- subsequence match: required tools must appear in order, while harmless intermediate steps are allowed;
- handoff accuracy: risky or low-confidence requests must stop at the human boundary.

This deterministic suite evaluates orchestration contracts. A model-judged trajectory score is optional and must record the evaluator model, rubric, prompt and per-case reasoning.

## 4. RAG evaluation

`rag_eval.jsonl` checks retrieval and answer contracts separately. The dependency-free baseline measures retrieval hit rate, Mean Reciprocal Rank, citation-source accuracy and refusal accuracy. These metrics reveal whether a failure came from retrieval, citation selection or insufficient-evidence handling.

Ragas faithfulness and context precision are intentionally left null until an evaluator model is configured. Any measured run must save the evaluator model, dataset version, raw per-case output and timestamp. A score copied from another repository is never a CrossBorder result.

## 5. Recovery evaluation

`recovery_eval.jsonl` injects transient failures, applies the retry policy, repeats the same request and checks the idempotency ledger. It reports recovery pass rate, retry-budget compliance and duplicate side effects. This proves the in-process contract only; distributed crash recovery requires a persistent store and separate integration tests.

## Running and reporting

`python -m evaluation.run_all` executes all dependency-free suites and writes `evaluation/reports/latest_report.json`. The report records dataset hashes, case counts, runtime version and per-suite failures. `evaluation/thresholds.json` defines the committed quality gate; a failed threshold returns a non-zero exit code, and the GitHub Actions workflow uploads the report even on failure. Individual suites remain runnable for focused debugging. Reports use three statuses:

- `illustrative`: schema or example only; never use as a project or resume metric;
- `measured-local`: produced by committed code and data on the local deterministic baseline;
- `measured-external`: requires provider/model versions, date, configuration, raw case output and a reproducible command.

Before publishing a number, retain the dataset, evaluator, baseline, failures and environment together. A metric without those artifacts is not reproducible evidence.

## Design references

- LangSmith recommends evaluating final responses, individual steps and full trajectories rather than relying on one score: https://docs.langchain.com/langsmith/evaluation-approaches
- AgentEvals supports strict, unordered, subset and superset trajectory matching, including tool-argument comparison: https://github.com/langchain-ai/agentevals
- Ragas separates RAG metrics such as faithfulness and context precision from agent metrics such as tool-call and goal accuracy: https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/
- OpenAI Agents tracing models generations, tool calls, handoffs and guardrails as traceable spans: https://openai.github.io/openai-agents-python/tracing/
