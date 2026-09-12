import React, { useMemo, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { InventoryBatchItem, InventorySupply } from "./types";
import { formatDateVN } from "../../features/credentials/DatePickerModal";
import { DateFilterPill, SearchInput } from "../common";

interface BatchesViewProps {
  supplies: InventorySupply[];
  loading: boolean;
  onRefresh: () => void;
}

export function BatchesView({ supplies, loading, onRefresh }: BatchesViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "warning" | "valid">("all");
  const [expiryFilterDate, setExpiryFilterDate] = useState("");

  // Chuyển đổi supplies thành danh sách lô hàng chi tiết
  const batches: InventoryBatchItem[] = useMemo(() => {
    const now = Date.now();
    return supplies
      .filter((s) => Boolean(s.batchNumber && s.batchNumber !== "N/A"))
      .map((s) => {
        let daysToExpiry = 999;
        let expiryStatus: "valid" | "warning" | "expired" = "valid";

        if (s.expiryDate) {
          const expTime = new Date(s.expiryDate).getTime();
          daysToExpiry = Math.round((expTime - now) / (1000 * 60 * 60 * 24));
          if (daysToExpiry < 0) {
            expiryStatus = "expired";
          } else if (daysToExpiry <= 60) {
            expiryStatus = "warning";
          }
        }

        return {
          id: `batch-${s.id}`,
          supplyId: s.id,
          supplyCode: s.code,
          supplyName: s.name,
          category: s.category,
          unit: s.unit,
          batchNumber: s.batchNumber,
          manufactureDate: s.manufactureDate || "N/A",
          expiryDate: s.expiryDate || "Không giới hạn",
          quantity: s.quantity,
          warehouseName: s.warehouseName || "Kho chính",
          warehouseLocation: s.warehouseLocation,
          supplierName: s.supplierName,
          daysToExpiry,
          expiryStatus,
        };
      })
      .sort((a, b) => a.daysToExpiry - b.daysToExpiry); // Sắp xếp theo quy tắc FEFO (Hạn gần nhất lên đầu)
  }, [supplies]);

  // Bộ lọc
  const filteredBatches = useMemo(() => {
    let list = batches;
    if (filterStatus === "warning") {
      list = list.filter((b) => b.expiryStatus === "warning" || b.expiryStatus === "expired");
    } else if (filterStatus === "valid") {
      list = list.filter((b) => b.expiryStatus === "valid");
    }

    if (expiryFilterDate) {
      const vnDate = formatDateVN(expiryFilterDate);
      list = list.filter(
        (b) => b.expiryDate.includes(expiryFilterDate) || b.expiryDate.includes(vnDate),
      );
    }

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter(
      (b) =>
        b.batchNumber.toLowerCase().includes(q) ||
        b.supplyName.toLowerCase().includes(q) ||
        b.supplyCode.toLowerCase().includes(q) ||
        b.warehouseLocation.toLowerCase().includes(q),
    );
  }, [batches, filterStatus, expiryFilterDate, searchQuery]);

  const warningCount = batches.filter(
    (b) => b.expiryStatus === "warning" || b.expiryStatus === "expired",
  ).length;

  const renderBatchCard = ({ item }: { item: InventoryBatchItem }) => {
    const isExpired = item.expiryStatus === "expired";
    const isWarning = item.expiryStatus === "warning";

    return (
      <View style={[styles.card, isExpired && styles.cardExpired, isWarning && styles.cardWarning]}>
        {/* Header lô: Mã Lô & Trạng thái FEFO */}
        <View style={styles.cardHeader}>
          <View style={styles.batchBadge}>
            <Ionicons name="barcode" size={14} color="#059669" />
            <Text style={styles.batchBadgeText}>Số Lô: {item.batchNumber}</Text>
          </View>

          {isExpired ? (
            <View style={[styles.statusTag, styles.tagExpired]}>
              <Ionicons name="alert-circle" size={12} color="#dc2626" />
              <Text style={styles.textExpired}>Đã quá hạn</Text>
            </View>
          ) : isWarning ? (
            <View style={[styles.statusTag, styles.tagWarning]}>
              <Ionicons name="warning" size={12} color="#ea580c" />
              <Text style={styles.textWarning}>Cận hạn ({item.daysToExpiry} ngày)</Text>
            </View>
          ) : (
            <View style={[styles.statusTag, styles.tagValid]}>
              <Ionicons name="checkmark-circle" size={12} color="#059669" />
              <Text style={styles.textValid}>An toàn ({item.daysToExpiry} ngày)</Text>
            </View>
          )}
        </View>

        {/* Tên vật tư & Số lượng tồn của Lô */}
        <View style={styles.bodyRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.supplyName} numberOfLines={2}>
              {item.supplyName}
            </Text>
            <Text style={styles.supplyCode}>
              {item.supplyCode} • {item.category}
            </Text>
          </View>

          <View style={styles.quantityBox}>
            <Text style={styles.quantityNum}>{item.quantity}</Text>
            <Text style={styles.unitText}>{item.unit} tồn</Text>
          </View>
        </View>

        {/* Dòng thời gian: NSX -> HSD */}
        <View style={styles.datesRow}>
          <View style={styles.dateCol}>
            <Text style={styles.dateLabel}>Ngày sản xuất (NSX)</Text>
            <Text style={styles.dateValue}>{formatDateVN(item.manufactureDate) || "N/A"}</Text>
          </View>

          <Ionicons name="arrow-forward" size={14} color="#94a3b8" />

          <View style={styles.dateCol}>
            <Text style={styles.dateLabel}>Hạn sử dụng (HSD)</Text>
            <Text
              style={[
                styles.dateValue,
                isExpired && { color: "#dc2626", fontWeight: "700" },
                isWarning && { color: "#ea580c", fontWeight: "700" },
              ]}
            >
              {formatDateVN(item.expiryDate) || "Không giới hạn"}
            </Text>
          </View>
        </View>

        {/* Vị trí lưu kho & Nhà cung cấp */}
        <View style={styles.footerRow}>
          <View style={styles.locCol}>
            <Ionicons name="location-outline" size={13} color="#059669" />
            <Text style={styles.locText} numberOfLines={1}>
              {item.warehouseLocation}
            </Text>
          </View>

          <Text style={styles.supplierText} numberOfLines={1}>
            {item.supplierName}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Search & Filter */}
      <View style={styles.topControl}>
        <SearchInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Tìm theo số lô LOT, tên thuốc, vị trí..."
        />

        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterChip, filterStatus === "all" && styles.filterChipActive]}
            onPress={() => setFilterStatus("all")}
          >
            <Text style={[styles.filterChipText, filterStatus === "all" && styles.filterChipTextActive]}>
              Tất cả lô ({batches.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, filterStatus === "warning" && styles.filterChipActiveWarn]}
            onPress={() => setFilterStatus("warning")}
          >
            <Ionicons name="alert-circle" size={13} color={filterStatus === "warning" ? "#ffffff" : "#ea580c"} />
            <Text style={[styles.filterChipText, filterStatus === "warning" && styles.filterChipTextActive]}>
              Cận hạn & Quá hạn ({warningCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, filterStatus === "valid" && styles.filterChipActive]}
            onPress={() => setFilterStatus("valid")}
          >
            <Text style={[styles.filterChipText, filterStatus === "valid" && styles.filterChipTextActive]}>
              Còn hạn an toàn ({batches.length - warningCount})
            </Text>
          </TouchableOpacity>

          <DateFilterPill
            value={expiryFilterDate}
            onChange={setExpiryFilterDate}
            label="Hạn dùng"
            title="Lọc lô theo ngày hết hạn"
          />
        </View>
      </View>

      {/* FEFO Banner */}
      <View style={styles.fefoBanner}>
        <Ionicons name="information-circle-outline" size={16} color="#0284c7" />
        <Text style={styles.fefoBannerText}>
          Danh sách ưu tiên theo quy tắc <Text style={{ fontWeight: "700" }}>FEFO</Text> (Lô có hạn dùng gần nhất được ưu tiên xuất trước).
        </Text>
      </View>

      {/* List */}
      <FlatList
        data={filteredBatches}
        keyExtractor={(item) => item.id}
        renderItem={renderBatchCard}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={onRefresh} colors={["#059669"]} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="barcode-outline" size={54} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>Chưa có dữ liệu lô hàng nào</Text>
            <Text style={styles.emptySubtitle}>
              Khi có thuốc và vật tư y tế được nhập kho với số lô và ngày hết hạn, danh sách sẽ hiển thị tại đây.
            </Text>
          </View>
        }
      />
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
    flexWrap: "wrap",
    alignItems: "center",
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
  filterChipActiveWarn: {
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
  fefoBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f0f9ff",
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#bae6fd",
  },
  fefoBannerText: {
    flex: 1,
    fontSize: 11,
    color: "#0369a1",
    lineHeight: 16,
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
    gap: 10,
    overflow: "hidden",
  },
  cardExpired: {
    borderColor: "#fecdd3",
    backgroundColor: "#fff5f5",
  },
  cardWarning: {
    borderColor: "#fed7aa",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  batchBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  batchBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#065f46",
  },
  statusTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  tagValid: {
    backgroundColor: "#ecfdf5",
  },
  tagWarning: {
    backgroundColor: "#fff7ed",
  },
  tagExpired: {
    backgroundColor: "#fef2f2",
  },
  textValid: {
    fontSize: 11,
    fontWeight: "700",
    color: "#059669",
  },
  textWarning: {
    fontSize: 11,
    fontWeight: "700",
    color: "#ea580c",
  },
  textExpired: {
    fontSize: 11,
    fontWeight: "700",
    color: "#dc2626",
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
  quantityNum: {
    fontSize: 18,
    fontWeight: "800",
    color: "#059669",
  },
  unitText: {
    fontSize: 11,
    color: "#64748b",
  },
  datesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    padding: 10,
    borderRadius: 10,
  },
  dateCol: {
    gap: 2,
  },
  dateLabel: {
    fontSize: 10,
    color: "#94a3b8",
    fontWeight: "600",
    textTransform: "uppercase",
  },
  dateValue: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 4,
  },
  locCol: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    maxWidth: "60%",
  },
  locText: {
    fontSize: 11,
    color: "#059669",
    fontWeight: "600",
  },
  supplierText: {
    fontSize: 11,
    color: "#94a3b8",
    maxWidth: "38%",
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
