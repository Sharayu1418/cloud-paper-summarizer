"""
Paper Upload Lambda
Handles PDF upload validation, S3 storage, SQS queue submission, and external paper import.
"""
import json
import boto3
import sys
import uuid
import base64
import traceback
import urllib.request
from typing import Dict, Optional

# Add shared modules to path (Lambda Layer)
sys.path.insert(0, '/opt/python')

from shared import config
from shared.dynamo_client import get_db_client
from shared.embeddings import EmbeddingClient
from shared.opensearch_client import OpenSearchClient


# Initialize clients
s3_client = boto3.client('s3', region_name=config.AWS_REGION)
sqs_client = boto3.client('sqs', region_name=config.AWS_REGION)
db_client = get_db_client()
embedding_client = EmbeddingClient()
vector_client = OpenSearchClient()


def handler(event, context):
    """
    Lambda handler for paper uploads, listing, and external paper import.
    
    Handles:
    - POST /papers - Upload a new paper
    - POST /papers/import - Import external paper from URL
    - GET /papers - List user's papers
    - GET /papers/{document_id} - Get paper details
    - DELETE /papers/{document_id} - Delete a paper
    """
    try:
        # Get HTTP method
        http_method = event.get('httpMethod', 'POST')
        path = event.get('path', '/papers')
        path_params = event.get('pathParameters') or {}
        
        # Get user_id from authorizer
        user_id = get_user_id(event)
        if not user_id:
            return create_response(401, {"error": "Unauthorized - user_id required"})
        
        # Route based on method
        if http_method == 'OPTIONS':
            # Handle CORS preflight
            return create_response(200, {})
        elif http_method == 'GET':
            document_id = path_params.get('document_id')
            # Check if this is an insights request
            if '/insights' in path and document_id:
                return get_paper_insights(user_id, document_id)
            elif document_id:
                return get_paper(user_id, document_id)
            else:
                return list_papers(user_id)
        elif http_method == 'DELETE':
            document_id = path_params.get('document_id')
            if document_id:
                return delete_paper(user_id, document_id)
            else:
                return create_response(400, {"error": "document_id required for DELETE"})
        elif http_method == 'POST':
            # Check if this is an import request, presigned URL, process trigger, or direct upload
            query_params = event.get('queryStringParameters') or {}
            
            # Handle import endpoint
            if '/import' in path:
                return import_external_paper(user_id, event)
            elif query_params.get('presigned') == 'true':
                return generate_presigned_upload(user_id, event)
            elif '/process' in path:
                return trigger_processing(user_id, event)
            else:
                # Direct upload (for small files or base64)
                pass  # Continue to existing upload logic
        elif http_method != 'POST':
            return create_response(405, {"error": f"Method {http_method} not allowed"})
        
        # Parse request
        content_type = event.get('headers', {}).get('content-type', '') or event.get('headers', {}).get('Content-Type', '')
        
        # Get metadata from query params or body
        query_params = event.get('queryStringParameters') or {}
        title = query_params.get('title', 'Untitled Paper')
        authors = query_params.get('authors', 'Unknown')
        
        # Get PDF data
        body = event.get('body', '')
        is_base64 = event.get('isBase64Encoded', False)
        
        if is_base64:
            pdf_bytes = base64.b64decode(body)
        else:
            # Check if it's JSON with embedded PDF
            try:
                body_json = json.loads(body) if isinstance(body, str) else body
                if 'pdf_data' in body_json:
                    pdf_bytes = base64.b64decode(body_json['pdf_data'])
                    title = body_json.get('title', title)
                    authors = body_json.get('authors', authors)
                elif 'file' in body_json:
                    pdf_bytes = base64.b64decode(body_json['file'])
                    title = body_json.get('title', title)
                    authors = body_json.get('authors', authors)
                else:
                    return create_response(400, {"error": "No PDF data found in request"})
            except (json.JSONDecodeError, TypeError):
                # Assume raw binary
                pdf_bytes = body.encode() if isinstance(body, str) else body
        
        # Validate PDF
        if not pdf_bytes or len(pdf_bytes) < 100:
            return create_response(400, {"error": "Invalid or empty PDF"})
        
        if not pdf_bytes[:4] == b'%PDF':
            return create_response(400, {"error": "File is not a valid PDF"})
        
        # Check file size (max 50MB)
        max_size = 50 * 1024 * 1024
        if len(pdf_bytes) > max_size:
            return create_response(400, {"error": f"File too large. Maximum size is {max_size // (1024*1024)}MB"})
        
        print(f"Received PDF: {len(pdf_bytes)} bytes, title: {title}")
        
        # Generate document ID
        document_id = str(uuid.uuid4())
        s3_key = f"{config.S3_UPLOADS_PREFIX}{document_id}.pdf"
        
        # Upload to S3
        print(f"Uploading to S3: {s3_key}")
        s3_client.put_object(
            Bucket=config.S3_BUCKET_NAME,
            Key=s3_key,
            Body=pdf_bytes,
            ContentType='application/pdf',
            Metadata={
                'title': title[:256],  # S3 metadata has size limits
                'authors': authors[:256],
                'user_id': user_id
            }
        )
        
        # Create metadata in DynamoDB
        print("Creating metadata in DynamoDB")
        paper = db_client.create_paper(
            user_id=user_id,
            document_id=document_id,
            title=title,
            s3_key=s3_key,
            authors=authors,
            source="upload",
            status="pending"
        )
        
        # Send to SQS for processing
        if config.PROCESSING_QUEUE_URL:
            print(f"Sending to SQS: {config.PROCESSING_QUEUE_URL}")
            sqs_message = {
                "user_id": user_id,
                "document_id": document_id,
                "s3_key": s3_key,
                "title": title,
                "authors": authors
            }
            
            # Build SQS parameters based on queue type
            sqs_params = {
                'QueueUrl': config.PROCESSING_QUEUE_URL,
                'MessageBody': json.dumps(sqs_message)
            }
            
            # Add FIFO-specific parameters only if it's a FIFO queue
            if '.fifo' in config.PROCESSING_QUEUE_URL.lower():
                sqs_params['MessageGroupId'] = user_id
                sqs_params['MessageDeduplicationId'] = document_id
            
            sqs_client.send_message(**sqs_params)
        else:
            print("Warning: PROCESSING_QUEUE_URL not set, skipping SQS")
        
        print(f"Upload successful: {document_id}")
        
        return create_response(201, {
            "message": "Paper uploaded successfully",
            "document_id": document_id,
            "status": "pending",
            "title": title
        })
        
    except Exception as e:
        print(f"Error in upload handler: {str(e)}")
        print(traceback.format_exc())
        return create_response(500, {"error": str(e)})


