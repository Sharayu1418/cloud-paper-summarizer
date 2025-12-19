"""
OpenSearch client - Now redirects to VectorClient (Pinecone).
Kept for backward compatibility with existing Lambda handlers.
"""
from .vector_client import VectorClient

# Alias for backward compatibility
OpenSearchClient = VectorClient


