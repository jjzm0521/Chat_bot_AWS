"""
Amazon Bedrock client for Chatbot - Using DeepSeek R1.
Updated: 2024-12-09 15:45
"""

import boto3
import json
import logging
import re
from typing import Optional

from .config import Config

logger = logging.getLogger(__name__)


class BedrockClient:
    """Client for Amazon Bedrock using DeepSeek R1."""
    
    def __init__(self):
        self.client = boto3.client('bedrock-runtime', region_name=Config.AWS_REGION)
        self.model_id = 'us.deepseek.r1-v1:0'  # Cross-region inference profile
    
    def generate_response(self, prompt: str, context: Optional[str] = None) -> str:
        """
        Generate a response using DeepSeek R1.
        DeepSeek R1 is a reasoning model that returns reasoning_content.
        """
        try:
            system_msg = """Eres un asistente virtual amable para una tienda en linea.
Responde de forma breve y directa (1-2 oraciones maximo).
Se util, empatico y profesional."""

            body = {
                "messages": [
                    {"role": "system", "content": system_msg},
                    {"role": "user", "content": prompt}
                ],
                "max_tokens": 500,  # More tokens for reasoning + response
                "temperature": 0.7
            }
            
            response = self.client.invoke_model(
                modelId=self.model_id,
                body=json.dumps(body),
                contentType='application/json',
                accept='application/json'
            )
            
            response_body = json.loads(response['body'].read())
            logger.info(f"DeepSeek raw response: {json.dumps(response_body)[:200]}")
            
            # DeepSeek R1 returns reasoning_content and content
            completion = ""
            if 'choices' in response_body and len(response_body['choices']) > 0:
                choice = response_body['choices'][0]
                message = choice.get('message', {})
                
                # Try content first, then reasoning_content
                completion = message.get('content') or ''
                
                # If content is null/empty, use reasoning_content
                if not completion:
                    reasoning = message.get('reasoning_content', '')
                    # Extract the actual response from reasoning
                    completion = self._extract_response_from_reasoning(reasoning)
            
            completion = self._clean_response(completion)
            
            logger.info(f"DeepSeek final response: {completion[:100]}...")
            return completion if completion else "En que puedo ayudarte?"
            
        except Exception as e:
            logger.error(f"Error calling DeepSeek: {e}")
            return self._get_smart_response(prompt)
    
    def _extract_response_from_reasoning(self, reasoning: str) -> str:
        """
        Extract the actual response from DeepSeek's reasoning content.
        The model thinks out loud, we need to find the actual response.
        """
        if not reasoning:
            return ""
        
        # Look for common patterns where the model states its response
        patterns = [
            r'(?:I should|I\'ll|Let me) (?:respond|reply|say)[:\s]*["\']?(.+?)["\']?(?:\.|$)',
            r'(?:responder|respondo|digo)[:\s]*["\']?(.+?)["\']?(?:\.|$)',
            r'response[:\s]*["\']?(.+?)["\']?(?:\.|$)',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, reasoning, re.IGNORECASE)
            if match:
                return match.group(1).strip()
        
        # If no pattern found, take the last sentence that looks like a response
        sentences = re.split(r'[.!?]\s+', reasoning)
        for sentence in reversed(sentences):
            if len(sentence) > 20 and not sentence.startswith(('Okay', 'Let me', 'I should', 'Maybe')):
                return sentence.strip() + '.'
        
        # Fallback: just return a generic response
        return ""
    
    def _clean_response(self, text: str) -> str:
        """Remove any simulated conversation from response."""
        if not text:
            return ""
        
        # Cut at any conversation simulation patterns
        for pattern in ['User:', 'Usuario:', 'Cliente:', 'Human:', '\n\nUser', '\n\nHuman']:
            if pattern in text:
                text = text.split(pattern)[0]
        
        return text.strip()
    
    def _get_smart_response(self, prompt: str) -> str:
        """Fallback responses based on keywords."""
        prompt_lower = prompt.lower()
        
        if any(w in prompt_lower for w in ['hola', 'buenos', 'hey', 'hi']):
            return "Hola! Soy tu asistente virtual. En que puedo ayudarte?"
        elif any(w in prompt_lower for w in ['precio', 'costo', 'cuanto']):
            return "Los precios varian segun el producto. Cual te interesa?"
        elif any(w in prompt_lower for w in ['envio', 'entrega']):
            return "El envio tarda 3-5 dias en zonas urbanas y 5-7 en zonas rurales."
        elif any(w in prompt_lower for w in ['devol', 'cambio']):
            return "Aceptamos devoluciones en 30 dias con empaque original."
        elif any(w in prompt_lower for w in ['problema', 'error', 'falla', 'dano']):
            return "Lamento escuchar eso. Cuentame mas sobre el problema."
        elif any(w in prompt_lower for w in ['gracias', 'adios', 'bye']):
            return "Gracias por contactarnos! Que tengas un excelente dia."
        else:
            return "Gracias por tu mensaje. Como puedo ayudarte?"
