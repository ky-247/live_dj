import { io, Socket } from 'socket.io-client';

/**
 * Shared singleton Socket.io client instance.
 * Reusing this single socket instance across all pages prevents duplicate
 * connection handshakes and listener leaks during route transitions and re-renders.
 */
export const socket: Socket = io({
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
});

/**
 * Generates or retrieves a persistent client identifier for anti-spam rate limiting.
 */
export function getOrCreateClientId(): string {
  try {
    let id = localStorage.getItem('desibeats_client_id');
    if (!id) {
      id = 'client_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
      localStorage.setItem('desibeats_client_id', id);
    }
    return id;
  } catch {
    return 'client_fallback';
  }
}
