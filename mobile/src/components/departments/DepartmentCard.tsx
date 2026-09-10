import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  getDepartmentCodePalette,
  type DepartmentRecord,
} from "./types";

interface DepartmentCardProps {
  department: DepartmentRecord;
  onPress: (department: DepartmentRecord) => void;
  onViewOrgChart?: (department: DepartmentRecord) => void;
}

export const DepartmentCard: React.FC<DepartmentCardProps> = ({
  department,
  onPress,
  onViewOrgChart,
}) => {
  const palette = getDepartmentCodePalette(department.code || department.name);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(department)}
      activeOpacity={0.8}
    >
      {/* 1. Header: Code Badge + Name + Status Pill */}
      <View style={styles.headerRow}>
        <View
          style={[
            styles.codeBadge,
            { backgroundColor: palette.bg, borderColor: palette.border },
          ]}
        >
          <Text style={[styles.codeBadgeText, { color: palette.text }]}>
            {department.code}
          </Text>
        </View>

        <View style={styles.titleCol}>
          <Text style={styles.nameText} numberOfLines={1}>
            {department.name}
          </Text>
          <Text style={styles.orderText}>Thứ tự hiển thị: #{department.sortOrder}</Text>
        </View>

        <View
          style={[
            styles.statusPill,
            department.isActive ? styles.statusActive : styles.statusInactive,
          ]}
        >
          <View
            style={[
              styles.statusDot,
              { backgroundColor: department.isActive ? "#16a34a" : "#94a3b8" },
            ]}
          />
          <Text
            style={[
              styles.statusText,
              { color: department.isActive ? "#15803d" : "#64748b" },
            ]}
          >
            {department.isActive ? "Hoạt động" : "Tạm ngừng"}
          </Text>
        </View>
      </View>

      {/* 2. Description if present */}
      {Boolean(department.description) && (
        <Text style={styles.descText} numberOfLines={2}>
          {department.description}
        </Text>
      )}

      {/* 3. Metrics Info Strip */}
      <View style={styles.infoStrip}>
        <View style={styles.infoItem}>
          <Ionicons name="people" size={14} color="#059669" />
          <Text style={styles.infoValue}>
            {department.employeeCount ?? 0}{" "}
            <Text style={styles.infoLabel}>nhân sự</Text>
          </Text>
        </View>

        <View style={styles.infoDivider} />

        <View style={[styles.infoItem, { flex: 1 }]}>
          <Ionicons name="person" size={13} color="#2563eb" />
          <Text style={styles.infoValue} numberOfLines={1}>
            {department.managerName || "Chưa bổ nhiệm"}
          </Text>
        </View>
      </View>

      {/* 4. Action Bar Footer */}
      <View style={styles.cardFooter}>
        {onViewOrgChart && (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => onViewOrgChart(department)}
            activeOpacity={0.7}
          >
            <Ionicons name="git-network-outline" size={14} color="#059669" />
            <Text style={styles.actionBtnText}>Sơ đồ tổ chức</Text>
          </TouchableOpacity>
        )}

        <View style={styles.detailLink}>
          <Text style={styles.detailLinkText}>Chi tiết & Chỉnh sửa</Text>
          <Ionicons name="chevron-forward" size={13} color="#64748b" />
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  codeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  codeBadgeText: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  titleCol: {
    flex: 1,
  },
  nameText: {
    fontSize: 14.5,
    fontWeight: "700",
    color: "#0f172a",
  },
  orderText: {
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 1,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusActive: {
    backgroundColor: "#f0fdf4",
    borderColor: "#bbf7d0",
  },
  statusInactive: {
    backgroundColor: "#f8fafc",
    borderColor: "#e2e8f0",
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  descText: {
    fontSize: 12.5,
    color: "#475569",
    lineHeight: 18,
    marginBottom: 10,
  },
  infoStrip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 10,
    marginBottom: 10,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  infoValue: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1e293b",
  },
  infoLabel: {
    fontWeight: "400",
    color: "#64748b",
  },
  infoDivider: {
    width: 1,
    height: 14,
    backgroundColor: "#cbd5e1",
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 8,
    marginTop: 2,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 8,
  },
  actionBtnText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#059669",
  },
  detailLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  detailLinkText: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "500",
  },
});
