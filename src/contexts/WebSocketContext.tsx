/**
 * WebSocketContext — real-time connection to the Survai backend.
 *
 * Provides subscribe/unsubscribe per room, auto-reconnect with
 * exponential backoff (3s initial, 5 max attempts).
 */

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

export interface WebSocketMessage {
  event: string;
  data: Record<string, unknown>;
  timestamp?: string;
}

export type MessageHandler = (message: WebSocketMessage) => void;

interface WebSocketContextValue {
  isConnected: boolean;
  subscribe: (room: string, handler: MessageHandler) => void;
  unsubscribe: (room: string) => void;
}

// ── Constants ────────────────────────────────────────────────────────────────

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws';
const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_ATTEMPTS = 5;

// ── Context ──────────────────────────────────────────────────────────────────

const WebSocketContext = createContext<WebSocketContextValue | undefined>(undefined);

// ── Provider ─────────────────────────────────────────────────────────────────

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roomHandlersRef = useRef<Map<string, MessageHandler>>(new Map());

  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    cleanup();

    const token = localStorage.getItem('survai_access_token');
    const url = token ? `${WS_URL}?token=${token}` : WS_URL;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      reconnectAttemptsRef.current = 0;

      // Re-subscribe to rooms
      roomHandlersRef.current.forEach((_handler, room) => {
        ws.send(JSON.stringify({ action: 'subscribe', room }));
      });
    };

    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        // Dispatch to all handlers
        roomHandlersRef.current.forEach((handler) => {
          try {
            handler(message);
          } catch (err) {
            console.error('WebSocket handler error:', err);
          }
        });
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = (event) => {
      setIsConnected(false);

      // Reconnect with exponential backoff (skip if intentional close)
      if (event.code !== 1000 && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttemptsRef.current++;
        const delay = RECONNECT_DELAY_MS * Math.pow(2, reconnectAttemptsRef.current - 1);
        console.log(
          `WebSocket reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`
        );
        reconnectTimeoutRef.current = setTimeout(connect, delay);
      }
    };
  }, [cleanup]);

  // Connect on mount
  useEffect(() => {
    connect();
    return cleanup;
  }, [connect, cleanup]);

  const subscribe = useCallback(
    (room: string, handler: MessageHandler) => {
      roomHandlersRef.current.set(room, handler);
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ action: 'subscribe', room }));
      }
    },
    []
  );

  const unsubscribe = useCallback(
    (room: string) => {
      roomHandlersRef.current.delete(room);
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ action: 'unsubscribe', room }));
      }
    },
    []
  );

  const value: WebSocketContextValue = { isConnected, subscribe, unsubscribe };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useWebSocket(): WebSocketContextValue {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
}
