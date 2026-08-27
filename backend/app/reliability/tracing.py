from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, Field


class TraceEvent(BaseModel):
    node: str
    status: Literal["started", "completed", "failed", "retried", "blocked"]
    duration_ms: int = 0
    attributes: dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ExecutionTrace(BaseModel):
    trace_id: str
    request_id: str
    user_id: str
    session_id: str
    route: list[str] = Field(default_factory=list)
    events: list[TraceEvent] = Field(default_factory=list)
    input_tokens: int = 0
    output_tokens: int = 0
    total_duration_ms: int = 0
    result: Literal["success", "failed", "handoff", "blocked"] = "success"
