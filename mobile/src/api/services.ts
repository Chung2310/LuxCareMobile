import * as SecureStore from "expo-secure-store";
import { MobileApi } from "./client";
import { createPayrollService } from "../../../src/services/payrollService";
import { createHrCredentialService } from "../../../src/services/hrCredentialService";
import { createHrContractService } from "../../../src/services/hrContractService";
import { createRecruitmentService } from "../../../src/services/recruitmentService";
import { createHrCalendarService } from "../../../src/services/hrCalendarService";
import { createDashboardService } from "../../../src/services/dashboardService";
import { createNotificationService } from "../../../src/services/notificationService";
import { createDepartmentService } from "../../../src/services/departmentService";
import type { UserProfile } from "../../../src/types/common";
import { createBranchService } from "../../../src/services/branchService";
import { createLeaveService } from "../../../src/services/leaveService";
import { createRosterService } from "../../../src/services/rosterService";
import { createKanbanService } from "../../../src/services/kanbanService";
import { createAttendanceService } from "../../../src/services/attendanceService";
import { createCompanyWorkCalendarService } from "../../../src/services/companyWorkCalendarService";
import { createAccountService } from "../../../src/services/accountService";
import { createMonthlyKpiService } from "../../../src/services/monthlyKpiService";
import { createKanbanMediaService } from "../../../src/services/kanbanMediaService";
import { createEquipmentService } from "../../../src/services/equipmentService";
import { createWorkflowService } from "../../../src/services/workflowService";
import { createResourceService } from "../../../src/services/resourceService";
import { createBlogService } from "../../../src/services/blogService";
import { createRoomService } from "../../../src/services/roomService";

const origin = process.env.EXPO_PUBLIC_API_URL?.trim();
export let configurationError: string | null = !origin ? "Chưa cấu hình EXPO_PUBLIC_API_URL trong mobile/.env." : null;
const tokenKey = `luxcare.refresh.${encodeURIComponent(origin || "unconfigured").replace(/%/g, "_")}`;
const storage = {
  read: () => SecureStore.getItemAsync(tokenKey),
  write: (token: string) =>
    SecureStore.setItemAsync(tokenKey, token, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }),
  clear: () => SecureStore.deleteItemAsync(tokenKey),
};
function createApi() {
  try {
    if (origin && !__DEV__ && !origin.startsWith("https://"))
      throw new Error("Bản phát hành cần kết nối API qua HTTPS.");
    return new MobileApi(origin || "https://unconfigured.invalid", storage);
  } catch (error) {
    configurationError = error instanceof Error ? error.message : "Địa chỉ API không hợp lệ.";
    return new MobileApi("https://unconfigured.invalid", storage);
  }
}
export const api = createApi();
export const blog = createBlogService(api.transport);
export const payroll = createPayrollService(api.transport);
export const credentials = createHrCredentialService(api.transport);
export const contracts = createHrContractService(api.transport);
export const dashboard = createDashboardService(api.transport);
export const notifications = createNotificationService(api.transport);
export const departments = createDepartmentService(api.transport);
export const branches = createBranchService(api.transport);
export const leave = createLeaveService(api.transport);
export const roster = createRosterService(api.transport);
export const kanban = createKanbanService(api.transport);
export const attendance = createAttendanceService(api.transport);
export const recruitment = createRecruitmentService(api.transport);
export const hrCalendar = createHrCalendarService(api.transport);
export const workCalendar = createCompanyWorkCalendarService(api.transport);
export const account = createAccountService(api.transport);
export const monthlyKpi = createMonthlyKpiService(api.transport);
export const kanbanMedia = createKanbanMediaService(api.transport);
export const equipment = createEquipmentService(api.transport);
export const workflow = createWorkflowService(api.transport);
export const resources = createResourceService(api.transport);
export const rooms = createRoomService(api.transport);
export async function getMe(): Promise<UserProfile> {
  const response = await api.transport.fetch("/api/v1/auth/me");
  const { user } = await response.json();
  if (!user || !(user._id || user.uid)) throw new Error("Hồ sơ người dùng không hợp lệ.");
  return { ...user, uid: user._id || user.uid };
}
