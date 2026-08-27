import math
import re
from collections import Counter
from typing import Iterable, Protocol

from .models import KnowledgeChunk, RetrievalFilter, RetrievalHit


def _tokens(text: str) -> list[str]:
    return re.findall(r"[a-z0-9_]+|[\u4e00-\u9fff]", text.lower())


class ChunkRepository(Protocol):
    def list_chunks(self, filters: RetrievalFilter) -> list[KnowledgeChunk]: ...


class InMemoryChunkRepository:
    def __init__(self, chunks: Iterable[KnowledgeChunk] = ()) -> None:
        self.chunks = list(chunks)

    def list_chunks(self, filters: RetrievalFilter) -> list[KnowledgeChunk]:
        result: list[KnowledgeChunk] = []
        for chunk in self.chunks:
            meta = chunk.metadata
            if meta.tenant_id != filters.tenant_id:
                continue
            if filters.knowledge_base_id and meta.knowledge_base_id != filters.knowledge_base_id:
                continue
            if filters.file_id and meta.file_id != filters.file_id:
                continue
            if filters.filename and meta.filename != filters.filename:
                continue
            if filters.section and meta.section != filters.section:
                continue
            if filters.page is not None and meta.page != filters.page:
                continue
            result.append(chunk)
        return result


class HybridRetriever:
    """Local demonstration of filtered hybrid retrieval and reranking.

    A production adapter replaces lexical vector approximation with pgvector
    embeddings and PostgreSQL full-text/BM25-compatible retrieval.
    """

    def __init__(self, repository: ChunkRepository) -> None:
        self.repository = repository

    @staticmethod
    def _cosine_like(query: str, text: str) -> float:
        q, d = Counter(_tokens(query)), Counter(_tokens(text))
        numerator = sum(q[token] * d[token] for token in q)
        denominator = math.sqrt(sum(v * v for v in q.values())) * math.sqrt(
            sum(v * v for v in d.values())
        )
        return numerator / denominator if denominator else 0.0

    @staticmethod
    def _keyword_score(query: str, text: str) -> float:
        wanted = set(_tokens(query))
        if not wanted:
            return 0.0
        return len(wanted.intersection(_tokens(text))) / len(wanted)

    def search(
        self, query: str, filters: RetrievalFilter, top_k: int = 5
    ) -> list[RetrievalHit]:
        hits: list[RetrievalHit] = []
        for chunk in self.repository.list_chunks(filters):
            vector_score = self._cosine_like(query, chunk.text)
            keyword_score = self._keyword_score(query, chunk.text)
            fused = 0.65 * vector_score + 0.35 * keyword_score
            rerank = min(1.0, fused + (0.08 if query.lower() in chunk.text.lower() else 0))
            hits.append(
                RetrievalHit(
                    chunk=chunk,
                    vector_score=vector_score,
                    keyword_score=keyword_score,
                    fused_score=fused,
                    rerank_score=rerank,
                )
            )
        return sorted(hits, key=lambda item: item.rerank_score, reverse=True)[:top_k]
