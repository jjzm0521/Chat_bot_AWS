"""
Amazon Bedrock client for Chatbot.
"""

import boto3
import json
import logging
from typing import Dict, Any, Optional

from .config import Config

logger = logging.getLogger(__name__)


class BedrockClient:
    """Client for Amazon Bedrock operations."""
    
    def __init__(self):
        self.client = boto3.client('bedrock-runtime', region_name=Config.AWS_REGION)
        # Default to Claude v2
        self.model_id = 'anthropic.claude-v2'
    
    def generate_response(self, prompt: str, context: Optional[str] = None) -> str:
        """
        Generate a response using Bedrock (Claude).
        
        Args:
            prompt: User's question or input
            context: Optional context or background information
            
        Returns:
            Generated text response
        """
        try:
            # Construct the prompt for Claude
            # Claude expects "\n\nHuman: <prompt>\n\nAssistant:" format
            full_prompt = f"\n\nHuman: "
            
            if context:
                full_prompt += f"Context: {context}\n\n"
            
            full_prompt += f"Question: {prompt}\n\nPlease provide a helpful, concise response in the same language as the question.\n\nAssistant:"
            
            body = {
                "prompt": full_prompt,
                "max_tokens_to_sample": 500,
                "temperature": 0.7,
                "top_p": 0.9,
            }
            
            response = self.client.invoke_model(
                modelId=self.model_id,
                body=json.dumps(body),
                contentType='application/json',
                accept='application/json'
            )
            
            response_body = json.loads(response['body'].read())
            completion = response_body.get('completion', '').strip()
            
            logger.info(f"Bedrock generation success")
            return completion
            
        except Exception as e:
            logger.error(f"Error calling Bedrock: {e}")
            # Fallback message if Bedrock fails
            return "Lo siento, tuve problemas para conectar con mi cerebro de IA. ¿Podrías intentar de nuevo?"
