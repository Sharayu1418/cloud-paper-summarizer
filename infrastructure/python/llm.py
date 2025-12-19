"""
LLM module supporting AWS Bedrock Claude and Google Gemini.
Provides a unified interface for text generation and chat.
"""
import json
import boto3
import time
from typing import List, Dict, Optional
from . import config


# Rate limit handling
MAX_RETRIES = 3
RETRY_DELAY_SECONDS = 2


class LLMClient:
    """Unified LLM client supporting multiple providers."""
    
    def __init__(self, provider: Optional[str] = None):
        """
        Initialize LLM client.
        
        Args:
            provider: "bedrock" or "gemini". Defaults to config.LLM_PROVIDER
        """
        self.provider = provider or config.LLM_PROVIDER
        self._bedrock_client = None
        self._gemini_model = None
    
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
    def gemini_model(self):
        """Lazy initialization of Gemini client."""
        if self._gemini_model is None:
            try:
                import google.generativeai as genai
                genai.configure(api_key=config.GEMINI_API_KEY)
                self._gemini_model = genai.GenerativeModel(config.GEMINI_MODEL)
            except ImportError:
                raise ImportError("google-generativeai package not installed. Run: pip install google-generativeai")
        return self._gemini_model
    
    def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 2048,
        temperature: float = 0.7
    ) -> str:
        """
        Generate text from a prompt.
        
        Args:
            prompt: User prompt
            system_prompt: Optional system instructions
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature (0-1)
            
        Returns:
            Generated text response
        """
        if self.provider == "bedrock":
            return self._bedrock_generate(prompt, system_prompt, max_tokens, temperature)
        elif self.provider == "gemini":
            return self._gemini_generate(prompt, system_prompt, max_tokens, temperature)
        else:
            raise ValueError(f"Unknown LLM provider: {self.provider}")
    
    def chat(
        self,
        messages: List[Dict[str, str]],
        system_prompt: Optional[str] = None,
        max_tokens: int = 2048,
        temperature: float = 0.7
    ) -> str:
        """
        Chat with conversation history.
        
        Args:
            messages: List of {"role": "user"|"assistant", "content": "..."}
            system_prompt: Optional system instructions
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature
            
        Returns:
            Assistant response
        """
        if self.provider == "bedrock":
            return self._bedrock_chat(messages, system_prompt, max_tokens, temperature)
        elif self.provider == "gemini":
            return self._gemini_chat(messages, system_prompt, max_tokens, temperature)
        else:
            raise ValueError(f"Unknown LLM provider: {self.provider}")
    
    def _bedrock_generate(
        self,
        prompt: str,
        system_prompt: Optional[str],
        max_tokens: int,
        temperature: float
    ) -> str:
        """Generate using AWS Bedrock Claude."""
        messages = [{"role": "user", "content": prompt}]
        return self._bedrock_chat(messages, system_prompt, max_tokens, temperature)
    
    def _bedrock_chat(
        self,
        messages: List[Dict[str, str]],
        system_prompt: Optional[str],
        max_tokens: int,
        temperature: float
    ) -> str:
        """Chat using AWS Bedrock Claude."""
        # Claude 3 Messages API format
        body = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": [
                {"role": msg["role"], "content": msg["content"]}
                for msg in messages
            ]
        }
        
        if system_prompt:
            body["system"] = system_prompt
        
        response = self.bedrock_client.invoke_model(
            modelId=config.BEDROCK_LLM_MODEL,
            contentType="application/json",
            accept="application/json",
            body=json.dumps(body)
        )
        
        response_body = json.loads(response["body"].read())
        return response_body["content"][0]["text"]
    
    def _gemini_generate(
        self,
        prompt: str,
        system_prompt: Optional[str],
        max_tokens: int,
        temperature: float
    ) -> str:
        """Generate using Google Gemini with retry logic for rate limits."""
        full_prompt = prompt
        if system_prompt:
            full_prompt = f"{system_prompt}\n\n{prompt}"
        
        last_error = None
        for attempt in range(MAX_RETRIES):
            try:
                response = self.gemini_model.generate_content(
                    full_prompt,
                    generation_config={
                        "max_output_tokens": max_tokens,
                        "temperature": temperature
                    }
                )
                return response.text
            except Exception as e:
                error_str = str(e)
                last_error = e
                if "429" in error_str or "quota" in error_str.lower() or "rate" in error_str.lower():
                    wait_time = RETRY_DELAY_SECONDS * (2 ** attempt)  # Exponential backoff
                    print(f"[LLM] Rate limited, waiting {wait_time}s before retry {attempt + 1}/{MAX_RETRIES}")
                    time.sleep(wait_time)
                else:
                    raise e
        
        # All retries exhausted
        raise Exception(f"Gemini API rate limit exceeded after {MAX_RETRIES} retries. Please wait a few minutes and try again. Error: {last_error}")
    
    def _gemini_chat(
        self,
        messages: List[Dict[str, str]],
        system_prompt: Optional[str],
        max_tokens: int,
        temperature: float
    ) -> str:
        """Chat using Google Gemini with retry logic for rate limits."""
        last_error = None
        for attempt in range(MAX_RETRIES):
            try:
                # Convert messages to Gemini format
                chat = self.gemini_model.start_chat(history=[])
                
                # Add system prompt as first user message if provided
                if system_prompt:
                    chat.send_message(f"System instructions: {system_prompt}")
                
                # Send all messages except the last one to build history
                for msg in messages[:-1]:
                    if msg["role"] == "user":
                        chat.send_message(msg["content"])
                
                # Send the last message and get response
                last_message = messages[-1]["content"] if messages else ""
                response = chat.send_message(
                    last_message,
                    generation_config={
                        "max_output_tokens": max_tokens,
                        "temperature": temperature
                    }
                )
                return response.text
            except Exception as e:
                error_str = str(e)
                last_error = e
                if "429" in error_str or "quota" in error_str.lower() or "rate" in error_str.lower():
                    wait_time = RETRY_DELAY_SECONDS * (2 ** attempt)  # Exponential backoff
                    print(f"[LLM] Rate limited, waiting {wait_time}s before retry {attempt + 1}/{MAX_RETRIES}")
                    time.sleep(wait_time)
                else:
                    raise e
        
        # All retries exhausted
        raise Exception(f"Gemini API rate limit exceeded after {MAX_RETRIES} retries. Please wait a few minutes and try again. Error: {last_error}")


