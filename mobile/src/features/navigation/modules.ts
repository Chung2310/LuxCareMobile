import type { UserProfile } from "../../../../src/types/common";
import { canUseModule, hasPermission } from "../../auth/access";
import { recruitmentAccess } from "../recruitment/access";
import { canReadContracts } from "../contracts/model";
import { canReadCredentials } from "../credentials/model";
import { canReadPayslips } from "../payroll/model";
import { canReadPayrollRuns } from "../payroll/runModel";
import { workflowAccess } from "../workflow/access";
import { trainingAccess } from "../training/access";

export function availableModules(user: UserProfile | null) {
  const hr = canUseModule(user, "hr");
  const recruitment = recruitmentAccess(user).read;
  const workflow = workflowAccess(user);
  const training = trainingAccess(user);

  return [
    {
      title: "Bảng lương",
      description: "Tính và hiển thị bảng lương, phiếu lương cá nhân",
      href: "/(tabs)/payslips" as const,
      visible: canReadPayslips(user) || canReadPayrollRuns(user),
    },
    {
      title: "Văn bằng & chứng chỉ",
      description: "Hồ sơ chuyên môn, thời hạn và tài liệu",
      href: "/(tabs)/credentials" as const,
      visible: canReadCredentials(user),
    },
    {
      title: "Đào tạo",
      description: "Khóa học nội bộ, bài giảng và tiến độ học tập",
      href: "/(tabs)/training" as const,
      visible: training.read,
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
      title: "Công việc",
      description: "Công việc, dự án và KPI tháng",
      href: "/(tabs)/work" as const,
      visible: hr,
    },
    {
      title: "Phòng ban",
      description: "Danh mục phòng ban của doanh nghiệp",
      href: "/(tabs)/departments" as const,
      visible: !!user,
    },
    {
      title: "Khách hàng & Tiếp nhận",
      description: "Tiếp nhận Leads, tư vấn & chăm sóc khách hàng",
      href: "/(tabs)/customers" as const,
      visible: !!user,
    },
    {
      title: "Vật tư & Dược phẩm",
      description: "Quản lý tồn kho, nhập xuất và cấp phát",
      href: "/(tabs)/inventory" as const,
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
