from langgraph.checkpoint.memory import MemorySaver
from langgraph.constants import END, START, Send
from langgraph.graph import StateGraph

from backend.app.models import SpecialistResult

from .router import StructuredRouter
from .specialists import SpecialistRegistry
from .state import CrossBorderState


router = StructuredRouter()
registry = SpecialistRegistry()


def supervisor_node(state: CrossBorderState) -> dict:
    decision = router.route(state["request"].message)
    return {
        "planned_agents": decision.agents,
        "pending_agents": decision.agents,
        "execution_mode": decision.execution_mode,
        "specialist_results": [],
    }


def dispatch_after_supervisor(state: CrossBorderState) -> str | list[Send]:
    if state["execution_mode"] == "parallel" and len(state["planned_agents"]) > 1:
        return [
            Send(
                "parallel_specialist",
                {"request": state["request"], "agent_name": agent_name},
            )
            for agent_name in state["planned_agents"]
        ]
    return "serial_specialist"


def parallel_specialist_node(state: CrossBorderState) -> dict:
    result = registry.execute(state["agent_name"], state["request"].message)
    return {"specialist_results": [result]}


def serial_specialist_node(state: CrossBorderState) -> dict:
    agent_name, *remaining = state["pending_agents"]
    result = registry.execute(agent_name, state["request"].message)
    return {"pending_agents": remaining, "specialist_results": [result]}


def continue_serial(state: CrossBorderState) -> str:
    return "serial_specialist" if state.get("pending_agents") else "synthesize"


def synthesize_node(state: CrossBorderState) -> dict:
    results: list[SpecialistResult] = state.get("specialist_results", [])
    summaries = [result.summary for result in results]
    if not summaries:
        return {"final_answer": "没有专业Agent返回有效结果，建议转人工处理。"}
    return {"final_answer": "\n".join(f"- {summary}" for summary in summaries)}


def build_crossborder_graph():
    builder = StateGraph(CrossBorderState)
    builder.add_node("supervisor", supervisor_node)
    builder.add_node("parallel_specialist", parallel_specialist_node)
    builder.add_node("serial_specialist", serial_specialist_node)
    builder.add_node("synthesize", synthesize_node)
    builder.add_edge(START, "supervisor")
    builder.add_conditional_edges("supervisor", dispatch_after_supervisor)
    builder.add_edge("parallel_specialist", "synthesize")
    builder.add_conditional_edges("serial_specialist", continue_serial)
    builder.add_edge("synthesize", END)
    return builder.compile(checkpointer=MemorySaver())
