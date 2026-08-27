import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REQUIRED = {
    "multi_agent": ["backend/app/agents/graph.py", "backend/app/agents/router.py"],
    "operations": ["backend/app/amazon_tools/service.py", "sample_data/products.json"],
    "customer_service": ["backend/app/customer_service/service.py", "frontend/index.html"],
    "rag": ["backend/app/rag/ingestion.py", "backend/app/rag/retrieval.py"],
    "memory": ["backend/app/memory/service.py", "backend/app/storage/models.py"],
    "reliability_eval": ["backend/app/reliability/idempotency.py", "evaluation/router_eval.py"],
    "portfolio": ["README.md", "LICENSE", "THIRD_PARTY_NOTICES.md", ".env.example"],
}


def jsonl_count(relative_path: str) -> int:
    path = ROOT / relative_path
    return sum(1 for line in path.read_text(encoding="utf-8").splitlines() if line.strip())


def main() -> int:
    failures: list[str] = []
    for capability, files in REQUIRED.items():
        missing = [path for path in files if not (ROOT / path).is_file()]
        if missing:
            failures.append(f"{capability}: missing {missing}")

    expected_counts = {
        "evaluation/datasets/router_eval.jsonl": 100,
        "evaluation/datasets/tool_eval.jsonl": 20,
        "evaluation/datasets/rag_eval.jsonl": 20,
        "evaluation/datasets/recovery_eval.jsonl": 16,
    }
    for path, expected in expected_counts.items():
        if not (ROOT / path).is_file():
            failures.append(f"missing dataset: {path}")
        elif jsonl_count(path) != expected:
            failures.append(f"{path}: expected {expected}, got {jsonl_count(path)}")

    example = json.loads((ROOT / "evaluation/reports/example_report.json").read_text())
    if example.get("result_status") != "illustrative":
        failures.append("example report must remain illustrative")

    notices = (ROOT / "THIRD_PARTY_NOTICES.md").read_text(encoding="utf-8")
    for name in ("E-Commerce Agents", "JoyAgent-JDGenie", "AWS", "Ragas"):
        if name not in notices:
            failures.append(f"third-party notice missing: {name}")

    if failures:
        print("Portfolio audit failed:")
        for failure in failures:
            print(f"- {failure}")
        return 1
    print("Portfolio audit passed: six capabilities, datasets, notices, and demo assets present.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
