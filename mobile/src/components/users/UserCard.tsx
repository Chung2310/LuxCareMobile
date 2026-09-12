import React from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { UserProfile } from "../../../../src/types/common";
import type { UserRole } from "../../api/userManagementApi";

export const ROLE_MAP: Record<
  string,
  { label: string; color: string; bg: string; border: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  superadmin: {
    label: "Super Admin",
    color: "#b91c1c",
    bg: "#fef2f2",
    border: "#f87171",
    icon: "shield",
  },
  admin: {
    label: "Quản trị viên",
    color: "#dc2626",
    bg: "#fef2f2",
    border: "#fca5a5",
    icon: "shield-checkmark",
  },
  branch_owner: {
    label: "Chủ chi nhánh",
    color: "#7c3aed",
    bg: "#f5f3ff",
    border: "#ddd6fe",
    icon: "business",
  },
  manager: {
    label: "Quản lý",
    color: "#d97706",
    bg: "#fffbeb",
    border: "#fde68a",
    icon: "briefcase",
  },
  user: {
    label: "Nhân viên",
    color: "#0284c7",
    bg: "#f0f9ff",
    border: "#bae6fd",
    icon: "person",
  },
};

interface UserCardProps {
  user: UserProfile;
  roleName?: string;
  onPress: (user: UserProfile) => void;
}

export const UserCard: React.FC<UserCardProps> = ({ user, onPress, roleName }) => {
  const roleConfig = { ...(ROLE_MAP[user.role] || ROLE_MAP.user), label: roleName || ROLE_MAP[user.role]?.label || user.role };

  const getInitials = (name: string) => {
    const parts = (name || "").trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return (name?.[0] || "U").toUpperCase();
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(user)}
      activeOpacity={0.75}
    >
      {/* Top row: Avatar, Name, Email, Role badge */}
      <View style={styles.headerRow}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{getInitials(user.displayName)}</Text>
        </View>

        <View style={styles.infoCol}>
          <View style={styles.nameRow}>
            <Text style={styles.fullName} numberOfLines={1}>
              {user.displayName || "Chưa đặt tên"}
            </Text>
            <View
              style={[
                styles.roleBadge,
                { backgroundColor: roleConfig.bg, borderColor: roleConfig.border },
              ]}
            >
              <Ionicons
                name={roleConfig.icon}
                size={11}
                color={roleConfig.color}
              />
              <Text style={[styles.roleText, { color: roleConfig.color }]}>
                {roleConfig.label}
              </Text>
            </View>
          </View>

          <Text style={styles.emailText} numberOfLines={1}>
            {user.email}
          </Text>
        </View>
      </View>

      {/* Middle row: Branch, Department, Phone chips */}
      <View style={styles.chipsRow}>
        {user.phone ? (
          <View style={styles.phoneChip}>
            <Ionicons name="call-outline" size={11} color="#059669" />
            <Text style={styles.phoneText}>{user.phone}</Text>
          </View>
        ) : null}

        {user.branchName ? (
          <View style={styles.branchChip}>
            <Ionicons name="business-outline" size={11} color="#0284c7" />
            <Text style={styles.branchText} numberOfLines={1}>
              {user.branchName}
            </Text>
          </View>
        ) : null}

        {user.department ? (
          <View style={styles.deptChip}>
            <Ionicons name="layers-outline" size={11} color="#475569" />
            <Text style={styles.deptText} numberOfLines={1}>
              {user.department}
            </Text>
          </View>
        ) : null}

        {user.jobTitle ? (
          <View style={styles.jobChip}>
            <Ionicons name="id-card-outline" size={11} color="#7c3aed" />
            <Text style={styles.jobText} numberOfLines={1}>
              {user.jobTitle}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Footer: Detail navigation hint */}
      <View style={styles.footerRow}>
        <View style={styles.viewDetailHint}>
          <Text style={styles.tapToViewText}>Xem chi tiết & phân quyền</Text>
          <Ionicons name="chevron-forward" size={12} color="#94a3b8" />
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#f0fdf4",
    borderWidth: 1.5,
    borderColor: "#bbf7d0",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  avatarText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#16a34a",
  },
  infoCol: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  fullName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
    flex: 1,
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    gap: 4,
  },
  roleText: {
    fontSize: 11,
    fontWeight: "600",
  },
  emailText: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  phoneChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#a7f3d0",
    paddingHorizontal: 7,
    paddingVertical: 3.5,
    borderRadius: 8,
    gap: 4,
  },
  phoneText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#059669",
  },
  branchChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f9ff",
    borderWidth: 1,
    borderColor: "#bae6fd",
    paddingHorizontal: 7,
    paddingVertical: 3.5,
    borderRadius: 8,
    gap: 4,
    maxWidth: 140,
  },
  branchText: {
    fontSize: 11.5,
    color: "#0284c7",
    fontWeight: "500",
  },
  deptChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 7,
    paddingVertical: 3.5,
    borderRadius: 8,
    gap: 4,
  },
  deptText: {
    fontSize: 11.5,
    color: "#475569",
  },
  jobChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f3ff",
    borderWidth: 1,
    borderColor: "#ddd6fe",
    paddingHorizontal: 7,
    paddingVertical: 3.5,
    borderRadius: 8,
    gap: 4,
  },
  jobText: {
    fontSize: 11.5,
    color: "#7c3aed",
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    marginTop: 10,
    paddingTop: 8,
  },
  viewDetailHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  tapToViewText: {
    fontSize: 11.5,
    color: "#64748b",
    fontWeight: "500",
  },
  quickCallBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#a7f3d0",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  quickCallText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#059669",
  },
});
