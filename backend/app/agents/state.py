import operator
from typing import Annotated, Literal, TypedDict

from backend.app.models import ChatRequest, SpecialistResult


class CrossBorderState(TypedDict, total=False):
    request: ChatRequest
    planned_agents: list[str]
    pending_agents: list[str]
    agent_name: str
    execution_mode: Literal["serial", "parallel"]
    specialist_results: Annotated[list[SpecialistResult], operator.add]
    final_answer: str
