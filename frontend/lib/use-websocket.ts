'use client';
import { useEffect, useRef, useCallback } from 'react';
import { WSEvent } from '@/lib/types';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';

export function useWebSocket(
  onMessage: (event: WSEvent) => void,
  room = 'global'
) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const connect = useCallback(() => {
    try {
      const ws = new WebSocket(`${WS_URL}/ws/${room}`);
      wsRef.current = ws;

      ws.onopen = () => console.log(`🔌 WebSocket connected to room: ${room}`);

      ws.onmessage = (event) => {
        try {
          const data: WSEvent = JSON.parse(event.data);
          onMessage(data);
        } catch {
          // ignore parse errors
        }
      };

      ws.onclose = () => {
        console.log('WebSocket closed, reconnecting in 3s...');
        reconnectTimerRef.current = setTimeout(connect, 3000);
      };

      ws.onerror = () => ws.close();
    } catch (e) {
      console.warn('WebSocket not available:', e);
    }
  }, [room, onMessage]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return wsRef;
}
