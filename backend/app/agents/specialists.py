import re

from backend.app.amazon_tools import AmazonToolService
from backend.app.customer_service.models import ChannelMessage
from backend.app.customer_service.service import CustomerService
from backend.app.models import SpecialistResult
from backend.app.rag.models import RetrievalFilter
from backend.app.rag.service import KnowledgeBaseService


def _match(pattern: str, text: str, fallback: str) -> str:
    found = re.search(pattern, text, flags=re.IGNORECASE)
    return found.group(0) if found else fallback


class SpecialistRegistry:
    def __init__(self) -> None:
        self.amazon = AmazonToolService()
        self.customer_service = CustomerService(self.amazon)
        self.knowledge = KnowledgeBaseService()

    def execute(self, agent_name: str, message: str) -> SpecialistResult:
        handlers = {
            "operations": self._operations,
            "customer_service": self._customer_support,
            "knowledge_base": self._knowledge,
            "review_analysis": self._reviews,
        }
        if agent_name not in handlers:
            raise ValueError(f"Unsupported specialist: {agent_name}")
        return handlers[agent_name](message)

    def _operations(self, message: str) -> SpecialistResult:
        if any(word in message.lower() for word in ("库存", "inventory", "stock")):
            sku = _match(r"CB-[A-Z0-9-]+", message, "CB-POD-BLUE")
            value, trace = self.amazon.call("get_inventory", sku=sku)
            summary = (
                f"SKU {sku} 可售库存 {value.fulfillable}，入库中 {value.inbound}，预留 {value.reserved}。"
                if value
                else f"未找到SKU {sku}。"
            )
            return SpecialistResult(
                agent="operations",
                summary=summary,
                confidence=0.95 if value else 0.2,
                data=value.model_dump() if value else {},
                tool_traces=[trace],
            )
        asin = _match(r"B0[A-Z0-9]{8,9}", message, "B0CBVAPE001")
        value, trace = self.amazon.call("get_product", asin=asin)
        summary = (
            f"商品 {value.title} 当前演示售价 {value.price} {value.currency}。"
            if value
            else f"未找到ASIN {asin}。"
        )
        return SpecialistResult(
            agent="operations",
            summary=summary,
            confidence=0.95 if value else 0.2,
            data=value.model_dump() if value else {},
            tool_traces=[trace],
        )

    def _reviews(self, message: str) -> SpecialistResult:
        asin = _match(r"B0[A-Z0-9]{8,9}", message, "B0CBVAPE001")
        topics, trace = self.amazon.call("get_feedback_topics", asin=asin)
        if not topics:
            return SpecialistResult(
                agent="review_analysis",
                summary=f"没有找到ASIN {asin}的客户反馈主题。",
                confidence=0.2,
                tool_traces=[trace],
            )
        negative = [topic for topic in topics if topic.sentiment == "negative"]
        top_issue = max(negative, key=lambda item: item.mentions) if negative else None
        summary = (
            f"主要负向反馈为“{top_issue.topic}”，共 {top_issue.mentions} 次提及，"
            "建议优先核验产品规格、批次和详情页承诺。"
            if top_issue
            else "当前示例反馈以正向主题为主。"
        )
        return SpecialistResult(
            agent="review_analysis",
            summary=summary,
            confidence=0.9,
            data={"topics": [topic.model_dump() for topic in topics]},
            tool_traces=[trace],
        )

    def _knowledge(self, message: str) -> SpecialistResult:
        return self.knowledge.answer(
            message,
            RetrievalFilter(tenant_id="demo-tenant", knowledge_base_id="amazon-operations"),
        )

    def _customer_support(self, message: str) -> SpecialistResult:
        order_id = _match(r"ORDER-[A-Z0-9-]+", message, "ORDER-DEMO-1001")
        _, result = self.customer_service.handle(
            ChannelMessage(
                channel="web",
                external_user_id="demo-customer",
                text=message,
                order_id=order_id,
            )
        )
        return result
