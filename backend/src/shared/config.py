"""
Configuration settings for Chatbot Lambda functions.
"""

import os


class Config:
    """Configuration class with environment variables."""
    
    # DynamoDB Tables
    CONVERSATIONS_TABLE = os.environ.get('CONVERSATIONS_TABLE', 'ChatbotConversations')
    KNOWLEDGE_BASE_TABLE = os.environ.get('KNOWLEDGE_BASE_TABLE', 'ChatbotKnowledgeBase')
    ANALYTICS_TABLE = os.environ.get('ANALYTICS_TABLE', 'ChatbotAnalytics')
    
    # Lex Bot
    LEX_BOT_ID = os.environ.get('LEX_BOT_ID', '')
    LEX_BOT_ALIAS_ID = os.environ.get('LEX_BOT_ALIAS_ID', '')
    
    # AWS Region
    AWS_REGION = os.environ.get('AWS_REGION', 'us-east-1')
    
    # Logging
    LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO')
    
    # Session TTL (7 days in seconds)
    SESSION_TTL_SECONDS = 7 * 24 * 60 * 60
    
    # Supported languages
    SUPPORTED_LANGUAGES = ['es', 'en', 'pt']
    DEFAULT_LANGUAGE = 'es'
    
    # Language to Lex locale mapping
    LANGUAGE_TO_LOCALE = {
        'es': 'es_ES',
        'en': 'en_US',
        'pt': 'pt_BR',
    }
    
    @classmethod
    def get_lex_locale(cls, language: str) -> str:
        """Get Lex locale ID for a language code."""
        return cls.LANGUAGE_TO_LOCALE.get(language, 'es_ES')
