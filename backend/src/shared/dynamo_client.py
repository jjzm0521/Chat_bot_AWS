"""
DynamoDB client for Chatbot operations.
"""

import boto3
from boto3.dynamodb.conditions import Key
from typing import Dict, List, Any, Optional
import logging

from .config import Config
from .models import Message, FAQItem, AnalyticsEvent

logger = logging.getLogger(__name__)


class DynamoClient:
    """Client for DynamoDB operations."""
    
    def __init__(self):
        self.dynamodb = boto3.resource('dynamodb', region_name=Config.AWS_REGION)
        self.conversations_table = self.dynamodb.Table(Config.CONVERSATIONS_TABLE)
        self.knowledge_base_table = self.dynamodb.Table(Config.KNOWLEDGE_BASE_TABLE)
        self.analytics_table = self.dynamodb.Table(Config.ANALYTICS_TABLE)
    
    # Conversations operations
    def save_message(self, message: Message) -> None:
        """Save a message to conversations table."""
        try:
            self.conversations_table.put_item(Item=message.to_dynamo_item())
            logger.info(f"Saved message for session {message.session_id}")
        except Exception as e:
            logger.error(f"Error saving message: {e}")
            raise
    
    def get_conversation_history(
        self, 
        session_id: str, 
        limit: int = 10
    ) -> List[Message]:
        """Get recent messages for a session."""
        try:
            response = self.conversations_table.query(
                KeyConditionExpression=Key('PK').eq(f'SESSION#{session_id}'),
                ScanIndexForward=False,  # Most recent first
                Limit=limit,
            )
            return [Message.from_dynamo_item(item) for item in response.get('Items', [])]
        except Exception as e:
            logger.error(f"Error getting conversation history: {e}")
            return []
    
    # Knowledge Base operations
    def get_faq_by_topic(self, category: str, topic_id: str) -> Optional[FAQItem]:
        """Get a specific FAQ item."""
        try:
            response = self.knowledge_base_table.get_item(
                Key={
                    'PK': f'FAQ#{category}',
                    'SK': f'TOPIC#{topic_id}',
                }
            )
            item = response.get('Item')
            return FAQItem.from_dynamo_item(item) if item else None
        except Exception as e:
            logger.error(f"Error getting FAQ: {e}")
            return None
    
    def search_faqs_by_category(self, category: str) -> List[FAQItem]:
        """Get all FAQs in a category."""
        try:
            response = self.knowledge_base_table.query(
                KeyConditionExpression=Key('PK').eq(f'FAQ#{category}'),
            )
            return [FAQItem.from_dynamo_item(item) for item in response.get('Items', [])]
        except Exception as e:
            logger.error(f"Error searching FAQs: {e}")
            return []
    
    def search_faqs_by_keyword(self, keyword: str) -> List[FAQItem]:
        """Search FAQs containing a keyword."""
        try:
            # Scan with filter - for small knowledge bases
            # For larger ones, consider using OpenSearch
            response = self.knowledge_base_table.scan(
                FilterExpression='contains(keywords, :kw)',
                ExpressionAttributeValues={':kw': keyword.lower()},
            )
            return [FAQItem.from_dynamo_item(item) for item in response.get('Items', [])]
        except Exception as e:
            logger.error(f"Error searching FAQs by keyword: {e}")
            return []
    
    # Analytics operations
    def save_analytics_event(self, event: AnalyticsEvent) -> None:
        """Save an analytics event."""
        try:
            self.analytics_table.put_item(Item=event.to_dynamo_item())
            logger.info(f"Saved analytics event: {event.metric_type}")
        except Exception as e:
            logger.error(f"Error saving analytics event: {e}")
            raise
    
    def get_analytics_by_type(
        self, 
        metric_type: str, 
        start_date: str, 
        end_date: str
    ) -> List[Dict[str, Any]]:
        """Get analytics events by type and date range."""
        try:
            response = self.analytics_table.query(
                IndexName='DateIndex',
                KeyConditionExpression=(
                    Key('metricType').eq(metric_type) & 
                    Key('date').between(start_date, end_date)
                ),
            )
            return response.get('Items', [])
        except Exception as e:
            logger.error(f"Error getting analytics: {e}")
            return []
