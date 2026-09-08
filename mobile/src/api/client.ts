import { ApiClientError, parseApiErrorResponse } from "../../../src/services/apiClientError";
import { ATTENDANCE_REASON_MESSAGES } from "../../../src/services/attendanceErrors";
import type { ServiceTransport } from "../../../src/services/serviceTransport";

export interface TokenStorage {
  read(): Promise<string | null>;
  write(token: string): Promise<void>;
  clear(): Promise<void>;
}

export class MobileApi {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private refreshing: Promise<void> | null = null;
  private generation = 0;
  private branchId: string | null = null;
  private scopeGeneration = 0;
  getBranchId() {
    return this.branchId;
  }
  setBranchId(branchId: string | null) {
    if (branchId !== null && !/^[0-9a-f]{24}$/i.test(branchId)) throw new Error("Mã chi nhánh không hợp lệ.");
    if (this.branchId !== branchId) {
      this.branchId = branchId;
      this.scopeGeneration++;
    }
  }
  onSessionExpired: () => void = () => {};

  constructor(
    private origin: string,
    private storage: TokenStorage,
    private network: typeof fetch = fetch,
  ) {
    const url = new URL(origin);
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/"
    ) {
      throw new Error("EXPO_PUBLIC_API_URL phải là địa chỉ máy chủ, không có đường dẫn /api/v1.");
    }
    this.origin = url.origin;
  }

  private raw: typeof fetch = async (input, init = {}) => {
    if (typeof input !== "string" || !input.startsWith("/api/v1/")) {
      throw new Error("Chỉ cho phép gọi API LuxCare bằng đường dẫn /api/v1/.");
    }
    const controller = new AbortController();
    const cancel = () => controller.abort();
    if (init.signal?.aborted) controller.abort();
    init.signal?.addEventListener("abort", cancel);
    const isFileTransfer =
      input.startsWith("/api/v1/hr-contracts/upload?") ||
      input === "/api/v1/recruitment/files/public" ||
      /^\/api\/v1\/recruitment\/(jobs|applicants)\/[^/]+\/attachment$/.test(input) ||
      input.startsWith("/api/v1/hr/leave-files/upload") ||
      input === "/api/v1/media/upload" ||
      input.startsWith("/api/v1/media/download?");
    const timeout = setTimeout(cancel, isFileTransfer ? 120000 : 20000);
    try {
      const headers = new Headers(init.headers);
      headers.set("x-luxcare-client", "native");
      return await this.network(`${this.origin}${input}`, {
        ...init,
        headers,
        credentials: "omit",
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
      init.signal?.removeEventListener("abort", cancel);
    }
  };

  private async error(response: Response) {
    const body = await response
      .clone()
      .json()
      .catch(() => ({}));
    if (body?.code === "SESSION_REPLACED") {
      return new ApiClientError({ status: response.status, code: body.code, message: body.message });
    }
    if (typeof body?.reasonCode === "string")
      return new ApiClientError({
        status: response.status,
        code: body.reasonCode,
        message:
          ATTENDANCE_REASON_MESSAGES[body.reasonCode] || body.message || "Không thể chấm công. Vui lòng thử lại.",
      });
    return parseApiErrorResponse(response);
  }

  async clear() {
    this.generation++;
    this.setBranchId(null);
    this.refreshing = null;
    this.accessToken = this.refreshToken = null;
    await this.storage.clear();
  }

  async setSession(accessToken: string, refreshToken: string) {
    await this.clear();
    await this.storage.write(refreshToken);
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }

  async restore() {
    this.refreshToken = await this.storage.read();
    if (!this.refreshToken) return false;
    await this.refresh();
    return true;
  }

  private async expire() {
    try {
      await this.clear();
    } finally {
      this.onSessionExpired();
    }
  }

  private refresh(): Promise<void> {
    if (this.refreshing) return this.refreshing;
    const generation = this.generation;
    const pending = (async () => {
      if (!this.refreshToken) throw new Error("Vui lòng đăng nhập lại.");
      const response = await this.raw("/api/v1/auth/refresh-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });
      if (!response.ok) {
        const error = await this.error(response);
        if (generation === this.generation && [400, 401, 403].includes(response.status)) await this.expire();
        throw error;
      }
      const body = await response.json();
      if (generation !== this.generation) throw new Error("Phiên đăng nhập đã thay đổi.");
      if (typeof body?.accessToken !== "string" || !body.accessToken)
        throw new Error("API không trả access token hợp lệ.");
      this.accessToken = body.accessToken;
    })();
    this.refreshing = pending;
    void pending
      .finally(() => {
        if (this.refreshing === pending) this.refreshing = null;
      })
      .catch(() => {});
    return pending;
  }

  transport: ServiceTransport = {
    getAccessToken: () => this.accessToken,
    fetch: async (input, init = {}) => {
      const generation = this.generation;
      const scopeGeneration = this.scopeGeneration;
      const branchId = this.branchId;
      const assertScope = () => {
        if (scopeGeneration !== this.scopeGeneration) throw new Error("Chi nhánh đã thay đổi. Vui lòng tải lại.");
      };
      const originalToken = this.accessToken;
      const send = () => {
        assertScope();
        const headers = new Headers(init.headers);
        headers.delete("Authorization");
        headers.delete("x-branch-id");
        if (branchId) headers.set("x-branch-id", branchId);
        if (this.accessToken) headers.set("Authorization", `Bearer ${this.accessToken}`);
        return this.raw(input, { ...init, headers });
      };
      let response = await send();
      assertScope();
      if (generation !== this.generation) throw new Error("Phiên đăng nhập đã thay đổi.");
      if (response.status === 401 && this.refreshToken) {
        const error = await this.error(response.clone());
        if (error.code === "SESSION_REPLACED") {
          await this.expire();
          throw error;
        }
        if (originalToken === this.accessToken) await this.refresh();
        assertScope();
        if (generation !== this.generation) throw new Error("Phiên đăng nhập đã thay đổi.");
        response = await send();
      }
      assertScope();
      if (generation !== this.generation) throw new Error("Phiên đăng nhập đã thay đổi.");
      if (!response.ok) {
        const error = await this.error(response);
        if (response.status === 401) await this.expire();
        throw error;
      }
      return response;
    },
  };

  async login(email: string, password: string) {
    const response = await this.raw("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) throw await this.error(response);
    const body = await response.json();
    if (response.status === 202 || body?.status === "challenge_required") {
      throw new Error("Tài khoản cần xác thực Super Admin. Luồng xác thực này đang được triển khai trên mobile.");
    }
    if (
      typeof body?.accessToken !== "string" ||
      !body.accessToken ||
      typeof body?.refreshToken !== "string" ||
      !body.refreshToken
    )
      throw new Error("Máy chủ chưa hỗ trợ phiên mobile. Cần cập nhật backend LuxCare.");
    await this.setSession(body.accessToken, body.refreshToken);
  }

  async logout() {
    // Always remove local credentials, even when the device is offline.
    try {
      await this.transport.fetch("/api/v1/auth/logout", { method: "POST" });
    } finally {
      await this.clear();
    }
  }
}
