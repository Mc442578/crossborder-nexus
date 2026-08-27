from time import perf_counter
from typing import Any

from backend.app.models import ToolTrace

from .contracts import AmazonProvider
from .mock_provider import MockAmazonProvider


class AmazonToolService:
    """Typed tool facade. Production SP-API adapters can implement AmazonProvider."""

    def __init__(self, provider: AmazonProvider | None = None) -> None:
        self.provider = provider or MockAmazonProvider()

    def call(self, tool_name: str, **arguments: str) -> tuple[Any, ToolTrace]:
        started = perf_counter()
        handlers = {
            "get_product": lambda: self.provider.get_product(arguments["asin"]),
            "get_order": lambda: self.provider.get_order(arguments["order_id"]),
            "get_inventory": lambda: self.provider.get_inventory(arguments["sku"]),
            "get_feedback_topics": lambda: self.provider.get_feedback_topics(arguments["asin"]),
            "get_messaging_actions": lambda: self.provider.get_messaging_actions(
                arguments["order_id"]
            ),
        }
        if tool_name not in handlers:
            raise ValueError(f"Unknown Amazon tool: {tool_name}")
        try:
            value = handlers[tool_name]()
            trace = ToolTrace(
                tool_name=tool_name,
                status="mocked" if isinstance(self.provider, MockAmazonProvider) else "success",
                arguments=arguments,
                duration_ms=int((perf_counter() - started) * 1000),
            )
            return value, trace
        except Exception as exc:
            trace = ToolTrace(
                tool_name=tool_name,
                status="failed",
                arguments=arguments,
                duration_ms=int((perf_counter() - started) * 1000),
                error_type=type(exc).__name__,
            )
            return None, trace