def import_external_paper(user_id: str, event: Dict) -> Dict:
    """
    Import an external paper from Semantic Scholar or arXiv.
    
    Two-step flow:
    1. First call: Try to fetch PDF. If unavailable, return pdf_available=false for user confirmation
    2. Second call with confirm_metadata_only=true: Create metadata-only entry with abstract
    
    Expected body:
    {
        "url": "https://...",           # Paper URL
        "pdf_url": "https://...",       # Direct PDF URL (optional)
        "title": "Paper Title",
        "authors": "Author Names",
        "abstract": "Paper abstract...",
        "source": "semantic_scholar" | "arxiv",
        "external_id": "arxiv:2301.12345" | "ss:abc123",
        "confirm_metadata_only": false  # Set to true to confirm metadata-only import
    }
    """
    try:
        body = event.get('body', '{}')
        if isinstance(body, str):
            body = json.loads(body)
        
        # Extract metadata
        url = body.get('url', '')
        pdf_url = body.get('pdf_url', '')
        title = body.get('title', 'Unknown Title')
        authors = body.get('authors', 'Unknown')
        abstract = body.get('abstract', '')
        source = body.get('source', 'external')
        external_id = body.get('external_id', '')
        year = body.get('year')
        citations = body.get('citations')
        confirm_metadata_only = body.get('confirm_metadata_only', False)
        
        print(f"Importing external paper: {title[:50]}... from {source}")
        print(f"confirm_metadata_only: {confirm_metadata_only}")
        
        # Generate document ID
        document_id = str(uuid.uuid4())
        
        # Try to fetch PDF (unless user already confirmed metadata-only)
        pdf_bytes = None
        s3_key = None
        metadata_only = True
        
        if not confirm_metadata_only:
            # Try PDF URL first (arXiv always has this)
            if pdf_url:
                pdf_bytes = try_fetch_pdf(pdf_url)
            
            # If no PDF from pdf_url, try the main URL
            if not pdf_bytes and url:
                pdf_bytes = try_fetch_pdf(url)
        
        if pdf_bytes:
            # PDF fetched successfully - store in S3
            s3_key = f"{config.S3_UPLOADS_PREFIX}{document_id}.pdf"
            print(f"Uploading fetched PDF to S3: {s3_key}")
            
            s3_client.put_object(
                Bucket=config.S3_BUCKET_NAME,
                Key=s3_key,
                Body=pdf_bytes,
                ContentType='application/pdf',
                Metadata={
                    'title': title[:256],
                    'authors': authors[:256],
                    'user_id': user_id,
                    'source': source
                }
            )
            metadata_only = False
            print(f"PDF stored successfully, size: {len(pdf_bytes)} bytes")
        elif not confirm_metadata_only:
            # PDF not available and user hasn't confirmed - ask for confirmation
            print(f"Could not fetch PDF, asking user for confirmation")
            return create_response(200, {
                "message": "PDF not available. Would you like to add this paper with abstract only?",
                "pdf_available": False,
                "requires_confirmation": True,
                "title": title,
                "authors": authors,
                "abstract": abstract[:500] if abstract else "",
                "source": source,
                "external_id": external_id,
                "url": url,
                "pdf_url": pdf_url,
                "year": year,
                "citations": citations
            })
        else:
            print(f"User confirmed metadata-only import")
        
        # Create metadata in DynamoDB
        paper = db_client.create_paper(
            user_id=user_id,
            document_id=document_id,
            title=title,
            s3_key=s3_key or '',
            authors=authors,
            abstract=abstract,
            source=source,
            status="pending" if not metadata_only else "processing"
        )
        
        # Add additional metadata fields
        extra_fields = {}
        if external_id:
            extra_fields['external_id'] = external_id
        if url:
            extra_fields['url'] = url
        if year:
            extra_fields['year'] = year
        if citations is not None:
            extra_fields['citation_count'] = citations
        if metadata_only:
            extra_fields['metadata_only'] = True
        
        if extra_fields:
            db_client.update_paper_metadata(user_id, document_id, **extra_fields)
        
        if metadata_only and abstract:
            # Index abstract directly to Pinecone (no PDF processing needed)
            print("Indexing abstract directly to Pinecone...")
            try:
                # Generate embedding for abstract
                embedding = embedding_client.generate_embedding(abstract)
                
                # Create single chunk from abstract
                chunk_id = f"{document_id}_chunk_0"
                indexed_chunks = [{
                    "chunk_id": chunk_id,
                    "embedding": embedding,
                    "text": abstract,
                    "document_id": document_id,
                    "user_id": user_id,
                    "chunk_index": 0,
                    "metadata": {
                        "title": title,
                        "authors": authors,
                        "source": source
                    }
                }]
                
                vector_ids = vector_client.bulk_index_chunks(indexed_chunks)
                
                # Update status to completed
                db_client.update_paper_status(
                    user_id,
                    document_id,
                    "completed",
                    vector_ids=vector_ids
                )
                
                print(f"Abstract indexed successfully, vector_ids: {vector_ids}")
                
            except Exception as e:
                print(f"Error indexing abstract: {e}")
                # Still mark as completed but with limited functionality
                db_client.update_paper_status(user_id, document_id, "completed")
        
        elif not metadata_only:
            # Send to SQS for full PDF processing
            if config.PROCESSING_QUEUE_URL:
                print(f"Sending to SQS for processing: {config.PROCESSING_QUEUE_URL}")
                sqs_message = {
                    "user_id": user_id,
                    "document_id": document_id,
                    "s3_key": s3_key,
                    "title": title,
                    "authors": authors
                }
                
                sqs_params = {
                    'QueueUrl': config.PROCESSING_QUEUE_URL,
                    'MessageBody': json.dumps(sqs_message)
                }
                
                if '.fifo' in config.PROCESSING_QUEUE_URL.lower():
                    sqs_params['MessageGroupId'] = user_id
                    sqs_params['MessageDeduplicationId'] = document_id
                
                sqs_client.send_message(**sqs_params)
        
        print(f"Import successful: {document_id}")
        
        return create_response(201, {
            "message": "Paper imported successfully",
            "document_id": document_id,
            "status": "completed" if metadata_only else "pending",
            "title": title,
            "metadata_only": metadata_only,
            "pdf_available": not metadata_only,
            "source": source
        })
        
    except Exception as e:
        print(f"Error importing paper: {str(e)}")
        print(traceback.format_exc())
        return create_response(500, {"error": str(e)})


