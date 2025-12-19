"""
Configuration settings for the Research Paper RAG system.
All environment variables and constants are defined here.
"""
import os

# AWS Region
AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")

# S3 Configuration
S3_BUCKET_NAME = os.environ.get("S3_BUCKET_NAME", "research-papers-dev-276036092170")
S3_UPLOADS_PREFIX = "uploads/"
S3_CHUNKS_PREFIX = "chunks/"

# DynamoDB Tables
PAPERS_TABLE = os.environ.get("PAPERS_TABLE", "papers-metadata-dev")
SESSIONS_TABLE = os.environ.get("SESSIONS_TABLE", "study-sessions-dev")
CHAT_HISTORY_TABLE = os.environ.get("CHAT_HISTORY_TABLE", "chat-history-dev")

# Pinecone Configuration
PINECONE_API_KEY = os.environ.get("PINECONE_API_KEY", "pcsk_2KJtFT_BKYS73y5LhZLtD3hPTq5K66RQtqrkJdjn87uvkyeSfNaKCY7SCmWfrSRVdPURpF")
PINECONE_INDEX_NAME = os.environ.get("PINECONE_INDEX_NAME", "research-papers")
PINECONE_HOST = os.environ.get("PINECONE_HOST", "https://research-papers-tskya0x.svc.aped-4627-b74a.pinecone.io")

# Vector DB Provider (for future flexibility)
VECTOR_DB_PROVIDER = os.environ.get("VECTOR_DB_PROVIDER", "pinecone")  # "pinecone" or "opensearch"

# Legacy OpenSearch Configuration (kept for reference)
OPENSEARCH_ENDPOINT = os.environ.get("OPENSEARCH_ENDPOINT", "")
OPENSEARCH_INDEX = os.environ.get("OPENSEARCH_INDEX", "papers-vectors")
OPENSEARCH_CROSS_ACCOUNT_ROLE = os.environ.get("OPENSEARCH_CROSS_ACCOUNT_ROLE", "")

# SQS Configuration
PROCESSING_QUEUE_URL = os.environ.get("PROCESSING_QUEUE_URL", "")

# Embedding Configuration
EMBEDDING_PROVIDER = os.environ.get("EMBEDDING_PROVIDER", "bedrock")  # "bedrock" or "openai"
BEDROCK_EMBEDDING_MODEL = "amazon.titan-embed-text-v2:0"
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
OPENAI_EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIMENSION = 1024  # Titan v2 dimension

# LLM Configuration
LLM_PROVIDER = os.environ.get("LLM_PROVIDER", "bedrock")  # "bedrock" or "gemini"
BEDROCK_LLM_MODEL = "anthropic.claude-3-haiku-20240307-v1:0"
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "AIzaSyCOicgIHvp20Gqb9wibOXOEZ3NgOkpJJFM")
GEMINI_MODEL = "gemini-2.0-flash"

# Chunking Configuration
CHUNK_SIZE = 1000  # characters
CHUNK_OVERLAP = 200  # characters

# RAG Configuration
TOP_K_RESULTS = 5  # Number of chunks to retrieve
MAX_CONTEXT_LENGTH = 4000  # Max characters for context in prompt

# External API Keys
SEMANTIC_SCHOLAR_API_KEY = os.environ.get("SEMANTIC_SCHOLAR_API_KEY", "uRDljdDyu48sjYRAa6y4g1VTTpZXuyYm3g8UDOHV")
