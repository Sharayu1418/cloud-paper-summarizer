"""
Amazon Comprehend client for NLP analysis of research papers.
Extracts key phrases, entities, and sentiment from paper content.
"""
import boto3
from typing import Dict, List, Optional
from shared.config import AWS_REGION


class ComprehendClient:
    """Client for Amazon Comprehend NLP operations."""
    
    def __init__(self):
        self.client = boto3.client('comprehend', region_name=AWS_REGION)
        self.max_text_size = 5000  # Comprehend limit per request
    
    def _truncate_text(self, text: str) -> str:
        """Truncate text to Comprehend's maximum size limit."""
        if len(text.encode('utf-8')) > self.max_text_size:
            # Truncate to max bytes while keeping valid UTF-8
            encoded = text.encode('utf-8')[:self.max_text_size]
            return encoded.decode('utf-8', errors='ignore')
        return text
    
    def extract_key_phrases(self, text: str, language: str = 'en') -> List[Dict]:
        """
        Extract key phrases from text.
        
        Args:
            text: The text to analyze
            language: Language code (default: 'en')
            
        Returns:
            List of key phrases with scores
        """
        try:
            truncated = self._truncate_text(text)
            response = self.client.detect_key_phrases(
                Text=truncated,
                LanguageCode=language
            )
            
            # Sort by score and return top phrases
            phrases = sorted(
                response.get('KeyPhrases', []),
                key=lambda x: x.get('Score', 0),
                reverse=True
            )
            
            return [
                {
                    'text': p['Text'],
                    'score': round(p['Score'], 3)
                }
                for p in phrases[:20]  # Top 20 phrases
            ]
        except Exception as e:
            print(f"Error extracting key phrases: {e}")
            return []
    
    def detect_entities(self, text: str, language: str = 'en') -> List[Dict]:
        """
        Detect named entities in text.
        
        Args:
            text: The text to analyze
            language: Language code (default: 'en')
            
        Returns:
            List of entities with types and scores
        """
        try:
            truncated = self._truncate_text(text)
            response = self.client.detect_entities(
                Text=truncated,
                LanguageCode=language
            )
            
            entities = response.get('Entities', [])
            
            # Group entities by type
            entity_map = {}
            for entity in entities:
                entity_type = entity['Type']
                if entity_type not in entity_map:
                    entity_map[entity_type] = []
                entity_map[entity_type].append({
                    'text': entity['Text'],
                    'score': round(entity['Score'], 3)
                })
            
            return entity_map
        except Exception as e:
            print(f"Error detecting entities: {e}")
            return {}
    
    def detect_sentiment(self, text: str, language: str = 'en') -> Dict:
        """
        Detect overall sentiment of text.
        
        Args:
            text: The text to analyze
            language: Language code (default: 'en')
            
        Returns:
            Sentiment analysis result
        """
        try:
            truncated = self._truncate_text(text)
            response = self.client.detect_sentiment(
                Text=truncated,
                LanguageCode=language
            )
            
            return {
                'sentiment': response.get('Sentiment', 'NEUTRAL'),
                'scores': {
                    'positive': round(response['SentimentScore'].get('Positive', 0), 3),
                    'negative': round(response['SentimentScore'].get('Negative', 0), 3),
                    'neutral': round(response['SentimentScore'].get('Neutral', 0), 3),
                    'mixed': round(response['SentimentScore'].get('Mixed', 0), 3)
                }
            }
        except Exception as e:
            print(f"Error detecting sentiment: {e}")
            return {'sentiment': 'NEUTRAL', 'scores': {}}
    
    def analyze_paper(self, full_text: str, abstract: Optional[str] = None) -> Dict:
        """
        Perform comprehensive NLP analysis on a paper.
        
        Args:
            full_text: The full paper text
            abstract: Optional paper abstract
            
        Returns:
            Combined analysis results
        """
        # Use abstract if available, otherwise first part of full text
        analysis_text = abstract if abstract else full_text[:5000]
        
        return {
            'key_phrases': self.extract_key_phrases(analysis_text),
            'entities': self.detect_entities(analysis_text),
            'sentiment': self.detect_sentiment(analysis_text)
        }


