"""
Amazon Translate client for multi-language support.
"""

import boto3
from typing import Optional
import logging

from .config import Config

logger = logging.getLogger(__name__)


class TranslateClient:
    """Client for Amazon Translate operations."""
    
    # Language code mapping for Translate
    TRANSLATE_LANGUAGE_CODES = {
        'es': 'es',
        'en': 'en',
        'pt': 'pt',
    }
    
    def __init__(self):
        self.client = boto3.client('translate', region_name=Config.AWS_REGION)
    
    def translate_text(
        self, 
        text: str, 
        source_language: str, 
        target_language: str
    ) -> str:
        """
        Translate text from source to target language.
        
        Args:
            text: Text to translate
            source_language: Source language code
            target_language: Target language code
            
        Returns:
            Translated text
        """
        # If same language, return original
        if source_language == target_language:
            return text
        
        try:
            source_code = self.TRANSLATE_LANGUAGE_CODES.get(source_language, source_language)
            target_code = self.TRANSLATE_LANGUAGE_CODES.get(target_language, target_language)
            
            response = self.client.translate_text(
                Text=text,
                SourceLanguageCode=source_code,
                TargetLanguageCode=target_code,
            )
            
            translated = response['TranslatedText']
            logger.info(f"Translated from {source_language} to {target_language}")
            
            return translated
            
        except Exception as e:
            logger.error(f"Error translating text: {e}")
            return text  # Return original on error
    
    def translate_to_spanish(self, text: str, source_language: str) -> str:
        """Translate text to Spanish."""
        return self.translate_text(text, source_language, 'es')
    
    def translate_from_spanish(self, text: str, target_language: str) -> str:
        """Translate text from Spanish to target language."""
        return self.translate_text(text, 'es', target_language)
    
    def translate_batch(
        self, 
        texts: list, 
        source_language: str, 
        target_language: str
    ) -> list:
        """
        Translate multiple texts.
        
        Args:
            texts: List of texts to translate
            source_language: Source language code
            target_language: Target language code
            
        Returns:
            List of translated texts
        """
        return [
            self.translate_text(text, source_language, target_language)
            for text in texts
        ]
    
    def get_supported_languages(self) -> list:
        """Get list of supported languages."""
        return list(Config.SUPPORTED_LANGUAGES)
