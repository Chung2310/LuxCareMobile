import React from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import {
  BRAND_NAME,
  BRAND_TAGLINE,
  LAST_UPDATED,
  PRIVACY_POLICY_SECTIONS,
  SUPPORT_EMAIL,
} from "../src/features/legal/legalContent";

export default function PrivacyPolicyScreen() {
  const openExternal = (url: string) => {
    Linking.openURL(url).catch(() => {});
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar style="dark" />

      {/* Top Navigation Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
        >
          <Ionicons name="chevron-back" size={22} color="#0f172a" />
        </Pressable>

        <Text style={styles.headerTitle} numberOfLines={1}>
          Chính sách bảo mật
        </Text>

        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Ionicons name="shield-checkmark" size={13} color="#059669" />
              <Text style={styles.badgeText}>BẢO MẬT & QUYỀN RIÊNG TƯ</Text>
            </View>
            <Text style={styles.updatedText}>Cập nhật: {LAST_UPDATED}</Text>
          </View>

          <Text style={styles.heroTitle}>Chính sách bảo mật {BRAND_NAME}</Text>
          <Text style={styles.heroSub}>
            Cam kết bảo vệ an toàn thông tin cá nhân, dữ liệu vận hành y tế và quyền kiểm soát dữ liệu của người dùng.
          </Text>

          <View style={styles.highlightNotice}>
            <Ionicons name="information-circle" size={18} color="#0284c7" />
            <Text style={styles.highlightNoticeText}>
              Ứng dụng chỉ sử dụng quyền truy cập thiết bị (Camera, Vị trí, Ảnh, Âm thanh) khi người dùng chủ động thực hiện chức năng tương ứng.
            </Text>
          </View>
        </View>

        {/* Policy Sections */}
        {PRIVACY_POLICY_SECTIONS.map((section, idx) => (
          <View key={idx} style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconRing}>
                <Text style={styles.sectionIndex}>{idx + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitleVi}>{section.titleVi || section.title}</Text>
                <Text style={styles.sectionTitleEn}>{section.title}</Text>
              </View>
            </View>

            <View style={styles.sectionBody}>
              {section.content.map((p, pIdx) => (
                <View key={pIdx} style={styles.paragraphRow}>
                  <View style={styles.bulletDot} />
                  <Text style={styles.paragraphText}>{p}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}

        {/* Contact & Legal Info */}
        <View style={styles.contactCard}>
          <Text style={styles.contactHeading}>Thông tin liên hệ & Hỗ trợ</Text>

          <View style={styles.linkRow}>
            <Ionicons name="business-outline" size={18} color="#059669" />
            <View style={{ flex: 1 }}>
              <Text style={styles.linkLabel}>Nền tảng</Text>
              <Text style={styles.linkValue}>{BRAND_NAME} - {BRAND_TAGLINE}</Text>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}
            onPress={() => openExternal(`mailto:${SUPPORT_EMAIL}`)}
          >
            <Ionicons name="mail-outline" size={18} color="#0284c7" />
            <View style={{ flex: 1 }}>
              <Text style={styles.linkLabel}>Email tiếp nhận hỗ trợ & bảo mật</Text>
              <Text style={styles.linkValue}>{SUPPORT_EMAIL}</Text>
            </View>
            <Ionicons name="arrow-forward" size={16} color="#94a3b8" />
          </Pressable>

          <View style={styles.linkRow}>
            <Ionicons name="trash-outline" size={18} color="#dc2626" />
            <View style={{ flex: 1 }}>
              <Text style={styles.linkLabel}>Xóa dữ liệu & tài khoản</Text>
              <Text style={styles.linkValue}>Thực hiện trực tiếp trong mục Hồ sơ &gt; Xóa tài khoản</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0f172a",
  },
  headerPlaceholder: {
    width: 38,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 36,
    gap: 14,
  },
  heroCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#059669",
    letterSpacing: 0.5,
  },
  updatedText: {
    fontSize: 11.5,
    color: "#64748b",
  },
  heroTitle: {
    fontSize: 21,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 6,
  },
  heroSub: {
    fontSize: 13.5,
    lineHeight: 20,
    color: "#475569",
    marginBottom: 14,
  },
  highlightNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#f0f9ff",
    borderWidth: 1,
    borderColor: "#bae6fd",
    borderRadius: 12,
    padding: 12,
  },
  highlightNoticeText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
    color: "#0369a1",
  },
  sectionCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  sectionIconRing: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#ecfdf5",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  sectionIndex: {
    fontSize: 14,
    fontWeight: "700",
    color: "#059669",
  },
  sectionTitleVi: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
  },
  sectionTitleEn: {
    fontSize: 12,
    color: "#64748b",
  },
  sectionBody: {
    gap: 10,
  },
  paragraphRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  bulletDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#059669",
    marginTop: 8,
  },
  paragraphText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    color: "#334155",
  },
  contactCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 10,
  },
  contactHeading: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 4,
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#f8fafc",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  linkLabel: {
    fontSize: 11.5,
    color: "#64748b",
  },
  linkValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
  },
  pressed: {
    opacity: 0.7,
  },
});
