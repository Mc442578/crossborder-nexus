import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent / "datasets"


def write_jsonl(name: str, records: list[dict]) -> None:
    ROOT.mkdir(exist_ok=True)
    text = "\n".join(json.dumps(item, ensure_ascii=False) for item in records) + "\n"
    (ROOT / name).write_text(text, encoding="utf-8")


def router_cases() -> list[dict]:
    templates = {
        "operations": ["查询商品价格", "检查库存", "查看订单数据", "product inventory report"],
        "customer_service": ["查询物流", "客户要求退款", "处理售后", "buyer track order"],
        "knowledge_base": ["查询平台规则", "检索政策文档", "knowledge policy question", "规则是什么"],
        "review_analysis": ["分析商品评论", "找出差评原因", "review sentiment", "客户反馈分析"],
    }
    records: list[dict] = []
    index = 1
    for agent, queries in templates.items():
        for repeat in range(6):
            for query in queries:
                records.append(
                    {
                        "id": f"ROUTE-{index:03d}",
                        "query": f"{query}，样例批次{repeat + 1}",
                        "expected_agents": [agent],
                        "execution_mode": "serial",
                    }
                )
                index += 1
    multi = [
        ("检查库存并分析评论", ["operations", "review_analysis"]),
        ("查询物流并核对平台规则", ["customer_service", "knowledge_base"]),
        ("product inventory and review sentiment", ["operations", "review_analysis"]),
        ("buyer refund and policy", ["customer_service", "knowledge_base"]),
    ]
    for query, agents in multi:
        records.append(
            {
                "id": f"ROUTE-{index:03d}",
                "query": query,
                "expected_agents": agents,
                "execution_mode": "parallel",
            }
        )
        index += 1
    assert len(records) == 100
    return records


def tool_cases() -> list[dict]:
    records: list[dict] = []
    for index in range(1, 11):
        records.append(
            {
                "id": f"TOOL-{index:03d}",
                "agent": "operations",
                "query": "检查库存 CB-POD-BLUE",
                "expected_tool": "get_inventory",
                "expected_arguments": {"sku": "CB-POD-BLUE"},
            }
        )
    for index in range(11, 21):
        records.append(
            {
                "id": f"TOOL-{index:03d}",
                "agent": "review_analysis",
                "query": "分析评论 B0CBVAPE001",
                "expected_tool": "get_feedback_topics",
                "expected_arguments": {"asin": "B0CBVAPE001"},
            }
        )
    return records


def rag_cases() -> list[dict]:
    records = []
    for index in range(1, 16):
        records.append(
            {
                "id": f"RAG-{index:03d}",
                "question": "Amazon buyer messaging policy order available action",
                "tenant_id": "demo-tenant",
                "knowledge_base_id": "amazon-operations",
                "expected_source_ids": ["policy-demo-001"],
                "expect_refusal": False,
            }
        )
    for index in range(16, 21):
        records.append(
            {
                "id": f"RAG-{index:03d}",
                "question": "What is the private unreleased tax policy?",
                "tenant_id": "demo-tenant",
                "knowledge_base_id": "missing-kb",
                "expected_source_ids": [],
                "expect_refusal": True,
            }
        )
    return records


def recovery_cases() -> list[dict]:
    return [
        {
            "id": f"REC-{index:03d}",
            "request_id": f"request-{index:03d}",
            "payload": f"send-message-{index}",
            "failures_before_success": index % 3,
            "max_attempts": 3,
            "expected_status": "success",
        }
        for index in range(1, 17)
    ]


if __name__ == "__main__":
    write_jsonl("router_eval.jsonl", router_cases())
    write_jsonl("tool_eval.jsonl", tool_cases())
    write_jsonl("rag_eval.jsonl", rag_cases())
    write_jsonl("recovery_eval.jsonl", recovery_cases())
    print("Generated 100 route, 20 tool, 20 RAG, and 16 recovery cases.")
