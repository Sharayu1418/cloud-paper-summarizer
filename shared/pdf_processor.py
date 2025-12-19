"""
PDF processing utilities for text extraction and chunking.
"""
import io
import re
from typing import List, Dict, Tuple
from . import config


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """
    Extract text content from a PDF file.
    
    Args:
        pdf_bytes: PDF file as bytes
        
    Returns:
        Extracted text content
    """
    try:
        import PyPDF2
        
        pdf_file = io.BytesIO(pdf_bytes)
        reader = PyPDF2.PdfReader(pdf_file)
        
        text_parts = []
        for page in reader.pages:
            text = page.extract_text()
            if text:
                text_parts.append(text)
        
        return "\n\n".join(text_parts)
    
    except Exception as e:
        # Fallback to pdfplumber if PyPDF2 fails
        try:
            import pdfplumber
            
            pdf_file = io.BytesIO(pdf_bytes)
            text_parts = []
            
            with pdfplumber.open(pdf_file) as pdf:
                for page in pdf.pages:
                    text = page.extract_text()
                    if text:
                        text_parts.append(text)
            
            return "\n\n".join(text_parts)
        
        except ImportError:
            raise Exception(f"Failed to extract PDF text: {str(e)}")


def extract_metadata_from_pdf(pdf_bytes: bytes) -> Dict:
    """
    Extract metadata from a PDF file.
    Tries PDF metadata first, then parses first page text.
    
    Args:
        pdf_bytes: PDF file as bytes
        
    Returns:
        Dictionary with title, authors, etc.
    """
    metadata = {
        "title": "",
        "authors": "",
        "subject": "",
        "creator": "",
        "page_count": 0
    }
    
    try:
        import PyPDF2
        
        pdf_file = io.BytesIO(pdf_bytes)
        reader = PyPDF2.PdfReader(pdf_file)
        
        # Get PDF metadata
        pdf_meta = reader.metadata or {}
        metadata["title"] = pdf_meta.get("/Title", "")
        metadata["authors"] = pdf_meta.get("/Author", "")
        metadata["subject"] = pdf_meta.get("/Subject", "")
        metadata["creator"] = pdf_meta.get("/Creator", "")
        metadata["page_count"] = len(reader.pages)
        
        # If title or authors are missing, try to extract from first page
        if not metadata["title"] or not metadata["authors"]:
            if len(reader.pages) > 0:
                first_page_text = reader.pages[0].extract_text()
                parsed = parse_first_page_metadata(first_page_text)
                
                if not metadata["title"] and parsed.get("title"):
                    metadata["title"] = parsed["title"]
                if not metadata["authors"] and parsed.get("authors"):
                    metadata["authors"] = parsed["authors"]
        
        return metadata
    
    except Exception as e:
        print(f"[WARNING] Metadata extraction failed: {e}")
        return metadata


def parse_first_page_metadata(text: str) -> Dict:
    """
    Parse title and authors from first page text using heuristics.
    
    Args:
        text: First page text
        
    Returns:
        Dictionary with extracted title and authors
    """
    if not text:
        return {}
    
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    
    result = {"title": "", "authors": ""}
    
    # Title is usually in the first few lines, often the longest line
    # and doesn't contain common header patterns
    title_candidates = []
    for i, line in enumerate(lines[:10]):  # Check first 10 lines
        # Skip lines that look like headers/metadata
        if any(skip in line.lower() for skip in ['abstract', 'introduction', 'keywords', 'doi:', 'arxiv:', 'email:', '@', 'university', 'department', 'volume', 'issn']):
            continue
        # Skip very short lines
        if len(line) < 10:
            continue
        # Skip lines with mostly numbers or special chars
        if len(re.findall(r'[a-zA-Z]', line)) < len(line) * 0.5:
            continue
        
        title_candidates.append((i, line, len(line)))
    
    # Pick the longest line in first 5 as title
    if title_candidates:
        title_candidates.sort(key=lambda x: x[2], reverse=True)
        result["title"] = title_candidates[0][1]
    
    # Authors are usually after title, may contain "and", commas, or be on multiple lines
    # Look for patterns like: "John Doe, Jane Smith" or "John Doe and Jane Smith"
    author_patterns = [
        r'([A-Z][a-z]+ [A-Z][a-z]+(?:,? (?:and |& )?[A-Z][a-z]+ [A-Z][a-z]+)*)',  # John Doe, Jane Smith
        r'([A-Z]\. [A-Z][a-z]+(?:,? (?:and |& )?[A-Z]\. [A-Z][a-z]+)*)',  # J. Doe, J. Smith
    ]
    
    for line in lines[:15]:  # Check first 15 lines
        for pattern in author_patterns:
            matches = re.findall(pattern, line)
            if matches and not result["authors"]:
                # Clean up the match
                authors = matches[0]
                # Remove trailing punctuation
                authors = re.sub(r'[,;.]+$', '', authors)
                result["authors"] = authors
                break
        if result["authors"]:
            break
    
    return result


