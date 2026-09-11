// Safe import for React Native Metro bundler
let io: any;
try {
  const socketModule = require("socket.io-client");
  io = typeof socketModule === "function" ? socketModule : socketModule?.io || socketModule?.default || socketModule;
} catch {
  try {
    const socketDist = require("socket.io-client/dist/socket.io.js");
    io = typeof socketDist === "function" ? socketDist : socketDist?.io || socketDist;
  } catch {
    io = () => ({ on: () => {}, connect: () => {}, disconnect: () => {}, removeAllListeners: () => {} });
  }
}

export type SocketEventHandler = (data: { code: string; message: string }) => void;

interface SocketServiceConfig {
  origin: string;
  onSessionReplaced: SocketEventHandler;
}

class SocketService {
  private socket: any = null;
  private currentToken: string | null = null;
  private origin: string = "";
  private onSessionReplaced: SocketEventHandler = () => {};
  private listeners: Map<string, Set<Function>> = new Map();

  configure(config: SocketServiceConfig) {
    this.origin = config.origin;
    this.onSessionReplaced = config.onSessionReplaced;
  }

  /**
   * Đăng ký lắng nghe sự kiện WebSocket thời gian thực
   */
  on(event: string, callback: (...args: any[]) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  /**
   * Hủy lắng nghe sự kiện WebSocket
   */
  off(event: string, callback: (...args: any[]) => void) {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(callback);
      if (set.size === 0) this.listeners.delete(event);
    }
    if (this.socket) {
      this.socket.off(event, callback);
    }
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
    this.disconnect(false);
    this.currentToken = accessToken;
    try {
      this.socket = io(cleanOrigin, {
        auth: { token: accessToken },
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
        autoConnect: true,
      });

      this.socket.on("auth:session-replaced", (data: { code: string; message: string }) => {
        this.onSessionReplaced(data);
        // Forcefully disconnect – the session is no longer valid.
        this.disconnect(true);
      });

      this.socket.on("connect", () => {
        // Gắn lại toàn bộ các event listeners đã đăng ký khi socket kết nối thành công
        for (const [event, callbacks] of this.listeners.entries()) {
          for (const cb of callbacks) {
            this.socket?.off(event, cb as any);
            this.socket?.on(event, cb as any);
          }
        }
      });

      this.socket.on("connect_error", () => {});

      // Gắn trước các event listeners đã đăng ký
      for (const [event, callbacks] of this.listeners.entries()) {
        for (const cb of callbacks) {
          this.socket.on(event, cb as any);
        }
      }
    } catch {
      // Bỏ qua lỗi kết nối socket trong môi trường test/build
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

