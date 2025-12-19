"""Amazon Polly client for text-to-speech synthesis."""
import boto3
import base64
from typing import Optional
from . import config


class PollyClient:
    """Client for Amazon Polly text-to-speech service."""
    
    # Available neural voices for research content
    VOICES = {
        'en-US': {
            'female': 'Joanna',  # Neural voice, clear and professional
            'male': 'Matthew',   # Neural voice, authoritative
        },
        'en-GB': {
            'female': 'Amy',
            'male': 'Brian',
        }
    }
    
    def __init__(self):
        self.client = boto3.client('polly', region_name=config.AWS_REGION)
    
    def synthesize_speech(
        self,
        text: str,
        voice_id: str = 'Joanna',
        output_format: str = 'mp3',
        engine: str = 'neural'
    ) -> dict:
        """
        Convert text to speech using Amazon Polly.
        
        Args:
            text: Text to convert (max 3000 characters for neural)
            voice_id: Polly voice ID (default: Joanna - US English female)
            output_format: Audio format (mp3, ogg_vorbis, pcm)
            engine: 'neural' for high quality, 'standard' for basic
            
        Returns:
            dict with 'audio_base64' and 'content_type'
        """
        # Polly neural engine limit is 3000 characters
        max_chars = 3000 if engine == 'neural' else 6000
        truncated_text = text[:max_chars] if len(text) > max_chars else text
        
        try:
            response = self.client.synthesize_speech(
                Text=truncated_text,
                OutputFormat=output_format,
                VoiceId=voice_id,
                Engine=engine,
                TextType='text'
            )
            
            # Read audio stream
            audio_stream = response['AudioStream'].read()
            audio_base64 = base64.b64encode(audio_stream).decode('utf-8')
            
            content_type_map = {
                'mp3': 'audio/mpeg',
                'ogg_vorbis': 'audio/ogg',
                'pcm': 'audio/pcm'
            }
            
            return {
                'audio_base64': audio_base64,
                'content_type': content_type_map.get(output_format, 'audio/mpeg'),
                'characters_synthesized': len(truncated_text),
                'truncated': len(text) > max_chars
            }
            
        except Exception as e:
            raise Exception(f"Polly synthesis failed: {str(e)}")
    
    def synthesize_paper_summary(
        self,
        insights: dict,
        voice_id: str = 'Joanna'
    ) -> dict:
        """
        Generate speech for a paper summary from insights.
        
        Args:
            insights: Paper insights dict with problem, method, findings, conclusion
            voice_id: Polly voice ID
            
        Returns:
            dict with audio data
        """
        # Build a natural-sounding summary script
        parts = []
        
        if insights.get('problem'):
            parts.append(f"This paper addresses the following problem: {insights['problem']}")
        
        if insights.get('method'):
            parts.append(f"The methodology used is: {insights['method']}")
        
        if insights.get('key_concepts'):
            concepts = insights['key_concepts'][:5]  # Limit to 5
            if concepts:
                parts.append(f"Key concepts include: {', '.join(concepts)}")
        
        if insights.get('findings'):
            findings = insights['findings'][:3]  # Limit to 3
            if findings:
                parts.append(f"The main findings are: {'. '.join(findings)}")
        
        if insights.get('metrics'):
            metrics = insights['metrics'][:3]
            if metrics:
                parts.append(f"Notable metrics: {', '.join(metrics)}")
        
        if insights.get('conclusion'):
            parts.append(f"In conclusion: {insights['conclusion']}")
        
        # Join with pauses
        full_text = '. '.join(parts)
        
        return self.synthesize_speech(full_text, voice_id=voice_id)
    
    def get_available_voices(self, language_code: str = 'en-US') -> list:
        """Get list of available neural voices for a language."""
        try:
            response = self.client.describe_voices(
                Engine='neural',
                LanguageCode=language_code
            )
            return [
                {
                    'id': voice['Id'],
                    'name': voice['Name'],
                    'gender': voice['Gender']
                }
                for voice in response['Voices']
            ]
        except Exception:
            # Return defaults if API call fails
            return [
                {'id': 'Joanna', 'name': 'Joanna', 'gender': 'Female'},
                {'id': 'Matthew', 'name': 'Matthew', 'gender': 'Male'}
            ]