def try_fetch_pdf(url: str, timeout: int = 30) -> Optional[bytes]:
    """
    Try to fetch PDF from URL.
    
    Args:
        url: URL to fetch PDF from
        timeout: Request timeout in seconds
        
    Returns:
        PDF bytes if successful, None otherwise
    """
    if not url:
        return None
    
    try:
        print(f"Attempting to fetch PDF from: {url}")
        
        # Create request with headers to avoid blocking
        req = urllib.request.Request(
            url,
            headers={
                'User-Agent': 'Mozilla/5.0 (Research Paper RAG System)',
                'Accept': 'application/pdf,*/*'
            }
        )
        
        with urllib.request.urlopen(req, timeout=timeout) as response:
            content_type = response.headers.get('Content-Type', '')
            content = response.read()
            
            # Check if it's a PDF
            if content[:4] == b'%PDF':
                print(f"Successfully fetched PDF, size: {len(content)} bytes")
                return content
            elif 'pdf' in content_type.lower():
                # Trust content-type header even if magic bytes differ
                print(f"Fetched content with PDF content-type, size: {len(content)} bytes")
                return content
            else:
                print(f"Fetched content is not a PDF (content-type: {content_type})")
                return None
                
    except urllib.error.HTTPError as e:
        print(f"HTTP error fetching PDF: {e.code} {e.reason}")
        return None
    except urllib.error.URLError as e:
        print(f"URL error fetching PDF: {e.reason}")
        return None
    except Exception as e:
        print(f"Error fetching PDF: {e}")
        return None


