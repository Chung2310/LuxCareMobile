import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { DepartmentFilterMode, DepartmentStatMetrics } from "./types";

interface DepartmentStatCardsProps {
  metrics: DepartmentStatMetrics;
  filterMode: DepartmentFilterMode;
  onSelectFilter: (mode: DepartmentFilterMode) => void;
}

export const DepartmentStatCards: React.FC<DepartmentStatCardsProps> = ({
  metrics,
  filterMode,
  onSelectFilter,
}) => {
  return (
    <View style={styles.container}>
      {/* Thẻ 1: Tất cả phòng ban */}
      <TouchableOpacity
        style={[
          styles.card,
          filterMode === "all" && styles.cardActive,
          { borderColor: filterMode === "all" ? "#059669" : "#e2e8f0" },
        ]}
        onPress={() => onSelectFilter("all")}
        activeOpacity={0.75}
      >
        <View style={styles.topRow}>
          <View style={[styles.iconBox, { backgroundColor: "#ecfdf5" }]}>
            <Ionicons name="business" size={15} color="#059669" />
          </View>
          <Text
            style={[
              styles.countText,
              filterMode === "all" && { color: "#059669" },
            ]}
          >
            {metrics.total}
          </Text>
        </View>
        <Text
          style={[
            styles.label,
            filterMode === "all" && styles.labelActive,
          ]}
          numberOfLines={1}
        >
          Tất cả
        </Text>
        <Text style={styles.subText}>phòng ban</Text>
      </TouchableOpacity>

      {/* Thẻ 2: Đang hoạt động */}
      <TouchableOpacity
        style={[
          styles.card,
          filterMode === "active" && styles.cardActive,
          { borderColor: filterMode === "active" ? "#16a34a" : "#e2e8f0" },
        ]}
        onPress={() => onSelectFilter("active")}
        activeOpacity={0.75}
      >
        <View style={styles.topRow}>
          <View style={[styles.iconBox, { backgroundColor: "#f0fdf4" }]}>
            <Ionicons name="checkmark-circle" size={15} color="#16a34a" />
          </View>
          <Text
            style={[
              styles.countText,
              { color: "#16a34a" },
            ]}
          >
            {metrics.active}
          </Text>
        </View>
        <Text
          style={[
            styles.label,
            filterMode === "active" && styles.labelActive,
          ]}
          numberOfLines={1}
        >
          Hoạt động
        </Text>
        <Text style={styles.subText}>sẵn sàng</Text>
      </TouchableOpacity>

      {/* Thẻ 3: Tạm ngừng */}
      <TouchableOpacity
        style={[
          styles.card,
          filterMode === "inactive" && styles.cardActive,
          { borderColor: filterMode === "inactive" ? "#d97706" : "#e2e8f0" },
        ]}
        onPress={() => onSelectFilter("inactive")}
        activeOpacity={0.75}
      >
        <View style={styles.topRow}>
          <View style={[styles.iconBox, { backgroundColor: "#fffbeb" }]}>
            <Ionicons name="pause-circle" size={15} color="#d97706" />
          </View>
          <Text
            style={[
              styles.countText,
              { color: "#d97706" },
            ]}
          >
            {metrics.inactive}
          </Text>
        </View>
        <Text
          style={[
            styles.label,
            filterMode === "inactive" && styles.labelActive,
          ]}
          numberOfLines={1}
        >
          Tạm ngừng
        </Text>
        <Text style={styles.subText}>chờ duyệt</Text>
      </TouchableOpacity>

      {/* Thẻ 4: Tổng nhân sự */}
      <View style={[styles.card, styles.cardStaff]}>
        <View style={styles.topRow}>
          <View style={[styles.iconBox, { backgroundColor: "#eff6ff" }]}>
            <Ionicons name="people" size={15} color="#2563eb" />
          </View>
          <Text style={[styles.countText, { color: "#2563eb" }]}>
            {metrics.totalStaff}
          </Text>
        </View>
        <Text style={styles.label} numberOfLines={1}>
          Nhân sự
        </Text>
        <Text style={styles.subText}>phân bổ</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  card: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  cardActive: {
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    shadowOpacity: 0.08,
    elevation: 2,
  },
  cardStaff: {
    backgroundColor: "#f8fafc",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  iconBox: {
    width: 26,
    height: 26,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  countText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.3,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
    marginBottom: 1,
  },
  labelActive: {
    color: "#0f172a",
  },
  subText: {
    fontSize: 9.5,
    color: "#94a3b8",
  },
});
