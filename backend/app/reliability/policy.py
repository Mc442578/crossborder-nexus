import time
from collections.abc import Callable
from dataclasses import dataclass
from typing import TypeVar


T = TypeVar("T")


@dataclass(frozen=True)
class RetryPolicy:
    max_attempts: int = 3
    base_delay_seconds: float = 0.25
    retryable_errors: tuple[type[Exception], ...] = (TimeoutError, ConnectionError)


def retry_call(operation: Callable[[], T], policy: RetryPolicy = RetryPolicy()) -> T:
    last_error: Exception | None = None
    for attempt in range(1, policy.max_attempts + 1):
        try:
            return operation()
        except policy.retryable_errors as exc:
            last_error = exc
            if attempt == policy.max_attempts:
                break
            time.sleep(policy.base_delay_seconds * (2 ** (attempt - 1)))
    assert last_error is not None
    raise last_error
