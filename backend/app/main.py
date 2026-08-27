from fastapi import FastAPI

from backend.app.agents import build_crossborder_graph
from backend.app.amazon_tools import AmazonToolService
from backend.app.customer_service.models import ChannelMessage, SupportOutcome
from backend.app.customer_service.service import CustomerService
from backend.app.memory import ConversationMemoryService
from backend.app.models import ChatRequest, ChatResponse


app = FastAPI(
    title="CrossBorder AI Agent Platform",
    version="0.1.0",
    description="Portfolio API. Amazon operations use mock data by default.",
)
graph = build_crossborder_graph()
memory = ConversationMemoryService()
amazon = AmazonToolService()
support = CustomerService(amazon)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "mode": "portfolio-demo", "amazon_provider": "mock"}


@app.post("/api/chat", response_model=ChatResponse)
def chat(request: ChatRequest) -> ChatResponse:
    memory.append(request.user_id, request.session_id, "user", request.message)
    result = graph.invoke(
        {"request": request, "specialist_results": []},
        config={"configurable": {"thread_id": f"{request.user_id}:{request.session_id}"}},
    )
    specialist_results = result.get("specialist_results", [])
    answer = result.get("final_answer", "未生成回答。")
    memory.append(request.user_id, request.session_id, "assistant", answer)
    citations = [citation for item in specialist_results for citation in item.citations]
    return ChatResponse(
        request_id=request.request_id,
        session_id=request.session_id,
        answer=answer,
        agents_involved=result.get("planned_agents", []),
        execution_mode=result.get("execution_mode", "serial"),
        results=specialist_results,
        citations=citations,
    )


@app.post("/api/support/messages", response_model=SupportOutcome)
def support_message(message: ChannelMessage) -> SupportOutcome:
    outcome, _ = support.handle(message)
    return outcome


@app.get("/api/amazon/products/{asin}")
def get_product(asin: str) -> dict:
    value, trace = amazon.call("get_product", asin=asin)
    return {"data": value.model_dump() if value else None, "trace": trace.model_dump()}


@app.get("/api/amazon/orders/{order_id}")
def get_order(order_id: str) -> dict:
    value, trace = amazon.call("get_order", order_id=order_id)
    return {"data": value.model_dump() if value else None, "trace": trace.model_dump()}


@app.get("/api/amazon/orders/{order_id}/messaging-actions")
def get_messaging_actions(order_id: str) -> dict:
    value, trace = amazon.call("get_messaging_actions", order_id=order_id)
    return {"data": [item.model_dump() for item in value], "trace": trace.model_dump()}
