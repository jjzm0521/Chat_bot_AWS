"""
Lambda Orchestrator Handler.

Uses Claude 3 Haiku via Amazon Bedrock for AI-powered responses.
"""

import json
import logging
import os
import sys
import uuid
from datetime import datetime, timezone
import time

sys.path.insert(0, '/opt/python')

import boto3

from shared.config import Config
from shared.dynamo_client import DynamoClient
from shared.lex_client import LexClient
from shared.comprehend_client import ComprehendClient
from shared.translate_client import TranslateClient
from shared.bedrock_client import BedrockClient
from shared.models import Message, AnalyticsEvent

logger = logging.getLogger()
logger.setLevel(getattr(logging, Config.LOG_LEVEL))

# Initialize clients
dynamo_client = DynamoClient()
lex_client = LexClient()
comprehend_client = ComprehendClient()
translate_client = TranslateClient()
bedrock_client = BedrockClient()


def lambda_handler(event: dict, context) -> dict:
    """Main handler for WebSocket events."""
    logger.info(f"Received event: {json.dumps(event)}")
    
    route_key = event.get('requestContext', {}).get('routeKey', '$default')
    connection_id = event.get('requestContext', {}).get('connectionId', '')
    
    try:
        if route_key == '$connect':
            return handle_connect(connection_id, event)
        elif route_key == '$disconnect':
            return handle_disconnect(connection_id, event)
        else:
            return handle_message(connection_id, event)
    except Exception as e:
        logger.error(f"Error handling {route_key}: {e}")
        return {'statusCode': 500, 'body': json.dumps({'error': str(e)})}


def handle_connect(connection_id: str, event: dict) -> dict:
    """Handle new WebSocket connection."""
    logger.info(f"New connection: {connection_id}")
    save_analytics_event('CONNECTION', {'action': 'connect', 'connectionId': connection_id})
    return {'statusCode': 200, 'body': 'Connected'}


def handle_disconnect(connection_id: str, event: dict) -> dict:
    """Handle WebSocket disconnection."""
    logger.info(f"Disconnection: {connection_id}")
    save_analytics_event('CONNECTION', {'action': 'disconnect', 'connectionId': connection_id})
    return {'statusCode': 200, 'body': 'Disconnected'}


def handle_message(connection_id: str, event: dict) -> dict:
    """
    Handle incoming chat message with AI-powered responses via Claude.
    """
    try:
        body = json.loads(event.get('body', '{}'))
        user_message = body.get('message', '')
        session_id = body.get('sessionId', str(uuid.uuid4()))
        user_id = body.get('userId', 'anonymous')
        preferred_language = body.get('language', 'es')
        
        if not user_message:
            return send_response(connection_id, event, {'error': 'No message provided'})
        
        logger.info(f"Processing message from {user_id}: {user_message[:50]}...")
        
        # Step 1: Detect language
        if preferred_language:
            detected_language = preferred_language
        else:
            detected_language, _ = comprehend_client.detect_language(user_message)
        
        logger.info(f"Language: {detected_language}")
        
        # Step 2: Analyze sentiment
        sentiment = comprehend_client.detect_sentiment(user_message, detected_language)
        logger.info(f"Sentiment: {sentiment['sentiment']}")
        
        # Step 3: Send to Lex for intent classification
        message_for_lex = user_message
        if detected_language != 'es':
            message_for_lex = translate_client.translate_to_spanish(user_message, detected_language)
        
        locale_id = Config.get_lex_locale(detected_language)
        lex_response = lex_client.recognize_text(
            session_id=session_id,
            text=message_for_lex,
            locale_id=locale_id,
        )
        
        intent_name = lex_response['intent_name']
        logger.info(f"Detected intent: {intent_name}")
        
        # Step 4: Get conversation history for memory
        conversation_history = dynamo_client.get_conversation_history(session_id, limit=5)
        history_text = format_conversation_history(conversation_history)
        logger.info(f"Retrieved {len(conversation_history)} messages from history")
        
        # Step 5: Build context with history
        context = build_context(intent_name, sentiment['sentiment'], detected_language, history_text)
        
        # Step 6: Generate AI response using DeepSeek
        bot_response = bedrock_client.generate_response(user_message, context)
        
        # Step 6: Save message to DynamoDB
        timestamp = datetime.now(timezone.utc).isoformat()
        ttl = int(time.time()) + Config.SESSION_TTL_SECONDS
        
        message = Message(
            session_id=session_id,
            user_id=user_id,
            user_message=user_message,
            bot_response=bot_response,
            sentiment=sentiment['sentiment'],
            language=detected_language,
            intent_name=intent_name,
            created_at=timestamp,
            ttl=ttl,
        )
        dynamo_client.save_message(message)
        
        # Log analytics
        save_analytics_event('MESSAGE', {
            'sessionId': session_id,
            'intent': intent_name,
            'sentiment': sentiment['sentiment'],
            'language': detected_language,
            'ai_model': 'claude-3-haiku',
        })
        
        # Prepare response
        response_data = {
            'type': 'message',
            'sessionId': session_id,
            'message': bot_response,
            'intent': intent_name,
            'sentiment': sentiment['sentiment'],
            'language': detected_language,
            'timestamp': timestamp,
        }
        
        return send_response(connection_id, event, response_data)
        
    except Exception as e:
        logger.error(f"Error processing message: {e}")
        return send_response(connection_id, event, {
            'type': 'error',
            'error': 'Error processing your message. Please try again.',
        })


