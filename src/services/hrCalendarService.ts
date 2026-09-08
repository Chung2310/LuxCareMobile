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
  };
}
export const hrCalendarService = createHrCalendarService(browserTransport);
