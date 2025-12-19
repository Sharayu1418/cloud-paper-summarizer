"""
Search Handler Lambda
Unified search across Semantic Scholar, arXiv, and user's library.
"""
import json
import sys
import traceback
import urllib.request
import urllib.parse
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

from shared import config
from shared.dynamo_client import get_db_client


db_client = get_db_client()


def handler(event, context):
    """
    Lambda handler for search requests.
    
    Expected event (from API Gateway):
    {
        "queryStringParameters": {
            "q": "search query",
            "sources": "all|library|semantic_scholar|arxiv",
            "limit": "10"
        }
    }
    """
    try:
        # Parse request
        query_params = event.get('queryStringParameters') or {}
        query = query_params.get('q', '').strip()
        sources = query_params.get('sources', 'all').lower()
        limit = int(query_params.get('limit', '10'))
        
        if not query:
            return create_response(400, {"error": "Search query 'q' is required"})
        
        # Get user_id for library search
        user_id = get_user_id(event)
        
        print(f"Search: '{query}' sources={sources} limit={limit}")
        
        results = {
            "query": query,
            "results": [],
            "sources_searched": []
        }
        
        # Search each source
        if sources in ['all', 'library'] and user_id:
            library_results = search_library(user_id, query, limit)
            results['results'].extend(library_results)
            results['sources_searched'].append('library')
        
        if sources in ['all', 'semantic_scholar']:
            ss_results = search_semantic_scholar(query, limit)
            results['results'].extend(ss_results)
            results['sources_searched'].append('semantic_scholar')
        
        if sources in ['all', 'arxiv']:
            arxiv_results = search_arxiv(query, limit)
            results['results'].extend(arxiv_results)
            results['sources_searched'].append('arxiv')
        
        # Sort by relevance (library first, then by score)
        results['results'].sort(key=lambda x: (
            0 if x.get('source') == 'library' else 1,
            -x.get('relevance_score', 0)
        ))
        
        # Limit total results
        results['results'] = results['results'][:limit]
        results['total'] = len(results['results'])
        
        return create_response(200, results)
        
    except Exception as e:
        print(f"Error in search handler: {str(e)}")
        print(traceback.format_exc())
        return create_response(500, {"error": str(e)})


def get_user_id(event: Dict) -> Optional[str]:
    """Extract user_id from event."""
    claims = event.get('requestContext', {}).get('authorizer', {}).get('claims', {})
    if claims.get('sub'):
        return claims['sub']
    
    query_params = event.get('queryStringParameters') or {}
    return query_params.get('user_id')


def search_library(user_id: str, query: str, limit: int) -> List[Dict]:
    """Search user's uploaded papers in DynamoDB."""
    papers = db_client.list_user_papers(user_id, status="completed")
    
    # Simple keyword matching (for more advanced, use OpenSearch)
    query_lower = query.lower()
    query_words = query_lower.split()
    
    scored_papers = []
    for paper in papers:
        title = paper.get('title', '').lower()
        authors = paper.get('authors', '').lower()
        abstract = paper.get('abstract', '').lower()
        
        # Calculate simple relevance score
        score = 0
        for word in query_words:
            if word in title:
                score += 3
            if word in authors:
                score += 2
            if word in abstract:
                score += 1
        
        if score > 0:
            scored_papers.append({
                "document_id": paper['document_id'],
                "title": paper.get('title', 'Unknown'),
                "authors": paper.get('authors', 'Unknown'),
                "abstract": paper.get('abstract', ''),
                "source": "library",
                "relevance_score": score,
                "status": paper.get('status'),
                "s3_key": paper.get('s3_key')
            })
    
    # Sort by score and limit
    scored_papers.sort(key=lambda x: -x['relevance_score'])
    return scored_papers[:limit]


