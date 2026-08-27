from typing import Any, Protocol

from pydantic import BaseModel, Field


class ProductRecord(BaseModel):
    asin: str
    sku: str
    title: str
    marketplace_id: str
    price: float
    currency: str
    sales_rank: int | None = None


class OrderRecord(BaseModel):
    order_id: str
    status: str
    purchase_date: str
    destination_country: str
    items: list[dict[str, Any]]
    tracking_number: str | None = None


class InventoryRecord(BaseModel):
    sku: str
    fulfillable: int = Field(ge=0)
    inbound: int = Field(ge=0)
    reserved: int = Field(ge=0)
    unfulfillable: int = Field(ge=0)


class FeedbackTopic(BaseModel):
    asin: str
    topic: str
    sentiment: str
    mentions: int = Field(ge=0)
    star_impact: float
    sample_snippets: list[str] = Field(default_factory=list)


class MessagingAction(BaseModel):
    action: str
    display_name: str
    attachments_allowed: bool = False
    custom_message_allowed: bool = False


class AmazonProvider(Protocol):
    def get_product(self, asin: str) -> ProductRecord | None: ...

    def get_order(self, order_id: str) -> OrderRecord | None: ...

    def get_inventory(self, sku: str) -> InventoryRecord | None: ...

    def get_feedback_topics(self, asin: str) -> list[FeedbackTopic]: ...

    def get_messaging_actions(self, order_id: str) -> list[MessagingAction]: ...
