import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { AccountForm } from "../../src/features/account/AccountForm";
import { getRoleDisplayName } from "../../../src/utils/permissionUtils";
import { messageOf, useSession } from "../../src/auth/SessionProvider";
import { BranchSelector } from "../../src/features/branches/BranchSelector";
import { LogoutConfirmModal } from "../../src/components/common";

const bannerSource = require("../../public/pfp-banner.png");

export default function Profile() {
  const insets = useSafeAreaInsets();
  const [editing, setEditing] = useState<"profile" | "password" | null>(null);
  const formLock = useRef(false);
  const { user, selectedBranch, logout } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleLogoutPress = () => setShowLogoutModal(true);

  const handleConfirmLogout = async () => {
    setBusy(true);
    try {
      await logout();
      setShowLogoutModal(false);
    } catch (err) {
      setError(messageOf(err));
      setShowLogoutModal(false);
    } finally {
      setBusy(false);
    }
  };

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
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Header Banner */}
        <View style={[styles.bannerContainer, { paddingTop: insets.top }]}>
          <Image
            source={bannerSource}
            style={styles.bannerImage}
            resizeMode="cover"
          />
        </View>

        {/* Hero Profile Card (Overlapping Banner) */}
        <View style={styles.heroCard}>
          {/* Centered Avatar */}
          <View style={styles.avatarWrap}>
            {user?.photoURL ? (
              <Image source={{ uri: user.photoURL }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>{initialLetter}</Text>
              </View>
            )}
            <View style={styles.onlineBadge}>
              <Ionicons name="checkmark" size={10} color="#ffffff" />
            </View>
          </View>

          {/* User Name & Info */}
          <Text style={styles.displayName}>{user?.displayName || "Người dùng LuxCare"}</Text>
          <Text style={styles.emailText}>{user?.email}</Text>

          {/* Badges Row */}
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

        {!!error && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={18} color="#e11d48" />
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        )}

        {/* Work Information Card */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionTitleRow}>
            <View style={styles.sectionIconBox}>
              <Ionicons name="briefcase-outline" size={16} color="#059669" />
            </View>
            <Text style={styles.sectionTitle}>Thông tin công việc</Text>
          </View>

          <View style={styles.infoList}>
            {/* Company */}
            <View style={styles.infoItem}>
              <View style={styles.infoIconBox}>
                <Ionicons name="business-outline" size={18} color="#059669" />
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
                <Ionicons name="people-outline" size={18} color="#059669" />
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
                <Ionicons name="id-card-outline" size={18} color="#059669" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.infoLabel}>Chức danh / Vị trí</Text>
                <Text style={styles.infoValue}>
                  {user?.jobTitle || "Nhân viên"}
                </Text>
              </View>
            </View>

            {/* Branch Switcher */}
            <BranchSelector
              renderCustomTrigger={(open, currentName) => (
                <Pressable
                  style={({ pressed }) => [
                    styles.infoItem,
                    pressed && { opacity: 0.8 },
                  ]}
                  onPress={open}
                >
                  <View style={styles.infoIconBox}>
                    <Ionicons name="location-outline" size={18} color="#059669" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.infoLabel}>Chi nhánh làm việc</Text>
                    <Text style={styles.infoValue} numberOfLines={1}>
                      {currentName}
                    </Text>
                  </View>
                  <View style={styles.changeBadge}>
                    <Text style={styles.changeBadgeText}>Đổi</Text>
                    <Ionicons name="chevron-forward" size={12} color="#059669" />
                  </View>
                </Pressable>
              )}
            />
          </View>
        </View>

        {/* Account & Security Section */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionTitleRow}>
            <View style={styles.sectionIconBox}>
              <Ionicons name="shield-checkmark-outline" size={16} color="#059669" />
            </View>
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
                <Ionicons name="person-outline" size={18} color="#059669" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionTitle}>Chỉnh sửa họ và tên</Text>
                <Text style={styles.actionSub}>Thay đổi tên hiển thị trong hệ thống</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
            </Pressable>

            {/* Change Password */}
            <Pressable
              style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowPressed]}
              onPress={() => setEditing("password")}
              disabled={busy}
            >
              <View style={[styles.actionIconBox, { backgroundColor: "#fef3c7" }]}>
                <Ionicons name="key-outline" size={18} color="#d97706" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionTitle}>Đổi mật khẩu đăng nhập</Text>
                <Text style={styles.actionSub}>Tăng cường bảo mật cho tài khoản của bạn</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
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
          onPress={handleLogoutPress}
        >
          {busy ? (
            <ActivityIndicator size="small" color="#dc2626" />
          ) : (
            <>
              <Ionicons name="log-out-outline" size={18} color="#dc2626" />
              <Text style={styles.logoutBtnText}>Đăng xuất khỏi thiết bị</Text>
            </>
          )}
        </Pressable>
      </ScrollView>

      {/* Logout Confirmation Modal */}
      <LogoutConfirmModal
        visible={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleConfirmLogout}
        user={user}
        busy={busy}
      />

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 70,
    gap: 14,
  },
  bannerContainer: {
    width: "100%",
    height: 160,
    backgroundColor: "#e6f4ea",
    overflow: "hidden",
  },
  bannerImage: {
    width: "100%",
    height: "100%",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    backgroundColor: "#fff1f2",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#fecdd3",
  },
  errorBannerText: {
    flex: 1,
    color: "#e11d48",
    fontSize: 13,
    fontWeight: "600",
  },
  heroCard: {
    marginHorizontal: 16,
    marginTop: -45,
    backgroundColor: "#ffffff",
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingBottom: 18,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#f1f5f9",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 4,
  },
  avatarWrap: {
    marginTop: -42,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: "#ecfdf5",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: "#ffffff",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 5,
  },
  avatarImage: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: "#e2e8f0",
    borderWidth: 4,
    borderColor: "#ffffff",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 5,
  },
  avatarText: {
    color: "#059669",
    fontSize: 32,
    fontWeight: "800",
  },
  onlineBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#10b981",
    borderWidth: 2.5,
    borderColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  displayName: {
    fontSize: 19,
    fontWeight: "800",
    color: "#0f172a",
    marginTop: 10,
    textAlign: "center",
  },
  emailText: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "500",
    marginTop: 3,
    textAlign: "center",
  },
  roleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  roleBadge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 20,
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
    fontSize: 12,
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
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  companyBadgeText: {
    fontSize: 12,
    color: "#475569",
    fontWeight: "600",
  },
  sectionCard: {
    marginHorizontal: 16,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    gap: 12,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f8fafc",
    paddingBottom: 10,
  },
  sectionIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#ecfdf5",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1e293b",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  infoList: {
    gap: 10,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    gap: 12,
  },
  infoIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  infoLabel: {
    fontSize: 11,
    color: "#94a3b8",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
    marginTop: 2,
  },
  changeBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ecfdf5",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 2,
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  changeBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#059669",
  },
  actionList: {
    gap: 8,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    gap: 12,
  },
  actionRowPressed: {
    backgroundColor: "#f1f5f9",
  },
  actionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
  },
  actionSub: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
  },
  logoutBtn: {
    marginHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fee2e2",
    borderRadius: 14,
    paddingVertical: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: "#fecdd3",
    marginTop: 2,
  },
  logoutBtnDisabled: {
    opacity: 0.6,
  },
  logoutBtnText: {
    color: "#dc2626",
    fontSize: 14,
    fontWeight: "700",
  },
});
