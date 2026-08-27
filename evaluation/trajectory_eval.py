from datetime import UTC, datetime

from backend.app.agents.router import StructuredRouter
from backend.app.agents.specialists import SpecialistRegistry
from evaluation.common import is_subsequence, load_jsonl, ratio, set_f1, write_report


def run() -> dict:
    cases = load_jsonl("trajectory_eval.jsonl")
    router = StructuredRouter()
    registry = SpecialistRegistry()
    strict_correct = 0
    unordered_correct = 0
    subsequence_correct = 0
    handoff_correct = 0
    tool_f1_scores: list[float] = []
    mistakes: list[dict] = []

    for case in cases:
        decision = router.route(case["query"])
        results = [registry.execute(agent, case["query"]) for agent in decision.agents]
        actual_tools = [trace.tool_name for result in results for trace in result.tool_traces]
        expected_tools = case["expected_tools"]
        actual_handoff = any(result.handoff_required for result in results)
        strict_ok = (
            list(decision.agents) == case["expected_agents"]
            and decision.execution_mode == case["execution_mode"]
            and actual_tools == expected_tools
            and actual_handoff == case["expect_handoff"]
        )
        strict_correct += int(strict_ok)
        unordered_correct += int(sorted(actual_tools) == sorted(expected_tools))
        subsequence_correct += int(is_subsequence(expected_tools, actual_tools))
        handoff_correct += int(actual_handoff == case["expect_handoff"])
        tool_f1_scores.append(set_f1(expected_tools, actual_tools))
        if not strict_ok:
            mistakes.append(
                {
                    "id": case["id"],
                    "expected_agents": case["expected_agents"],
                    "actual_agents": list(decision.agents),
                    "expected_tools": expected_tools,
                    "actual_tools": actual_tools,
                    "expected_handoff": case["expect_handoff"],
                    "actual_handoff": actual_handoff,
                }
            )

    report = {
        "result_status": "measured-local",
        "evaluator": "deterministic end-to-end agent trajectory contract",
        "evaluated_at": datetime.now(UTC).isoformat(),
        "dataset_size": len(cases),
        "strict_trajectory_accuracy": ratio(strict_correct, len(cases)),
        "unordered_tool_accuracy": ratio(unordered_correct, len(cases)),
        "tool_subsequence_accuracy": ratio(subsequence_correct, len(cases)),
        "trajectory_tool_f1": sum(tool_f1_scores) / len(tool_f1_scores),
        "handoff_accuracy": ratio(handoff_correct, len(cases)),
        "mistakes": mistakes,
        "limitations": "Checks the local deterministic graph and mock provider, not model reasoning quality.",
    }
    write_report("trajectory_report.json", report)
    return report


if __name__ == "__main__":
    print(run())