def clean_text(text: str) -> str:
    """
    Clean extracted text for better processing.
    
    Args:
        text: Raw extracted text
        
    Returns:
        Cleaned text
    """
    # Remove excessive whitespace
    text = re.sub(r'\s+', ' ', text)
    
    # Remove page numbers (common patterns)
    text = re.sub(r'\n\s*\d+\s*\n', '\n', text)
    
    # Remove headers/footers that repeat
    # (This is a simple heuristic, may need tuning)
    
    # Fix common OCR issues
    text = text.replace('ﬁ', 'fi')
    text = text.replace('ﬂ', 'fl')
    text = text.replace('ﬀ', 'ff')
    
    return text.strip()


def chunk_text(
    text: str,
    chunk_size: int = None,
    chunk_overlap: int = None,
    respect_sentences: bool = True
) -> List[Dict]:
    """
    Split text into overlapping chunks.
    
    Args:
        text: Input text to chunk
        chunk_size: Maximum characters per chunk (default from config)
        chunk_overlap: Overlap between chunks (default from config)
        respect_sentences: Try to break at sentence boundaries
        
    Returns:
        List of {"text": "...", "start": int, "end": int, "index": int}
    """
    chunk_size = chunk_size or config.CHUNK_SIZE
    chunk_overlap = chunk_overlap or config.CHUNK_OVERLAP
    
    print(f"[DEBUG] chunk_text called with text length: {len(text) if text else 0}")
    
    if not text:
        print("[DEBUG] chunk_text: empty text, returning []")
        return []
    
    # Clean the text first
    print("[DEBUG] chunk_text: cleaning text...")
    text = clean_text(text)
    print(f"[DEBUG] chunk_text: cleaned text length: {len(text)}")
    
    chunks = []
    start = 0
    index = 0
    text_len = len(text)
    max_iterations = (text_len // (chunk_size - chunk_overlap)) + 10  # Safety limit
    
    print(f"[DEBUG] chunk_text: starting chunking loop, chunk_size={chunk_size}, overlap={chunk_overlap}, text_len={text_len}")
    
    iteration = 0
    while start < text_len and iteration < max_iterations:
        iteration += 1
        prev_start = start
        
        # Calculate end position
        end = min(start + chunk_size, text_len)
        
        if end < text_len and respect_sentences:
            # Try to find a sentence boundary
            # Look for period, question mark, or exclamation followed by space
            search_start = max(start + chunk_size - 200, start)  # Search in last 200 chars
            search_end = min(end + 100, text_len)  # Include some buffer
            search_text = text[search_start:search_end]
            
            # Find the last sentence boundary in the search range
            sentence_ends = []
            for match in re.finditer(r'[.!?]\s+', search_text):
                pos = search_start + match.end()
                if start < pos <= end + 50:  # Allow going slightly over
                    sentence_ends.append(pos)
            
            if sentence_ends:
                end = min(sentence_ends[-1], text_len)
        
        chunk_content = text[start:end].strip()
        
        if chunk_content:  # Only add non-empty chunks
            chunks.append({
                "text": chunk_content,
                "start": start,
                "end": end,
                "index": index
            })
            index += 1
        
        # Move start position with overlap
        if end >= text_len:
            # We've reached the end, break out
            break
        
        new_start = end - chunk_overlap
        
        # Ensure we always make forward progress
        if new_start <= start:
            new_start = start + 1  # Force at least 1 character progress
        
        start = new_start
    
    if iteration >= max_iterations:
        print(f"[WARNING] chunk_text: hit max iterations ({max_iterations}), possible infinite loop prevented")
    
    print(f"[DEBUG] chunk_text: completed, created {len(chunks)} chunks in {iteration} iterations")
    return chunks


def process_pdf(pdf_bytes: bytes) -> Tuple[str, List[Dict], Dict]:
    """
    Full PDF processing pipeline: extract, clean, chunk.
    
    Args:
        pdf_bytes: PDF file as bytes
        
    Returns:
        Tuple of (full_text, chunks, metadata)
    """
    # Extract text
    full_text = extract_text_from_pdf(pdf_bytes)
    print(f"[DEBUG] Extracted text length: {len(full_text)} characters")
    print(f"[DEBUG] Sample text (first 500 chars): {full_text[:500] if full_text else 'NO TEXT'}")
    
    # Extract metadata
    metadata = extract_metadata_from_pdf(pdf_bytes)
    print(f"[DEBUG] Extracted metadata: {metadata}")
    
    # Chunk the text
    chunks = chunk_text(full_text)
    print(f"[DEBUG] Total chunks created: {len(chunks)}")
    if chunks:
        print(f"[DEBUG] Sample chunk (first 200 chars): {chunks[0]['text'][:200]}")
    else:
        print("[ERROR] NO CHUNKS CREATED - check text extraction")
    
    return full_text, chunks, metadata


def estimate_tokens(text: str) -> int:
    """
    Rough estimate of token count (for cost estimation).
    
    Args:
        text: Input text
        
    Returns:
        Estimated token count
    """
    # Rough estimate: ~4 characters per token for English
    return len(text) // 4




