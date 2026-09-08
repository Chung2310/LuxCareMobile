import type { UserProfile } from "../../../../src/types/common";
import { canUseModule, hasPermission } from "../../auth/access";
import { calendarAccess } from "../calendar/model";
import { recruitmentAccess } from "../recruitment/access";
import { canReadContracts } from "../contracts/model";
export function availableModules(user: UserProfile | null) {
  const hr = canUseModule(user, "hr");
  return [
    {
      title: "Hợp đồng nhân sự",
      description: "Hợp đồng, thời hạn và lịch sử gia hạn",
      href: "/(tabs)/contracts" as const,
      visible: canReadContracts(user),
    },
    {
      title: "Quy trình tuyển dụng",
      description: "Giai đoạn, thứ tự và kết quả cuối",
      href: "/(tabs)/recruitment-pipeline" as const,
      visible: recruitmentAccess(user).read,
    },
    {
      title: "Phỏng vấn",
      description: "Lịch hẹn và kết quả phỏng vấn",
      href: "/(tabs)/interviews" as const,
      visible: recruitmentAccess(user).read,
    },
    {
      title: "Ứng viên",
      description: "Hồ sơ, giai đoạn và lịch sử tuyển dụng",
      href: "/(tabs)/applicants" as const,
      visible: recruitmentAccess(user).read,
    },
    {
      title: "Tuyển dụng",
      description: "Tin tuyển dụng, trạng thái và thùng rác",
      href: "/(tabs)/recruitment" as const,
      visible: recruitmentAccess(user).read,
    },
    {
      title: "Lịch nhân sự",
      description: "Sự kiện, nghỉ phép, làm tại nhà và nhắc việc",
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
    { title: "Công việc", description: "Giao việc, tiến độ và lịch sử", href: "/(tabs)/work" as const, visible: hr },
    { title: "Dự án", description: "Danh sách và tiến độ dự án", href: "/(tabs)/projects" as const, visible: hr },
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
      title: "KPI tháng",
      description: "Báo cáo công việc hoàn thành đúng hạn",
      href: "/(tabs)/kpi" as const,
      visible: hr && hasPermission(user, "work:read"),
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
  ].filter((item) => item.visible);
}
