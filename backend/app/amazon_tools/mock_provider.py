import json
from pathlib import Path
from typing import Any, TypeVar

from pydantic import BaseModel

from .contracts import FeedbackTopic, InventoryRecord, MessagingAction, OrderRecord, ProductRecord


T = TypeVar("T", bound=BaseModel)
PROJECT_ROOT = Path(__file__).resolve().parents[3]


class MockAmazonProvider:
    """Local substitute for SP-API; it performs no network requests."""

    def __init__(self, data_dir: Path | None = None) -> None:
        self.data_dir = data_dir or PROJECT_ROOT / "sample_data"

    def _read(self, filename: str) -> list[dict[str, Any]]:
        return json.loads((self.data_dir / filename).read_text(encoding="utf-8"))

    def _find(self, filename: str, model: type[T], field: str, value: str) -> T | None:
        for item in self._read(filename):
            if str(item.get(field, "")).lower() == value.lower():
                return model.model_validate(item)
        return None

    def get_product(self, asin: str) -> ProductRecord | None:
        return self._find("products.json", ProductRecord, "asin", asin)

    def get_order(self, order_id: str) -> OrderRecord | None:
        return self._find("orders.json", OrderRecord, "order_id", order_id)

    def get_inventory(self, sku: str) -> InventoryRecord | None:
        return self._find("inventory.json", InventoryRecord, "sku", sku)

    def get_feedback_topics(self, asin: str) -> list[FeedbackTopic]:
        return [
            FeedbackTopic.model_validate(item)
            for item in self._read("feedback_topics.json")
            if item["asin"].lower() == asin.lower()
        ]

    def get_messaging_actions(self, order_id: str) -> list[MessagingAction]:
        order = self.get_order(order_id)
        if order is None:
            return []
        actions = [
            MessagingAction(
                action="confirm_order_details",
                display_name="Confirm order details",
                custom_message_allowed=True,
            )
        ]
        if order.status in {"Shipped", "Delivered"}:
            actions.append(
                MessagingAction(
                    action="confirm_delivery_details",
                    display_name="Confirm delivery details",
                    custom_message_allowed=True,
                )
            )
        return actions
