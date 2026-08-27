from backend.app.agents.router import StructuredRouter
from backend.app.amazon_tools import AmazonToolService
from backend.app.memory import ConversationMemoryService
from backend.app.reliability.idempotency import IdempotencyLedger


def test_router_supports_parallel_multi_intent() -> None:
    decision = StructuredRouter().route("检查库存并分析评论")
    assert decision.agents == ["operations", "review_analysis"]
    assert decision.execution_mode == "parallel"


def test_router_does_not_treat_product_review_as_operations() -> None:
    decision = StructuredRouter().route("分析商品 B0CBVAPE001 评论")
    assert decision.agents == ["review_analysis"]


def test_mock_amazon_tool_is_explicit() -> None:
    value, trace = AmazonToolService().call("get_inventory", sku="CB-POD-BLUE")
    assert value.fulfillable == 43
    assert trace.status == "mocked"


def test_memory_isolated_by_session() -> None:
    memory = ConversationMemoryService(window_size=2)
    memory.append("user-1", "session-a", "user", "A")
    memory.append("user-1", "session-b", "user", "B")
    assert memory.context("user-1", "session-a").recent_messages[0].content == "A"
    assert memory.context("user-1", "session-b").recent_messages[0].content == "B"


def test_idempotency_prevents_duplicate_effect() -> None:
    ledger = IdempotencyLedger()
    ledger.begin("request-1", "fingerprint")
    ledger.complete("request-1", {"sent": True})
    repeated = ledger.begin("request-1", "fingerprint")
    assert repeated.status == "completed"
    assert repeated.result == {"sent": True}
