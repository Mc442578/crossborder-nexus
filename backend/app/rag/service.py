from pathlib import Path

from backend.app.models import Citation, SpecialistResult

from .ingestion import DocumentParser, RecursiveTextChunker
from .models import DocumentMetadata, KnowledgeChunk, RetrievalFilter
from .retrieval import HybridRetriever, InMemoryChunkRepository


class KnowledgeBaseService:
    def __init__(self, chunks: list[KnowledgeChunk] | None = None) -> None:
        self.repository = InMemoryChunkRepository(chunks or self._demo_chunks())
        self.retriever = HybridRetriever(self.repository)
        self.parser = DocumentParser()
        self.chunker = RecursiveTextChunker()

    @staticmethod
    def _demo_chunks() -> list[KnowledgeChunk]:
        metadata = DocumentMetadata(
            knowledge_base_id="amazon-operations",
            file_id="policy-demo-001",
            filename="amazon-messaging-policy-demo.md",
            section="Buyer communication",
            page=1,
        )
        return [
            KnowledgeChunk(
                chunk_id="policy-demo-chunk-001",
                text=(
                    "Buyer messaging is order-scoped. The application must first request the "
                    "messaging actions available for the specified order and may only execute an "
                    "available action after operator confirmation."
                ),
                metadata=metadata,
            )
        ]

    def ingest(self, path: Path, metadata: DocumentMetadata) -> list[KnowledgeChunk]:
        chunks: list[KnowledgeChunk] = []
        for text, segment_metadata in self.parser.parse(path, metadata):
            chunks.extend(self.chunker.split(text, segment_metadata))
        self.repository.chunks.extend(chunks)
        return chunks

    def answer(self, query: str, filters: RetrievalFilter) -> SpecialistResult:
        hits = self.retriever.search(query, filters)
        strong_hits = [hit for hit in hits if hit.rerank_score >= 0.12]
        if not strong_hits:
            return SpecialistResult(
                agent="knowledge_base",
                summary="知识库中没有足够证据，建议补充文件或转人工确认。",
                confidence=0.0,
                handoff_required=True,
            )
        citations = [
            Citation(
                source_id=hit.chunk.metadata.file_id,
                title=hit.chunk.metadata.filename,
                section=hit.chunk.metadata.section,
                page=hit.chunk.metadata.page,
                quote=hit.chunk.text[:240],
                score=hit.rerank_score,
            )
            for hit in strong_hits
        ]
        return SpecialistResult(
            agent="knowledge_base",
            summary="根据检索证据，买家沟通必须限定在订单当前允许的消息操作范围内。",
            confidence=min(0.95, strong_hits[0].rerank_score + 0.35),
            citations=citations,
        )
