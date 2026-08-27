from datetime import datetime, timezone
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, Field


AgentName = Literal["operations", "customer_service", "knowledge_base", "review_analysis"]


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=8_000)
    user_id: str = Field(min_length=1)
    session_id: str = Field(min_length=1)
    request_id: str = Field(default_factory=lambda: str(uuid4()))
    locale: str = "zh-CN"


class Citation(BaseModel):
    source_id: str
    title: str
    section: str | None = None
    page: int | None = None
    quote: str | None = None
    score: float | None = None


class ToolTrace(BaseModel):
    tool_name: str
    status: Literal["success", "failed", "blocked", "mocked"]
    arguments: dict[str, Any] = Field(default_factory=dict)
    duration_ms: int = 0
    error_type: str | None = None


class SpecialistResult(BaseModel):
    agent: AgentName
    summary: str
    confidence: float = Field(ge=0, le=1)
    data: dict[str, Any] = Field(default_factory=dict)
    citations: list[Citation] = Field(default_factory=list)
    tool_traces: list[ToolTrace] = Field(default_factory=list)
    handoff_required: bool = False


class ChatResponse(BaseModel):
    request_id: str
    session_id: str
    answer: str
    agents_involved: list[AgentName]
    execution_mode: Literal["serial", "parallel"]
    results: list[SpecialistResult]
    citations: list[Citation]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    demo_notice: str = "Demo response generated from mock or local data unless configured otherwise."
