from backend.app.amazon_tools import AmazonToolService
from backend.app.models import SpecialistResult

from .models import ChannelMessage, HandoffTicket, SupportOutcome


class CustomerService:
    def __init__(self, amazon: AmazonToolService | None = None) -> None:
        self.amazon = amazon or AmazonToolService()

    def handle(self, message: ChannelMessage) -> tuple[SupportOutcome, SpecialistResult]:
        lowered = message.text.lower()
        if message.order_id and any(word in lowered for word in ("where", "track", "物流", "到哪")):
            order, trace = self.amazon.call("get_order", order_id=message.order_id)
            if order:
                reply = f"订单 {order.order_id} 当前状态为 {order.status}。"
                if order.tracking_number:
                    reply += f" 演示物流编号为 {order.tracking_number}。"
                outcome = SupportOutcome(intent="logistics", reply=reply, confidence=0.96)
                return outcome, SpecialistResult(
                    agent="customer_service",
                    summary=reply,
                    confidence=outcome.confidence,
                    data=order.model_dump(),
                    tool_traces=[trace],
                )

        if any(word in lowered for word in ("refund", "赔付", "退款", "damaged", "损坏")):
            ticket = HandoffTicket(
                reason="售后请求涉及外部副作用，需要人工核验订单、证据和平台政策。",
                priority="high",
                conversation_summary=message.text,
                order_id=message.order_id,
            )
            outcome = SupportOutcome(
                intent="after_sales",
                reply="已整理售后信息并生成待人工确认工单。",
                confidence=0.72,
                handoff=ticket,
            )
            return outcome, SpecialistResult(
                agent="customer_service",
                summary=outcome.reply,
                confidence=outcome.confidence,
                data={"handoff_ticket": ticket.model_dump()},
                handoff_required=True,
            )

        ticket = HandoffTicket(
            reason="意图置信度不足",
            conversation_summary=message.text,
            order_id=message.order_id,
        )
        outcome = SupportOutcome(
            intent="unknown",
            reply="我暂时无法确认你的问题，已转交人工客服。",
            confidence=0.35,
            handoff=ticket,
        )
        return outcome, SpecialistResult(
            agent="customer_service",
            summary=outcome.reply,
            confidence=outcome.confidence,
            handoff_required=True,
            data={"handoff_ticket": ticket.model_dump()},
        )
