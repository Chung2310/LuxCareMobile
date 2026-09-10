import { Redirect, Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSession } from "../../src/auth/SessionProvider";
import { colors } from "../../src/ui";
import { canUseModule } from "../../src/auth/access";

export default function TabLayout() {
  const { user, selectedBranch } = useSession();
  if (!user) return <Redirect href="/login" />;

  return (
    <Tabs
      key={`${user.uid}:${user.companyCode || ""}:${selectedBranch?._id || "default"}`}
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: "#94a3b8",
        headerTitle: "LuxCare",
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopColor: "#e2e8f0",
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
          elevation: 8,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          shadowRadius: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Trang chủ",
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "home" : "home-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="work"
        options={{
          title: "Công việc",
          headerShown: false,
          href: canUseModule(user, "hr") ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "briefcase" : "briefcase-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="resources"
        options={{
          title: "Tài nguyên",
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "folder" : "folder-outline"} size={20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "Trò chuyện",
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "chatbubble-ellipses" : "chatbubble-ellipses-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "Thông báo",
          headerShown: true,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "notifications" : "notifications-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Tài khoản",
          headerShown: true,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "person" : "person-outline"} size={22} color={color} />
          ),
        }}
      />

      {/* Các phân hệ phụ không hiển thị trên Tab Bar */}
      <Tabs.Screen name="equipment" options={{ title: "Thiết bị", href: null }} />
      <Tabs.Screen name="modules" options={{ title: "Chức năng", href: null }} />
      <Tabs.Screen name="customers" options={{ title: "Khách hàng", href: null }} />
      <Tabs.Screen name="inventory" options={{ title: "Vật tư & Dược phẩm", href: null }} />
      <Tabs.Screen name="users" options={{ title: "Quản lý người dùng", href: null }} />
      <Tabs.Screen name="attendance" options={{ title: "Chấm công", href: null }} />
      <Tabs.Screen name="leave" options={{ title: "Đơn từ", href: null }} />
      <Tabs.Screen name="departments" options={{ title: "Phòng ban", href: null }} />
      <Tabs.Screen name="employees" options={{ title: "Nhân sự", href: null }} />
      <Tabs.Screen name="contracts" options={{ title: "Hợp đồng nhân sự", href: null }} />
      <Tabs.Screen name="credentials" options={{ title: "Văn bằng & chứng chỉ", href: null }} />
      <Tabs.Screen name="payslips" options={{ title: "Phiếu lương của tôi", href: null }} />
      <Tabs.Screen name="payroll-runs" options={{ title: "Tra cứu bảng lương", href: null }} />
      <Tabs.Screen name="projects" options={{ title: "Dự án", href: null }} />
      <Tabs.Screen name="work-calendar" options={{ title: "Lịch doanh nghiệp", href: null }} />
      <Tabs.Screen name="shifts" options={{ title: "Quản lý ca", href: null }} />
      <Tabs.Screen name="recruitment" options={{ title: "Tuyển dụng", href: null }} />
      <Tabs.Screen name="recruitment-pipeline" options={{ title: "Quy trình tuyển dụng", href: null }} />
      <Tabs.Screen name="workflow" options={{ title: "Quy trình làm việc", href: null }} />
      <Tabs.Screen name="applicants" options={{ title: "Ứng viên", href: null }} />
      <Tabs.Screen name="interviews" options={{ title: "Phỏng vấn", href: null }} />
      <Tabs.Screen name="calendar-events" options={{ title: "Lịch làm việc", href: null }} />
      <Tabs.Screen name="attendance-management" options={{ title: "Quản lý công", href: null }} />
      <Tabs.Screen name="kpi" options={{ title: "KPI tháng", href: null }} />
      <Tabs.Screen name="org-chart" options={{ title: "Sơ đồ tổ chức", href: null }} />
      <Tabs.Screen name="blog" options={{ title: "Blog nội bộ & Thảo luận", href: null }} />
    </Tabs>
  );
}
