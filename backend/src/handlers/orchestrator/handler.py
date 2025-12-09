"""
Lambda Orchestrator Handler.

This Lambda function handles WebSocket connections and messages,
orchestrating the flow between the frontend, Lex, and other services.
"""

import json
import logging
import os
import sys
import uuid
from datetime import datetime, timezone
import time

# Add shared module to path
sys.path.insert(0, '/opt/python')

import boto3

from shared.config import Config
from shared.dynamo_client import DynamoClient
from shared.lex_client import LexClient
from shared.comprehend_client import ComprehendClient
from shared.translate_client import TranslateClient
from shared.models import Message, AnalyticsEvent

# Configure logging
logger = logging.getLogger()
logger.setLevel(getattr(logging, Config.LOG_LEVEL))

# Initialize clients
dynamo_client = DynamoClient()
lex_client = LexClient()
comprehend_client = ComprehendClient()
translate_client = TranslateClient()


def lambda_handler(event: dict, context) -> dict:
    """
    Main handler for WebSocket events.
    
    Handles:
    - $connect: New WebSocket connection
    - $disconnect: WebSocket disconnection
    - $default: Default route for messages
    - sendMessage: Custom route for chat messages
    """
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
    
    # Log analytics event
    save_analytics_event('CONNECTION', {'action': 'connect', 'connectionId': connection_id})
    
    return {'statusCode': 200, 'body': 'Connected'}


def handle_disconnect(connection_id: str, event: dict) -> dict:
    """Handle WebSocket disconnection."""
    logger.info(f"Disconnection: {connection_id}")
    
    # Log analytics event
    save_analytics_event('CONNECTION', {'action': 'disconnect', 'connectionId': connection_id})
    
    return {'statusCode': 200, 'body': 'Disconnected'}


def handle_message(connection_id: str, event: dict) -> dict:
    """
    Handle incoming chat message.
    
    Flow:
    1. Parse message
    2. Detect language
    3. Translate to Spanish (for Lex) if needed
    4. Send to Lex
    5. Analyze sentiment
    6. Translate response back if needed
    7. Save message and send response
    """
    try:
        # Parse message body
        body = json.loads(event.get('body', '{}'))
        user_message = body.get('message', '')
        session_id = body.get('sessionId', str(uuid.uuid4()))
        user_id = body.get('userId', 'anonymous')
        preferred_language = body.get('language', None)  # User's preferred language
        
        if not user_message:
            return send_response(connection_id, event, {
                'error': 'No message provided',
            })
        
        logger.info(f"Processing message from {user_id}: {user_message[:50]}...")
        
        # Step 1: Detect language if not specified
        if preferred_language:
            detected_language = preferred_language
        else:
            detected_language, confidence = comprehend_client.detect_language(user_message)
        
        logger.info(f"Language: {detected_language}")
        
        # Step 2: Translate to Spanish for Lex if needed
        message_for_lex = user_message
        if detected_language != 'es':
            message_for_lex = translate_client.translate_to_spanish(user_message, detected_language)
            logger.info(f"Translated to Spanish: {message_for_lex[:50]}...")
        
        # Step 3: Send to Lex
        locale_id = Config.get_lex_locale(detected_language)
        lex_response = lex_client.recognize_text(
            session_id=session_id,
            text=message_for_lex,
            locale_id=locale_id,
        )
        
        # Extract bot response
        bot_response_es = ''
        if lex_response['messages']:
            bot_response_es = lex_response['messages'][0].get('content', '')
        
        # Step 4: Analyze sentiment
        sentiment = comprehend_client.detect_sentiment(user_message, detected_language)
        
        # Step 5: Translate response back if needed
        bot_response = bot_response_es
        if detected_language != 'es' and bot_response_es:
            bot_response = translate_client.translate_from_spanish(bot_response_es, detected_language)
        
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
            intent_name=lex_response['intent_name'],
            created_at=timestamp,
            ttl=ttl,
        )
        dynamo_client.save_message(message)
        
        # Step 7: Log analytics
        save_analytics_event('MESSAGE', {
            'sessionId': session_id,
            'intent': lex_response['intent_name'],
            'sentiment': sentiment['sentiment'],
            'language': detected_language,
        })
        
        # Prepare response
        response_data = {
            'type': 'message',
            'sessionId': session_id,
            'message': bot_response,
            'intent': lex_response['intent_name'],
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
            ttl=int(time.time()) + (30 * 24 * 60 * 60),  # 30 days
        )
        dynamo_client.save_analytics_event(event)
    except Exception as e:
        logger.warning(f"Failed to save analytics: {e}")
