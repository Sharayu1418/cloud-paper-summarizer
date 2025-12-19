"""
Embedding generation module supporting AWS Bedrock Titan and OpenAI.
Provides a unified interface for generating embeddings from text.
"""
import json
import boto3
from typing import List, Optional
from . import config


class EmbeddingClient:
    """Unified embedding client supporting multiple providers."""
    
    def __init__(self, provider: Optional[str] = None):
        """
        Initialize embedding client.
        
        Args:
            provider: "bedrock" or "openai". Defaults to config.EMBEDDING_PROVIDER
        """
        self.provider = provider or config.EMBEDDING_PROVIDER
        self._bedrock_client = None
        self._openai_client = None
    
    @property
    def bedrock_client(self):
        """Lazy initialization of Bedrock client."""
        if self._bedrock_client is None:
            self._bedrock_client = boto3.client(
                "bedrock-runtime",
                region_name=config.AWS_REGION
            )
        return self._bedrock_client
    
    @property
    def openai_client(self):
        """Lazy initialization of OpenAI client."""
        if self._openai_client is None:
            try:
                from openai import OpenAI
                self._openai_client = OpenAI(api_key=config.OPENAI_API_KEY)
            except ImportError:
                raise ImportError("openai package not installed. Run: pip install openai")
        return self._openai_client
    
    def generate_embedding(self, text: str) -> List[float]:
        """
        Generate embedding for a single text.
        
        Args:
            text: Input text to embed
            
        Returns:
            List of floats representing the embedding vector
        """
        if self.provider == "bedrock":
            return self._bedrock_embedding(text)
        elif self.provider == "openai":
            return self._openai_embedding(text)
        else:
            raise ValueError(f"Unknown embedding provider: {self.provider}")
    
    def generate_embeddings(self, texts: List[str]) -> List[List[float]]:
        """
        Generate embeddings for multiple texts.
        
        Args:
            texts: List of input texts
            
        Returns:
            List of embedding vectors
        """
        if self.provider == "openai":
            # OpenAI supports batch embedding
            return self._openai_embeddings_batch(texts)
        else:
            # Bedrock Titan - process one at a time
            return [self.generate_embedding(text) for text in texts]
    
    def _bedrock_embedding(self, text: str) -> List[float]:
        """Generate embedding using AWS Bedrock Titan."""
        # Titan Embeddings V2 request format
        body = json.dumps({
            "inputText": text,
            "dimensions": 1024,  # Titan V2 supports 256, 512, 1024
            "normalize": True
        })
        
        response = self.bedrock_client.invoke_model(
            modelId=config.BEDROCK_EMBEDDING_MODEL,
            contentType="application/json",
            accept="application/json",
            body=body
        )
        
        response_body = json.loads(response["body"].read())
        embedding = response_body["embedding"]
        print(f"[DEBUG] Bedrock embedding generated, dimension: {len(embedding)}")
        return embedding
    
    def _openai_embedding(self, text: str) -> List[float]:
        """Generate embedding using OpenAI."""
        response = self.openai_client.embeddings.create(
            model=config.OPENAI_EMBEDDING_MODEL,
            input=text
        )
        return response.data[0].embedding
    
    def _openai_embeddings_batch(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for multiple texts using OpenAI batch API."""
        response = self.openai_client.embeddings.create(
            model=config.OPENAI_EMBEDDING_MODEL,
            input=texts
        )
        # Sort by index to maintain order
        sorted_data = sorted(response.data, key=lambda x: x.index)
        return [item.embedding for item in sorted_data]
    
    def get_embedding_dimension(self) -> int:
        """Return the dimension of embeddings for the current provider."""
        if self.provider == "bedrock":
            return 1024  # Titan V2 with dimensions=1024
        elif self.provider == "openai":
            return 1536  # text-embedding-3-small
        else:
            return 1024  # default


# Convenience function for simple usage
def get_embedding(text: str, provider: Optional[str] = None) -> List[float]:
    """
    Generate embedding for text using configured provider.
    
    Args:
        text: Input text
        provider: Optional provider override
        
    Returns:
        Embedding vector
    """
    client = EmbeddingClient(provider=provider)
    return client.generate_embedding(text)




