import type { ServiceItem, ServiceModule } from "./types";
import type { UserProfile } from "../../../../src/types/common";
import { canUseModule, hasPermission } from "../../auth/access";
import { recruitmentAccess } from "../../features/recruitment/access";
import { canReadContracts } from "../../features/contracts/model";
import { canReadCredentials } from "../../features/credentials/model";
import { canReadPayslips } from "../../features/payroll/model";
import { canReadPayrollRuns } from "../../features/payroll/runModel";
import { workflowAccess } from "../../features/workflow/access";
import { trainingAccess } from "../../features/training/access";

export const DEFAULT_PINNED_IDS = [
  "att-checkin",
  "hr-leave",
  "pay-slips",
  "op-inventory",
];

export const LUXCARE_MODULES: ServiceModule[] = [
  {
    id: "popular",
    title: "Dịch vụ phổ biến",
    shortTitle: "Phổ biến",
    items: [
      {
        id: "pop-checkin",
        title: "Chấm công\n& Ca trực",
        icon: "time",
        color: "#059669",
        bgColor: "#ecfdf5",
        route: "/(tabs)/attendance",
        moduleId: "popular",
        status: "active",
      },
      {
        id: "pop-leave",
        title: "Đơn từ\n& Nghỉ phép",
        icon: "receipt",
        color: "#0d9488",
        bgColor: "#f0fdfa",
        route: "/(tabs)/leave",
        moduleId: "popular",
        status: "active",
      },
      {
        id: "pop-work",
        title: "Công việc\ncần làm",
        icon: "checkbox",
        color: "#2563eb",
        bgColor: "#eff6ff",
        route: "/(tabs)/work",
        moduleId: "popular",
        status: "active",
      },
      {
        id: "pop-payslip",
        title: "Bảng lương",
        icon: "wallet",
        color: "#059669",
        bgColor: "#ecfdf5",
        route: "/(tabs)/payslips",
        moduleId: "popular",
        status: "active",
      },
      {
        id: "pop-inventory",
        title: "Vật tư\n& Dược phẩm",
        icon: "cube",
        color: "#10b981",
        bgColor: "#ecfdf5",
        route: "/(tabs)/inventory",
        moduleId: "popular",
        status: "active",
      },
      {
        id: "pop-equipment",
        title: "Thiết bị\ny tế",
        icon: "medkit",
        color: "#0284c7",
        bgColor: "#f0f9ff",
        route: "/(tabs)/equipment",
        moduleId: "popular",
        status: "active",
      },
      {
        id: "pop-chat",
        title: "Trò chuyện\nnội bộ",
        icon: "chatbubble-ellipses",
        color: "#0d9488",
        bgColor: "#f0fdfa",
        route: "/(tabs)/chat",
        moduleId: "popular",
        status: "active",
      },
      {
        id: "pop-directory",
        title: "Danh bạ\nnhân viên",
        icon: "people",
        color: "#0284c7",
        bgColor: "#f0f9ff",
        route: "/(tabs)/employees",
        moduleId: "popular",
        status: "active",
      },
      {
        id: "pop-crm",
        title: "Khách hàng\n& Leads",
        icon: "people",
        color: "#059669",
        bgColor: "#ecfdf5",
        route: "/(tabs)/customers",
        moduleId: "popular",
        status: "active",
      },
      {
        id: "pop-users",
        title: "Quản lý\nngười dùng",
        icon: "people-circle",
        color: "#6366f1",
        bgColor: "#eef2ff",
        route: "/(tabs)/users",
        moduleId: "popular",
        status: "active",
      },
      {
        id: "pop-blog",
        title: "Bảng tin\ndoanh nghiệp",
        icon: "newspaper",
        color: "#ea580c",
        bgColor: "#fff7ed",
        route: "/(tabs)/blog",
        moduleId: "popular",
        status: "active",
      },
      {
        id: "pop-workflow",
        title: "Quy trình\nlàm việc",
        icon: "git-merge",
        color: "#0284c7",
        bgColor: "#f0f9ff",
        route: "/(tabs)/workflow",
        moduleId: "popular",
        status: "active",
      },
      {
        id: "pop-departments",
        title: "Quản lý\nphòng ban",
        icon: "business",
        color: "#0891b2",
        bgColor: "#ecfeff",
        route: "/(tabs)/departments",
        moduleId: "popular",
        status: "active",
      },
    ],
  },
  {
    id: "hr",
    title: "Nhân sự & Chấm công",
    shortTitle: "Nhân sự & Chấm công",
    items: [
      {
        id: "att-checkin",
        title: "Chấm công\nhôm nay",
        icon: "finger-print",
        color: "#059669",
        bgColor: "#ecfdf5",
        route: "/(tabs)/attendance",
        moduleId: "hr",
        status: "active",
      },
      {
        id: "att-history",
        title: "Lịch sử\nchấm công",
        icon: "time",
        color: "#0891b2",
        bgColor: "#ecfeff",
        route: "/(tabs)/attendance-history",
        moduleId: "hr",
        status: "active",
      },
      {
        id: "hr-leave",
        title: "Đơn từ\n& Nghỉ phép",
        icon: "receipt",
        color: "#059669",
        bgColor: "#ecfdf5",
        route: "/(tabs)/leave",
        moduleId: "hr",
        status: "active",
      },
      {
        id: "hr-calendar",
        title: "Lịch làm việc",
        icon: "calendar",
        color: "#0891b2",
        bgColor: "#ecfeff",
        route: "/(tabs)/calendar-events",
        moduleId: "hr",
        status: "active",
      },
      {
        id: "pay-slips",
        title: "Bảng lương",
        icon: "wallet",
        color: "#10b981",
        bgColor: "#ecfdf5",
        route: "/(tabs)/payslips",
        moduleId: "hr",
        status: "active",
      },
      {
        id: "hr-directory",
        title: "Danh bạ\nnhân sự",
        icon: "people",
        color: "#0284c7",
        bgColor: "#f0f9ff",
        route: "/(tabs)/employees",
        moduleId: "hr",
        status: "active",
      },
      {
        id: "hr-orgchart",
        title: "Sơ đồ\ntổ chức",
        icon: "git-network",
        color: "#6366f1",
        bgColor: "#eef2ff",
        route: "/(tabs)/org-chart",
        moduleId: "hr",
        status: "active",
      },
      {
        id: "hr-departments",
        title: "Quản lý\nphòng ban",
        icon: "business",
        color: "#0891b2",
        bgColor: "#ecfeff",
        route: "/(tabs)/departments",
        moduleId: "hr",
        status: "active",
      },
      {
        id: "hr-workflow",
        title: "Quy trình\nlàm việc",
        icon: "git-merge",
        color: "#0284c7",
        bgColor: "#f0f9ff",
        route: "/(tabs)/workflow",
        moduleId: "hr",
        status: "active",
      },
      {
        id: "hr-contracts",
        title: "Hợp đồng\nlao động",
        icon: "newspaper",
        color: "#047857",
        bgColor: "#ecfdf5",
        route: "/(tabs)/contracts",
        moduleId: "hr",
        status: "active",
      },
      {
        id: "hr-credentials",
        title: "Văn bằng\nchứng chỉ",
        icon: "ribbon",
        color: "#d97706",
        bgColor: "#fffbeb",
        route: "/(tabs)/credentials",
        moduleId: "hr",
        status: "active",
      },
      {
        id: "hr-training",
        title: "Đào tạo\nNội bộ",
        icon: "school",
        color: "#7c3aed",
        bgColor: "#f5f3ff",
        route: "/(tabs)/training",
        moduleId: "hr",
        status: "active",
      },
      {
        id: "rec-recruitment",
        title: "Tuyển dụng",
        icon: "megaphone",
        color: "#ea580c",
        bgColor: "#fff7ed",
        route: "/(tabs)/recruitment",
        moduleId: "hr",
        status: "active",
      },
      {
        id: "hr-celebration",
        title: "Email\nchúc mừng",
        icon: "mail",
        color: "#db2777",
        bgColor: "#fdf2f8",
        route: "/(tabs)/celebration-email",
        moduleId: "hr",
        status: "active",
      },
    ],
  },
  {
    id: "operations",
    title: "Vận hành & Y tế",
    shortTitle: "Vận hành & Y tế",
    items: [
      {
        id: "op-inventory",
        title: "Vật tư\n& Dược phẩm",
        icon: "cube",
        color: "#059669",
        bgColor: "#ecfdf5",
        route: "/(tabs)/inventory",
        moduleId: "operations",
        status: "active",
      },
      {
        id: "op-equipment",
        title: "Quản lý\nthiết bị y tế",
        icon: "medkit",
        color: "#0284c7",
        bgColor: "#f0f9ff",
        route: "/(tabs)/equipment",
        moduleId: "operations",
        status: "active",
      },
      {
        id: "op-crm",
        title: "Khách hàng\n& Tiếp nhận",
        icon: "people",
        color: "#059669",
        bgColor: "#ecfdf5",
        route: "/(tabs)/customers",
        moduleId: "operations",
        status: "active",
      },
      {
        id: "op-leads",
        title: "Tiếp nhận\ntư vấn Leads",
        icon: "call",
        color: "#10b981",
        bgColor: "#ecfdf5",
        route: "/(tabs)/customers",
        moduleId: "operations",
        status: "active",
      },
    ],
  },
  {
    id: "work",
    title: "Công việc",
    shortTitle: "Công việc",
    items: [
      {
        id: "work-my",
        title: "Công việc\ncủa tôi",
        icon: "checkmark-done-circle",
        color: "#2563eb",
        bgColor: "#eff6ff",
        route: "/(tabs)/work",
        moduleId: "work",
        status: "active",
      },
      {
        id: "work-projects",
        title: "Quản lý\ndự án",
        icon: "briefcase",
        color: "#6366f1",
        bgColor: "#eef2ff",
        route: "/(tabs)/projects",
        moduleId: "work",
        status: "active",
      },
      {
        id: "work-kpi",
        title: "Báo cáo\nKPI tháng",
        icon: "trending-up",
        color: "#16a34a",
        bgColor: "#f0fdf4",
        route: "/(tabs)/kpi",
        moduleId: "work",
        status: "active",
      },
    ],
  },
  {
    id: "communication",
    title: "Truyền thông & Hệ thống",
    shortTitle: "Truyền thông & Hệ thống",
    items: [
      {
        id: "comm-chat",
        title: "Trò chuyện\nnội bộ",
        icon: "chatbubble-ellipses",
        color: "#059669",
        bgColor: "#ecfdf5",
        route: "/(tabs)/chat",
        moduleId: "communication",
        status: "active",
      },
      {
        id: "comm-groups",
        title: "Nhóm\nphòng ban",
        icon: "chatbubbles",
        color: "#0284c7",
        bgColor: "#f0f9ff",
        route: "/(tabs)/chat",
        moduleId: "communication",
        status: "active",
      },
      {
        id: "comm-blog",
        title: "Bảng tin\nBlog nội bộ",
        icon: "newspaper",
        color: "#ea580c",
        bgColor: "#fff7ed",
        route: "/(tabs)/blog",
        moduleId: "communication",
        status: "active",
      },
      {
        id: "comm-broadcast",
        title: "Thông báo\ntoàn viện",
        icon: "megaphone",
        color: "#d97706",
        bgColor: "#fffbeb",
        route: "/(tabs)/notifications",
        moduleId: "communication",
        status: "active",
      },
      {
        id: "comm-knowledge",
        title: "Kho tri thức\n& SOP y tế",
        icon: "library",
        color: "#7c3aed",
        bgColor: "#f5f3ff",
        route: "/(tabs)/knowledge",
        moduleId: "communication",
        status: "active",
      },
      {
        id: "comm-resources",
        title: "Quản lý\ntài nguyên",
        icon: "folder-open",
        color: "#0284c7",
        bgColor: "#f0f9ff",
        route: "/(tabs)/resources",
        moduleId: "communication",
        status: "active",
      },
      {
        id: "sys-users",
        title: "Quản lý\nngười dùng",
        icon: "people-circle",
        color: "#6366f1",
        bgColor: "#eef2ff",
        route: "/(tabs)/users",
        moduleId: "communication",
        status: "active",
      },
    ],
  },
];

