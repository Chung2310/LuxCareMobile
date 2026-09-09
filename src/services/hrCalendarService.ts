import { browserTransport, type ServiceTransport } from "./serviceTransport";
import { parseApiErrorResponse } from "./apiClientError";

export interface CalendarItem {
  _id?: string;
  id?: string;
  companyCode: string;
  type: "event" | "leave" | "wfh" | "exception" | "reminder";
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  employeeId?: string;
  employeeName?: string;
  assigneeId?: string;
  status: "pending" | "approved" | "completed" | "active";
  creatorId: string;
  createdAt?: string;
  leaveApplicationId?: string;
}

export type CalendarItemInput = Pick<CalendarItem, "type" | "title" | "startDate" | "endDate"> &
  Partial<Pick<CalendarItem, "description" | "employeeId" | "employeeName" | "assigneeId" | "status" | "companyCode">>;

export function createHrCalendarService({ fetch, getAccessToken }: ServiceTransport) {
  return {
    async list(companyCode: string): Promise<CalendarItem[]> {
      if (!companyCode.trim()) throw new Error("Mã công ty là bắt buộc.");
      const headers = new Headers();
      const token = getAccessToken();
      if (token) headers.set("Authorization", `Bearer ${token}`);
      const response = await fetch(`/api/v1/crud/hr-calendar-events?companyCode=${encodeURIComponent(companyCode)}`, {
        headers,
      });
      if (!response.ok) throw await parseApiErrorResponse(response);
      const body = await response.json();
      return (body.data || []).map((item: CalendarItem) => ({ ...item, id: item._id || item.id }));
    },

    async create(input: CalendarItemInput): Promise<CalendarItem> {
      const headers = new Headers();
      const token = getAccessToken();
      if (token) headers.set("Authorization", `Bearer ${token}`);
      headers.set("Content-Type", "application/json");
      const response = await fetch("/api/v1/crud/hr-calendar-events", {
        method: "POST",
        headers,
        body: JSON.stringify(input),
      });
      if (!response.ok) throw await parseApiErrorResponse(response);
      const body = await response.json();
      return { ...body.data, id: body.data?._id || body.data?.id };
    },

    async update(id: string, input: Partial<CalendarItemInput>): Promise<CalendarItem> {
      const headers = new Headers();
      const token = getAccessToken();
      if (token) headers.set("Authorization", `Bearer ${token}`);
      headers.set("Content-Type", "application/json");
      const response = await fetch(`/api/v1/crud/hr-calendar-events/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(input),
      });
      if (!response.ok) throw await parseApiErrorResponse(response);
      const body = await response.json();
      return { ...body.data, id: body.data?._id || body.data?.id };
    },

    async remove(id: string): Promise<void> {
      const headers = new Headers();
      const token = getAccessToken();
      if (token) headers.set("Authorization", `Bearer ${token}`);
      const response = await fetch(`/api/v1/crud/hr-calendar-events/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers,
      });
      if (!response.ok) throw await parseApiErrorResponse(response);
    },
  };
}

export const hrCalendarService = createHrCalendarService(browserTransport);
