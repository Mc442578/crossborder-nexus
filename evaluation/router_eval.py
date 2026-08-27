from datetime import datetime, timezone

from backend.app.agents.router import StructuredRouter
from evaluation.common import load_jsonl, macro_f1, ratio, write_report


def run() -> dict:
    cases = load_jsonl("router_eval.jsonl")
    router = StructuredRouter()
    expected_primary: list[str] = []
    predicted_primary: list[str] = []
    exact = 0
    mistakes: list[dict] = []
    for case in cases:
        decision = router.route(case["query"])
        predicted = list(decision.agents)
        expected = case["expected_agents"]
        expected_primary.append(expected[0])
        predicted_primary.append(predicted[0])
        if predicted == expected and decision.execution_mode == case["execution_mode"]:
            exact += 1
        else:
            mistakes.append({"id": case["id"], "expected": expected, "predicted": predicted})
    report = {
        "result_status": "measured-local",
        "evaluator": "deterministic StructuredRouter baseline",
        "evaluated_at": datetime.now(timezone.utc).isoformat(),
        "dataset_size": len(cases),
        "exact_route_accuracy": ratio(exact, len(cases)),
        "primary_route_macro_f1": macro_f1(expected_primary, predicted_primary),
        "mistakes": mistakes,
        "limitations": "Measures the local deterministic baseline, not a production LLM.",
    }
    write_report("router_report.json", report)
    return report


if __name__ == "__main__":
    print(run())
