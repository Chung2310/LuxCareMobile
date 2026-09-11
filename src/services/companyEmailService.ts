import { parseApiErrorResponse } from "./apiClientError";
import { browserTransport, type ServiceTransport } from "./serviceTransport";

export interface CelebrationStats {
  totalEmployees: number;
  missingBirthDate: number;
}

export interface CelebrationTemplate {
  subject: string;
  html: string;
}

export interface HolidayOverride {
  date: string;
  enabled: boolean;
  subject?: string;
  html?: string;
}

export interface CelebrationConfig {
  birthdayEnabled: boolean;
  holidayEnabled: boolean;
  sendTime: string;
  birthdayTemplate: CelebrationTemplate;
  holidayTemplate: CelebrationTemplate;
  holidayOverrides?: HolidayOverride[];
}

export interface CelebrationDeliveryRecord {
  _id: string;
  companyCode: string;
  eventType: "birthday" | "holiday";
  eventDate: string;
  eventKey: string;
  recipientUserId?: string;
  recipientEmail: string;
  subject: string;
  status: "sending" | "sent" | "failed";
  attempts: number;
  error?: string;
  messageId?: string;
  sentAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SmtpConfigInfo {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  fromEmail: string;
  fromName: string;
  hasPassword?: boolean;
}

export function createCompanyEmailService({ fetch, getAccessToken }: ServiceTransport) {
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    const token = getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    if (init.body) headers.set("Content-Type", "application/json");
    const response = await fetch(path, { ...init, headers });
    if (!response.ok) throw await parseApiErrorResponse(response);
    const body = await response.json().catch(() => ({}));
    return (body.data ?? body) as T;
  }

  return {
    getCelebration: () => request<CelebrationConfig | null>("/api/v1/company-email/celebration"),
    getStats: () => request<CelebrationStats>("/api/v1/company-email/celebration/stats"),
    saveCelebration: (data: CelebrationConfig) =>
      request<CelebrationConfig>("/api/v1/company-email/celebration", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    previewCelebration: (data: { subject: string; html: string; holidayName?: string }) =>
      request<{ subject: string; html: string }>("/api/v1/company-email/celebration/preview", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    getHistory: () => request<CelebrationDeliveryRecord[]>("/api/v1/company-email/celebration/history"),
    getSmtp: () => request<SmtpConfigInfo | null>("/api/v1/company-email/smtp"),
    verifySmtp: () => request<{ success: boolean }>("/api/v1/company-email/smtp/verify", { method: "POST" }),
    testSmtp: () => request<{ messageId: string }>("/api/v1/company-email/smtp/test", { method: "POST" }),
  };
}

export const companyEmailService = createCompanyEmailService(browserTransport);
