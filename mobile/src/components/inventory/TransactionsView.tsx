import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { InventoryTransaction } from "./types";

interface TransactionsViewProps {
  transactions: InventoryTransaction[];
  loading: boolean;
  onRefresh: () => void;
  typeFilter: "all" | "in" | "out";
  onChangeTypeFilter: (type: "all" | "in" | "out") => void;
  searchQuery: string;
  onChangeSearch: (text: string) => void;
  onNewTransactionPress?: (type: "in" | "out") => void;
}

export function TransactionsView({
  transactions,
  loading,
  onRefresh,
  typeFilter,
  onChangeTypeFilter,
  searchQuery,
  onChangeSearch,
  onNewTransactionPress,
}: TransactionsViewProps) {
  const inCount = transactions.filter((t) => t.type === "in").length;
  const outCount = transactions.filter((t) => t.type === "out").length;

  const renderTransactionItem = ({ item }: { item: InventoryTransaction }) => {
    const isIn = item.type === "in";

    return (
      <View style={styles.card}>
        {/* Header phiếu: Mã phiếu & Loại giao dịch */}
        <View style={styles.cardHeader}>
          <View style={styles.codeRow}>
            <View style={[styles.typeBadge, isIn ? styles.badgeIn : styles.badgeOut]}>
              <Ionicons
                name={isIn ? "arrow-down-circle" : "arrow-up-circle"}
                size={14}
                color={isIn ? "#059669" : "#ea580c"}
              />
              <Text style={[styles.typeBadgeText, isIn ? styles.textIn : styles.textOut]}>
                {isIn ? "Phiếu Nhập Kho" : "Phiếu Xuất Cấp"}
              </Text>
            </View>
            <Text style={styles.voucherCode}>{item.voucherCode}</Text>
          </View>
          <Text style={styles.timeText}>{item.createdAt}</Text>
        </View>

        {/* Tên vật tư & số lượng */}
        <View style={styles.bodyRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.supplyName} numberOfLines={2}>
              {item.supplyName}
            </Text>
            <Text style={styles.supplyCode}>Mã: {item.supplyCode}</Text>
          </View>

          <View style={styles.quantityBox}>
            <Text style={[styles.quantityBig, isIn ? styles.textIn : styles.textOut]}>
              {isIn ? `+${item.quantity}` : `-${item.quantity}`}
            </Text>
            <Text style={styles.unitText}>{item.unit}</Text>
          </View>
        </View>

        {/* Thông tin số lô & HSD (nếu có) */}
        {item.batchNumber && (
          <View style={styles.metaRow}>
            <Ionicons name="barcode-outline" size={13} color="#64748b" />
            <Text style={styles.metaText}>Lô: {item.batchNumber}</Text>
            {item.expiryDate && (
              <>
                <Text style={styles.dot}>•</Text>
                <Ionicons name="calendar-outline" size={13} color="#64748b" />
                <Text style={styles.metaText}>HSD: {item.expiryDate}</Text>
              </>
            )}
          </View>
        )}

        {/* Thông tin Khoa/Phòng nhận & Người thực hiện */}
        <View style={styles.footerRow}>
          <View style={styles.footerCol}>
            <Ionicons name="business-outline" size={13} color="#0284c7" />
            <Text style={styles.departmentText} numberOfLines={1}>
              {item.recipientDepartment || "Kho Dược Trung Tâm"}
            </Text>
          </View>

          <View style={styles.footerCol}>
            <Ionicons name="person-circle-outline" size={14} color="#64748b" />
            <Text style={styles.performerText} numberOfLines={1}>
              {item.performerName || "Nhân viên"}
            </Text>
          </View>
        </View>

        {/* Lý do giao dịch */}
        {item.reason && (
          <View style={styles.reasonBox}>
            <Text style={styles.reasonText} numberOfLines={2}>
              <Text style={{ fontWeight: "700", color: "#475569" }}>Lý do: </Text>
              {item.reason}
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Search Bar & Filter Types */}
      <View style={styles.topControl}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={17} color="#94a3b8" style={{ marginLeft: 10 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm theo mã phiếu, tên thuốc, khoa phòng..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={onChangeSearch}
            clearButtonMode="while-editing"
          />
        </View>

        {/* Filter Pills */}
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterChip, typeFilter === "all" && styles.filterChipActive]}
            onPress={() => onChangeTypeFilter("all")}
          >
            <Text style={[styles.filterChipText, typeFilter === "all" && styles.filterChipTextActive]}>
              Tất cả ({transactions.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, typeFilter === "in" && styles.filterChipActiveIn]}
            onPress={() => onChangeTypeFilter("in")}
          >
            <Ionicons name="arrow-down" size={13} color={typeFilter === "in" ? "#ffffff" : "#059669"} />
            <Text style={[styles.filterChipText, typeFilter === "in" && styles.filterChipTextActive]}>
              Nhập kho ({inCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, typeFilter === "out" && styles.filterChipActiveOut]}
            onPress={() => onChangeTypeFilter("out")}
          >
            <Ionicons name="arrow-up" size={13} color={typeFilter === "out" ? "#ffffff" : "#ea580c"} />
            <Text style={[styles.filterChipText, typeFilter === "out" && styles.filterChipTextActive]}>
              Xuất cấp ({outCount})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Loading state */}
      {loading && transactions.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#059669" />
          <Text style={styles.loadingText}>Đang tải lịch sử nhập xuất kho...</Text>
        </View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item) => item.id}
          renderItem={renderTransactionItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={onRefresh} colors={["#059669"]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="receipt-outline" size={54} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>Chưa có giao dịch nhập/xuất nào</Text>
              <Text style={styles.emptySubtitle}>
                Dữ liệu phiếu nhập và phiếu xuất kho từ hệ thống sẽ hiển thị tại đây.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  topControl: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    gap: 10,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 12,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#0f172a",
    paddingHorizontal: 10,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#f1f5f9",
  },
  filterChipActive: {
    backgroundColor: "#059669",
  },
  filterChipActiveIn: {
    backgroundColor: "#059669",
  },
  filterChipActiveOut: {
    backgroundColor: "#ea580c",
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
  },
  filterChipTextActive: {
    color: "#ffffff",
    fontWeight: "700",
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    gap: 8,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeIn: {
    backgroundColor: "#ecfdf5",
  },
  badgeOut: {
    backgroundColor: "#fff7ed",
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  textIn: {
    color: "#059669",
  },
  textOut: {
    color: "#ea580c",
  },
  voucherCode: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
  },
  timeText: {
    fontSize: 11,
    color: "#94a3b8",
  },
  bodyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  supplyName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
    lineHeight: 19,
  },
  supplyCode: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
  },
  quantityBox: {
    alignItems: "flex-end",
  },
  quantityBig: {
    fontSize: 18,
    fontWeight: "800",
  },
  unitText: {
    fontSize: 11,
    color: "#64748b",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
  },
  metaText: {
    fontSize: 11,
    color: "#64748b",
  },
  dot: {
    color: "#cbd5e1",
    marginHorizontal: 4,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  footerCol: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    maxWidth: "50%",
  },
  departmentText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#0284c7",
  },
  performerText: {
    fontSize: 11,
    color: "#64748b",
  },
  reasonBox: {
    backgroundColor: "#f8fafc",
    padding: 8,
    borderRadius: 8,
  },
  reasonText: {
    fontSize: 11,
    color: "#64748b",
    lineHeight: 15,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: "#64748b",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#475569",
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 12,
    color: "#94a3b8",
    textAlign: "center",
    paddingHorizontal: 24,
  },
});
