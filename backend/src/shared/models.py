"""
Data models for Chatbot.
"""

from dataclasses import dataclass, asdict
from datetime import datetime
from typing import Optional, List, Dict, Any


@dataclass
class Message:
    """Represents a chat message."""
    session_id: str
    user_id: str
    user_message: str
    bot_response: str
    sentiment: str
    language: str
    intent_name: str
    created_at: str
    ttl: int
    
    def to_dynamo_item(self) -> Dict[str, Any]:
        """Convert to DynamoDB item format."""
        timestamp = self.created_at
        return {
            'PK': f'SESSION#{self.session_id}',
            'SK': f'MSG#{timestamp}',
            'userId': self.user_id,
            'userMessage': self.user_message,
            'botResponse': self.bot_response,
            'sentiment': self.sentiment,
            'language': self.language,
            'intentName': self.intent_name,
            'createdAt': self.created_at,
            'TTL': self.ttl,
        }
    
    @classmethod
    def from_dynamo_item(cls, item: Dict[str, Any]) -> 'Message':
        """Create from DynamoDB item."""
        return cls(
            session_id=item['PK'].replace('SESSION#', ''),
            user_id=item['userId'],
            user_message=item['userMessage'],
            bot_response=item['botResponse'],
            sentiment=item['sentiment'],
            language=item['language'],
            intent_name=item['intentName'],
            created_at=item['createdAt'],
            ttl=item['TTL'],
        )


@dataclass
class Conversation:
    """Represents a conversation session."""
    session_id: str
    user_id: str
    language: str
    messages: List[Message]
    started_at: str
    last_activity: str
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return asdict(self)


@dataclass
class FAQItem:
    """Represents a FAQ item in the knowledge base."""
    category: str
    topic_id: str
    question_es: str
    question_en: str
    question_pt: str
    answer_es: str
    answer_en: str
    answer_pt: str
    keywords: List[str]
    
    def to_dynamo_item(self) -> Dict[str, Any]:
        """Convert to DynamoDB item format."""
        return {
            'PK': f'FAQ#{self.category}',
            'SK': f'TOPIC#{self.topic_id}',
            'category': self.category,
            'question_es': self.question_es,
            'question_en': self.question_en,
            'question_pt': self.question_pt,
            'answer_es': self.answer_es,
            'answer_en': self.answer_en,
            'answer_pt': self.answer_pt,
            'keywords': self.keywords,
        }
    
    def get_answer(self, language: str) -> str:
        """Get answer in the specified language."""
        answers = {
            'es': self.answer_es,
            'en': self.answer_en,
            'pt': self.answer_pt,
        }
        return answers.get(language, self.answer_es)
    
    @classmethod
    def from_dynamo_item(cls, item: Dict[str, Any]) -> 'FAQItem':
        """Create from DynamoDB item."""
        return cls(
            category=item['category'],
            topic_id=item['SK'].replace('TOPIC#', ''),
            question_es=item.get('question_es', ''),
            question_en=item.get('question_en', ''),
            question_pt=item.get('question_pt', ''),
            answer_es=item.get('answer_es', ''),
            answer_en=item.get('answer_en', ''),
            answer_pt=item.get('answer_pt', ''),
            keywords=item.get('keywords', []),
        )


@dataclass
class AnalyticsEvent:
    """Represents an analytics event."""
    metric_type: str
    event_id: str
    date: str
    value: Any
    metadata: Dict[str, Any]
    ttl: int
    
    def to_dynamo_item(self) -> Dict[str, Any]:
        """Convert to DynamoDB item format."""
        return {
            'PK': f'METRIC#{self.metric_type}',
            'SK': f'EVENT#{self.event_id}',
            'metricType': self.metric_type,
            'date': self.date,
            'value': self.value,
            'metadata': self.metadata,
            'TTL': self.ttl,
        }
