import { io } from "socket.io-client";

export type SocketEventHandler = (data: { code: string; message: string }) => void;

interface SocketServiceConfig {
  origin: string;
  onSessionReplaced: SocketEventHandler;
}

class SocketService {
  private listeners = new Map<string, Set<(data: any) => void>>();

  subscribe(event: string, callback: (data: any) => void) {
    const callbacks = this.listeners.get(event) || new Set();
    callbacks.add(callback);
    this.listeners.set(event, callbacks);
    this.socket?.on(event, callback);
    return () => {
      callbacks.delete(callback);
      this.socket?.off(event, callback);
    };
  }

  on(event: string, callback: (data: any) => void) {
    const callbacks = this.listeners.get(event) || new Set();
    callbacks.add(callback);
    this.listeners.set(event, callbacks);
    this.socket?.on(event, callback);
  }

  off(event: string, callback: (data: any) => void) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback);
      this.socket?.off(event, callback);
    }
  }

  private socket: any = null;
  private currentToken: string | null = null;
  private origin: string = "";
  private onSessionReplaced: SocketEventHandler = () => {};

  configure(config: SocketServiceConfig) {
    this.origin = config.origin;
    this.onSessionReplaced = config.onSessionReplaced;
  }

  /**
   * Connect (or re-connect) the socket with a new access token.
   * If the same token is already connected this is a no-op.
   * The server's JWT middleware will place this socket into
   * `session:<sid>` so `auth:session-replaced` events are routed here.
   */
  connect(accessToken: string) {
    const rawOrigin = this.origin || process.env.EXPO_PUBLIC_API_URL?.trim() || "";
    if (!rawOrigin || !accessToken) return;
    const cleanOrigin = rawOrigin.replace(/\/+$/, "");
    if (this.socket?.connected && this.currentToken === accessToken) return;
    this.disconnect();
    this.currentToken = accessToken;
    try {
      this.socket = io(cleanOrigin, {
        auth: { token: accessToken },
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
        upgrade: false,
      });

      this.listeners.forEach((callbacks, event) =>
        callbacks.forEach((callback) => this.socket?.on(event, callback))
      );

      this.socket.on("auth:session-replaced", (data: { code: string; message: string }) => {
        this.onSessionReplaced(data);
        // Forcefully disconnect – the session is no longer valid.
        this.disconnect(true);
      });

      // Silently suppress connection errors.
      // HTTP-level errors already surface in the app UI.
      this.socket.on("connect_error", () => {});
    } catch {
      // Ignored in test/unsupported environments
    }
  }

  /** Disconnect and clean up. Call on logout or token invalidation. */
  disconnect(clearListeners = false) {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    if (clearListeners) {
      this.listeners.clear();
    }
    this.currentToken = null;
  }

  get isConnected() {
    return this.socket?.connected ?? false;
  }
}

export const socketService = new SocketService();
