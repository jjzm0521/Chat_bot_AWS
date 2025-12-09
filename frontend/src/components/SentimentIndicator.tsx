import { Sentiment } from '../types/chat.types';
import '../styles/SentimentIndicator.css';

interface SentimentIndicatorProps {
    sentiment: Sentiment;
}

const SENTIMENT_CONFIG: Record<Sentiment, { emoji: string; label: string; color: string }> = {
    POSITIVE: { emoji: '😊', label: 'Positivo', color: '#10b981' },
    NEGATIVE: { emoji: '😔', label: 'Negativo', color: '#ef4444' },
    NEUTRAL: { emoji: '😐', label: 'Neutral', color: '#6b7280' },
    MIXED: { emoji: '🤔', label: 'Mixto', color: '#f59e0b' },
};

function SentimentIndicator({ sentiment }: SentimentIndicatorProps) {
    const config = SENTIMENT_CONFIG[sentiment];

    return (
        <div
            className="sentiment-indicator"
            style={{ '--sentiment-color': config.color } as React.CSSProperties}
        >
            <span className="sentiment-emoji">{config.emoji}</span>
            <span className="sentiment-label">Sentimiento: {config.label}</span>
            <div className="sentiment-bar">
                <div
                    className="sentiment-fill"
                    style={{ backgroundColor: config.color }}
                />
            </div>
        </div>
    );
}

export default SentimentIndicator;
