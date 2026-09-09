import type { UserProfile } from "../../../../src/types/common";
import { canUseModule, hasPermission } from "../../auth/access";
import { calendarAccess } from "../calendar/model";
import { recruitmentAccess } from "../recruitment/access";
import { canReadContracts } from "../contracts/model";
import { canReadCredentials } from "../credentials/model";
import { canReadPayslips } from "../payroll/model";
import { canReadPayrollRuns } from "../payroll/runModel";
import { workflowAccess } from "../workflow/access";

export function availableModules(user: UserProfile | null) {
  const hr = canUseModule(user, "hr");
  const recruitment = recruitmentAccess(user).read;
  const workflow = workflowAccess(user);

  return [
    {
      title: "Tra cứu bảng lương",
      description: "Trạng thái kỳ và lương theo nhân viên",
      href: "/(tabs)/payroll-runs" as const,
      visible: canReadPayrollRuns(user),
    },
    {
      title: "Phiếu lương của tôi",
      description: "Kỳ lương đã phát hành, thu nhập và khấu trừ",
      href: "/(tabs)/payslips" as const,
      visible: canReadPayslips(user),
    },
    {
      title: "Văn bằng & chứng chỉ",
      description: "Hồ sơ chuyên môn, thời hạn và tài liệu",
      href: "/(tabs)/credentials" as const,
      visible: canReadCredentials(user),
    },
    {
      title: "Hợp đồng nhân sự",
      description: "Hợp đồng, thời hạn và lịch sử gia hạn",
      href: "/(tabs)/contracts" as const,
      visible: canReadContracts(user),
    },
    {
      title: "Tuyển dụng",
      description: "Tin tuyển dụng, ứng viên, phỏng vấn và quy trình",
      href: "/(tabs)/recruitment" as const,
      visible: recruitment,
    },
    {
      title: "Quy trình làm việc",
      description: "Xây dựng quy trình, các bước và hướng xử lý",
      href: "/(tabs)/workflow" as const,
      visible: workflow.read,
    },
    {
      title: "Lịch làm việc",
      description: "Lịch trình, chấm công, đơn từ và ca làm việc",
      href: "/(tabs)/calendar-events" as const,
      visible: hr && !!user?.companyCode,
    },
    {
      title: "Quản lý công",
      description: "Chỉnh trạng thái, ghi chú và xem lịch sử",
      href: "/(tabs)/attendance-management" as const,
      visible: hr && !!user?.companyCode && hasPermission(user, "timekeeping:manage"),
    },
    {
      title: "Nhân sự",
      description: "Danh sách và hồ sơ nhân viên",
      href: "/(tabs)/employees" as const,
      visible: hr && (hasPermission(user, "user:read") || hasPermission(user, "hr:read")),
    },
    {
      title: "Công việc",
      description: "Công việc, dự án và KPI tháng",
      href: "/(tabs)/work" as const,
      visible: hr,
    },
    {
      title: "Lịch nghỉ & làm bù",
      description: "Lịch doanh nghiệp và lịch sử thay đổi",
      href: "/(tabs)/work-calendar" as const,
      visible: calendarAccess(user).read,
    },
    {
      title: "Quản lý & phân ca",
      description: "Danh mục ca, giờ nghỉ và phân ca nhân sự",
      href: "/(tabs)/shifts" as const,
      visible: hr && hasPermission(user, "timekeeping:manage"),
    },
    {
      title: "Lịch & chấm công",
      description: "Trạng thái hôm nay, lịch sử cá nhân và lịch làm việc",
      href: "/(tabs)/attendance" as const,
      visible: hr,
    },
    {
      title: "Đơn từ & phép",
      description: "Nộp đơn, biểu mẫu và phê duyệt",
      href: "/(tabs)/leave" as const,
      visible: hr,
    },
    {
      title: "Phòng ban",
      description: "Danh mục phòng ban của doanh nghiệp",
      href: "/(tabs)/departments" as const,
      visible: !!user,
    },
    {
      title: "Sơ đồ tổ chức",
      description: "Cơ cấu phân cấp phòng ban và nhân sự",
      href: "/(tabs)/org-chart" as const,
      visible: !!user,
    },
  ].filter((item) => item.visible);
}
