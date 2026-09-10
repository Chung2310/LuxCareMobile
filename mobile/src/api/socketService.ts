import { io } from "socket.io-client";

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
    if (!this.origin || !accessToken) return;
    if (this.socket?.connected && this.currentToken === accessToken) return;
    this.disconnect();
    this.currentToken = accessToken;
    this.socket = io(this.origin, {
      auth: { token: accessToken },
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 30000,
      upgrade: false,
    });
    this.socket.on("auth:session-replaced", (data: { code: string; message: string }) => {
      this.onSessionReplaced(data);
      // Forcefully disconnect – the session is no longer valid.
      this.disconnect();
    });
    // Silently suppress connection errors.
    // HTTP-level errors already surface in the app UI.
    this.socket.on("connect_error", () => {});
  }

  /** Disconnect and clean up. Call on logout or token invalidation. */
  disconnect() {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.currentToken = null;
  }

  get isConnected() {
    return this.socket?.connected ?? false;
  }
}

export const socketService = new SocketService();

