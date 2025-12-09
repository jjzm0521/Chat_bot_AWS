"""
Lambda Fulfillment Handler for Amazon Lex.

This Lambda function is invoked by Lex to fulfill intents,
query the knowledge base, and provide dynamic responses.
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

from shared.config import Config
from shared.dynamo_client import DynamoClient
from shared.comprehend_client import ComprehendClient
from shared.bedrock_client import BedrockClient
from shared.models import AnalyticsEvent

# Configure logging
logger = logging.getLogger()
logger.setLevel(getattr(logging, Config.LOG_LEVEL))

# Initialize clients
dynamo_client = DynamoClient()
comprehend_client = ComprehendClient()
bedrock_client = BedrockClient()


def lambda_handler(event: dict, context) -> dict:
    """
    Lex Fulfillment handler.
    
    This function is called by Lex when an intent requires fulfillment.
    It processes the intent and returns the appropriate response.
    """
    logger.info(f"Fulfillment event: {json.dumps(event)}")
    
    try:
        intent_name = event['sessionState']['intent']['name']
        slots = event['sessionState']['intent'].get('slots', {})
        session_id = event['sessionId']
        input_transcript = event.get('inputTranscript', '')
        
        # Detect locale from event
        locale_id = event.get('bot', {}).get('localeId', 'es_ES')
        language = locale_id.split('_')[0]  # es, en, pt
        
        logger.info(f"Processing intent: {intent_name} for session {session_id}")
        
        # Route to appropriate handler
        if intent_name == 'FAQQueryIntent':
            return handle_faq_query(event, slots, language)
        elif intent_name == 'FeedbackIntent':
            return handle_feedback(event, slots, language, session_id)
        elif intent_name == 'FallbackIntent':
            return handle_fallback(event, input_transcript, language)
        else:
            # For other intents, let Lex handle with default responses
            return close_intent(event, 'Fulfilled')
            
    except Exception as e:
        logger.error(f"Error in fulfillment: {e}")
        return build_error_response(event)


def handle_faq_query(event: dict, slots: dict, language: str) -> dict:
    """
    Handle FAQ query intent.
    
    Searches the knowledge base for the requested topic.
    """
    topic_slot = slots.get('topic', {})
    topic = None
    
    if topic_slot and topic_slot.get('value'):
        topic = topic_slot['value'].get('interpretedValue', '').lower()
    
    if not topic:
        return elicit_slot(
            event, 
            'topic',
            get_message(language, 'ask_topic')
        )
    
    logger.info(f"Searching FAQ for topic: {topic}")
    
    # Search in knowledge base
    faqs = dynamo_client.search_faqs_by_keyword(topic)
    
    if faqs:
        # Return the first matching FAQ
        faq = faqs[0]
        answer = faq.get_answer(language)
        
        # Log analytics
        save_analytics_event('FAQ_QUERY', {
            'topic': topic,
            'found': True,
            'category': faq.category,
        })
        
        return close_intent(event, 'Fulfilled', answer)
    else:
        # No FAQ found, try to provide helpful response
        not_found_msg = get_message(language, 'faq_not_found').format(topic=topic)
        
        save_analytics_event('FAQ_QUERY', {
            'topic': topic,
            'found': False,
        })
        
        return close_intent(event, 'Fulfilled', not_found_msg)


def handle_feedback(event: dict, slots: dict, language: str, session_id: str) -> dict:
    """
    Handle feedback intent.
    
    Saves user rating and thanks them.
    """
    rating_slot = slots.get('rating', {})
    rating = None
    
    if rating_slot and rating_slot.get('value'):
        rating = rating_slot['value'].get('interpretedValue', '')
    
    if not rating:
        return elicit_slot(
            event,
            'rating',
            get_message(language, 'ask_rating')
        )
    
    # Validate rating
    try:
        rating_value = int(rating)
        if rating_value < 1 or rating_value > 5:
            raise ValueError("Rating out of range")
    except ValueError:
        return elicit_slot(
            event,
            'rating',
            get_message(language, 'invalid_rating')
        )
    
    # Save feedback
    save_analytics_event('FEEDBACK', {
        'sessionId': session_id,
        'rating': rating_value,
    })
    
    # Thank the user
    thanks_msg = get_message(language, 'feedback_thanks')
    
    return close_intent(event, 'Fulfilled', thanks_msg)


def handle_fallback(event: dict, input_text: str, language: str) -> dict:
    """
    Handle fallback intent with intelligent response using Bedrock.
    
    Uses Generative AI to provide helpful responses when no specific intent is matched.
    """
    logger.info(f"Fallback triggered for: {input_text}")
    
    # Log analytics
    save_analytics_event('FALLBACK', {
        'input': input_text,
    })
    
    # Use Bedrock to generate response
    try:
        # Fetch conversation history for context
        history_context = ""
        try:
            # Get last 5 messages
            history = dynamo_client.get_conversation_history(session_id, limit=5)
            # Reverse to have oldest first
            history.reverse()
            
            if history:
                history_text = []
                for msg in history:
                    if msg.user_message:
                        history_text.append(f"User: {msg.user_message}")
                    if msg.bot_response:
                        history_text.append(f"Assistant: {msg.bot_response}")
                
                history_context = "\n".join(history_text)
                logger.info(f"Retrieved {len(history)} messages for context")
        except Exception as h_e:
            logger.warning(f"Failed to retrieve history: {h_e}")

        # Construct context
        context = f"The user is speaking in {language}."
        if history_context:
            context += f"\n\nConversation History:\n{history_context}"
        
        # Add some basic info about the business/bot if we want the AI to be aware
        # context += " You are a helpful assistant for an e-commerce store."
        
        ai_response = bedrock_client.generate_response(input_text, context)
        return close_intent(event, 'Fulfilled', ai_response)
        
    except Exception as e:
        logger.error(f"Error using Bedrock in fallback: {e}")
        # Default fallback if AI fails
        return close_intent(event, 'Fulfilled', get_message(language, 'fallback_default'))


# Response builders

def close_intent(event: dict, state: str, message: str = None) -> dict:
    """Close the intent with a response."""
    response = {
        'sessionState': {
            'dialogAction': {
                'type': 'Close',
            },
            'intent': {
                'name': event['sessionState']['intent']['name'],
                'state': state,
            },
        },
    }
    
    if message:
        response['messages'] = [
            {
                'contentType': 'PlainText',
                'content': message,
            }
        ]
    
    return response


def elicit_slot(event: dict, slot_name: str, message: str) -> dict:
    """Request a specific slot from the user."""
    return {
        'sessionState': {
            'dialogAction': {
                'type': 'ElicitSlot',
                'slotToElicit': slot_name,
            },
            'intent': {
                'name': event['sessionState']['intent']['name'],
                'slots': event['sessionState']['intent'].get('slots', {}),
                'state': 'InProgress',
            },
        },
        'messages': [
            {
                'contentType': 'PlainText',
                'content': message,
            }
        ],
    }


def build_error_response(event: dict) -> dict:
    """Build an error response."""
    return {
        'sessionState': {
            'dialogAction': {
                'type': 'Close',
            },
            'intent': {
                'name': event['sessionState']['intent']['name'],
                'state': 'Failed',
            },
        },
        'messages': [
            {
                'contentType': 'PlainText',
                'content': 'Lo siento, ocurrió un error. Por favor, intenta de nuevo.',
            }
        ],
    }


# Localized messages

MESSAGES = {
    'es': {
        'ask_topic': '¿Sobre qué tema te gustaría obtener información?',
        'faq_not_found': 'No encontré información específica sobre "{topic}". ¿Podrías ser más específico o preguntar sobre otro tema?',
        'ask_rating': '¿Cómo calificarías tu experiencia del 1 al 5?',
        'invalid_rating': 'Por favor, proporciona una calificación del 1 al 5.',
        'feedback_thanks': '¡Muchas gracias por tu retroalimentación! Tu opinión nos ayuda a mejorar.',
        'fallback_default': 'No logré entender tu pregunta. Puedo ayudarte con información sobre precios, envíos, devoluciones, garantías y más. ¿Sobre qué te gustaría saber?',
        'fallback_suggestions': 'No estoy seguro de entender, pero quizás te interese:\n{suggestions}',
    },
    'en': {
        'ask_topic': 'What topic would you like information about?',
        'faq_not_found': 'I could not find specific information about "{topic}". Could you be more specific or ask about another topic?',
        'ask_rating': 'How would you rate your experience from 1 to 5?',
        'invalid_rating': 'Please provide a rating from 1 to 5.',
        'feedback_thanks': 'Thank you so much for your feedback! Your opinion helps us improve.',
        'fallback_default': 'I could not understand your question. I can help you with information about prices, shipping, returns, warranties and more. What would you like to know?',
        'fallback_suggestions': 'I am not sure I understand, but you might be interested in:\n{suggestions}',
    },
    'pt': {
        'ask_topic': 'Sobre qual tema você gostaria de obter informações?',
        'faq_not_found': 'Não encontrei informações específicas sobre "{topic}". Poderia ser mais específico ou perguntar sobre outro tema?',
        'ask_rating': 'Como você classificaria sua experiência de 1 a 5?',
        'invalid_rating': 'Por favor, forneça uma classificação de 1 a 5.',
        'feedback_thanks': 'Muito obrigado pelo seu feedback! Sua opinião nos ajuda a melhorar.',
        'fallback_default': 'Não consegui entender sua pergunta. Posso ajudá-lo com informações sobre preços, envios, devoluções, garantias e mais. Sobre o que você gostaria de saber?',
        'fallback_suggestions': 'Não tenho certeza se entendi, mas talvez você se interesse por:\n{suggestions}',
    },
}


def get_message(language: str, key: str) -> str:
    """Get localized message."""
    return MESSAGES.get(language, MESSAGES['es']).get(key, MESSAGES['es'][key])


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
