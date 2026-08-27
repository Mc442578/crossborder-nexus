from datetime import datetime, timezone

from backend.app.agents.specialists import SpecialistRegistry
from evaluation.common import load_jsonl, ratio, write_report


def run() -> dict:
    cases = load_jsonl("tool_eval.jsonl")
    registry = SpecialistRegistry()
    name_correct = 0
    args_correct = 0
    details: list[dict] = []
    for case in cases:
        result = registry.execute(case["agent"], case["query"])
        trace = result.tool_traces[0] if result.tool_traces else None
        actual_name = trace.tool_name if trace else None
        actual_args = trace.arguments if trace else {}
        name_ok = actual_name == case["expected_tool"]
        args_ok = name_ok and actual_args == case["expected_arguments"]
        name_correct += int(name_ok)
        args_correct += int(args_ok)
        if not args_ok:
            details.append(
                {
                    "id": case["id"],
                    "expected": [case["expected_tool"], case["expected_arguments"]],
                    "actual": [actual_name, actual_args],
                }
            )
    report = {
        "result_status": "measured-local",
        "evaluator": "exact tool name and argument match",
        "evaluated_at": datetime.now(timezone.utc).isoformat(),
        "dataset_size": len(cases),
        "tool_name_accuracy": ratio(name_correct, len(cases)),
        "tool_argument_accuracy": ratio(args_correct, len(cases)),
        "mistakes": details,
        "limitations": "Uses the local specialist implementation and mock Amazon provider.",
    }
    write_report("tool_report.json", report)
    return report


if __name__ == "__main__":
    print(run())
