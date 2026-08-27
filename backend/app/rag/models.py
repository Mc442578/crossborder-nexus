from pydantic import BaseModel, Field


class DocumentMetadata(BaseModel):
    knowledge_base_id: str
    file_id: str
    filename: str
    section: str | None = None
    page: int | None = None
    tenant_id: str = "demo-tenant"
    version: str = "1"


class KnowledgeChunk(BaseModel):
    chunk_id: str
    text: str
    metadata: DocumentMetadata
    embedding: list[float] | None = None


class RetrievalHit(BaseModel):
    chunk: KnowledgeChunk
    vector_score: float = Field(ge=0, le=1)
    keyword_score: float = Field(ge=0, le=1)
    fused_score: float = Field(ge=0, le=1)
    rerank_score: float = Field(ge=0, le=1)


class RetrievalFilter(BaseModel):
    tenant_id: str
    knowledge_base_id: str | None = None
    file_id: str | None = None
    filename: str | None = None
    section: str | None = None
    page: int | None = None
