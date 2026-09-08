import type { WebNotification } from "../../../../src/services/notificationService";
import type { UserProfile } from "../../../../src/types/common";
import { canUseModule, hasPermission } from "../../auth/access";
type Target = { href: "/(tabs)/work" | "/(tabs)" | "/(tabs)/departments"; label: string };
export type NotificationTarget = { target: Target; reason?: never } | { target?: never; reason: string };
export function notificationTarget(
  notification: Pick<WebNotification, "action" | "companyCode">,
  user: UserProfile | null,
): NotificationTarget {
  if (!user) return { reason: "Vui lòng đăng nhập để mở nội dung." };
  if (notification.companyCode && notification.companyCode !== user.companyCode)
    return { reason: "Thông báo thuộc doanh nghiệp khác với phiên hiện tại." };
  const action = notification.action;
  if (!action) return { reason: "Thông báo này không có nội dung liên kết." };
  if (action.tab === "NHÂN SỰ" && action.subTab === "Giao Việc")
    return canUseModule(user, "hr")
      ? { target: { href: "/(tabs)/work", label: "Mở danh sách công việc" } }
      : { reason: "Phân hệ nhân sự chưa được kích hoạt." };
  if (action.tab === "NHÂN SỰ" && action.subTab === "PHÒNG BAN")
    return canUseModule(user, "hr")
      ? { target: { href: "/(tabs)/departments", label: "Mở phòng ban" } }
      : { reason: "Phân hệ nhân sự chưa được kích hoạt." };
  if (action.tab === "TỔNG QUAN" && !action.subTab)
    return hasPermission(user, "dashboard:read")
      ? { target: { href: "/(tabs)", label: "Mở tổng quan" } }
      : { reason: "Bạn chưa có quyền xem tổng quan." };
  return { reason: "Nội dung liên kết này chưa có trên ứng dụng mobile. Bạn có thể xem trên LuxCare web." };
}
