from typing import Literal

from pydantic import BaseModel, Field


class ChannelMessage(BaseModel):
    channel: Literal["web", "email", "amazon"]
    external_user_id: str
    text: str
    order_id: str | None = None
    locale: str = "en-GB"


class HandoffTicket(BaseModel):
    reason: str
    priority: Literal["low", "normal", "high"] = "normal"
    conversation_summary: str
    order_id: str | None = None
    required_team: str = "customer-support"
    status: Literal["open"] = "open"


class SupportOutcome(BaseModel):
    intent: Literal["faq", "order", "logistics", "after_sales", "unknown"]
    reply: str
    confidence: float = Field(ge=0, le=1)
    handoff: HandoffTicket | None = None