def search_semantic_scholar(query: str, limit: int) -> List[Dict]:
    """Search Semantic Scholar API."""
    try:
        base_url = "https://api.semanticscholar.org/graph/v1/paper/search"
        params = {
            "query": query,
            "limit": limit,
            "fields": "title,authors,abstract,year,citationCount,url,paperId"
        }
        
        url = f"{base_url}?{urllib.parse.urlencode(params)}"
        
        headers = {"Accept": "application/json"}
        if config.SEMANTIC_SCHOLAR_API_KEY:
            headers["x-api-key"] = config.SEMANTIC_SCHOLAR_API_KEY
        
        req = urllib.request.Request(url, headers=headers)
        
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode())
        
        results = []
        for paper in data.get('data', []):
            authors = ", ".join([a.get('name', '') for a in paper.get('authors', [])])
            results.append({
                "external_id": paper.get('paperId'),
                "title": paper.get('title', 'Unknown'),
                "authors": authors,
                "abstract": paper.get('abstract', ''),
                "year": paper.get('year'),
                "citations": paper.get('citationCount', 0),
                "url": paper.get('url'),
                "source": "semantic_scholar",
                "relevance_score": 1.0  # API doesn't return scores
            })
        
        return results
        
    except Exception as e:
        print(f"Semantic Scholar search error: {e}")
        return []


def search_arxiv(query: str, limit: int) -> List[Dict]:
    """Search arXiv API."""
    try:
        base_url = "http://export.arxiv.org/api/query"
        params = {
            "search_query": f"all:{query}",
            "start": 0,
            "max_results": limit,
            "sortBy": "relevance",
            "sortOrder": "descending"
        }
        
        url = f"{base_url}?{urllib.parse.urlencode(params)}"
        
        req = urllib.request.Request(url)
        
        with urllib.request.urlopen(req, timeout=10) as response:
            data = response.read().decode()
        
        # Parse Atom XML response
        results = parse_arxiv_response(data)
        return results[:limit]
        
    except Exception as e:
        print(f"arXiv search error: {e}")
        return []


def parse_arxiv_response(xml_data: str) -> List[Dict]:
    """Parse arXiv Atom XML response."""
    import re
    
    results = []
    
    # Simple regex parsing (avoid xml.etree for Lambda size)
    entries = re.findall(r'<entry>(.*?)</entry>', xml_data, re.DOTALL)
    
    for entry in entries:
        # Extract fields
        title_match = re.search(r'<title>(.*?)</title>', entry, re.DOTALL)
        title = title_match.group(1).strip().replace('\n', ' ') if title_match else 'Unknown'
        
        summary_match = re.search(r'<summary>(.*?)</summary>', entry, re.DOTALL)
        abstract = summary_match.group(1).strip().replace('\n', ' ') if summary_match else ''
        
        # Get authors
        author_matches = re.findall(r'<author>.*?<name>(.*?)</name>.*?</author>', entry, re.DOTALL)
        authors = ", ".join(author_matches)
        
        # Get arXiv ID
        id_match = re.search(r'<id>http://arxiv.org/abs/(.*?)</id>', entry)
        arxiv_id = id_match.group(1) if id_match else ''
        
        # Get PDF link
        pdf_match = re.search(r'<link.*?type="application/pdf".*?href="(.*?)"', entry)
        pdf_url = pdf_match.group(1) if pdf_match else ''
        
        # Get published date
        published_match = re.search(r'<published>(.*?)</published>', entry)
        published = published_match.group(1)[:4] if published_match else ''  # Just year
        
        results.append({
            "external_id": arxiv_id,
            "title": title,
            "authors": authors,
            "abstract": abstract[:500] + '...' if len(abstract) > 500 else abstract,
            "year": published,
            "url": f"https://arxiv.org/abs/{arxiv_id}",
            "pdf_url": pdf_url,
            "source": "arxiv",
            "relevance_score": 1.0
        })
    
    return results


def create_response(status_code: int, body: Dict) -> Dict:
    """Create API Gateway response."""
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "GET,OPTIONS"
        },
        "body": json.dumps(body, cls=DecimalEncoder)
    }




