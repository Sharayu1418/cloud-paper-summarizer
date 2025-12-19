"""
Text-to-Speech Lambda Handler
Converts paper summaries to audio using Amazon Polly.
"""
import json
import sys
import os
from decimal import Decimal

# Add shared layer to path
sys.path.insert(0, '/opt/python')

from shared.polly_client import PollyClient  # noqa: E402
from shared.dynamo_client import get_db_client  # noqa: E402


class DecimalEncoder(json.JSONEncoder):
    """Custom JSON encoder for Decimal types from DynamoDB."""
    def default(self, obj):
        if isinstance(obj, Decimal):
            return int(obj) if obj % 1 == 0 else float(obj)
        return super(DecimalEncoder, self).default(obj)


def handler(event, context):
    """
    Main Lambda handler for text-to-speech synthesis.
    
    Endpoints:
        POST /tts/paper/{document_id} - Generate audio for paper summary
        POST /tts/text - Generate audio for arbitrary text
        GET /tts/voices - List available voices
    """
    print(f"Event: {json.dumps(event)}")
    
    http_method = event.get('httpMethod', '')
    path = event.get('path', '')
    path_params = event.get('pathParameters') or {}
    query_params = event.get('queryStringParameters') or {}
    
    try:
        # Route requests
        if http_method == 'GET' and '/tts/voices' in path:
            return get_voices(query_params)
        elif http_method == 'POST' and '/tts/paper/' in path:
            document_id = path_params.get('document_id')
            return synthesize_paper_summary(document_id, query_params, event)
        elif http_method == 'POST' and '/tts/text' in path:
            return synthesize_text(event)
        else:
            return response(404, {'error': 'Not found'})
            
    except Exception as e:
        print(f"Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return response(500, {'error': str(e)})


def get_voices(query_params):
    """Get list of available Polly voices."""
    polly = PollyClient()
    language = query_params.get('language', 'en-US')
    
    voices = polly.get_available_voices(language)
    
    return response(200, {
        'voices': voices,
        'language': language
    })


def synthesize_paper_summary(document_id, query_params, event):
    """Generate audio for a paper's summary/insights."""
    if not document_id:
        return response(400, {'error': 'document_id is required'})
    
    user_id = query_params.get('user_id')
    if not user_id:
        # Try to get from body
        body = json.loads(event.get('body') or '{}')
        user_id = body.get('user_id')
    
    if not user_id:
        return response(400, {'error': 'user_id is required'})
    
    voice_id = query_params.get('voice', 'Joanna')
    
    # Get paper insights from DynamoDB
    db = get_db_client()
    insights = db.get_paper_insights(user_id, document_id)
    
    if not insights:
        # Try to get basic paper info and generate simple summary
        paper = db.get_paper(user_id, document_id)
        if not paper:
            return response(404, {'error': 'Paper not found'})
        
        # Create basic insights from paper metadata
        insights = {
            'problem': paper.get('abstract', paper.get('title', 'This paper')),
            'conclusion': f"This paper titled '{paper.get('title', 'Unknown')}' by {paper.get('authors', 'unknown authors')}."
        }
    
    # Generate audio
    polly = PollyClient()
    result = polly.synthesize_paper_summary(insights, voice_id=voice_id)
    
    return response(200, {
        'audio_base64': result['audio_base64'],
        'content_type': result['content_type'],
        'characters_synthesized': result['characters_synthesized'],
        'truncated': result.get('truncated', False),
        'document_id': document_id,
        'voice_id': voice_id
    })


def synthesize_text(event):
    """Generate audio for arbitrary text."""
    body = json.loads(event.get('body') or '{}')
    
    text = body.get('text')
    if not text:
        return response(400, {'error': 'text is required'})
    
    voice_id = body.get('voice', 'Joanna')
    output_format = body.get('format', 'mp3')
    
    polly = PollyClient()
    result = polly.synthesize_speech(
        text=text,
        voice_id=voice_id,
        output_format=output_format
    )
    
    return response(200, {
        'audio_base64': result['audio_base64'],
        'content_type': result['content_type'],
        'characters_synthesized': result['characters_synthesized'],
        'truncated': result.get('truncated', False),
        'voice_id': voice_id
    })


def response(status_code, body):
    """Create API Gateway response."""
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
            'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
        },
        'body': json.dumps(body, cls=DecimalEncoder)
    }

