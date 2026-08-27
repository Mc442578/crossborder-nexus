import hashlib
import json
import platform
from datetime import UTC, datetime

from evaluation.common import ROOT, load_jsonl, write_report
from evaluation.rag_eval import run_local as run_rag
from evaluation.recovery_eval import run as run_recovery
from evaluation.router_eval import run as run_router
from evaluation.tool_eval import run as run_tools
from evaluation.trajectory_eval import run as run_trajectory


def _dataset_manifest() -> dict:
    manifest = {}
    for filename in (
        "router_eval.jsonl",
        "tool_eval.jsonl",
        "trajectory_eval.jsonl",
        "rag_eval.jsonl",
        "recovery_eval.jsonl",
    ):
        path = ROOT / "datasets" / filename
        manifest[filename] = {
            "cases": len(load_jsonl(filename)),
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        }
    return manifest


def _quality_gate(results: dict) -> dict:
    thresholds = json.loads((ROOT / "thresholds.json").read_text(encoding="utf-8"))
    checks = {
        "router.exact_route_accuracy": results["router"]["exact_route_accuracy"],
        "tools.tool_argument_accuracy": results["tools"]["tool_argument_accuracy"],
        "trajectory.strict_trajectory_accuracy": results["trajectory"][
            "strict_trajectory_accuracy"
        ],
        "trajectory.handoff_accuracy": results["trajectory"]["handoff_accuracy"],
        "rag.contract_pass_rate": results["rag"]["contract_pass_rate"],
        "recovery.recovery_pass_rate": results["recovery"]["recovery_pass_rate"],
    }
    details = {
        name: {"actual": actual, "minimum": thresholds[name], "passed": actual >= thresholds[name]}
        for name, actual in checks.items()
    }
    duplicate_side_effects = results["recovery"]["duplicate_side_effects"]
    details["recovery.duplicate_side_effects"] = {
        "actual": duplicate_side_effects,
        "maximum": thresholds["recovery.duplicate_side_effects"],
        "passed": duplicate_side_effects <= thresholds["recovery.duplicate_side_effects"],
    }
    return {
        "status": "pass" if all(item["passed"] for item in details.values()) else "fail",
        "checks": details,
    }


def run() -> dict:
    results = {
        "router": run_router(),
        "tools": run_tools(),
        "trajectory": run_trajectory(),
        "rag": run_rag(),
        "recovery": run_recovery(),
    }
    report = {
        "result_status": "measured-local",
        "evaluated_at": datetime.now(UTC).isoformat(),
        "scope": "deterministic local baseline with mock Amazon data",
        "harness_version": "1.0",
        "runtime": {"python": platform.python_version()},
        "datasets": _dataset_manifest(),
        **results,
        "quality_gate": _quality_gate(results),
        "model_judged_metrics": {
            "status": "not_run",
            "ragas_faithfulness": None,
            "ragas_context_precision": None,
            "trajectory_llm_judge": None,
        },
    }
    write_report("latest_report.json", report)
    return report


if __name__ == "__main__":
    result = run()
    print(result)
    if result["quality_gate"]["status"] != "pass":
        raise SystemExit(1)
