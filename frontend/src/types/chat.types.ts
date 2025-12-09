/**
 * Chat types for the chatbot application.
 */

export interface Message {
    id: string;
    type: 'user' | 'bot' | 'system';
    content: string;
    timestamp: Date;
    sentiment?: Sentiment;
    intent?: string;
    language?: string;
}

export type Sentiment = 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'MIXED';

export type Language = 'es' | 'en' | 'pt';

export interface LanguageOption {
    code: Language;
    name: string;
    flag: string;
}

export const LANGUAGES: LanguageOption[] = [
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'pt', name: 'Português', flag: '🇧🇷' },
];

export interface WebSocketMessage {
    type: 'message' | 'error' | 'connected' | 'disconnected';
    sessionId?: string;
    message?: string;
    intent?: string;
    sentiment?: Sentiment;
    language?: string;
    timestamp?: string;
    error?: string;
}

export interface ChatState {
    messages: Message[];
    isConnected: boolean;
    isTyping: boolean;
    sessionId: string;
    language: Language;
}
