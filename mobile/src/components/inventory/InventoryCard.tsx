import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { InventorySupply } from "./types";

interface InventoryCardProps {
  item: InventorySupply;
  onStockIn: (item: InventorySupply) => void;
  onStockOut: (item: InventorySupply) => void;
  onDetail: (item: InventorySupply) => void;
  onEdit?: (item: InventorySupply) => void;
  onDelete?: (item: InventorySupply) => void;
}

export const InventoryCard: React.FC<InventoryCardProps> = ({
  item,
  onStockIn,
  onStockOut,
  onDetail,
  onEdit,
  onDelete,
}) => {
  // Tính tỷ lệ tồn kho so với mức tồn an toàn (minQuantity * 2 là ngưỡng thoải mái)
  const maxBenchmark = Math.max(item.minQuantity * 2, 1);
  const stockRatio = Math.min(item.quantity / maxBenchmark, 1);

  const getStatusBadge = () => {
    switch (item.status) {
      case "in-stock":
        return { label: "Còn hàng", color: "#059669", bg: "#ecfdf5", icon: "checkmark-circle" as const };
      case "low-stock":
        return { label: "Sắp hết", color: "#d97706", bg: "#fffbeb", icon: "alert-circle" as const };
      case "out-of-stock":
        return { label: "Hết hàng", color: "#dc2626", bg: "#fef2f2", icon: "close-circle" as const };
      case "expired":
        return { label: "Hết hạn", color: "#7c3aed", bg: "#f5f3ff", icon: "warning" as const };
      case "quarantined":
        return { label: "Cách ly", color: "#ea580c", bg: "#fff7ed", icon: "shield" as const };
      default:
        return { label: "Bình thường", color: "#64748b", bg: "#f1f5f9", icon: "ellipse" as const };
    }
  };

  const statusInfo = getStatusBadge();

  // Kiểm tra hạn sử dụng
  const isExpiringSoon = () => {
    if (!item.expiryDate) return false;
    const exp = new Date(item.expiryDate).getTime();
    const now = Date.now();
    const diffDays = (exp - now) / (1000 * 60 * 60 * 24);
    return diffDays >= 0 && diffDays <= 60;
  };

  const isExpired = () => {
    if (!item.expiryDate) return false;
    return new Date(item.expiryDate).getTime() < Date.now();
  };

  return (
    <View style={styles.card}>
      {/* Top Header Row */}
      <View style={styles.headerRow}>
        <View style={styles.codePill}>
          <Text style={styles.codeText}>{item.code}</Text>
        </View>

        <View style={styles.categoryPill}>
          <Text style={styles.categoryText}>{item.category}</Text>
        </View>

        <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
          <Ionicons name={statusInfo.icon} size={13} color={statusInfo.color} style={{ marginRight: 3 }} />
          <Text style={[styles.statusText, { color: statusInfo.color }]}>
            {statusInfo.label}
          </Text>
        </View>
      </View>

      {/* Main Item Name */}
      <TouchableOpacity onPress={() => onDetail(item)} activeOpacity={0.8}>
        <Text style={styles.nameText}>{item.name}</Text>
      </TouchableOpacity>

      {/* Tồn Kho & Thanh Tiến Độ */}
      <View style={styles.stockSection}>
        <View style={styles.stockTextRow}>
          <Text style={styles.stockLabel}>Số lượng tồn:</Text>
          <View style={styles.stockValues}>
            <Text
              style={[
                styles.stockCurrent,
                item.quantity <= item.minQuantity && { color: "#d97706" },
                item.quantity === 0 && { color: "#dc2626" },
              ]}
            >
              {item.quantity} {item.unit}
            </Text>
            <Text style={styles.stockMin}>/ Tối thiểu: {item.minQuantity}</Text>
          </View>
        </View>

        <View style={styles.progressBarBackground}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${Math.max(stockRatio * 100, item.quantity > 0 ? 6 : 0)}%`,
                backgroundColor:
                  item.quantity === 0
                    ? "#dc2626"
                    : item.quantity <= item.minQuantity
                    ? "#f59e0b"
                    : "#10b981",
              },
            ]}
          />
        </View>
      </View>

      {/* Thông tin Lô & Hạn dùng */}
      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Ionicons name="barcode-outline" size={14} color="#64748b" />
          <Text style={styles.metaText}>Lô: {item.batchNumber}</Text>
        </View>

        <View style={styles.metaItem}>
          <Ionicons
            name="calendar-outline"
            size={14}
            color={isExpired() ? "#dc2626" : isExpiringSoon() ? "#ea580c" : "#64748b"}
          />
          <Text
            style={[
              styles.metaText,
              isExpired() && { color: "#dc2626", fontWeight: "700" },
              isExpiringSoon() && { color: "#ea580c", fontWeight: "600" },
            ]}
          >
            HSD: {item.expiryDate}
          </Text>
        </View>
      </View>

      {/* Vị trí lưu kho & Nhà cung cấp */}
      <View style={styles.locationRow}>
        <Ionicons name="location-outline" size={14} color="#059669" />
        <Text style={styles.locationText} numberOfLines={1}>
          {item.warehouseLocation}
        </Text>
      </View>

      {/* Action Buttons Row 1: Nhập kho & Xuất kho */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.actionBtnIn}
          onPress={() => onStockIn(item)}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-down-circle" size={15} color="#059669" />
          <Text style={styles.actionBtnInText}>Nhập kho</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtnOut}
          onPress={() => onStockOut(item)}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-up-circle" size={15} color="#0284c7" />
          <Text style={styles.actionBtnOutText}>Xuất kho</Text>
        </TouchableOpacity>
      </View>

      {/* Action Buttons Row 2: Chi tiết, Sửa, Xóa */}
      <View style={styles.subActionsRow}>
        <TouchableOpacity
          style={styles.actionBtnDetail}
          onPress={() => onDetail(item)}
          activeOpacity={0.7}
        >
          <Ionicons name="eye-outline" size={14} color="#475569" />
          <Text style={styles.actionBtnDetailText}>Chi tiết</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtnEdit}
          onPress={() => onEdit?.(item)}
          activeOpacity={0.7}
        >
          <Ionicons name="create-outline" size={14} color="#2563eb" />
          <Text style={styles.actionBtnEditText}>Sửa</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtnDelete}
          onPress={() => onDelete?.(item)}
          activeOpacity={0.7}
        >
          <Ionicons name="trash-outline" size={14} color="#dc2626" />
          <Text style={styles.actionBtnDeleteText}>Xóa</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  codePill: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  codeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#334155",
  },
  categoryPill: {
    backgroundColor: "#f0fdfa",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    flex: 1,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: "500",
    color: "#0d9488",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
  },
  nameText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
    lineHeight: 21,
    marginBottom: 10,
  },
  stockSection: {
    backgroundColor: "#f8fafc",
    padding: 10,
    borderRadius: 12,
    marginBottom: 10,
  },
  stockTextRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  stockLabel: {
    fontSize: 12,
    color: "#64748b",
  },
  stockValues: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  stockCurrent: {
    fontSize: 15,
    fontWeight: "800",
    color: "#059669",
  },
  stockMin: {
    fontSize: 12,
    color: "#94a3b8",
  },
  progressBarBackground: {
    height: 6,
    backgroundColor: "#e2e8f0",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  metaText: {
    fontSize: 12,
    color: "#64748b",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  locationText: {
    fontSize: 12,
    color: "#059669",
    fontWeight: "500",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  actionBtnIn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ecfdf5",
    paddingVertical: 9,
    borderRadius: 10,
    gap: 4,
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  actionBtnInText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#059669",
  },
  actionBtnOut: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f0f9ff",
    paddingVertical: 9,
    borderRadius: 10,
    gap: 4,
    borderWidth: 1,
    borderColor: "#bae6fd",
  },
  actionBtnOutText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0284c7",
  },
  actionBtnDetail: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  actionBtnDetailText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#475569",
  },
  subActionsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  actionBtnEdit: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  actionBtnEditText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2563eb",
  },
  actionBtnDelete: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecdd3",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  actionBtnDeleteText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#dc2626",
  },
});
