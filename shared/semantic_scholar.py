"""
Semantic Scholar API integration for paper metadata enrichment.
"""
import json
import urllib.request
import urllib.parse
from typing import Dict, Optional
from . import config


def search_paper_by_title(title: str) -> Optional[Dict]:
    """
    Search Semantic Scholar for a paper by title.
    
    Args:
        title: Paper title to search for
        
    Returns:
        Paper metadata dict or None if not found
    """
    if not title or len(title) < 10:
        return None
    
    try:
        base_url = "https://api.semanticscholar.org/graph/v1/paper/search"
        params = {
            "query": title,
            "limit": 1,
            "fields": "title,authors,abstract,year,citationCount,venue,externalIds"
        }
        
        url = f"{base_url}?{urllib.parse.urlencode(params)}"
        
        headers = {"Accept": "application/json"}
        if config.SEMANTIC_SCHOLAR_API_KEY:
            headers["x-api-key"] = config.SEMANTIC_SCHOLAR_API_KEY
        
        req = urllib.request.Request(url, headers=headers)
        
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode())
        
        if data.get('data') and len(data['data']) > 0:
            paper = data['data'][0]
            
            # Format authors
            authors_list = [a.get('name', '') for a in paper.get('authors', [])]
            authors_str = ', '.join(authors_list[:5])  # Limit to first 5 authors
            if len(paper.get('authors', [])) > 5:
                authors_str += ' et al.'
            
            return {
                "title": paper.get('title', ''),
                "authors": authors_str,
                "abstract": paper.get('abstract', ''),
                "year": paper.get('year'),
                "citation_count": paper.get('citationCount', 0),
                "venue": paper.get('venue', ''),
                "doi": paper.get('externalIds', {}).get('DOI'),
                "arxiv_id": paper.get('externalIds', {}).get('ArXiv'),
                "source": "semantic_scholar"
            }
        
        return None
        
    except Exception as e:
        print(f"[WARNING] Semantic Scholar search failed: {e}")
        return None


def enrich_metadata(extracted_metadata: Dict) -> Dict:
    """
    Enrich extracted metadata with Semantic Scholar data.
    
    Args:
        extracted_metadata: Metadata extracted from PDF
        
    Returns:
        Enriched metadata dictionary
    """
    title = extracted_metadata.get('title', '').strip()
    
    # If we have a title, try to find the paper on Semantic Scholar
    if title and len(title) > 10:
        print(f"[INFO] Searching Semantic Scholar for: {title[:100]}")
        ss_data = search_paper_by_title(title)
        
        if ss_data:
            print(f"[SUCCESS] Found paper on Semantic Scholar!")
            print(f"  - Title: {ss_data.get('title', '')[:100]}")
            print(f"  - Authors: {ss_data.get('authors', '')[:100]}")
            print(f"  - Year: {ss_data.get('year')}")
            print(f"  - Citations: {ss_data.get('citation_count')}")
            
            # Merge with extracted metadata (Semantic Scholar takes precedence)
            enriched = extracted_metadata.copy()
            
            # Update with Semantic Scholar data
            if ss_data.get('title'):
                enriched['title'] = ss_data['title']
            if ss_data.get('authors'):
                enriched['authors'] = ss_data['authors']
            if ss_data.get('abstract'):
                enriched['abstract'] = ss_data['abstract']
            
            # Add additional fields
            enriched['year'] = ss_data.get('year')
            enriched['citation_count'] = ss_data.get('citation_count', 0)
            enriched['venue'] = ss_data.get('venue', '')
            enriched['doi'] = ss_data.get('doi', '')
            enriched['arxiv_id'] = ss_data.get('arxiv_id', '')
            enriched['metadata_source'] = 'semantic_scholar'
            
            return enriched
    
    # No Semantic Scholar data found, return original
    extracted_metadata['metadata_source'] = 'pdf_extraction'
    return extracted_metadata

