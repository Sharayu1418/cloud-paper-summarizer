"""
Session Manager Lambda
Handles CRUD operations for study sessions.
"""
import json
import sys
import traceback
from decimal import Decimal
from typing import Dict


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

from shared.dynamo_client import get_db_client


db_client = get_db_client()


def handler(event, context):
    """
    Lambda handler for session management.
    
    Routes based on HTTP method and path:
    - POST /sessions - Create session
    - GET /sessions - List user sessions
    - GET /sessions/{session_id} - Get session
    - PUT /sessions/{session_id} - Update session
    - DELETE /sessions/{session_id} - Delete session
    - POST /sessions/{session_id}/papers - Add paper to session
    - DELETE /sessions/{session_id}/papers/{document_id} - Remove paper
    """
    try:
        # Parse request
        http_method = event.get('httpMethod', event.get('requestContext', {}).get('http', {}).get('method', 'POST'))
        path = event.get('path', event.get('rawPath', '/sessions'))
        path_params = event.get('pathParameters') or {}
        
        # Get user_id from authorizer or body
        user_id = get_user_id(event)
        if not user_id:
            return create_response(401, {"error": "Unauthorized - user_id required"})
        
        # Parse body
        body = {}
        if event.get('body'):
            body = json.loads(event['body']) if isinstance(event['body'], str) else event['body']
        
        # Route request
        session_id = path_params.get('session_id')
        document_id = path_params.get('document_id')
        
        # Check if this is a papers sub-resource
        is_papers_route = '/papers' in path
        
        if http_method == 'POST':
            if is_papers_route and session_id:
                return add_paper_to_session(user_id, session_id, body)
            else:
                return create_session(user_id, body)
        
        elif http_method == 'GET':
            if session_id:
                return get_session(user_id, session_id)
            else:
                return list_sessions(user_id)
        
        elif http_method == 'PUT':
            if session_id:
                return update_session(user_id, session_id, body)
            else:
                return create_response(400, {"error": "session_id required"})
        
        elif http_method == 'DELETE':
            if is_papers_route and session_id and document_id:
                return remove_paper_from_session(user_id, session_id, document_id)
            elif session_id:
                return delete_session(user_id, session_id)
            else:
                return create_response(400, {"error": "session_id required"})
        
        else:
            return create_response(405, {"error": f"Method {http_method} not allowed"})
        
    except Exception as e:
        print(f"Error in session manager: {str(e)}")
        print(traceback.format_exc())
        return create_response(500, {"error": str(e)})


def get_user_id(event: Dict) -> str:
    """Extract user_id from event (Cognito authorizer or body)."""
    # Try Cognito authorizer claims
    claims = event.get('requestContext', {}).get('authorizer', {}).get('claims', {})
    if claims.get('sub'):
        return claims['sub']
    
    # Try query parameters
    query_params = event.get('queryStringParameters') or {}
    if query_params.get('user_id'):
        return query_params['user_id']
    
    # Try body
    body = event.get('body', {})
    if isinstance(body, str):
        try:
            body = json.loads(body)
        except:
            body = {}
    
    return body.get('user_id')


def create_session(user_id: str, body: Dict) -> Dict:
    """Create a new study session."""
    name = body.get('name', 'New Study Session')
    paper_ids = body.get('paper_ids', [])
    
    session = db_client.create_session(user_id, name, paper_ids)
    
    return create_response(201, {
        "message": "Session created",
        "session": convert_decimals(session)
    })


def get_session(user_id: str, session_id: str) -> Dict:
    """Get a study session."""
    session = db_client.get_session(user_id, session_id)
    
    if not session:
        return create_response(404, {"error": "Session not found"})
    
    # Get paper details for each paper_id
    papers = []
    for paper_id in session.get('paper_ids', []):
        paper = db_client.get_paper(user_id, paper_id)
        if paper:
            papers.append({
                "document_id": paper['document_id'],
                "title": paper.get('title', 'Unknown'),
                "authors": paper.get('authors', 'Unknown'),
                "status": paper.get('status', 'unknown')
            })
    
    session_data = convert_decimals(session)
    session_data['papers'] = papers
    
    return create_response(200, {"session": session_data})


def list_sessions(user_id: str) -> Dict:
    """List all sessions for a user."""
    sessions = db_client.list_user_sessions(user_id)
    
    return create_response(200, {
        "sessions": [convert_decimals(s) for s in sessions],
        "count": len(sessions)
    })


def update_session(user_id: str, session_id: str, body: Dict) -> Dict:
    """Update a study session."""
    name = body.get('name')
    paper_ids = body.get('paper_ids')
    
    session = db_client.update_session(user_id, session_id, name=name, paper_ids=paper_ids)
    
    if not session:
        return create_response(404, {"error": "Session not found"})
    
    return create_response(200, {
        "message": "Session updated",
        "session": convert_decimals(session)
    })


def delete_session(user_id: str, session_id: str) -> Dict:
    """Delete a study session."""
    # Also clear chat history
    db_client.clear_chat_history(session_id)
    db_client.delete_session(user_id, session_id)
    
    return create_response(200, {"message": "Session deleted"})


def add_paper_to_session(user_id: str, session_id: str, body: Dict) -> Dict:
    """Add a paper to a study session."""
    document_id = body.get('document_id')
    
    if not document_id:
        return create_response(400, {"error": "document_id required"})
    
    # Verify paper exists and belongs to user
    paper = db_client.get_paper(user_id, document_id)
    if not paper:
        return create_response(404, {"error": "Paper not found"})
    
    session = db_client.add_paper_to_session(user_id, session_id, document_id)
    
    return create_response(200, {
        "message": "Paper added to session",
        "session": convert_decimals(session)
    })


def remove_paper_from_session(user_id: str, session_id: str, document_id: str) -> Dict:
    """Remove a paper from a study session."""
    session = db_client.remove_paper_from_session(user_id, session_id, document_id)
    
    return create_response(200, {
        "message": "Paper removed from session",
        "session": convert_decimals(session)
    })


def convert_decimals(obj):
    """Convert DynamoDB Decimal types to Python native types."""
    from decimal import Decimal
    
    if isinstance(obj, dict):
        return {k: convert_decimals(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_decimals(v) for v in obj]
    elif isinstance(obj, Decimal):
        if obj % 1 == 0:
            return int(obj)
        return float(obj)
    return obj


def create_response(status_code: int, body: Dict) -> Dict:
    """Create API Gateway response."""
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
        },
        "body": json.dumps(body, cls=DecimalEncoder)
    }




