from datetime import UTC, datetime

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
    retrieval_hits = 0
    reciprocal_rank_total = 0.0
    citation_correct = 0
    refusal_correct = 0
    details: list[dict] = []
    for case in cases:
        filters = RetrievalFilter(
            tenant_id=case.get("tenant_id", "demo-tenant"),
            knowledge_base_id=case.get("knowledge_base_id"),
            file_id=case.get("file_id"),
        )
        hits = service.retriever.search(case["question"], filters)
        result = service.answer(case["question"], filters)
        citation_ids = {citation.source_id for citation in result.citations}
        ranked_source_ids = [hit.chunk.metadata.file_id for hit in hits]
        expected_sources = set(case["expected_source_ids"])
        first_relevant_rank = next(
            (
                rank
                for rank, source_id in enumerate(ranked_source_ids, start=1)
                if source_id in expected_sources
            ),
            None,
        )
        if expected_sources and first_relevant_rank is not None:
            retrieval_hits += 1
            reciprocal_rank_total += 1 / first_relevant_rank
        citation_ok = set(case["expected_source_ids"]).issubset(citation_ids)
        refusal_ok = result.handoff_required == case["expect_refusal"]
        citation_correct += int(citation_ok)
        refusal_correct += int(refusal_ok)
        passed = citation_ok and refusal_ok
        correct += int(passed)
        if not passed:
            details.append({"id": case["id"], "sources": sorted(citation_ids)})
    report = {
        "result_status": "measured-local",
        "evaluator": "citation/refusal contract check",
        "evaluated_at": datetime.now(UTC).isoformat(),
        "dataset_size": len(cases),
        "contract_pass_rate": ratio(correct, len(cases)),
        "retrieval_hit_rate": ratio(
            retrieval_hits, sum(bool(case["expected_source_ids"]) for case in cases)
        ),
        "mean_reciprocal_rank": ratio(
            reciprocal_rank_total, sum(bool(case["expected_source_ids"]) for case in cases)
        ),
        "citation_source_accuracy": ratio(citation_correct, len(cases)),
        "refusal_accuracy": ratio(refusal_correct, len(cases)),
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
