"""
Amazon Comprehend client for sentiment analysis.
"""

import boto3
from typing import Dict, Any, Tuple
import logging

from .config import Config

logger = logging.getLogger(__name__)


class ComprehendClient:
    """Client for Amazon Comprehend operations."""
    
    def __init__(self):
        self.client = boto3.client('comprehend', region_name=Config.AWS_REGION)
    
    def detect_sentiment(self, text: str, language_code: str = 'es') -> Dict[str, Any]:
        """
        Detect sentiment of the text.
        
        Args:
            text: Text to analyze
            language_code: Language code (es, en, pt)
            
        Returns:
            Sentiment analysis result
        """
        try:
            response = self.client.detect_sentiment(
                Text=text,
                LanguageCode=language_code,
            )
            
            result = {
                'sentiment': response['Sentiment'],  # POSITIVE, NEGATIVE, NEUTRAL, MIXED
                'scores': {
                    'positive': response['SentimentScore']['Positive'],
                    'negative': response['SentimentScore']['Negative'],
                    'neutral': response['SentimentScore']['Neutral'],
                    'mixed': response['SentimentScore']['Mixed'],
                },
            }
            
            logger.info(f"Detected sentiment: {result['sentiment']}")
            return result
            
        except Exception as e:
            logger.error(f"Error detecting sentiment: {e}")
            return {
                'sentiment': 'NEUTRAL',
                'scores': {'positive': 0, 'negative': 0, 'neutral': 1, 'mixed': 0},
            }
    
    def detect_language(self, text: str) -> Tuple[str, float]:
        """
        Detect dominant language of the text.
        
        Args:
            text: Text to analyze
            
        Returns:
            Tuple of (language_code, confidence_score)
        """
        try:
            response = self.client.detect_dominant_language(Text=text)
            
            if response['Languages']:
                lang = response['Languages'][0]
                language_code = lang['LanguageCode']
                confidence = lang['Score']
                
                # Map to supported languages
                if language_code not in Config.SUPPORTED_LANGUAGES:
                    # Default to Spanish for unsupported languages
                    language_code = Config.DEFAULT_LANGUAGE
                
                logger.info(f"Detected language: {language_code} ({confidence:.2%})")
                return language_code, confidence
            
            return Config.DEFAULT_LANGUAGE, 0.0
            
        except Exception as e:
            logger.error(f"Error detecting language: {e}")
            return Config.DEFAULT_LANGUAGE, 0.0
    
    def detect_entities(self, text: str, language_code: str = 'es') -> list:
        """
        Detect entities in the text.
        
        Args:
            text: Text to analyze
            language_code: Language code
            
        Returns:
            List of detected entities
        """
        try:
            response = self.client.detect_entities(
                Text=text,
                LanguageCode=language_code,
            )
            
            entities = [
                {
                    'text': entity['Text'],
                    'type': entity['Type'],
                    'score': entity['Score'],
                }
                for entity in response['Entities']
            ]
            
            logger.info(f"Detected {len(entities)} entities")
            return entities
            
        except Exception as e:
            logger.error(f"Error detecting entities: {e}")
            return []
    
    def detect_key_phrases(self, text: str, language_code: str = 'es') -> list:
        """
        Detect key phrases in the text.
        
        Args:
            text: Text to analyze
            language_code: Language code
            
        Returns:
            List of key phrases
        """
        try:
            response = self.client.detect_key_phrases(
                Text=text,
                LanguageCode=language_code,
            )
            
            phrases = [
                {
                    'text': phrase['Text'],
                    'score': phrase['Score'],
                }
                for phrase in response['KeyPhrases']
            ]
            
            logger.info(f"Detected {len(phrases)} key phrases")
            return phrases
            
        except Exception as e:
            logger.error(f"Error detecting key phrases: {e}")
            return []
