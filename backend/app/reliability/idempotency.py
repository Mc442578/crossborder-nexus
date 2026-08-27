from dataclasses import dataclass
from typing import Any


@dataclass
class LedgerEntry:
    request_id: str
    fingerprint: str
    status: str
    result: Any = None


class IdempotencyLedger:
    """Demo exactly-once guard for external side effects."""

    def __init__(self) -> None:
        self._entries: dict[str, LedgerEntry] = {}

    def begin(self, request_id: str, fingerprint: str) -> LedgerEntry:
        existing = self._entries.get(request_id)
        if existing:
            if existing.fingerprint != fingerprint:
                raise ValueError("request_id was reused with different decision data")
            return existing
        entry = LedgerEntry(request_id=request_id, fingerprint=fingerprint, status="started")
        self._entries[request_id] = entry
        return entry

    def complete(self, request_id: str, result: Any) -> LedgerEntry:
        entry = self._entries[request_id]
        entry.status = "completed"
        entry.result = result
        return entry

    def get(self, request_id: str) -> LedgerEntry | None:
        return self._entries.get(request_id)
