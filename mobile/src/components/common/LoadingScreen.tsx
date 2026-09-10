import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Image,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export interface LoadingScreenProps {
  title?: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  color?: string;
  bgColor?: string;
}

/**
 * Màn hình Loading chuyển tiếp toàn trang (Full-screen Transition Loader)
 * Hiển thị ngay lập tức khi bấm icon điều hướng hoặc chuyển tab, xóa tan cảm giác "trống" hay giật lag.
 */
export const NavigationLoadingOverlay: React.FC<LoadingScreenProps & { visible: boolean }> = ({
  visible,
  title = "LuxCare",
  subtitle = "Đang đồng bộ và tải dữ liệu phân hệ...",
  icon = "medical",
  color = "#059669",
  bgColor = "#ecfdf5",
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      // Fade in & Scale in
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 60,
          useNativeDriver: true,
        }),
      ]).start();

      // Hiệu ứng nhịp đập (pulse effect) liên tục cho icon
      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.08,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 700,
            useNativeDriver: true,
          }),
        ]),
      );
      pulseLoop.start();

      return () => {
        pulseLoop.stop();
      };
    } else {
      // Fade out
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, fadeAnim, scaleAnim, pulseAnim]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.overlayContainer,
        {
          opacity: fadeAnim,
        },
      ]}
      pointerEvents="auto"
    >
      <Animated.View
        style={[
          styles.contentCard,
          {
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* Icon box phát sáng nhịp đập */}
        <Animated.View
          style={[
            styles.iconOuterGlow,
            {
              backgroundColor: bgColor || "#ecfdf5",
              transform: [{ scale: pulseAnim }],
            },
          ]}
        >
          <View
            style={[
              styles.iconInner,
              {
                backgroundColor: color || "#059669",
              },
            ]}
          >
            <Ionicons name={icon} size={36} color="#ffffff" />
          </View>
        </Animated.View>

        {/* Tiêu đề phân hệ */}
        <Text style={styles.moduleTitle} numberOfLines={2}>
          {title}
        </Text>

        {/* Phụ đề hướng dẫn */}
        <Text style={styles.subtitleText}>{subtitle}</Text>

        {/* Vòng quay tải dữ liệu */}
        <View style={styles.spinnerRow}>
          <ActivityIndicator size="small" color="#059669" />
          <Text style={styles.loadingTip}>Đang khởi tạo...</Text>
        </View>

        {/* Khung mô phỏng Skeleton mượt mà */}
        <View style={styles.skeletonBox}>
          <View style={styles.skeletonLineShort} />
          <View style={styles.skeletonLineFull} />
        </View>
      </Animated.View>

      {/* Footer thương hiệu */}
      <View style={styles.footerBrand}>
        <Image
          source={require("../../../public/brand-icon.png")}
          style={styles.footerLogo}
          resizeMode="contain"
        />
        <Text style={styles.footerText}>LuxCare Healthcare Management</Text>
      </View>
    </Animated.View>
  );
};

/**
 * Giao diện Loading nội trang (Skeleton/Empty State Loader cho danh sách trong từng màn hình)
 */
export const PageLoadingView: React.FC<{
  title?: string;
  subtitle?: string;
  color?: string;
}> = ({
  title = "Đang tải dữ liệu...",
  subtitle = "Hệ thống đang kết nối và nạp thông tin từ máy chủ",
  color = "#059669",
}) => {
  return (
    <View style={styles.pageLoadingContainer}>
      <View style={styles.pageSpinnerBox}>
        <ActivityIndicator size="large" color={color} />
      </View>
      <Text style={styles.pageLoadingTitle}>{title}</Text>
      <Text style={styles.pageLoadingSubtitle}>{subtitle}</Text>

      {/* Danh sách các thanh Skeleton tượng trưng */}
      <View style={styles.pageSkeletonWrapper}>
        <View style={styles.pageSkeletonCard}>
          <View style={styles.skeletonAvatar} />
          <View style={{ flex: 1, gap: 8 }}>
            <View style={[styles.skeletonBar, { width: "65%" }]} />
            <View style={[styles.skeletonBar, { width: "40%" }]} />
          </View>
        </View>
        <View style={styles.pageSkeletonCard}>
          <View style={styles.skeletonAvatar} />
          <View style={{ flex: 1, gap: 8 }}>
            <View style={[styles.skeletonBar, { width: "80%" }]} />
            <View style={[styles.skeletonBar, { width: "50%" }]} />
          </View>
        </View>
        <View style={styles.pageSkeletonCard}>
          <View style={styles.skeletonAvatar} />
          <View style={{ flex: 1, gap: 8 }}>
            <View style={[styles.skeletonBar, { width: "55%" }]} />
            <View style={[styles.skeletonBar, { width: "35%" }]} />
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlayContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255, 255, 255, 0.98)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 99999,
    paddingHorizontal: 24,
  },
  contentCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#ffffff",
    borderRadius: 24,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: "center",
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
    borderWidth: 1,
    borderColor: "#ecfdf5",
  },
  iconOuterGlow: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  iconInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  moduleTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#0f172a",
    textAlign: "center",
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  subtitleText: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 20,
    paddingHorizontal: 12,
  },
  spinnerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f0fdf4",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#dcfce7",
  },
  loadingTip: {
    fontSize: 12,
    fontWeight: "600",
    color: "#059669",
  },
  skeletonBox: {
    width: "100%",
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  skeletonLineShort: {
    height: 8,
    width: "45%",
    backgroundColor: "#e2e8f0",
    borderRadius: 4,
  },
  skeletonLineFull: {
    height: 8,
    width: "85%",
    backgroundColor: "#f1f5f9",
    borderRadius: 4,
  },
  footerBrand: {
    position: "absolute",
    bottom: 36,
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  footerLogo: {
    width: 22,
    height: 22,
  },
  footerText: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: "600",
    letterSpacing: 0.2,
  },

  // PageLoadingView styles
  pageLoadingContainer: {
    flex: 1,
    alignItems: "center",
    paddingTop: 40,
    paddingHorizontal: 20,
  },
  pageSpinnerBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#ecfdf5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  pageLoadingTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 6,
    textAlign: "center",
  },
  pageLoadingSubtitle: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 28,
  },
  pageSkeletonWrapper: {
    width: "100%",
    gap: 12,
  },
  pageSkeletonCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    gap: 14,
  },
  skeletonAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#f1f5f9",
  },
  skeletonBar: {
    height: 10,
    backgroundColor: "#f1f5f9",
    borderRadius: 5,
  },
});
