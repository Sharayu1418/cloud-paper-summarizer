"""
Chat Handler Lambda
Handles RAG-based Q&A for study sessions.
Retrieves relevant chunks and generates answers using LLM.
"""
import json
import sys
import traceback
from decimal import Decimal
from typing import Dict, List, Optional


class DecimalEncoder(json.JSONEncoder):
    """Custom JSON encoder that handles Decimal types from DynamoDB."""
    def default(self, obj):
        if isinstance(obj, Decimal):
            if obj % 1 == 0:
                return int(obj)
            return float(obj)
        return super().default(obj)

# Add shared modules to path (Lambda Layer)
sys.path.insert(0, '/opt/python')

from shared import config  # noqa: E402
from shared.embeddings import EmbeddingClient  # noqa: E402
from shared.opensearch_client import OpenSearchClient  # noqa: E402
from shared.dynamo_client import get_db_client  # noqa: E402
from shared.llm import LLMClient, generate_rag_response  # noqa: E402


# Initialize clients
embedding_client = EmbeddingClient()
opensearch_client = OpenSearchClient()
db_client = get_db_client()
llm_client = LLMClient()


def handler(event, context):
    """
    Lambda handler for chat requests.
    
    Expected event (from API Gateway):
    {
        "body": {
            "session_id": "session-123",
            "user_id": "user-456",
            "question": "What is the main contribution of this paper?",
            "include_history": true
        }
    }
    
    Or direct invocation:
    {
        "session_id": "session-123",
        "user_id": "user-456",
        "question": "What is the main contribution of this paper?"
    }
    """
    try:
        # Parse request body
        if 'body' in event:
            if isinstance(event['body'], str):
                body = json.loads(event['body'])
            else:
                body = event['body']
        else:
            body = event
        
        user_id = body.get('user_id')
        session_id = body.get('session_id')
        question = body.get('question')
        include_history = body.get('include_history', True)
        
        # Validate required fields
        if not all([user_id, session_id, question]):
            return create_response(400, {
                "error": "Missing required fields: user_id, session_id, question"
            })
        
        print(f"Chat request - User: {user_id}, Session: {session_id}")
        print(f"Question: {question}")
        
        # Get session to find associated papers
        session = db_client.get_session(user_id, session_id)
        if not session:
            return create_response(404, {"error": "Session not found"})
        
        paper_ids = session.get('paper_ids', [])
        if not paper_ids:
            return create_response(400, {
                "error": "No papers in this study session. Add papers first."
            })
        
        print(f"Session has {len(paper_ids)} papers")
        
        # Generate embedding for the question
        print("Generating question embedding...")
        question_embedding = embedding_client.generate_embedding(question)
        
        # Search for relevant chunks (filtered by session's papers)
        print("Searching for relevant chunks...")
        search_results = opensearch_client.search_similar(
            query_embedding=question_embedding,
            k=config.TOP_K_RESULTS,
            user_id=user_id,
            document_ids=paper_ids
        )
        
        if not search_results:
            return create_response(200, {
                "answer": "I couldn't find relevant information in the selected papers to answer your question.",
                "sources": [],
                "session_id": session_id
            })
        
        print(f"Found {len(search_results)} relevant chunks")
        
        # Get chat history if requested
        chat_history = []
        if include_history:
            history = db_client.get_chat_history(session_id, limit=10)
            chat_history = [
                {"role": msg['role'], "content": msg['content']}
                for msg in history
            ]
        
        # Prepare context chunks for RAG
        context_chunks = [
            {
                "text": result['text'],
                "metadata": result['metadata']
            }
            for result in search_results
        ]
        
        # Generate response using LLM
        print("Generating LLM response...")
        answer = generate_rag_response(
            question=question,
            context_chunks=context_chunks,
            chat_history=chat_history
        )
        
        # Prepare source citations
        sources = []
        seen_docs = set()
        for result in search_results:
            doc_id = result['document_id']
            if doc_id not in seen_docs:
                seen_docs.add(doc_id)
                sources.append({
                    "document_id": doc_id,
                    "title": result['metadata'].get('title', 'Unknown'),
                    "authors": result['metadata'].get('authors', 'Unknown'),
                    "relevance_score": Decimal(str(round(float(result['score']), 4)))  # Convert to Decimal for DynamoDB
                })
        
        # Save messages to chat history
        db_client.add_chat_message(session_id, "user", question)
        db_client.add_chat_message(session_id, "assistant", answer, sources=sources)
        
        # Update session last_active
        db_client.update_session(user_id, session_id)
        
        print("Response generated successfully")
        
        return create_response(200, {
            "answer": answer,
            "sources": sources,
            "session_id": session_id,
            "chunks_used": len(search_results)
        })
        
    except Exception as e:
        print(f"Error in chat handler: {str(e)}")
        print(traceback.format_exc())
        return create_response(500, {"error": str(e)})


def create_response(status_code: int, body: Dict) -> Dict:
    """Create API Gateway response."""
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "POST,OPTIONS"
        },
        "body": json.dumps(body, cls=DecimalEncoder)
    }


def quick_answer(user_id: str, session_id: str, question: str) -> Dict:
    """
    Quick answer function for testing.
    
    Args:
        user_id: User ID
        session_id: Session ID
        question: Question to answer
        
    Returns:
        Response dict with answer and sources
    """
    event = {
        "user_id": user_id,
        "session_id": session_id,
        "question": question,
        "include_history": False
    }
    
    response = handler(event, None)
    return json.loads(response['body'])