def get_user_id(event: Dict) -> str:
    """Extract user_id from event (Cognito authorizer or query params)."""
    # Try Cognito authorizer claims
    claims = event.get('requestContext', {}).get('authorizer', {}).get('claims', {})
    if claims.get('sub'):
        return claims['sub']
    
    # Try query parameters (for testing)
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


def convert_decimal(obj):
    """Convert DynamoDB Decimal to int/float for JSON serialization."""
    from decimal import Decimal
    
    if isinstance(obj, Decimal):
        if obj % 1 == 0:
            return int(obj)
        return float(obj)
    return obj


class DecimalEncoder(json.JSONEncoder):
    """Custom JSON encoder that handles Decimal types from DynamoDB."""
    def default(self, obj):
        from decimal import Decimal
        if isinstance(obj, Decimal):
            if obj % 1 == 0:
                return int(obj)
            return float(obj)
        return super().default(obj)


def create_response(status_code: int, body: Dict) -> Dict:
    """Create API Gateway response."""
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Requested-With",
            "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
        },
        "body": json.dumps(body, cls=DecimalEncoder)
    }


def generate_presigned_upload(user_id: str, event: Dict) -> Dict:
    """Generate a presigned URL for direct S3 upload."""
    try:
        body = event.get('body', '{}')
        if isinstance(body, str):
            body = json.loads(body)
        
        file_name = body.get('file_name', 'document.pdf')
        title = body.get('title', file_name.replace('.pdf', ''))
        authors = body.get('authors', 'Unknown')
        
        # Generate document ID
        document_id = str(uuid.uuid4())
        s3_key = f"{config.S3_UPLOADS_PREFIX}{document_id}.pdf"
        
        # Generate presigned URL for upload (valid for 10 minutes)
        presigned_url = s3_client.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': config.S3_BUCKET_NAME,
                'Key': s3_key,
                'ContentType': 'application/pdf'
            },
            ExpiresIn=600
        )
        
        # Create metadata in DynamoDB (status: pending)
        db_client.create_paper(
            user_id=user_id,
            document_id=document_id,
            title=title,
            s3_key=s3_key,
            authors=authors,
            source="upload",
            status="pending"
        )
        
        # Pre-send SQS message (will process once file is uploaded)
        if config.PROCESSING_QUEUE_URL:
            print(f"Pre-sending to SQS: {config.PROCESSING_QUEUE_URL}")
            sqs_message = {
                "user_id": user_id,
                "document_id": document_id,
                "s3_key": s3_key,
                "title": title,
                "authors": authors
            }
            
            # Build SQS parameters
            sqs_params = {
                'QueueUrl': config.PROCESSING_QUEUE_URL,
                'MessageBody': json.dumps(sqs_message),
                'DelaySeconds': 5  # Wait 5 seconds for S3 upload to complete
            }
            
            # Add FIFO-specific parameters only if it's a FIFO queue
            if '.fifo' in config.PROCESSING_QUEUE_URL.lower():
                sqs_params['MessageGroupId'] = user_id
                sqs_params['MessageDeduplicationId'] = document_id
            
            sqs_client.send_message(**sqs_params)
        
        print(f"Generated presigned URL for: {document_id}")
        
        return create_response(200, {
            "upload_url": presigned_url,
            "document_id": document_id,
            "s3_key": s3_key,
            "message": "Upload URL generated. Upload PDF to this URL, then it will be processed automatically."
        })
        
    except Exception as e:
        print(f"Error generating presigned URL: {str(e)}")
        print(traceback.format_exc())
        return create_response(500, {"error": str(e)})


