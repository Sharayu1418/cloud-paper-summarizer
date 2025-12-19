"""
Paper insights generator using Amazon Comprehend for NLP analysis
and AWS Bedrock for structured methodology extraction.

Generates a methodology flowchart structure:
Problem -> Method -> Results -> Conclusion
"""
import json
from typing import Dict, Optional, List
from shared.comprehend_client import ComprehendClient
from shared.llm import LLMClient


class PaperInsightsGenerator:
    """Generate paper insights using Comprehend + Bedrock."""
    
    def __init__(self):
        self.comprehend = ComprehendClient()
        self.llm = LLMClient(provider="bedrock")
    
    def generate_methodology_flowchart(self, 
                                        full_text: str, 
                                        title: str,
                                        abstract: Optional[str] = None) -> Dict:
        """
        Generate a methodology flowchart for a research paper.
        
        Uses Bedrock to extract:
        - Problem: What problem does the paper address?
        - Method: What approach/methodology is used?
        - Results: What are the key findings?
        - Conclusion: What are the implications?
        
        Args:
            full_text: The full paper text
            title: Paper title
            abstract: Optional abstract
            
        Returns:
            Flowchart structure with nodes and edges
        """
        # Use abstract + first portion of text for analysis
        analysis_text = abstract if abstract else ""
        if full_text:
            # Add first 4000 chars of full text for more context
            analysis_text += "\n\n" + full_text[:4000]
        
        prompt = f"""Analyze this research paper and extract the methodology structure.

PAPER TITLE: {title}

PAPER CONTENT:
{analysis_text[:6000]}

Extract the following components in JSON format:
{{
    "problem": {{
        "title": "Problem Statement",
        "description": "1-2 sentence description of the problem being addressed",
        "keywords": ["key", "terms"]
    }},
    "method": {{
        "title": "Methodology",
        "description": "1-2 sentence description of the approach used",
        "steps": ["step1", "step2", "step3"]
    }},
    "results": {{
        "title": "Key Results",
        "description": "1-2 sentence summary of main findings",
        "findings": ["finding1", "finding2"]
    }},
    "conclusion": {{
        "title": "Conclusion",
        "description": "1-2 sentence summary of implications and contributions",
        "implications": ["implication1", "implication2"]
    }}
}}

Respond with ONLY valid JSON, no other text."""

        try:
            response = self.llm.generate(prompt, max_tokens=1500, temperature=0.3)
            
            # Extract JSON from response
            flowchart_data = self._parse_json_response(response)
            
            # Convert to React Flow compatible format
            return self._to_react_flow_format(flowchart_data)
            
        except Exception as e:
            print(f"Error generating methodology flowchart: {e}")
            return self._get_fallback_flowchart(title)
    
    def _parse_json_response(self, response: str) -> Dict:
        """Parse JSON from LLM response."""
        # Try to extract JSON from the response
        try:
            # First try direct parse
            return json.loads(response)
        except json.JSONDecodeError:
            pass
        
        # Try to find JSON in the response
        try:
            start = response.find('{')
            end = response.rfind('}') + 1
            if start >= 0 and end > start:
                return json.loads(response[start:end])
        except json.JSONDecodeError:
            pass
        
        return {}
    
    def _to_react_flow_format(self, data: Dict) -> Dict:
        """Convert extracted data to React Flow node/edge format."""
        nodes = []
        edges = []
        
        # Define node positions (vertical flowchart)
        positions = {
            'problem': {'x': 250, 'y': 0},
            'method': {'x': 250, 'y': 150},
            'results': {'x': 250, 'y': 300},
            'conclusion': {'x': 250, 'y': 450}
        }
        
        # Node colors
        colors = {
            'problem': '#EF4444',      # Red
            'method': '#3B82F6',       # Blue
            'results': '#10B981',      # Green
            'conclusion': '#8B5CF6'    # Purple
        }
        
        node_order = ['problem', 'method', 'results', 'conclusion']
        
        for node_id in node_order:
            node_data = data.get(node_id, {})
            nodes.append({
                'id': node_id,
                'type': 'custom',
                'position': positions[node_id],
                'data': {
                    'label': node_data.get('title', node_id.capitalize()),
                    'description': node_data.get('description', ''),
                    'details': node_data.get('steps') or node_data.get('findings') or node_data.get('implications') or node_data.get('keywords', []),
                    'color': colors[node_id]
                }
            })
        
        # Create edges connecting nodes in sequence
        for i in range(len(node_order) - 1):
            edges.append({
                'id': f'{node_order[i]}-{node_order[i+1]}',
                'source': node_order[i],
                'target': node_order[i+1],
                'type': 'smoothstep',
                'animated': True
            })
        
        return {
            'nodes': nodes,
            'edges': edges,
            'metadata': {
                'generated': True,
                'version': '1.0'
            }
        }
    
    def _get_fallback_flowchart(self, title: str) -> Dict:
        """Return a fallback flowchart when extraction fails."""
        return self._to_react_flow_format({
            'problem': {
                'title': 'Problem Statement',
                'description': f'Research problem addressed in: {title}',
                'keywords': ['research', 'analysis']
            },
            'method': {
                'title': 'Methodology',
                'description': 'Approach used in this study',
                'steps': ['Data collection', 'Analysis', 'Validation']
            },
            'results': {
                'title': 'Key Results',
                'description': 'Findings from the research',
                'findings': ['Primary findings', 'Secondary findings']
            },
            'conclusion': {
                'title': 'Conclusion',
                'description': 'Implications of this research',
                'implications': ['Research contribution', 'Future work']
            }
        })
    
    def generate_full_insights(self, 
                                full_text: str, 
                                title: str,
                                abstract: Optional[str] = None) -> Dict:
        """
        Generate complete paper insights including:
        - Comprehend NLP analysis (key phrases, entities, sentiment)
        - Methodology flowchart from Bedrock
        
        Args:
            full_text: The full paper text
            title: Paper title
            abstract: Optional abstract
            
        Returns:
            Complete insights object
        """
        # Get Comprehend analysis
        comprehend_analysis = self.comprehend.analyze_paper(full_text, abstract)
        
        # Get methodology flowchart
        flowchart = self.generate_methodology_flowchart(full_text, title, abstract)
        
        return {
            'title': title,
            'nlp_analysis': comprehend_analysis,
            'methodology_flowchart': flowchart
        }


