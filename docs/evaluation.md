# Evaluation design

The repository keeps four concerns separate because one aggregate score would hide important failures.

## Route evaluation

`router_eval.jsonl` contains 100 labelled business queries. Exact route accuracy requires both the ordered agent list and execution mode to match. Macro F1 reports whether one high-volume intent hides a weak specialist.

## Tool evaluation

Tool name accuracy and argument accuracy are separate. Calling `get_order` with the wrong order ID is not a successful tool call even if the tool name is correct.

## RAG evaluation

The dependency-free check validates evidence selection, citations, metadata filters, and refusal behavior. Faithfulness and context precision are intentionally left null until Ragas runs with a named evaluator model, ground truth, date, and saved per-case output.

## Recovery evaluation

The local suite injects transient failures, retries the operation, repeats the same request, and checks that the idempotency ledger records at most one side effect. This is not presented as proof of distributed production recovery.

## Reporting rule

- `illustrative`: schema or example only; never use as a resume metric.
- `measured-local`: produced by committed code and data on a named local baseline.
- `measured-external`: requires model/provider, date, configuration, raw per-case output, and reproducible command.

No number may be copied from an upstream repository into a CrossBorder result report.