def trigger_processing(user_id: str, event: Dict) -> Dict:
    """Trigger SQS processing after S3 upload."""
    try:
        body = event.get('body', '{}')
        if isinstance(body, str):
            body = json.loads(body)
        
        document_id = body.get('document_id')
        s3_key = body.get('s3_key')
        title = body.get('title', 'Unknown Title')
        authors = body.get('authors', 'Unknown')
        
        if not document_id or not s3_key:
            return create_response(400, {"error": "document_id and s3_key required"})
        
        # Send to SQS for processing
        if config.PROCESSING_QUEUE_URL:
            print(f"Sending to SQS: {config.PROCESSING_QUEUE_URL}")
            sqs_message = {
                "user_id": user_id,
                "document_id": document_id,
                "s3_key": s3_key,
                "title": title,
                "authors": authors
            }
            
            # Build SQS parameters based on queue type
            sqs_params = {
                'QueueUrl': config.PROCESSING_QUEUE_URL,
                'MessageBody': json.dumps(sqs_message)
            }
            
            # Add FIFO-specific parameters only if it's a FIFO queue
            if '.fifo' in config.PROCESSING_QUEUE_URL.lower():
                sqs_params['MessageGroupId'] = user_id
                sqs_params['MessageDeduplicationId'] = document_id
            
            sqs_client.send_message(**sqs_params)
            print(f"Processing triggered for: {document_id}")
        
        return create_response(200, {
            "message": "Processing started",
            "document_id": document_id,
            "status": "processing"
        })
        
    except Exception as e:
        print(f"Error triggering processing: {str(e)}")
        print(traceback.format_exc())
        return create_response(500, {"error": str(e)})


def list_papers(user_id: str) -> Dict:
    """List all papers for a user."""
    try:
        papers = db_client.list_user_papers(user_id)
        
        # Convert to frontend format
        paper_list = []
        for paper in papers:
            paper_item = {
                "document_id": paper.get('document_id'),
                "user_id": paper.get('user_id'),
                "title": paper.get('title', 'Untitled'),
                "authors": paper.get('authors', 'Unknown'),
                "abstract": paper.get('abstract', ''),
                "status": paper.get('status', 'unknown'),
                "upload_date": convert_decimal(paper.get('created_at')),
                "s3_key": paper.get('s3_key'),
                "source": paper.get('source', 'upload'),
                "chunk_count": len(paper.get('vector_ids', [])),
                "metadata_only": paper.get('metadata_only', False)
            }
            
            # Add optional fields if present
            if paper.get('external_id'):
                paper_item['external_id'] = paper['external_id']
            if paper.get('url'):
                paper_item['url'] = paper['url']
            if paper.get('year'):
                paper_item['year'] = paper['year']
            if paper.get('citation_count') is not None:
                paper_item['citation_count'] = convert_decimal(paper['citation_count'])
            
            paper_list.append(paper_item)
        
        return create_response(200, {
            "papers": paper_list,
            "count": len(paper_list)
        })
    except Exception as e:
        print(f"Error listing papers: {str(e)}")
        print(traceback.format_exc())
        return create_response(500, {"error": str(e)})


