"""
Amazon Lex client for Chatbot.
"""

import boto3
from typing import Dict, Any, Optional
import logging

from .config import Config

logger = logging.getLogger(__name__)


class LexClient:
    """Client for Amazon Lex v2 operations."""
    
    def __init__(self):
        self.client = boto3.client('lexv2-runtime', region_name=Config.AWS_REGION)
        self.bot_id = Config.LEX_BOT_ID
        self.bot_alias_id = Config.LEX_BOT_ALIAS_ID
    
    def recognize_text(
        self, 
        session_id: str, 
        text: str, 
        locale_id: str = 'es_ES',
        session_state: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Send text to Lex for recognition.
        
        Args:
            session_id: Unique session identifier
            text: User input text
            locale_id: Locale for the bot (es_ES, en_US, pt_BR)
            session_state: Optional session state for context
            
        Returns:
            Lex response with intent and messages
        """
        try:
            params = {
                'botId': self.bot_id,
                'botAliasId': self.bot_alias_id,
                'localeId': locale_id,
                'sessionId': session_id,
                'text': text,
            }
            
            if session_state:
                params['sessionState'] = session_state
            
            response = self.client.recognize_text(**params)
            
            logger.info(f"Lex response for session {session_id}: {response.get('sessionState', {}).get('intent', {}).get('name', 'Unknown')}")
            
            return {
                'intent_name': response.get('sessionState', {}).get('intent', {}).get('name', 'FallbackIntent'),
                'intent_state': response.get('sessionState', {}).get('intent', {}).get('state', 'Failed'),
                'messages': response.get('messages', []),
                'session_state': response.get('sessionState', {}),
                'slots': response.get('sessionState', {}).get('intent', {}).get('slots', {}),
            }
            
        except Exception as e:
            logger.error(f"Error calling Lex: {e}")
            return {
                'intent_name': 'FallbackIntent',
                'intent_state': 'Failed',
                'messages': [{'content': 'Lo siento, ocurrió un error. Por favor, intenta de nuevo.', 'contentType': 'PlainText'}],
                'session_state': {},
                'slots': {},
            }
    
    def get_session(self, session_id: str, locale_id: str = 'es_ES') -> Dict[str, Any]:
        """Get current session state."""
        try:
            response = self.client.get_session(
                botId=self.bot_id,
                botAliasId=self.bot_alias_id,
                localeId=locale_id,
                sessionId=session_id,
            )
            return response.get('sessionState', {})
        except Exception as e:
            logger.warning(f"Could not get session: {e}")
            return {}
    
    def delete_session(self, session_id: str, locale_id: str = 'es_ES') -> bool:
        """Delete a session."""
        try:
            self.client.delete_session(
                botId=self.bot_id,
                botAliasId=self.bot_alias_id,
                localeId=locale_id,
                sessionId=session_id,
            )
            logger.info(f"Deleted session {session_id}")
            return True
        except Exception as e:
            logger.error(f"Error deleting session: {e}")
            return False
