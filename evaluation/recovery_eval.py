import hashlib
from datetime import UTC, datetime

from backend.app.reliability.idempotency import IdempotencyLedger
from backend.app.reliability.policy import RetryPolicy, retry_call
from evaluation.common import load_jsonl, ratio, write_report


def run() -> dict:
    cases = load_jsonl("recovery_eval.jsonl")
    passed = 0
    duplicate_side_effects = 0
    retry_budget_correct = 0
    details: list[dict] = []
    for case in cases:
        attempts = 0
        side_effects = 0
        ledger = IdempotencyLedger()
        failures_before_success = case["failures_before_success"]
        payload = case["payload"]
        request_id = case["request_id"]

        def operation(
            failures_before_success: int = failures_before_success,
            payload: str = payload,
            request_id: str = request_id,
            ledger: IdempotencyLedger = ledger,
        ) -> str:
            nonlocal attempts, side_effects
            attempts += 1
            if attempts <= failures_before_success:
                raise TimeoutError("injected timeout")
            fingerprint = hashlib.sha256(payload.encode()).hexdigest()
            entry = ledger.begin(request_id, fingerprint)
            if entry.status != "completed":
                side_effects += 1
                ledger.complete(request_id, "ok")
            return "ok"

        try:
            retry_call(
                operation, RetryPolicy(max_attempts=case["max_attempts"], base_delay_seconds=0)
            )
            retry_call(operation, RetryPolicy(max_attempts=1, base_delay_seconds=0))
            actual_status = "success"
        except TimeoutError:
            actual_status = "failed"
        ok = actual_status == case["expected_status"] and side_effects <= 1
        duplicate_side_effects += max(0, side_effects - 1)
        retry_budget_correct += int(
            attempts <= case["max_attempts"] + int(actual_status == "success")
        )
        passed += int(ok)
        if not ok:
            details.append(
                {"id": case["id"], "status": actual_status, "side_effects": side_effects}
            )
    report = {
        "result_status": "measured-local",
        "evaluator": "fault injection plus idempotency ledger",
        "evaluated_at": datetime.now(UTC).isoformat(),
        "dataset_size": len(cases),
        "recovery_pass_rate": ratio(passed, len(cases)),
        "retry_budget_compliance": ratio(retry_budget_correct, len(cases)),
        "duplicate_side_effects": duplicate_side_effects,
        "mistakes": details,
        "limitations": "In-process fault simulation; not a distributed crash-recovery benchmark.",
    }
    write_report("recovery_report.json", report)
    return report


if __name__ == "__main__":
    print(run())