def get_paper(user_id: str, document_id: str) -> Dict:
    """Get details for a specific paper."""
    try:
        paper = db_client.get_paper(user_id, document_id)
        
        if not paper:
            return create_response(404, {"error": "Paper not found"})
        
        paper_item = {
            "document_id": paper.get('document_id'),
            "user_id": paper.get('user_id'),
            "title": paper.get('title', 'Untitled'),
            "authors": paper.get('authors', 'Unknown'),
            "abstract": paper.get('abstract', ''),
            "status": paper.get('status', 'unknown'),
            "upload_date": convert_decimal(paper.get('created_at')),
            "s3_key": paper.get('s3_key'),
            "source": paper.get('source', 'upload'),
            "chunk_count": len(paper.get('vector_ids', [])),
            "metadata_only": paper.get('metadata_only', False)
        }
        
        # Add optional fields if present
        if paper.get('external_id'):
            paper_item['external_id'] = paper['external_id']
        if paper.get('url'):
            paper_item['url'] = paper['url']
        if paper.get('year'):
            paper_item['year'] = paper['year']
        if paper.get('citation_count') is not None:
            paper_item['citation_count'] = convert_decimal(paper['citation_count'])
        
        return create_response(200, {"paper": paper_item})
    except Exception as e:
        print(f"Error getting paper: {str(e)}")
        print(traceback.format_exc())
        return create_response(500, {"error": str(e)})


def get_paper_insights(user_id: str, document_id: str) -> Dict:
    """Get paper insights (NLP analysis + methodology flowchart)."""
    try:
        # Check if paper exists
        paper = db_client.get_paper(user_id, document_id)
        
        if not paper:
            return create_response(404, {"error": "Paper not found"})
        
        # Get insights from paper
        insights = paper.get('insights')
        
        if not insights:
            return create_response(200, {
                "document_id": document_id,
                "insights": None,
                "message": "Insights not yet generated for this paper"
            })
        
        return create_response(200, {
            "document_id": document_id,
            "title": paper.get('title'),
            "insights": insights
        })
    except Exception as e:
        print(f"Error getting paper insights: {str(e)}")
        print(traceback.format_exc())
        return create_response(500, {"error": str(e)})


def delete_paper(user_id: str, document_id: str) -> Dict:
    """Delete a paper from S3 and DynamoDB."""
    try:
        print(f"Deleting paper: {document_id} for user: {user_id}")
        
        # Get paper details first
        paper = db_client.get_paper(user_id, document_id)
        
        if not paper:
            return create_response(404, {"error": "Paper not found"})
        
        # Delete from S3
        s3_key = paper.get('s3_key')
        if s3_key:
            try:
                print(f"Deleting from S3: {s3_key}")
                s3_client.delete_object(
                    Bucket=config.S3_BUCKET_NAME,
                    Key=s3_key
                )
            except Exception as s3_error:
                print(f"Warning: Could not delete from S3: {str(s3_error)}")
                # Continue to delete from DynamoDB even if S3 fails
        
        # Delete from DynamoDB
        print(f"Deleting from DynamoDB: {document_id}")
        db_client.delete_paper(user_id, document_id)
        
        print(f"Successfully deleted paper: {document_id}")
        
        return create_response(200, {
            "message": "Paper deleted successfully",
            "document_id": document_id
        })
    except Exception as e:
        print(f"Error deleting paper: {str(e)}")
        print(traceback.format_exc())
        return create_response(500, {"error": str(e)})


def upload_paper_direct(user_id: str, pdf_path: str, title: str = None, authors: str = None) -> Dict:
    """
    Direct upload function for testing.
    
    Args:
        user_id: User ID
        pdf_path: Local path to PDF file
        title: Optional title
        authors: Optional authors
        
    Returns:
        Upload response
    """
    with open(pdf_path, 'rb') as f:
        pdf_bytes = f.read()
    
    event = {
        "httpMethod": "POST",
        "body": base64.b64encode(pdf_bytes).decode(),
        "isBase64Encoded": True,
        "queryStringParameters": {
            "user_id": user_id,
            "title": title or "Test Paper",
            "authors": authors or "Test Author"
        }
    }
    
    response = handler(event, None)
    return json.loads(response['body'])




