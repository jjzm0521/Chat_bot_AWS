import { Message } from '../types/chat.types';
import '../styles/MessageBubble.css';

interface MessageBubbleProps {
    message: Message;
}

function MessageBubble({ message }: MessageBubbleProps) {
    const { type, content, timestamp, sentiment, intent } = message;

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const getSentimentEmoji = (sentiment?: string) => {
        switch (sentiment) {
            case 'POSITIVE': return '😊';
            case 'NEGATIVE': return '😔';
            case 'MIXED': return '🤔';
            default: return '';
        }
    };

    return (
        <div className={`message-bubble ${type}`}>
            {type === 'bot' && (
                <div className="message-avatar">🤖</div>
            )}
            <div className="message-content-wrapper">
                <div className="message-content">
                    {content}
                </div>
                <div className="message-meta">
                    <span className="message-time">{formatTime(timestamp)}</span>
                    {sentiment && (
                        <span className="message-sentiment" title={`Sentimiento: ${sentiment}`}>
                            {getSentimentEmoji(sentiment)}
                        </span>
                    )}
                    {intent && intent !== 'FallbackIntent' && (
                        <span className="message-intent" title={`Intent: ${intent}`}>
                            📌
                        </span>
                    )}
                </div>
            </div>
            {type === 'user' && (
                <div className="message-avatar user-avatar">👤</div>
            )}
        </div>
    );
}

export default MessageBubble;
