from datetime import datetime, timezone

from pydantic import BaseModel, Field


class ConversationMessage(BaseModel):
    role: str
    content: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ShortTermMemory(BaseModel):
    user_id: str
    session_id: str
    recent_messages: list[ConversationMessage] = Field(default_factory=list)
    summary: str = ""


class DurableMemory(BaseModel):
    user_id: str
    tenant_id: str
    preferences: dict[str, str] = Field(default_factory=dict)
    store_profile: dict[str, str] = Field(default_factory=dict)
    recurring_issues: list[str] = Field(default_factory=list)