def format_conversation_history(history) -> str:
    """Format conversation history for context."""
    if not history:
        return ""
    
    formatted = []
    # Reverse to get chronological order (oldest first)
    for msg in reversed(history):
        formatted.append(f"Usuario: {msg.user_message}")
        formatted.append(f"Asistente: {msg.bot_response}")
    
    return "\n".join(formatted)


def build_context(intent_name: str, sentiment: str, language: str, history: str = "") -> str:
    """Build context string for DeepSeek based on intent, sentiment, and history."""
    context_parts = []
    
    # Conversation history (memory)
    if history:
        context_parts.append(f"HISTORIAL DE CONVERSACION:\n{history}\n")
    
    # Intent context
    intent_hints = {
        'GreetingIntent': 'El usuario te saluda. Responde amablemente.',
        'FarewellIntent': 'El usuario se despide. Despidete cordialmente.',
        'GetHelpIntent': 'El usuario pide ayuda. Explica brevemente tus capacidades.',
        'PriceQueryIntent': 'El usuario pregunta sobre precios.',
        'ShippingQueryIntent': 'El usuario pregunta sobre envios.',
        'ReturnQueryIntent': 'El usuario pregunta sobre devoluciones.',
        'FallbackIntent': 'Intenta entender que necesita el usuario.',
    }
    if intent_name in intent_hints:
        context_parts.append(intent_hints[intent_name])
    
    # Sentiment context
    if sentiment == 'NEGATIVE':
        context_parts.append('El usuario parece frustrado. Muestra empatia.')
    elif sentiment == 'POSITIVE':
        context_parts.append('El usuario esta contento. Manten un tono positivo.')
    
    # Language
    lang_names = {'es': 'espanol', 'en': 'ingles', 'pt': 'portugues'}
    context_parts.append(f'Responde en {lang_names.get(language, "espanol")}.')
    
    return '\n'.join(context_parts)


def send_response(connection_id: str, event: dict, data: dict) -> dict:
    """Send response back to WebSocket client."""
    try:
        domain_name = event.get('requestContext', {}).get('domainName', '')
        stage = event.get('requestContext', {}).get('stage', '')
        
        if domain_name and stage:
            endpoint_url = f"https://{domain_name}/{stage}"
            
            api_client = boto3.client(
                'apigatewaymanagementapi',
                endpoint_url=endpoint_url,
            )
            
            api_client.post_to_connection(
                ConnectionId=connection_id,
                Data=json.dumps(data).encode('utf-8'),
            )
            
            logger.info(f"Sent response to {connection_id}")
        
        return {'statusCode': 200, 'body': json.dumps(data)}
        
    except Exception as e:
        logger.error(f"Error sending response: {e}")
        return {'statusCode': 500, 'body': json.dumps({'error': str(e)})}


def save_analytics_event(metric_type: str, metadata: dict) -> None:
    """Save an analytics event."""
    try:
        event = AnalyticsEvent(
            metric_type=metric_type,
            event_id=str(uuid.uuid4()),
            date=datetime.now(timezone.utc).strftime('%Y-%m-%d'),
            value=1,
            metadata=metadata,
            ttl=int(time.time()) + (30 * 24 * 60 * 60),
        )
        dynamo_client.save_analytics_event(event)
    except Exception as e:
        logger.warning(f"Failed to save analytics: {e}")
