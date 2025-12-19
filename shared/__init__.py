"""
Shared modules for Research Paper RAG system.
"""
from . import config
from .embeddings import EmbeddingClient, get_embedding
from .llm import LLMClient, generate_rag_response
from .opensearch_client import OpenSearchClient
from .dynamo_client import DynamoDBClient, get_db_client
from .pdf_processor import process_pdf, chunk_text, extract_text_from_pdf
from .comprehend_client import ComprehendClient
from .insights_generator import PaperInsightsGenerator
from .polly_client import PollyClient

__all__ = [
    "config",
    "EmbeddingClient",
    "get_embedding",
    "LLMClient",
    "generate_rag_response",
    "OpenSearchClient",
    "DynamoDBClient",
    "get_db_client",
    "process_pdf",
    "chunk_text",
    "extract_text_from_pdf",
    "ComprehendClient",
    "PaperInsightsGenerator",
    "PollyClient",
]




