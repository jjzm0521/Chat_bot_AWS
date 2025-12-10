import { useState, useEffect, useCallback, useRef } from 'react';
import { WebSocketMessage, Language } from '../types/chat.types';

// Session ID management - persists in localStorage for memory continuity
const SESSION_STORAGE_KEY = 'chatbot_session_id';

function getOrCreateSessionId(): string {
    // Try to get existing session from localStorage
    const existingSession = localStorage.getItem(SESSION_STORAGE_KEY);
    if (existingSession) {
        return existingSession;
    }
    // Create new session and store it
    const newSession = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem(SESSION_STORAGE_KEY, newSession);
    return newSession;
}

function resetSessionId(): string {
    const newSession = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem(SESSION_STORAGE_KEY, newSession);
    return newSession;
}

const WEBSOCKET_URL = import.meta.env.VITE_WEBSOCKET_URL || 'wss://your-api-id.execute-api.us-east-1.amazonaws.com/production';

interface UseWebSocketOptions {
    onMessage?: (message: WebSocketMessage) => void;
    onConnect?: () => void;
    onDisconnect?: () => void;
    onError?: (error: Event) => void;
    autoReconnect?: boolean;
    reconnectInterval?: number;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
    const {
        onMessage,
        onConnect,
        onDisconnect,
        onError,
        autoReconnect = true,
        reconnectInterval = 3000,
    } = options;

    const [isConnected, setIsConnected] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const sessionIdRef = useRef<string>(getOrCreateSessionId());

    const connect = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            return;
        }

        setConnectionStatus('connecting');

        try {
            wsRef.current = new WebSocket(WEBSOCKET_URL);

            wsRef.current.onopen = () => {
                console.log('WebSocket connected');
                setIsConnected(true);
                setConnectionStatus('connected');
                onConnect?.();
            };

            wsRef.current.onclose = () => {
                console.log('WebSocket disconnected');
                setIsConnected(false);
                setConnectionStatus('disconnected');
                onDisconnect?.();

                if (autoReconnect) {
                    reconnectTimeoutRef.current = setTimeout(() => {
                        console.log('Attempting to reconnect...');
                        connect();
                    }, reconnectInterval);
                }
            };

            wsRef.current.onerror = (error) => {
                console.error('WebSocket error:', error);
                setConnectionStatus('error');
                onError?.(error);
            };

            wsRef.current.onmessage = (event) => {
                try {
                    const data: WebSocketMessage = JSON.parse(event.data);
                    console.log('Received message:', data);
                    onMessage?.(data);
                } catch (error) {
                    console.error('Error parsing message:', error);
                }
            };
        } catch (error) {
            console.error('Error creating WebSocket:', error);
            setConnectionStatus('error');
        }
    }, [onConnect, onDisconnect, onError, onMessage, autoReconnect, reconnectInterval]);

    const disconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
        }
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
    }, []);

    const sendMessage = useCallback((
        message: string,
        userId: string = 'anonymous',
        language?: Language
    ) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            const payload = {
                action: 'sendMessage',
                message,
                sessionId: sessionIdRef.current,
                userId,
                language,
            };
            wsRef.current.send(JSON.stringify(payload));
            return true;
        }
        console.warn('WebSocket not connected');
        return false;
    }, []);

    const resetSession = useCallback(() => {
        sessionIdRef.current = resetSessionId();
    }, []);

    useEffect(() => {
        connect();
        return () => {
            disconnect();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return {
        isConnected,
        connectionStatus,
        sendMessage,
        connect,
        disconnect,
        resetSession,
        sessionId: sessionIdRef.current,
    };
}

export default useWebSocket;
