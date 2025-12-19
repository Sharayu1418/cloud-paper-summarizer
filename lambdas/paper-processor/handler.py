"""
Paper Processor Lambda
Triggered by SQS when a new paper is uploaded.
Extracts text, chunks it, generates embeddings, and stores in OpenSearch.
"""
import json
import boto3
import os
import sys
import uuid
import traceback

# Add shared modules to path (Lambda Layer)
sys.path.insert(0, '/opt/python')

from shared import config
from shared.embeddings import EmbeddingClient
from shared.opensearch_client import OpenSearchClient
from shared.dynamo_client import get_db_client
from shared.pdf_processor import process_pdf
from shared.semantic_scholar import enrich_metadata
from shared.insights_generator import PaperInsightsGenerator


# Initialize clients
s3_client = boto3.client('s3', region_name=config.AWS_REGION)
embedding_client = EmbeddingClient()
opensearch_client = OpenSearchClient()
db_client = get_db_client()
insights_generator = PaperInsightsGenerator()


def handler(event, context):
    """
    Lambda handler for processing papers from SQS.
    
    Expected SQS message body:
    {
        "user_id": "user-123",
        "document_id": "doc-456",
        "s3_key": "uploads/xxx.pdf",
        "title": "Paper Title",
        "authors": "Author Names",
        "metadata_only": false,  # Optional - if true, use abstract instead of PDF
        "abstract": "..."        # Required if metadata_only is true
    }
    """
    print(f"Processing {len(event.get('Records', []))} records")
    
    # Ensure OpenSearch index exists
    try:
        dimension = embedding_client.get_embedding_dimension()
        opensearch_client.create_index_if_not_exists(dimension=dimension)
    except Exception as e:
        print(f"Warning: Could not create/verify index: {e}")
    
    failed_records = []
    
    for record in event.get('Records', []):
        try:
            # Parse SQS message
            message = json.loads(record['body'])
            
            user_id = message['user_id']
            document_id = message['document_id']
            s3_key = message.get('s3_key', '')
            title = message.get('title', 'Unknown Title')
            authors = message.get('authors', 'Unknown')
            metadata_only = message.get('metadata_only', False)
            abstract = message.get('abstract', '')
            
            print(f"Processing document: {document_id} for user: {user_id}")
            print(f"Metadata only: {metadata_only}")
            
            # Update status to processing
            db_client.update_paper_status(user_id, document_id, "processing")
            
            # Handle metadata-only papers (imported from external sources without PDF)
            if metadata_only:
                print("Processing metadata-only paper (using abstract)")
                if not abstract:
                    raise Exception("Metadata-only paper requires abstract text")
                
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
                        "s3_key": s3_key
                    }
                }]
                
                print(f"Indexing abstract to Pinecone...")
                vector_ids = opensearch_client.bulk_index_chunks(indexed_chunks)
                
                # Generate paper insights for metadata-only papers
                print("==== GENERATING PAPER INSIGHTS (metadata-only) ====")
                try:
                    insights = insights_generator.generate_full_insights(
                        full_text=abstract,
                        title=title,
                        abstract=abstract
                    )
                    db_client.save_paper_insights(user_id, document_id, insights)
                    print(f"Paper insights generated and saved")
                except Exception as insights_error:
                    print(f"Warning: Could not generate insights: {insights_error}")
                
                # Update paper status to completed
                db_client.update_paper_status(
                    user_id, 
                    document_id, 
                    "completed",
                    vector_ids=vector_ids
                )
                
                print(f"Successfully processed metadata-only document: {document_id}")
                continue  # Move to next record
            
            # Download PDF from S3
            print(f"Downloading from S3: {s3_key}")
            response = s3_client.get_object(
                Bucket=config.S3_BUCKET_NAME,
                Key=s3_key
            )
            pdf_bytes = response['Body'].read()
            
            # Process PDF: extract text and chunk
            print("Extracting text and chunking...")
            full_text, chunks, metadata = process_pdf(pdf_bytes)
            
            print(f"==== POST-PROCESS_PDF DEBUG ====")
            print(f"full_text length: {len(full_text) if full_text else 0}")
            print(f"chunks count: {len(chunks) if chunks else 0}")
            print(f"metadata: {metadata}")
            
            if not chunks:
                raise Exception("No text could be extracted from PDF")
            
            print(f"Created {len(chunks)} chunks")
            
            # Enrich metadata with Semantic Scholar (if title was extracted)
            print("==== METADATA ENRICHMENT ====")
            enriched_metadata = enrich_metadata(metadata)
            print(f"Enriched metadata: {enriched_metadata}")
            
            # Use enriched metadata if not provided in upload
            if title == 'Unknown Title' or title == 'Untitled Paper':
                if enriched_metadata.get('title'):
                    title = enriched_metadata['title']
                    print(f"Updated title from metadata: {title[:100]}")
            
            if authors == 'Unknown':
                if enriched_metadata.get('authors'):
                    authors = enriched_metadata['authors']
                    print(f"Updated authors from metadata: {authors[:100]}")
            
            # Update paper metadata in DynamoDB with enriched data
            update_fields = {
                'title': title,
                'authors': authors
            }
            
            # Add optional enriched fields
            if enriched_metadata.get('abstract'):
                update_fields['abstract'] = enriched_metadata['abstract'][:1000]  # Limit length
            if enriched_metadata.get('year'):
                update_fields['year'] = enriched_metadata['year']
            if enriched_metadata.get('citation_count'):
                update_fields['citation_count'] = enriched_metadata['citation_count']
            if enriched_metadata.get('venue'):
                update_fields['venue'] = enriched_metadata['venue']
            if enriched_metadata.get('doi'):
                update_fields['doi'] = enriched_metadata['doi']
            
            print(f"Updating paper metadata: {list(update_fields.keys())}")
            db_client.update_paper_metadata(user_id, document_id, **update_fields)
            
            # Generate embeddings for all chunks
            print(f"==== EMBEDDING GENERATION START ====")
            print(f"Number of chunks to embed: {len(chunks)}")
            chunk_texts = [chunk['text'] for chunk in chunks]
            print(f"First chunk text (100 chars): {chunk_texts[0][:100] if chunk_texts else 'NONE'}")
            
            embeddings = embedding_client.generate_embeddings(chunk_texts)
            
            print(f"==== EMBEDDING GENERATION COMPLETE ====")
            print(f"Number of embeddings: {len(embeddings) if embeddings else 0}")
            if embeddings:
                print(f"First embedding type: {type(embeddings[0])}")
                print(f"First embedding length: {len(embeddings[0])}")
                print(f"First embedding sample (first 5 values): {embeddings[0][:5]}")
            else:
                print("[ERROR] NO EMBEDDINGS GENERATED!")
            
            # Prepare chunks for indexing
            print(f"==== PREPARING VECTORS FOR PINECONE ====")
            indexed_chunks = []
            for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
                chunk_id = f"{document_id}_chunk_{i}"
                indexed_chunks.append({
                    "chunk_id": chunk_id,
                    "embedding": embedding,
                    "text": chunk['text'],
                    "document_id": document_id,
                    "user_id": user_id,
                    "chunk_index": i,
                    "metadata": {
                        "title": title,
                        "authors": authors,
                        "s3_key": s3_key
                    }
                })
            
            print(f"==== PINECONE PRE-UPSERT DEBUG ====")
            print(f"Number of vectors: {len(indexed_chunks)}")
            if indexed_chunks:
                print(f"Vector keys: {indexed_chunks[0].keys()}")
                print(f"Vector ID: {indexed_chunks[0]['chunk_id']}")
                print(f"Vector embedding length: {len(indexed_chunks[0]['embedding'])}")
                print(f"Vector embedding type: {type(indexed_chunks[0]['embedding'])}")
                print(f"Vector user_id: {indexed_chunks[0]['user_id']}")
            else:
                print("[ERROR] NO VECTORS PREPARED - UPSERT WILL BE SKIPPED")
            
            # Bulk index to Pinecone
            print("==== CALLING PINECONE UPSERT ====")
            vector_ids = opensearch_client.bulk_index_chunks(indexed_chunks)
            
            print(f"==== PINECONE UPSERT COMPLETE ====")
            print(f"Indexed {len(vector_ids)} chunks")
            
            # Generate paper insights using Comprehend + Bedrock
            print("==== GENERATING PAPER INSIGHTS ====")
            try:
                paper_abstract = enriched_metadata.get('abstract', '')
                insights = insights_generator.generate_full_insights(
                    full_text=full_text,
                    title=title,
                    abstract=paper_abstract
                )
                db_client.save_paper_insights(user_id, document_id, insights)
                print(f"Paper insights generated and saved")
            except Exception as insights_error:
                print(f"Warning: Could not generate insights: {insights_error}")
                # Don't fail the whole process if insights generation fails
            
            # Update paper status to completed
            db_client.update_paper_status(
                user_id, 
                document_id, 
                "completed",
                vector_ids=vector_ids
            )
            
            print(f"Successfully processed document: {document_id}")
            
        except Exception as e:
            error_msg = str(e)
            print(f"Error processing record: {error_msg}")
            print(traceback.format_exc())
            
            # Try to update status to failed
            try:
                if 'user_id' in message and 'document_id' in message:
                    db_client.update_paper_status(
                        message['user_id'],
                        message['document_id'],
                        "failed"
                    )
            except:
                pass
            
            # Add to failed records for SQS retry/DLQ
            failed_records.append({
                "itemIdentifier": record.get('messageId')
            })
    
    # Return failed records for partial batch failure
    if failed_records:
        return {
            "batchItemFailures": failed_records
        }
    
    return {"statusCode": 200, "message": "All records processed successfully"}


def process_single_document(user_id: str, document_id: str, s3_key: str, title: str = None, authors: str = None):
    """
    Process a single document (can be called directly for testing).
    
    Args:
        user_id: User ID
        document_id: Document ID
        s3_key: S3 key of the PDF
        title: Optional title
        authors: Optional authors
        
    Returns:
        List of vector IDs
    """
    # Create fake SQS event
    event = {
        "Records": [{
            "body": json.dumps({
                "user_id": user_id,
                "document_id": document_id,
                "s3_key": s3_key,
                "title": title or "Unknown Title",
                "authors": authors or "Unknown"
            }),
            "messageId": "test-message-id"
        }]
    }
    
    return handler(event, None)




