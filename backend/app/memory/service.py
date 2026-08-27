from collections import defaultdict

from .models import ConversationMessage, DurableMemory, ShortTermMemory


class ConversationMemoryService:
    """Demo memory with the same user/session boundaries expected from Redis/PostgreSQL."""

    def __init__(self, window_size: int = 8) -> None:
        self.window_size = window_size
        self._sessions: dict[tuple[str, str], ShortTermMemory] = {}
        self._durable: dict[tuple[str, str], DurableMemory] = {}
        self._archive: dict[tuple[str, str], list[ConversationMessage]] = defaultdict(list)

    def append(self, user_id: str, session_id: str, role: str, content: str) -> None:
        key = (user_id, session_id)
        memory = self._sessions.setdefault(
            key, ShortTermMemory(user_id=user_id, session_id=session_id)
        )
        memory.recent_messages.append(ConversationMessage(role=role, content=content))
        if len(memory.recent_messages) > self.window_size:
            removed = memory.recent_messages[: -self.window_size]
            memory.recent_messages = memory.recent_messages[-self.window_size :]
            self._archive[key].extend(removed)
            memory.summary = self._summarize(self._archive[key])

    def context(self, user_id: str, session_id: str) -> ShortTermMemory:
        return self._sessions.setdefault(
            (user_id, session_id), ShortTermMemory(user_id=user_id, session_id=session_id)
        )

    def save_durable(self, memory: DurableMemory) -> None:
        self._durable[(memory.tenant_id, memory.user_id)] = memory

    def get_durable(self, tenant_id: str, user_id: str) -> DurableMemory | None:
        return self._durable.get((tenant_id, user_id))

    @staticmethod
    def _summarize(messages: list[ConversationMessage]) -> str:
        topics = [message.content[:60].replace("\n", " ") for message in messages[-6:]]
        return "历史摘要：" + "；".join(topics)
