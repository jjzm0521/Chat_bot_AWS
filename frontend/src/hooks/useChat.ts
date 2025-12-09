import { useState, useCallback } from 'react';
import { Message, Language, WebSocketMessage, Sentiment } from '../types/chat.types';
import { useWebSocket } from './useWebSocket';

function generateId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

const WELCOME_MESSAGES: Record<Language, string> = {
    es: '¡Hola! Soy tu asistente virtual. ¿En qué puedo ayudarte hoy?',
    en: 'Hello! I am your virtual assistant. How can I help you today?',
    pt: 'Olá! Sou seu assistente virtual. Como posso ajudá-lo hoje?',
};

export function useChat(initialLanguage: Language = 'es') {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: generateId(),
            type: 'bot',
            content: WELCOME_MESSAGES[initialLanguage],
            timestamp: new Date(),
        },
    ]);
    const [isTyping, setIsTyping] = useState(false);
    const [language, setLanguage] = useState<Language>(initialLanguage);

    const handleWebSocketMessage = useCallback((data: WebSocketMessage) => {
        setIsTyping(false);

        if (data.type === 'message' && data.message) {
            const botMessage: Message = {
                id: generateId(),
                type: 'bot',
                content: data.message,
                timestamp: new Date(data.timestamp || Date.now()),
                sentiment: data.sentiment,
                intent: data.intent,
                language: data.language,
            };
            setMessages((prev) => [...prev, botMessage]);
        } else if (data.type === 'error') {
            const errorMessage: Message = {
                id: generateId(),
                type: 'system',
                content: data.error || 'Ocurrió un error. Por favor, intenta de nuevo.',
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorMessage]);
        }
    }, []);

    const { isConnected, connectionStatus, sendMessage: wsSendMessage, sessionId } = useWebSocket({
        onMessage: handleWebSocketMessage,
        onConnect: () => {
            console.log('Chat connected');
        },
        onDisconnect: () => {
            console.log('Chat disconnected');
        },
    });

    const sendMessage = useCallback((content: string) => {
        if (!content.trim()) return;

        // Add user message
        const userMessage: Message = {
            id: generateId(),
            type: 'user',
            content: content.trim(),
            timestamp: new Date(),
            language,
        };
        setMessages((prev) => [...prev, userMessage]);

        // Show typing indicator
        setIsTyping(true);

        // Send via WebSocket
        const sent = wsSendMessage(content.trim(), 'user', language);

        if (!sent) {
            // Simulate response if not connected (for demo)
            setTimeout(() => {
                setIsTyping(false);
                const demoResponse: Message = {
                    id: generateId(),
                    type: 'bot',
                    content: getDemoResponse(content, language),
                    timestamp: new Date(),
                    sentiment: 'NEUTRAL' as Sentiment,
                };
                setMessages((prev) => [...prev, demoResponse]);
            }, 1000);
        }
    }, [wsSendMessage, language]);

    const changeLanguage = useCallback((newLanguage: Language) => {
        setLanguage(newLanguage);

        // Add system message about language change
        const systemMessage: Message = {
            id: generateId(),
            type: 'system',
            content: getLanguageChangeMessage(newLanguage),
            timestamp: new Date(),
        };
        setMessages((prev) => [...prev, systemMessage]);
    }, []);

    const clearMessages = useCallback(() => {
        setMessages([
            {
                id: generateId(),
                type: 'bot',
                content: WELCOME_MESSAGES[language],
                timestamp: new Date(),
            },
        ]);
    }, [language]);

    return {
        messages,
        isTyping,
        isConnected,
        connectionStatus,
        language,
        sessionId,
        sendMessage,
        changeLanguage,
        clearMessages,
    };
}

function getDemoResponse(input: string, language: Language): string {
    const lowerInput = input.toLowerCase();

    const responses: Record<Language, Record<string, string>> = {
        es: {
            greeting: '¡Hola! Es un placer saludarte. ¿Cómo puedo ayudarte hoy?',
            help: 'Puedo ayudarte con información sobre precios, envíos, devoluciones, garantías y más. ¿Qué necesitas saber?',
            default: 'Gracias por tu mensaje. Puedo ayudarte con consultas sobre productos, precios, envíos y más.',
        },
        en: {
            greeting: 'Hello! It is a pleasure to meet you. How can I help you today?',
            help: 'I can help you with information about prices, shipping, returns, warranties and more. What do you need to know?',
            default: 'Thank you for your message. I can help you with inquiries about products, prices, shipping and more.',
        },
        pt: {
            greeting: 'Olá! É um prazer conhecê-lo. Como posso ajudá-lo hoje?',
            help: 'Posso ajudá-lo com informações sobre preços, envio, devoluções, garantias e mais. O que você precisa saber?',
            default: 'Obrigado pela sua mensagem. Posso ajudá-lo com perguntas sobre produtos, preços, envio e mais.',
        },
    };

    const langResponses = responses[language];

    if (/hola|hi|hello|oi|olá/.test(lowerInput)) {
        return langResponses.greeting;
    }
    if (/ayuda|help|ajuda/.test(lowerInput)) {
        return langResponses.help;
    }
    return langResponses.default;
}

function getLanguageChangeMessage(language: Language): string {
    const messages: Record<Language, string> = {
        es: '🌐 Idioma cambiado a Español',
        en: '🌐 Language changed to English',
        pt: '🌐 Idioma alterado para Português',
    };
    return messages[language];
}

export default useChat;
