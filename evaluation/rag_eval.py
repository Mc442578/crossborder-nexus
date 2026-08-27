from datetime import datetime, timezone

from backend.app.rag.models import RetrievalFilter
from backend.app.rag.service import KnowledgeBaseService
from evaluation.common import load_jsonl, ratio, write_report


def run_local() -> dict:
    """Dependency-free citation and refusal checks.

    Ragas metrics require a configured evaluator model and are intentionally not
    fabricated by this local fallback.
    """
    cases = load_jsonl("rag_eval.jsonl")
    service = KnowledgeBaseService()
    correct = 0
    details: list[dict] = []
    for case in cases:
        result = service.answer(
            case["question"],
            RetrievalFilter(
                tenant_id=case.get("tenant_id", "demo-tenant"),
                knowledge_base_id=case.get("knowledge_base_id"),
                file_id=case.get("file_id"),
            ),
        )
        citation_ids = {citation.source_id for citation in result.citations}
        citation_ok = set(case["expected_source_ids"]).issubset(citation_ids)
        refusal_ok = result.handoff_required == case["expect_refusal"]
        passed = citation_ok and refusal_ok
        correct += int(passed)
        if not passed:
            details.append({"id": case["id"], "sources": sorted(citation_ids)})
    report = {
        "result_status": "measured-local",
        "evaluator": "citation/refusal contract check",
        "evaluated_at": datetime.now(timezone.utc).isoformat(),
        "dataset_size": len(cases),
        "contract_pass_rate": ratio(correct, len(cases)),
        "ragas_faithfulness": None,
        "ragas_context_precision": None,
        "mistakes": details,
        "limitations": (
            "Faithfulness and context precision remain null until Ragas is run "
            "with a recorded evaluator model and ground-truth dataset."
        ),
    }
    write_report("rag_report.json", report)
    return report


if __name__ == "__main__":
    print(run_local())
