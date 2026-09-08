import type { DashboardSummaryParams } from "../../../../src/services/dashboardService";
export function customDashboardRange(startDate: string, endDate: string): DashboardSummaryParams {
  const valid = (value: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
  if (!valid(startDate) || !valid(endDate)) throw new Error("Nhập ngày hợp lệ theo định dạng YYYY-MM-DD.");
  if (endDate < startDate) throw new Error("Ngày kết thúc không được trước ngày bắt đầu.");
  return { filter: "custom", startDate, endDate };
}
