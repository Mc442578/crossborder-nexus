import hashlib
import re
from pathlib import Path

from .models import DocumentMetadata, KnowledgeChunk


class DocumentParser:
    """Extract text while keeping source boundaries needed for citations."""

    def parse(self, path: Path, metadata: DocumentMetadata) -> list[tuple[str, DocumentMetadata]]:
        suffix = path.suffix.lower()
        if suffix == ".pdf":
            from pypdf import PdfReader

            pages: list[tuple[str, DocumentMetadata]] = []
            for index, page in enumerate(PdfReader(path).pages, start=1):
                page_meta = metadata.model_copy(update={"page": index})
                pages.append((page.extract_text() or "", page_meta))
            return pages
        if suffix == ".docx":
            from docx import Document

            text = "\n".join(paragraph.text for paragraph in Document(path).paragraphs)
            return [(text, metadata)]
        if suffix in {".md", ".txt"}:
            return [(path.read_text(encoding="utf-8"), metadata)]
        raise ValueError(f"Unsupported document type: {suffix}")


class RecursiveTextChunker:
    def __init__(self, chunk_size: int = 600, overlap: int = 80) -> None:
        if overlap >= chunk_size:
            raise ValueError("overlap must be smaller than chunk_size")
        self.chunk_size = chunk_size
        self.overlap = overlap

    def split(self, text: str, metadata: DocumentMetadata) -> list[KnowledgeChunk]:
        normalized = re.sub(r"\n{3,}", "\n\n", text).strip()
        if not normalized:
            return []
        chunks: list[KnowledgeChunk] = []
        start = 0
        while start < len(normalized):
            end = min(start + self.chunk_size, len(normalized))
            if end < len(normalized):
                boundary = max(
                    normalized.rfind("\n\n", start, end),
                    normalized.rfind("。", start, end),
                    normalized.rfind(". ", start, end),
                )
                if boundary > start + self.chunk_size // 2:
                    end = boundary + 1
            body = normalized[start:end].strip()
            digest = hashlib.sha256(
                f"{metadata.file_id}:{metadata.page}:{start}:{body}".encode()
            ).hexdigest()[:16]
            chunks.append(KnowledgeChunk(chunk_id=digest, text=body, metadata=metadata))
            if end >= len(normalized):
                break
            start = max(end - self.overlap, start + 1)
        return chunks
