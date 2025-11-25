from fastapi import FastAPI, File, UploadFile, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import boto3
import os
import arxiv 
from semanticscholar import SemanticScholar # Main client import

# Try to import ApiError, but don't fail if it's not available
try:
    from semanticscholar.rest import ApiError
except ImportError:
    try:
        from semanticscholar import ApiError
    except ImportError:
        # If we can't import ApiError, we'll catch generic exceptions instead
        ApiError = Exception

from uuid import uuid4
from botocore.exceptions import BotoCoreError, ClientError
from typing import List, Dict
from dotenv import load_dotenv # To load secrets from the .env file

# --- CONFIG ---
# Load environment variables from the .env file
load_dotenv() 

# UPDATE THESE VARIABLES to match your existing AWS setup
AWS_REGION = "us-east-1"  
S3_BUCKET_NAME = "research-papers-cc"

# --- CLIENT INITIALIZATION ---
# Load Semantic Scholar API Key from environment (set in .env file)
SS_API_KEY = os.environ.get("SEMANTIC_SCHOLAR_API_KEY")

# Initialize clients
try:
    # S3 Client uses credentials from 'aws configure'
    s3_client = boto3.client("s3", region_name=AWS_REGION)
except Exception as e:
    print(f"Failed to initialize S3 client: {e}")
    s3_client = None

# Search Clients
ss_client = SemanticScholar(api_key=SS_API_KEY) # Uses the key from the .env file
arxiv_client = arxiv.Client() # No key needed

# --- FASTAPI APP ---
app = FastAPI(title="Research Paper Uploader and Search API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------------------------------------------
# 1. UPLOAD ENDPOINT
# ----------------------------------------------------

@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    """Handles PDF file upload and stores the binary data in S3."""
    
    if not s3_client:
        raise HTTPException(status_code=500, detail="S3 client not initialized. Check AWS config.")
        
    # 1. Validation (only PDFs)
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed.")

    # 2. Read file contents and create unique S3 key
    file_bytes = await file.read()
    object_key = f"uploads/{uuid4()}-{file.filename}"

    # 3. Upload to S3
    try:
        s3_client.put_object(
            Bucket=S3_BUCKET_NAME,
            Key=object_key,
            Body=file_bytes,
            ContentType=file.content_type or "application/pdf",
        )
    except (BotoCoreError, ClientError) as e:
        print(f"S3 Upload Error: {e}")
        # A 403 Forbidden means a permissions issue
        raise HTTPException(status_code=500, detail=f"S3 upload failed. Check IAM permissions: {e}")

    # 4. Return success
    return {
        "bucket": S3_BUCKET_NAME,
        "key": object_key,
        "message": "File uploaded successfully",
    }

# ----------------------------------------------------
# 2. SEARCH ENDPOINT WITH FALLBACK
# ----------------------------------------------------

@app.get("/search", response_model=List[Dict])
async def search_papers(
    query: str = Query(..., description="The search query for academic papers."),
    limit: int = Query(10, ge=1, le=50, description="Maximum number of results to return.")
):
    """
    Attempts search via Semantic Scholar first. If it fails (API key issue, 
    rate limit, or connection error), it falls back to the arXiv API.
    """
    
    # 1. Try Semantic Scholar Search (Primary Source)
    try:
        if SS_API_KEY:
            ss_results = search_semantic_scholar_impl(query, limit)
            if ss_results:
                print("INFO: Search successful using Semantic Scholar.")
                return ss_results
            
    except ApiError as e:
        # Catch specific Semantic Scholar errors (e.g., 403 Forbidden, 429 Rate Limit)
        print(f"WARNING: Semantic Scholar failed (ApiError: {e}). Falling back to arXiv.")
    except Exception as e:
        # Catch network issues or other general errors
        print(f"WARNING: Semantic Scholar failed (Generic Error: {e}). Falling back to arXiv.")
    
    # 2. Fallback to ArXiv Search (Secondary Source)
    try:
        arxiv_results = search_arxiv_impl(query, limit)
        print("INFO: Search successful using arXiv fallback.")
        return arxiv_results
        
    except Exception as e:
        # If both fail, raise a 500 error
        print(f"ERROR: ArXiv search also failed: {e}")
        raise HTTPException(status_code=503, detail="Both Semantic Scholar and arXiv search services failed.")


# --- PRIVATE HELPER FUNCTIONS ---

def search_semantic_scholar_impl(query: str, limit: int) -> List[Dict]:
    """Internal function to handle Semantic Scholar search logic."""
    results = ss_client.search_paper(
        query=query, 
        limit=limit, 
        fields=['paperId', 'title', 'authors', 'publicationDate', 'url', 'abstract']
    )
    
    formatted_results = []
    for paper in results.get('data', []):
        formatted_results.append({
            "source": "Semantic Scholar",
            "id": paper.get('paperId'),
            "title": paper.get('title'),
            "authors": [author.get('name') for author in paper.get('authors', [])],
            "published": paper.get('publicationDate'),
            "url": paper.get('url'),
            "abstract_snippet": (paper.get('abstract', '')[:200] + "...") if paper.get('abstract') else "No abstract available"
        })
        
    return formatted_results


def search_arxiv_impl(query: str, limit: int) -> List[Dict]:
    """Internal function to handle arXiv search logic."""
    search = arxiv.Search(
        query=query,
        max_results=limit,
        sort_by=arxiv.SortCriterion.SubmittedDate,
        sort_order=arxiv.SortOrder.Descending,
    )
    
    results = []
    for r in arxiv_client.results(search):
        results.append({
            "source": "arXiv",
            "id": r.entry_id.split('/')[-1],
            "title": r.title,
            "authors": [author.name for author in r.authors],
            "published": r.published.strftime("%Y-%m-%d"),
            "url": r.pdf_url,
            "abstract_snippet": r.summary[:200] + "...",
        })
        
    return results

# ----------------------------------------------------
# 3. HEALTH ENDPOINT
# ----------------------------------------------------

@app.get("/health")
def health():
    return {"status": "ok"}