# RAG-specific prompt templates
RAG_SYSTEM_PROMPT = """You are a helpful research assistant that answers questions based on academic papers. 
Your answers should be:
1. Accurate and grounded in the provided context
2. Include citations to specific papers when referencing information
3. Acknowledge when information is not available in the context
4. Be concise but thorough

When citing sources, use the format [Paper Title, Author(s)].
"""

def generate_rag_response(
    question: str,
    context_chunks: List[Dict],
    chat_history: Optional[List[Dict[str, str]]] = None,
    provider: Optional[str] = None
) -> str:
    """
    Generate a RAG response using retrieved context.
    
    Args:
        question: User's question
        context_chunks: List of {"text": "...", "metadata": {...}} retrieved chunks
        chat_history: Optional previous conversation
        provider: LLM provider override
        
    Returns:
        Generated response with citations
    """
    # Build context string
    context_parts = []
    for i, chunk in enumerate(context_chunks, 1):
        metadata = chunk.get("metadata", {})
        source = metadata.get("title", f"Document {i}")
        authors = metadata.get("authors", "Unknown")
        context_parts.append(f"[Source {i}: {source} by {authors}]\n{chunk['text']}\n")
    
    context_string = "\n---\n".join(context_parts)
    
    # Build the prompt
    prompt = f"""Based on the following research paper excerpts, answer the question.

CONTEXT:
{context_string}

QUESTION: {question}

Provide a comprehensive answer based on the context above. Cite sources using [Source N] format."""

    # Build messages
    messages = []
    if chat_history:
        messages.extend(chat_history)
    messages.append({"role": "user", "content": prompt})
    
    # Generate response
    client = LLMClient(provider=provider)
    return client.chat(messages, system_prompt=RAG_SYSTEM_PROMPT)




