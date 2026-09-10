import { View, ScrollView, Pressable, Text, StyleSheet } from "react-native";
import { Redirect, Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSession } from "../../src/auth/SessionProvider";
import { colors } from "../../src/ui";
import { canUseModule } from "../../src/auth/access";
import { isBlogEditorUser } from "../../../src/utils/permissionUtils";

function ScrollableTabBar({ state, descriptors, navigation, insets, isEditor }: any) {
  if (isEditor) return null;

  return (
    <View
      style={[
        tabBarStyles.container,
        { paddingBottom: Math.max(insets?.bottom ?? 0, 6) },
      ]}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={tabBarStyles.scrollContent}
      >
        {state.routes.map((route: any, index: number) => {
          const { options } = descriptors[route.key];
          
          // Explicitly hide these tabs for Blog Editors
          const hideForEditor = ["index", "work", "equipment", "resources", "chat", "notifications", "modules", "profile"].includes(route.name);
          if (isEditor && hideForEditor) return null;

          if (options.href === null) return null;

          const isFocused = state.index === index;
          const label =
            typeof options.tabBarLabel === "string"
              ? options.tabBarLabel
              : options.title !== undefined
              ? options.title
              : route.name;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const icon = options.tabBarIcon
            ? options.tabBarIcon({
                color: isFocused ? "#008852" : "#94a3b8",
                focused: isFocused,
                size: 20,
              })
            : null;

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              onPress={onPress}
              style={({ pressed }) => [
                tabBarStyles.tabItem,
                pressed && { opacity: 0.65 },
              ]}
              hitSlop={{ top: 8, bottom: 8 }}
            >
              {icon}
              <Text
                style={[
                  tabBarStyles.tabLabel,
                  isFocused ? tabBarStyles.tabLabelActive : tabBarStyles.tabLabelInactive,
                ]}
              >
                {label}
              </Text>
              <View
                style={[
                  tabBarStyles.indicator,
                  isFocused ? tabBarStyles.indicatorActive : tabBarStyles.indicatorInactive,
                ]}
              />
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const tabBarStyles = StyleSheet.create({
  container: {
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 3,
  },
  scrollContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingTop: 6,
    gap: 2,
  },
  tabItem: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  tabLabel: {
    fontSize: 11,
    fontFamily: "Inter-Medium",
  },
  tabLabelActive: {
    color: "#008852",
    fontWeight: "700",
    fontFamily: "Inter-Bold",
  },
  tabLabelInactive: {
    color: "#64748b",
    fontWeight: "500",
  },
  indicator: {
    height: 2.5,
    width: 16,
    borderRadius: 2,
    marginTop: 2,
  },
  indicatorActive: {
    backgroundColor: "#008852",
  },
  indicatorInactive: {
    backgroundColor: "transparent",
  },
});

export default function TabLayout() {
  const { user, selectedBranch } = useSession();
  if (!user) return <Redirect href="/login" />;

  const isEditor = isBlogEditorUser(user);

  return (
    <Tabs
      key={`${user.uid}:${user.companyCode || ""}:${selectedBranch?._id || "default"}`}
      tabBar={(props) => <ScrollableTabBar {...props} isEditor={isEditor} />}
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
          href: isEditor ? null : undefined,
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
          href: isEditor ? null : canUseModule(user, "hr") ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "briefcase" : "briefcase-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="equipment"
        options={{
          title: "Thiết bị",
          headerShown: false,
          href: isEditor ? null : undefined,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "medkit" : "medkit-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="resources"
        options={{
          title: "Tài nguyên",
          headerShown: false,
          href: isEditor ? null : undefined,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "folder" : "folder-outline"} size={20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="blog"
        options={{
          title: "Bản tin & Blog",
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "newspaper" : "newspaper-outline"} size={20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "Trò chuyện",
          headerShown: false,
          href: isEditor ? null : undefined,
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
          href: isEditor ? null : undefined,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "notifications" : "notifications-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="modules"
        options={{
          title: "Chức năng",
          headerShown: false,
          href: isEditor ? null : undefined,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "apps" : "apps-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Tài khoản",
          headerShown: true,
          href: isEditor ? null : undefined,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "person" : "person-outline"} size={22} color={color} />
          ),
        }}
      />

      {/* Các phân hệ phụ không hiển thị trên Tab Bar */}
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
      <Tabs.Screen name="training" options={{ title: "Đào tạo", href: null }} />
    </Tabs>
  );
}
