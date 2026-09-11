import React, { useEffect, useRef } from "react";
import { Animated, Platform, Pressable, StyleSheet, View } from "react-native";
import { Redirect, Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useSession } from "../../src/auth/SessionProvider";
import { colors } from "../../src/ui";
import { canUseModule } from "../../src/auth/access";
import { isBlogEditorUser } from "../../../src/utils/permissionUtils";

interface MomoTabIconProps {
  name: keyof typeof Ionicons.glyphMap;
  outlineName: keyof typeof Ionicons.glyphMap;
  focused: boolean;
}

function MomoTabIcon({ name, outlineName, focused }: MomoTabIconProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const dotScale = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    if (focused) {
      // Hiệu ứng nhảy nảy MoMo (Jump up & Spring elastic bounce)
      scale.setValue(0.85);
      translateY.setValue(0);
      dotScale.setValue(0);

      Animated.parallel([
        Animated.sequence([
          Animated.timing(translateY, {
            toValue: -5,
            duration: 130,
            useNativeDriver: true,
          }),
          Animated.spring(translateY, {
            toValue: 0,
            friction: 3.5,
            tension: 160,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 1.22,
            duration: 130,
            useNativeDriver: true,
          }),
          Animated.spring(scale, {
            toValue: 1,
            friction: 3.5,
            tension: 160,
            useNativeDriver: true,
          }),
        ]),
        Animated.spring(dotScale, {
          toValue: 1,
          friction: 4,
          tension: 140,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scale, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(dotScale, {
          toValue: 0,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [focused]);

  return (
    <View style={momoStyles.iconWrapper}>
      {/* Biểu tượng nảy đàn hồi (không khung bo) */}
      <Animated.View
        style={{
          transform: [{ scale }, { translateY }],
        }}
      >
        <Ionicons
          name={focused ? name : outlineName}
          size={23}
          color={focused ? "#059669" : "#94a3b8"}
        />
      </Animated.View>

      {/* Chấm chỉ báo nhỏ tinh tế bên dưới */}
      <Animated.View
        style={[
          momoStyles.accentDot,
          {
            transform: [{ scale: dotScale }],
            opacity: dotScale,
          },
        ]}
      />
    </View>
  );
}

function MomoTabButton(props: any) {
  const pressScale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(pressScale, {
      toValue: 0.9,
      speed: 50,
      bounciness: 0,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressScale, {
      toValue: 1,
      friction: 3.5,
      tension: 140,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      {...props}
      onPressIn={(e) => {
        handlePressIn();
        props.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        handlePressOut();
        props.onPressOut?.(e);
      }}
      style={[props.style, { flex: 1 }]}
    >
      <Animated.View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          transform: [{ scale: pressScale }],
        }}
      >
        {props.children}
      </Animated.View>
    </Pressable>
  );
}

export default function TabLayout() {
  const { user, selectedBranch } = useSession();
  const insets = useSafeAreaInsets();
  if (!user) return <Redirect href="/login" />;

  const isEditor = isBlogEditorUser(user);
  const bottomPadding = insets.bottom > 0 ? insets.bottom : (Platform.OS === "android" ? 12 : 10);
  const tabHeight = 56 + bottomPadding;

  return (
    <Tabs
      key={`${user.uid}:${user.companyCode || ""}:${selectedBranch?._id || "default"}`}
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: "#94a3b8",
        headerTitle: "LuxCare",
        headerShown: false,
        tabBarButton: (props) => <MomoTabButton {...props} />,
        tabBarStyle: isEditor
          ? { display: "none" }
          : {
              backgroundColor: "#ffffff",
              borderTopColor: "rgba(226, 232, 240, 0.8)",
              borderTopWidth: 1,
              borderTopLeftRadius: 22,
              borderTopRightRadius: 22,
              height: tabHeight,
              paddingBottom: bottomPadding,
              paddingTop: 6,
              elevation: 12,
              shadowColor: "#0f172a",
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.07,
              shadowRadius: 12,
            },
        tabBarLabelStyle: {
          fontSize: 10.5,
          fontWeight: "700",
          letterSpacing: -0.15,
          marginTop: 1,
        },
        tabBarItemStyle: {
          paddingVertical: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Trang chủ",
          headerShown: false,
          href: isEditor ? null : undefined,
          tabBarIcon: ({ focused }) => (
            <MomoTabIcon name="home" outlineName="home-outline" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="work"
        options={{
          title: "Công việc",
          headerShown: false,
          href: isEditor ? null : canUseModule(user, "hr") ? undefined : null,
          tabBarIcon: ({ focused }) => (
            <MomoTabIcon name="briefcase" outlineName="briefcase-outline" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "Trò chuyện",
          headerShown: false,
          href: isEditor ? null : undefined,
          tabBarIcon: ({ focused }) => (
            <MomoTabIcon name="chatbubble-ellipses" outlineName="chatbubble-ellipses-outline" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "Thông báo",
          headerShown: true,
          href: isEditor ? null : undefined,
          tabBarIcon: ({ focused }) => (
            <MomoTabIcon name="notifications" outlineName="notifications-outline" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Tài khoản",
          headerShown: true,
          href: isEditor ? null : undefined,
          tabBarIcon: ({ focused }) => (
            <MomoTabIcon name="person" outlineName="person-outline" focused={focused} />
          ),
        }}
      />

      {/* Các phân hệ phụ không hiển thị trên Tab Bar */}
      <Tabs.Screen name="resources" options={{ title: "Tài nguyên", href: null }} />
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
      <Tabs.Screen name="blog" options={{ title: "Blog nội bộ & Thảo luận", href: isEditor ? undefined : null }} />
      <Tabs.Screen name="training" options={{ title: "Đào tạo", href: null }} />
    </Tabs>
  );
}

const momoStyles = StyleSheet.create({
  iconWrapper: {
    width: 42,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  accentDot: {
    position: "absolute",
    bottom: -3,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#059669",
  },
});

