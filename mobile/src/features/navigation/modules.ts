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
  const isManager = ["admin", "superadmin", "branch_owner", "manager"].includes(user?.role || "");
  const canManageCelebration = isManager || hasPermission(user, "company-email:manage");
  const canReadKnowledge =
    isManager || hasPermission(user, "knowledge:read") || hasPermission(user, "knowledge:manage");

  return [
    {
      title: "Kho tri thức & SOP",
      description: "Phác đồ điều trị, quy chuẩn chuyên môn và chính sách y tế",
      href: "/(tabs)/knowledge" as const,
      visible: canReadKnowledge,
    },
    {
      title: "Email chúc mừng",
      description: "Cấu hình mẫu, tự động gửi lời chúc sinh nhật và ngày lễ",
      href: "/(tabs)/celebration-email" as const,
      visible: canManageCelebration,
    },
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
      title: "Lịch & chấm công",
      description: "Trạng thái hôm nay, lịch sử cá nhân và lịch làm việc",
      href: "/(tabs)/attendance" as const,
      visible: hr,
    },
    {
      title: "Lịch sử chấm công",
      description: "Chi tiết nhật ký vào/ra ca, tổng giờ công và đối soát theo tháng",
      href: "/(tabs)/attendance-history" as const,
      visible: hr,
    },
    {
      title: "Đơn từ & phép",
      description: "Nộp đơn, biểu mẫu và phê duyệt",
      href: "/(tabs)/leave" as const,
      visible: hr,
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
      title: "Quản lý người dùng",
      description: "Thành viên, tài khoản & phân quyền hệ thống",
      href: "/(tabs)/users" as const,
      visible:
        !!user &&
        (user.role === "admin" ||
          user.role === "superadmin" ||
          user.role === "branch_owner" ||
          user.role === "manager" ||
          hasPermission(user, "user:read")),
    },
    {
      title: "Sơ đồ tổ chức",
      description: "Cơ cấu phân cấp phòng ban và nhân sự",
      href: "/(tabs)/org-chart" as const,
      visible: !!user,
    },
    {
      title: "Thiết bị y tế",
      description: "Quản lý danh mục, mượn trả & bảo trì thiết bị",
      href: "/(tabs)/equipment" as const,
      visible: !!user,
    },
    {
      title: "Bản tin & Blog nội bộ",
      description: "Bản tin công ty, chia sẻ kiến thức & thảo luận",
      href: "/(tabs)/blog" as const,
      visible: !!user,
    },
    {
      title: "Trò chuyện nội bộ",
      description: "Trao đổi tin nhắn, nhóm phòng ban & chia sẻ",
      href: "/(tabs)/chat" as const,
      visible: !!user,
    },
  ].filter((item) => item.visible);
}
