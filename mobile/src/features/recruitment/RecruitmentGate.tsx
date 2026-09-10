import { router } from "expo-router";
import { Text } from "react-native";
import type { UserProfile } from "../../../../src/types/common";
import { Button, Card, Page, styles } from "../../ui";

export function RecruitmentGate({
  title,
  user,
  access,
  scopeReady,
}: {
  title: string;
  user: UserProfile | null;
  access: { read: boolean; manage: boolean };
  scopeReady: boolean;
}) {
  const needsBranch = access.read && !scopeReady;
  const isAdmin = user?.role === "admin";

  let heading = "Chưa thể mở chức năng";
  let message = "Vui lòng kiểm tra lại tài khoản và phạm vi chi nhánh.";
  if (!user?.companyCode) {
    heading = "Tài khoản chưa thuộc doanh nghiệp";
    message = "Tài khoản cần được gán vào một doanh nghiệp LuxCare trước khi dùng tuyển dụng.";
  } else if (!access.read) {
    heading = "Chưa được cấp quyền tuyển dụng";
    message =
      "Tài khoản cần quyền recruitment:read để xem tin tuyển dụng, hồ sơ ứng viên và lịch hẹn phỏng vấn. Liên hệ quản trị viên để cấp quyền này.";
  } else if (needsBranch && isAdmin) {
    heading = "Chưa chọn chi nhánh";
    message = "Admin cần chọn một chi nhánh đang hoạt động trong mục Tài khoản trước khi tải dữ liệu tuyển dụng.";
  } else if (needsBranch) {
    heading = "Chưa được gán chi nhánh";
    message = "Hồ sơ tài khoản chưa có chi nhánh làm việc. Hãy nhờ quản trị viên cập nhật hồ sơ nhân sự.";
  }

  return (
    <Page title={title}>
      <Card>
        <Text style={styles.heading}>{heading}</Text>
        <Text style={styles.text}>{message}</Text>
        {needsBranch && isAdmin && (
          <Button title="Mở Tài khoản để chọn chi nhánh" onPress={() => router.push("/(tabs)/profile")} />
        )}
        <Button title="Mở Tất cả chức năng" onPress={() => router.push("/(tabs)/modules")} />
        <Button title="Về trang chủ" onPress={() => router.push("/(tabs)")} />
      </Card>
    </Page>
  );
}
