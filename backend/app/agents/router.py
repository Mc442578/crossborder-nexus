from typing import ClassVar, Literal

from pydantic import BaseModel, Field

from backend.app.models.contracts import AgentName


class RouteDecision(BaseModel):
    agents: list[AgentName] = Field(min_length=1)
    execution_mode: Literal["serial", "parallel"]
    reason: str


class StructuredRouter:
    """Deterministic demo router with the same contract expected from an LLM router."""

    signals: ClassVar[dict[AgentName, tuple[str, ...]]] = {
        "operations": ("商品", "库存", "订单", "价格", "product", "inventory", "price"),
        "customer_service": ("客服", "物流", "退款", "售后", "track", "refund", "buyer"),
        "knowledge_base": ("规则", "政策", "文档", "policy", "rule", "knowledge"),
        "review_analysis": (
            "评论",
            "情感",
            "差评",
            "客户反馈",
            "feedback",
            "review",
            "sentiment",
        ),
    }

    def route(self, message: str) -> RouteDecision:
        lowered = message.lower()
        agents: list[AgentName] = [
            agent for agent, words in self.signals.items() if any(word in lowered for word in words)
        ]
        operational_detail = any(
            word in lowered for word in ("库存", "价格", "inventory", "price", "stock")
        )
        if "operations" in agents and "review_analysis" in agents and not operational_detail:
            agents.remove("operations")
        if "operations" in agents and "customer_service" in agents and not operational_detail:
            agents.remove("operations")
        if not agents:
            agents = ["knowledge_base"]
        sequential_markers = ("然后", "再根据", "after that", "then")
        mode: Literal["serial", "parallel"] = (
            "serial"
            if len(agents) == 1 or any(x in lowered for x in sequential_markers)
            else "parallel"
        )
        return RouteDecision(
            agents=list(dict.fromkeys(agents)),
            execution_mode=mode,
            reason="Matched typed business-intent signals; production can replace this with structured LLM output.",
        )
