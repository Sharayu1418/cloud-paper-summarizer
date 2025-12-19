"""
Vector database client for Pinecone.
Handles storing and retrieving embeddings for RAG.
"""
import time
from typing import List, Dict, Optional, Any
from pinecone import Pinecone
from . import config


class VectorClient:
    """Client for Pinecone vector operations."""
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        index_name: Optional[str] = None,
        host: Optional[str] = None
    ):
        """
        Initialize Pinecone client.
        
        Args:
            api_key: Pinecone API key
            index_name: Name of the Pinecone index
            host: Pinecone host URL
        """
        self.api_key = api_key or config.PINECONE_API_KEY
        self.index_name = index_name or config.PINECONE_INDEX_NAME
        self.host = host or config.PINECONE_HOST
        
        # Initialize Pinecone
        self.pc = Pinecone(api_key=self.api_key)
        self._index = None
    
    @property
    def index(self):
        """Get Pinecone index."""
        if self._index is None:
            self._index = self.pc.Index(self.index_name, host=self.host)
        return self._index
    
    def create_index_if_not_exists(self, dimension: int = 1024):
        """
        Check if index exists (Pinecone serverless indexes are created via console).
        This is mainly for compatibility with the existing interface.
        
        Args:
            dimension: Embedding dimension (1024 for Titan)
        """
        # For serverless Pinecone, index is created via console/API separately
        # Just verify we can connect
        try:
            stats = self.index.describe_index_stats()
            print(f"Connected to Pinecone index. Total vectors: {stats.get('total_vector_count', 0)}")
        except Exception as e:
            print(f"Warning: Could not connect to Pinecone index: {e}")
    
    def index_chunk(
        self,
        chunk_id: str,
        embedding: List[float],
        text: str,
        document_id: str,
        user_id: str,
        chunk_index: int,
        metadata: Optional[Dict] = None
    ) -> str:
        """
        Index a single chunk with its embedding.
        
        Args:
            chunk_id: Unique ID for this chunk
            embedding: Vector embedding
            text: Original text content
            document_id: Parent document ID
            user_id: Owner user ID
            chunk_index: Position in document
            metadata: Additional metadata (title, authors, etc.)
            
        Returns:
            The indexed document ID
        """
        # Build metadata (Pinecone stores metadata alongside vectors)
        vector_metadata = {
            "text": text[:1000],  # Pinecone has metadata size limits, truncate if needed
            "document_id": document_id,
            "user_id": user_id,
            "chunk_index": chunk_index,
            "created_at": int(time.time())
        }
        
        if metadata:
            # Add additional metadata fields
            if "title" in metadata:
                vector_metadata["title"] = metadata["title"][:200]
            if "authors" in metadata:
                vector_metadata["authors"] = metadata["authors"][:200]
            if "s3_key" in metadata:
                vector_metadata["s3_key"] = metadata["s3_key"]
        
        # Upsert to Pinecone
        self.index.upsert(
            vectors=[{
                "id": chunk_id,
                "values": embedding,
                "metadata": vector_metadata
            }],
            namespace=user_id  # Use user_id as namespace for isolation
        )
        
        return chunk_id
    
    def bulk_index_chunks(
        self,
        chunks: List[Dict[str, Any]]
    ) -> List[str]:
        """
        Bulk index multiple chunks.
        
        Args:
            chunks: List of chunk documents with embeddings
            
        Returns:
            List of indexed document IDs
        """
        if not chunks:
            return []
        
        # Group by user_id (namespace)
        chunks_by_user = {}
        for chunk in chunks:
            user_id = chunk["user_id"]
            if user_id not in chunks_by_user:
                chunks_by_user[user_id] = []
            
            vector_metadata = {
                "text": chunk["text"][:1000],
                "document_id": chunk["document_id"],
                "user_id": user_id,
                "chunk_index": chunk["chunk_index"],
                "created_at": int(time.time())
            }
            
            if "metadata" in chunk:
                meta = chunk["metadata"]
                if "title" in meta:
                    vector_metadata["title"] = meta["title"][:200]
                if "authors" in meta:
                    vector_metadata["authors"] = meta["authors"][:200]
                if "s3_key" in meta:
                    vector_metadata["s3_key"] = meta["s3_key"]
            
            chunks_by_user[user_id].append({
                "id": chunk["chunk_id"],
                "values": chunk["embedding"],
                "metadata": vector_metadata
            })
        
        indexed_ids = []
        
        # Upsert in batches per namespace
        for user_id, vectors in chunks_by_user.items():
            print(f"[DEBUG] Upserting {len(vectors)} vectors to namespace: {user_id}")
            # Pinecone recommends batches of 100
            batch_size = 100
            for i in range(0, len(vectors), batch_size):
                batch = vectors[i:i + batch_size]
                print(f"[DEBUG] Upserting batch of {len(batch)} vectors...")
                try:
                    upsert_response = self.index.upsert(vectors=batch, namespace=user_id)
                    print(f"[DEBUG] Upsert response: {upsert_response}")
                    indexed_ids.extend([v["id"] for v in batch])
                except Exception as e:
                    print(f"[ERROR] Pinecone upsert failed: {e}")
                    raise
        
        print(f"[DEBUG] Total vectors indexed: {len(indexed_ids)}")
        return indexed_ids
    
    def search_similar(
        self,
        query_embedding: List[float],
        k: int = 5,
        user_id: Optional[str] = None,
        document_ids: Optional[List[str]] = None
    ) -> List[Dict]:
        """
        Search for similar chunks using vector similarity.
        
        Args:
            query_embedding: Query vector
            k: Number of results to return
            user_id: Filter by user ID (uses namespace)
            document_ids: Filter by specific document IDs (for study sessions)
            
        Returns:
            List of matching chunks with scores
        """
        # Build filter for document_ids if provided
        filter_dict = None
        if document_ids:
            filter_dict = {
                "document_id": {"$in": document_ids}
            }
        
        # Query Pinecone
        response = self.index.query(
            vector=query_embedding,
            top_k=k,
            namespace=user_id,  # Use user_id as namespace
            filter=filter_dict,
            include_metadata=True
        )
        
        results = []
        for match in response.get("matches", []):
            metadata = match.get("metadata", {})
            result = {
                "chunk_id": match["id"],
                "score": match["score"],
                "text": metadata.get("text", ""),
                "document_id": metadata.get("document_id"),
                "chunk_index": metadata.get("chunk_index"),
                "metadata": {
                    "title": metadata.get("title"),
                    "authors": metadata.get("authors"),
                    "s3_key": metadata.get("s3_key")
                }
            }
            results.append(result)
        
        return results
    
    def delete_document_chunks(self, document_id: str, user_id: str) -> int:
        """
        Delete all chunks for a document.
        
        Args:
            document_id: Document ID to delete chunks for
            user_id: User ID (namespace)
            
        Returns:
            Number of deleted chunks (approximate)
        """
        # Pinecone delete by metadata filter
        self.index.delete(
            filter={"document_id": document_id},
            namespace=user_id
        )
        
        return 1  # Pinecone doesn't return count
    
    def get_document_chunk_ids(self, document_id: str, user_id: str) -> List[str]:
        """
        Get all chunk IDs for a document.
        
        Args:
            document_id: Document ID
            user_id: User ID (namespace)
            
        Returns:
            List of chunk IDs
        """
        # Query with a dummy vector to get IDs (not ideal but works)
        # In practice, you'd store chunk IDs in DynamoDB
        # This is a workaround for Pinecone's limitations
        dummy_vector = [0.0] * config.EMBEDDING_DIMENSION
        
        response = self.index.query(
            vector=dummy_vector,
            top_k=1000,
            namespace=user_id,
            filter={"document_id": document_id},
            include_metadata=False
        )
        
        return [match["id"] for match in response.get("matches", [])]


# Alias for backward compatibility
OpenSearchClient = VectorClient

