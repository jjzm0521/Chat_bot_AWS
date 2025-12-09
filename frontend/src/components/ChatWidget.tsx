import { useState, useRef, useEffect } from 'react';
import { useChat } from '../hooks/useChat';
import { Language } from '../types/chat.types';
import MessageBubble from './MessageBubble';
import LanguageSelector from './LanguageSelector';
import SentimentIndicator from './SentimentIndicator';
import '../styles/ChatWidget.css';

interface ChatWidgetProps {
    isOpen: boolean;
    onClose: () => void;
}

function ChatWidget({ isOpen, onClose }: ChatWidgetProps) {
    const [inputValue, setInputValue] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const {
        messages,
        isTyping,
        isConnected,
        connectionStatus,
        language,
        sendMessage,
        changeLanguage,
        clearMessages,
    } = useChat('es');

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping]);

    // Focus input when chat opens
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (inputValue.trim()) {
            sendMessage(inputValue);
            setInputValue('');
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        }
    };

    // Get last bot message sentiment for indicator
    const lastBotMessage = [...messages].reverse().find(m => m.type === 'bot');
    const currentSentiment = lastBotMessage?.sentiment;

    if (!isOpen) return null;

    return (
        <div className="chat-widget">
            {/* Header */}
            <div className="chat-header">
                <div className="chat-header-left">
                    <div className="chat-avatar">
                        <span>🤖</span>
                    </div>
                    <div className="chat-header-info">
                        <h3>Asistente Virtual</h3>
                        <span className={`connection-status ${connectionStatus}`}>
                            {connectionStatus === 'connected' ? '● Conectado' :
                                connectionStatus === 'connecting' ? '○ Conectando...' :
                                    '○ Desconectado'}
                        </span>
                    </div>
                </div>
                <div className="chat-header-right">
                    <LanguageSelector
                        currentLanguage={language}
                        onLanguageChange={changeLanguage}
                    />
                    <button
                        className="chat-header-btn"
                        onClick={clearMessages}
                        title="Limpiar chat"
                    >
                        🗑️
                    </button>
                    <button
                        className="chat-header-btn close-btn"
                        onClick={onClose}
                        title="Cerrar"
                    >
                        ✕
                    </button>
                </div>
            </div>

            {/* Sentiment Indicator */}
            {currentSentiment && (
                <SentimentIndicator sentiment={currentSentiment} />
            )}

            {/* Messages */}
            <div className="chat-messages">
                {messages.map((message) => (
                    <MessageBubble key={message.id} message={message} />
                ))}

                {/* Typing indicator */}
                {isTyping && (
                    <div className="typing-indicator">
                        <div className="typing-dot"></div>
                        <div className="typing-dot"></div>
                        <div className="typing-dot"></div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form className="chat-input-form" onSubmit={handleSubmit}>
                <input
                    ref={inputRef}
                    type="text"
                    className="chat-input"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={getPlaceholder(language)}
                    disabled={!isConnected && connectionStatus !== 'disconnected'}
                />
                <button
                    type="submit"
                    className="send-button"
                    disabled={!inputValue.trim()}
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                    </svg>
                </button>
            </form>

            {/* Quick Actions */}
            <div className="quick-actions">
                {getQuickActions(language).map((action, index) => (
                    <button
                        key={index}
                        className="quick-action-btn"
                        onClick={() => {
                            setInputValue(action);
                            inputRef.current?.focus();
                        }}
                    >
                        {action}
                    </button>
                ))}
            </div>
        </div>
    );
}

function getPlaceholder(language: Language): string {
    const placeholders: Record<Language, string> = {
        es: 'Escribe tu mensaje...',
        en: 'Type your message...',
        pt: 'Digite sua mensagem...',
    };
    return placeholders[language];
}

function getQuickActions(language: Language): string[] {
    const actions: Record<Language, string[]> = {
        es: ['👋 Hola', '❓ Ayuda', '📦 Envíos', '💰 Precios'],
        en: ['👋 Hello', '❓ Help', '📦 Shipping', '💰 Prices'],
        pt: ['👋 Olá', '❓ Ajuda', '📦 Envio', '💰 Preços'],
    };
    return actions[language];
}

export default ChatWidget;