export function isServiceAccessible(item: ServiceItem, user: UserProfile | null): boolean {
  if (!user) return false;

  const isManager = ["admin", "superadmin", "branch_owner", "manager"].includes(user.role || "");

  // Route-based permission checks
  const baseRoute = item.route.split("?")[0];
  switch (baseRoute) {
    case "/(tabs)/users":
      return isManager || hasPermission(user, "user:read");

    case "/(tabs)/recruitment":
      return recruitmentAccess(user).read;

    case "/(tabs)/contracts":
      return isManager || canReadContracts(user);

    case "/(tabs)/credentials":
      return isManager || canReadCredentials(user);

    case "/(tabs)/training":
      return isManager || trainingAccess(user).read;

    case "/(tabs)/celebration-email":
      return isManager || hasPermission(user, "company-email:manage");

    case "/(tabs)/workflow":
      return isManager || workflowAccess(user).read;

    case "/(tabs)/payroll-runs":
      return isManager || canReadPayrollRuns(user);

    case "/(tabs)/payslips":
      return isManager || canReadPayslips(user) || canReadPayrollRuns(user);

    case "/(tabs)/attendance-management":
      return isManager || (canUseModule(user, "hr") && hasPermission(user, "timekeeping:manage"));

    case "/(tabs)/kpi":
      return isManager || hasPermission(user, "work:read");

    case "/(tabs)/work":
    case "/(tabs)/projects":
    case "/(tabs)/shifts":
    case "/(tabs)/calendar-events":
      return isManager || canUseModule(user, "hr");

    case "/(tabs)/inventory":
      return isManager || canUseModule(user, "supply");

    case "/(tabs)/equipment":
      return isManager || canUseModule(user, "equipment");

    case "/(tabs)/chat":
      return isManager || canUseModule(user, "chat");

    case "/(tabs)/resources":
      return isManager || canUseModule(user, "resource");

    case "/(tabs)/attendance":
    case "/(tabs)/leave":
    case "/(tabs)/departments":
    case "/(tabs)/employees":
    case "/(tabs)/org-chart":
    case "/(tabs)/customers":
    case "/(tabs)/blog":
    case "/(tabs)/notifications":
      return true;

    case "/(tabs)/knowledge":
      return isManager || hasPermission(user, "knowledge:read") || hasPermission(user, "knowledge:manage");

    default:
      return true;
  }
}

export function getAccessibleModules(user: UserProfile | null, modulesList = LUXCARE_MODULES): ServiceModule[] {
  if (!user) return [];
  return modulesList
    .map((mod) => ({
      ...mod,
      items: mod.items.filter((item) => isServiceAccessible(item, user)),
    }))
    .filter((mod) => mod.items.length > 0);
}

export function getAllServicesFlat(modulesList = LUXCARE_MODULES, user?: UserProfile | null): ServiceItem[] {
  const list: ServiceItem[] = [];
  const seen = new Set<string>();
  for (const mod of modulesList) {
    for (const item of mod.items) {
      if (!seen.has(item.id) && (!user || isServiceAccessible(item, user))) {
        seen.add(item.id);
        list.push(item);
      }
    }
  }
  return list;
}

