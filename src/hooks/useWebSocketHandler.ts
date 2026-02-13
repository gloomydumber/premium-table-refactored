import { useEffect, useRef } from 'react';
import useWebSocket from 'react-use-websocket';

/**
 * Low-level WebSocket hook wrapper.
 * Connects, optionally sends a subscribe message, and routes every message
 * to processMessage.
 */
export function useWebSocketHandler(
  url: string,
  processMessage: (data: unknown) => void,
  subscribe?: (sendMessage: (message: string) => void) => void,
  heartbeat?: { message: string; interval: number },
) {
  const processMessageRef = useRef(processMessage);
  processMessageRef.current = processMessage;

  const subscribeRef = useRef(subscribe);
  subscribeRef.current = subscribe;

  const { sendMessage, lastMessage, readyState } = useWebSocket(url, {
    shouldReconnect: () => true,
    reconnectAttempts: 10,
    reconnectInterval: 3000,
    ...(heartbeat && {
      heartbeat: {
        message: heartbeat.message,
        interval: heartbeat.interval,
        timeout: 60000,
      },
    }),
  });

  // Send subscription message on connect and when subscribe callback changes
  // (e.g., when dynamic tickers arrive and tickers list expands)
  useEffect(() => {
    if (readyState === 1 && subscribeRef.current) {
      subscribeRef.current(sendMessage);
    }
  }, [readyState, sendMessage, subscribe]);

  // Process incoming messages
  useEffect(() => {
    if (lastMessage !== null) {
      try {
        processMessageRef.current(lastMessage);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    }
  }, [lastMessage]);

  return { sendMessage, readyState };
}
