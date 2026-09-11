import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AccountForm } from "../../src/features/account/AccountForm";
import { getRoleDisplayName } from "../../../src/utils/permissionUtils";
import { messageOf, useSession } from "../../src/auth/SessionProvider";
import { BranchSelector } from "../../src/features/branches/BranchSelector";

export default function Profile() {
  const [editing, setEditing] = useState<"profile" | "password" | null>(null);
  const formLock = useRef(false);
  const { user, selectedBranch, logout } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogout = () =>
    Alert.alert("Đăng xuất tài khoản", "Bạn có chắc chắn muốn đăng xuất khỏi thiết bị này?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Đăng xuất",
        style: "destructive",
        onPress: () => {
          setBusy(true);
          void logout()
            .catch((err) => setError(messageOf(err)))
            .finally(() => setBusy(false));
        },
      },
    ]);

  const roleName = getRoleDisplayName(user?.role || "");

  const roleStyle =
    user?.role === "superadmin"
      ? styles.roleSuperadmin
      : user?.role === "admin"
      ? styles.roleAdmin
      : user?.role === "manager"
      ? styles.roleManager
      : styles.roleUser;

  const roleTextStyle =
    user?.role === "superadmin"
      ? styles.roleTextSuperadmin
      : user?.role === "admin"
      ? styles.roleTextAdmin
      : user?.role === "manager"
      ? styles.roleTextManager
      : styles.roleTextUser;

  const initialLetter = (user?.displayName || user?.email || "U").charAt(0).toUpperCase();

  return (
    <SafeAreaView edges={["top"]} style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Bar */}
        <View style={styles.headerRow}>
          <Text style={styles.pageTitle}>Tài khoản</Text>
          <Text style={styles.pageSubtitle}>Hồ sơ cá nhân & cài đặt hệ thống</Text>
        </View>

        {!!error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>⚠️ {error}</Text>
          </View>
        )}

        {/* Hero Profile Card */}
        <View style={styles.heroCard}>
          <View style={styles.avatarWrap}>
            {user?.photoURL ? (
              <Image source={{ uri: user.photoURL }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>{initialLetter}</Text>
              </View>
            )}
            <View style={styles.onlineBadge} />
          </View>

          <View style={styles.heroInfo}>
            <Text style={styles.displayName}>{user?.displayName || "Người dùng LuxCare"}</Text>
            <Text style={styles.emailText}>{user?.email}</Text>

            <View style={styles.roleRow}>
              <View style={[styles.roleBadge, roleStyle]}>
                <Text style={[styles.roleBadgeText, roleTextStyle]}>{roleName}</Text>
              </View>

              {user?.companyCode && (
                <View style={styles.companyBadge}>
                  <Text style={styles.companyBadgeText}>Mã DN: {user.companyCode}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Work Information Card */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionIcon}>🏢</Text>
            <Text style={styles.sectionTitle}>Thông tin công việc</Text>
          </View>

          <View style={styles.infoList}>
            {/* Company */}
            <View style={styles.infoItem}>
              <View style={styles.infoIconBox}>
                <Text style={styles.infoItemIcon}>🏛️</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.infoLabel}>Doanh nghiệp</Text>
                <Text style={styles.infoValue}>
                  {user?.companyName || user?.companyCode || "Chưa có thông tin"}
                </Text>
              </View>
            </View>

            {/* Department */}
            <View style={styles.infoItem}>
              <View style={styles.infoIconBox}>
                <Text style={styles.infoItemIcon}>👥</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.infoLabel}>Phòng ban</Text>
                <Text style={styles.infoValue}>
                  {user?.department || "Chưa phân bổ phòng ban"}
                </Text>
              </View>
            </View>

            {/* Job Title */}
            <View style={styles.infoItem}>
              <View style={styles.infoIconBox}>
                <Text style={styles.infoItemIcon}>💼</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.infoLabel}>Chức danh / Vị trí</Text>
                <Text style={styles.infoValue}>
                  {user?.jobTitle || "Nhân viên"}
                </Text>
              </View>
            </View>
          </View>

          {/* Branch Switcher for Admins */}
          <BranchSelector />
        </View>

        {/* Account & Security Section */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionIcon}>⚙️</Text>
            <Text style={styles.sectionTitle}>Cài đặt tài khoản & Bảo mật</Text>
          </View>

          <View style={styles.actionList}>
            {/* Edit Display Name */}
            <Pressable
              style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowPressed]}
              onPress={() => setEditing("profile")}
              disabled={busy}
            >
              <View style={[styles.actionIconBox, { backgroundColor: "#ecfdf5" }]}>
                <Text style={styles.actionIcon}>👤</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionTitle}>Chỉnh sửa họ và tên</Text>
                <Text style={styles.actionSub}>Thay đổi tên hiển thị trong hệ thống</Text>
              </View>
              <Text style={styles.arrowIcon}>›</Text>
            </Pressable>

            {/* Change Password */}
            <Pressable
              style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowPressed]}
              onPress={() => setEditing("password")}
              disabled={busy}
            >
              <View style={[styles.actionIconBox, { backgroundColor: "#fef3c7" }]}>
                <Text style={styles.actionIcon}>🔒</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionTitle}>Đổi mật khẩu đăng nhập</Text>
                <Text style={styles.actionSub}>Tăng cường bảo mật cho tài khoản của bạn</Text>
              </View>
              <Text style={styles.arrowIcon}>›</Text>
            </Pressable>

          </View>
        </View>

        {/* Logout Button */}
        <Pressable
          style={({ pressed }) => [
            styles.logoutBtn,
            busy && styles.logoutBtnDisabled,
            pressed && { opacity: 0.88 },
          ]}
          disabled={busy}
          onPress={handleLogout}
        >
          {busy ? (
            <ActivityIndicator size="small" color="#dc2626" />
          ) : (
            <>
              <Text style={styles.logoutIcon}>🚪</Text>
              <Text style={styles.logoutBtnText}>Đăng xuất khỏi thiết bị</Text>
            </>
          )}
        </Pressable>
      </ScrollView>

      {/* Account Form Modal */}
      <Modal
        visible={editing !== null}
        animationType="slide"
        onRequestClose={() => {
          if (!formLock.current) setEditing(null);
        }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: "#f8fafc" }}>
          {editing && (
            <AccountForm
              mode={editing}
              onClose={() => setEditing(null)}
              setLocked={(value) => {
                formLock.current = value;
              }}
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  headerRow: {
    paddingTop: 8,
    paddingBottom: 2,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.3,
  },
  pageSubtitle: {
    fontSize: 13,
    fontWeight: "500",
    color: "#64748b",
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 70,
    gap: 14,
  },
  errorBanner: {
    backgroundColor: "#fff1f2",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#fecdd3",
  },
  errorBannerText: {
    color: "#e11d48",
    fontSize: 13,
    fontWeight: "600",
  },
  heroCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 16,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  avatarWrap: {
    position: "relative",
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#059669",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  avatarImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#e2e8f0",
  },
  avatarText: {
    color: "#ffffff",
    fontSize: 26,
    fontWeight: "800",
  },
  onlineBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#22c55e",
    borderWidth: 3,
    borderColor: "#ffffff",
  },
  heroInfo: {
    flex: 1,
    gap: 3,
  },
  displayName: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0f172a",
  },
  emailText: {
    fontSize: 12,
    color: "#64748b",
  },
  roleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  roleBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  roleSuperadmin: {
    backgroundColor: "#f3e8ff",
  },
  roleAdmin: {
    backgroundColor: "#dbeafe",
  },
  roleManager: {
    backgroundColor: "#fef3c7",
  },
  roleUser: {
    backgroundColor: "#ecfdf5",
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  roleTextSuperadmin: {
    color: "#7e22ce",
  },
  roleTextAdmin: {
    color: "#1d4ed8",
  },
  roleTextManager: {
    color: "#b45309",
  },
  roleTextUser: {
    color: "#059669",
  },
  companyBadge: {
    backgroundColor: "#f1f5f9",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  companyBadgeText: {
    fontSize: 11,
    color: "#475569",
    fontWeight: "600",
  },
  sectionCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 12,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingBottom: 10,
  },
  sectionIcon: {
    fontSize: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1e293b",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  infoList: {
    gap: 10,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    gap: 12,
  },
  infoIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  infoItemIcon: {
    fontSize: 16,
  },
  infoLabel: {
    fontSize: 10,
    color: "#94a3b8",
    fontWeight: "700",
    textTransform: "uppercase",
  },
  infoValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
    marginTop: 1,
  },
  actionList: {
    gap: 6,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 12,
    gap: 12,
  },
  actionRowPressed: {
    backgroundColor: "#f8fafc",
  },
  actionIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  actionIcon: {
    fontSize: 16,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
  },
  actionSub: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 1,
  },
  arrowIcon: {
    fontSize: 18,
    color: "#94a3b8",
    fontWeight: "600",
  },
  versionBadge: {
    backgroundColor: "#ecfdf5",
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 6,
  },
  versionBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#059669",
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fee2e2",
    borderRadius: 14,
    paddingVertical: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: "#fca5a5",
    marginTop: 4,
  },
  logoutBtnDisabled: {
    opacity: 0.6,
  },
  logoutIcon: {
    fontSize: 16,
  },
  logoutBtnText: {
    color: "#dc2626",
    fontSize: 14,
    fontWeight: "700",
  },
});
