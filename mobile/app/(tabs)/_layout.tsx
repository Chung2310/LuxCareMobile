import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Redirect, Tabs } from "expo-router";
import { useSession } from "../../src/auth/SessionProvider";
import { colors } from "../../src/ui";
import { canUseModule } from "../../src/auth/access";

function ScrollableTabBar({ state, descriptors, navigation, insets }: any) {
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
    paddingTop: 8,
    gap: 4,
  },
  tabItem: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  tabLabel: {
    fontSize: 12.5,
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
    width: 18,
    borderRadius: 2,
    marginTop: 4,
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
  return (
    <Tabs
      key={`${user.uid}:${user.companyCode || ""}:${selectedBranch?._id || "default"}`}
      tabBar={(props) => <ScrollableTabBar {...props} />}
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        headerTitle: "LuxCare",
        headerShown: true,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Tổng quan", headerShown: false }} />
      <Tabs.Screen name="work" options={{ title: "Công việc", href: canUseModule(user, "hr") ? undefined : null }} />
      <Tabs.Screen name="equipment" options={{ title: "Thiết bị", headerShown: false }} />
      <Tabs.Screen name="notifications" options={{ title: "Thông báo" }} />
      <Tabs.Screen name="modules" options={{ title: "Chức năng" }} />
      <Tabs.Screen name="profile" options={{ title: "Tài khoản" }} />
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
      <Tabs.Screen name="attendance" options={{ title: "Lịch & chấm công", href: null }} />
      <Tabs.Screen name="recruitment" options={{ title: "Tuyển dụng", href: null }} />
      <Tabs.Screen name="recruitment-pipeline" options={{ title: "Quy trình tuyển dụng", href: null }} />
      <Tabs.Screen name="applicants" options={{ title: "Ứng viên", href: null }} />
      <Tabs.Screen name="interviews" options={{ title: "Phỏng vấn", href: null }} />
      <Tabs.Screen name="calendar-events" options={{ title: "Lịch nhân sự", href: null }} />
      <Tabs.Screen name="attendance-management" options={{ title: "Quản lý công", href: null }} />
      <Tabs.Screen name="kpi" options={{ title: "KPI tháng", href: null }} />
    </Tabs>
  );
}

