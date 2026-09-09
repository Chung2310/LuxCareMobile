import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { InventoryWarehouse } from "./types";
import { WarehouseFormModal } from "./WarehouseFormModal";

interface WarehousesViewProps {
  warehouses: InventoryWarehouse[];
  loading: boolean;
  onRefresh: () => void;
  onSelectWarehouse?: (warehouse: InventoryWarehouse) => void;
  onAddWarehouse?: (data: {
    name: string;
    code: string;
    location: string;
    managerName?: string;
    managerPhone?: string;
    description?: string;
  }) => Promise<void>;
  onEditWarehouse?: (
    id: string,
    data: {
      name: string;
      code: string;
      location: string;
      managerName?: string;
      managerPhone?: string;
      description?: string;
    },
  ) => Promise<void>;
  onDeleteWarehouse?: (warehouse: InventoryWarehouse) => void;
}

export function WarehousesView({
  warehouses,
  loading,
  onRefresh,
  onSelectWarehouse,
  onAddWarehouse,
  onEditWarehouse,
  onDeleteWarehouse,
}: WarehousesViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [formModal, setFormModal] = useState<{
    visible: boolean;
    item: InventoryWarehouse | null;
  }>({
    visible: false,
    item: null,
  });

  const filteredWarehouses = useMemo(() => {
    if (!searchQuery.trim()) return warehouses;
    const q = searchQuery.toLowerCase().trim();
    return warehouses.filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        w.code.toLowerCase().includes(q) ||
        w.location.toLowerCase().includes(q) ||
        w.managerName.toLowerCase().includes(q),
    );
  }, [warehouses, searchQuery]);

  const handleCallManager = (phone: string) => {
    if (!phone) return;
    const cleaned = phone.replace(/[^0-9+]/g, "");
    Linking.openURL(`tel:${cleaned}`).catch(() => {});
  };

  const handleCreate = () => {
    setFormModal({ visible: true, item: null });
  };

  const handleEdit = (item: InventoryWarehouse) => {
    setFormModal({ visible: true, item });
  };

  const handleDelete = (item: InventoryWarehouse) => {
    Alert.alert(
      "Xác nhận xóa kho lưu trữ",
      `Bạn có chắc chắn muốn xóa kho "${item.name}" (Mã: ${item.code}) không?\nVui lòng đảm bảo các mặt hàng đã được chuyển kho trước khi xóa.`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xóa",
          style: "destructive",
          onPress: () => onDeleteWarehouse?.(item),
        },
      ],
    );
  };

  const handleFormSubmit = async (formData: {
    name: string;
    code: string;
    location: string;
    managerName?: string;
    managerPhone?: string;
    description?: string;
  }) => {
    if (formModal.item && onEditWarehouse) {
      await onEditWarehouse(formModal.item.id, formData);
    } else if (onAddWarehouse) {
      await onAddWarehouse(formData);
    }
  };

  const renderWarehouseCard = ({ item }: { item: InventoryWarehouse }) => {
    return (
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.cardHeader}
          onPress={() => onSelectWarehouse?.(item)}
          activeOpacity={0.7}
        >
          {/* Header Kho: Tên kho & Badge */}
          <View style={styles.headerRow}>
            <View style={styles.titleCol}>
              <View style={styles.nameRow}>
                <Ionicons name="archive" size={17} color="#059669" />
                <Text style={styles.warehouseName}>{item.name}</Text>
              </View>
              <Text style={styles.codeText}>Mã kho: {item.code}</Text>
            </View>

            <View style={styles.capacityBadge}>
              <Text style={styles.capacityNum}>{item.totalItemsCount}</Text>
              <Text style={styles.capacityLabel}>Mặt hàng</Text>
            </View>
          </View>

          {/* Vị trí tầng/khu vực */}
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={14} color="#0284c7" />
            <Text style={styles.locationText}>{item.location}</Text>
          </View>

          {/* Mô tả điều kiện bảo quản */}
          {item.description && (
            <Text style={styles.descText} numberOfLines={2}>
              {item.description}
            </Text>
          )}

          {/* Thông tin thủ kho */}
          <View style={styles.managerRow}>
            <View style={styles.managerInfo}>
              <Ionicons name="person-outline" size={14} color="#64748b" />
              <Text style={styles.managerText}>
                Thủ kho: <Text style={styles.managerBold}>{item.managerName}</Text>
              </Text>
            </View>

            {item.managerPhone ? (
              <TouchableOpacity
                style={styles.callBtn}
                onPress={() => handleCallManager(item.managerPhone)}
                activeOpacity={0.7}
              >
                <Ionicons name="call" size={13} color="#059669" />
                <Text style={styles.callText}>Gọi</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </TouchableOpacity>

        {/* Action Row: Lọc SP, Sửa, Xóa */}
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.actionBtnFilter}
            onPress={() => onSelectWarehouse?.(item)}
            activeOpacity={0.7}
          >
            <Ionicons name="filter-outline" size={14} color="#059669" />
            <Text style={styles.actionBtnFilterText}>Xem tồn kho</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtnEdit}
            onPress={() => handleEdit(item)}
            activeOpacity={0.7}
          >
            <Ionicons name="create-outline" size={14} color="#2563eb" />
            <Text style={styles.actionBtnEditText}>Sửa</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtnDelete}
            onPress={() => handleDelete(item)}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={14} color="#dc2626" />
            <Text style={styles.actionBtnDeleteText}>Xóa</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Search Header */}
      <View style={styles.topControl}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={17} color="#94a3b8" style={{ marginLeft: 10 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm theo tên kho, mã, vị trí, thủ kho..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryText}>Tổng cộng {warehouses.length} kho lưu trữ y tế</Text>
          <TouchableOpacity
            style={styles.addWarehouseBtn}
            onPress={handleCreate}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={16} color="#ffffff" />
            <Text style={styles.addWarehouseBtnText}>Thêm kho mới</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* List */}
      {loading && warehouses.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#059669" />
          <Text style={styles.loadingText}>Đang tải danh sách kho lưu trữ...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredWarehouses}
          keyExtractor={(item) => item.id}
          renderItem={renderWarehouseCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={onRefresh}
              colors={["#059669"]}
              tintColor="#059669"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="archive-outline" size={48} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>Chưa có kho lưu trữ nào</Text>
              <Text style={styles.emptySubtitle}>Bấm "+ Thêm kho mới" để thiết lập kho đầu tiên.</Text>
            </View>
          }
        />
      )}

      {/* Form Modal Thêm / Sửa */}
      <WarehouseFormModal
        visible={formModal.visible}
        item={formModal.item}
        onClose={() => setFormModal({ visible: false, item: null })}
        onSubmit={handleFormSubmit}
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
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 12,
    height: 40,
    paddingHorizontal: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#0f172a",
    paddingHorizontal: 8,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  summaryText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
  },
  addWarehouseBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#059669",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 4,
  },
  addWarehouseBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  cardHeader: {
    // container for card click
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  titleCol: {
    flex: 1,
    marginRight: 10,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  warehouseName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
    flex: 1,
  },
  codeText: {
    fontSize: 12,
    color: "#64748b",
    fontFamily: "monospace",
    fontWeight: "600",
    marginTop: 2,
  },
  capacityBadge: {
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    alignItems: "center",
  },
  capacityNum: {
    fontSize: 13,
    fontWeight: "800",
    color: "#059669",
  },
  capacityLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#059669",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
  locationText: {
    fontSize: 13,
    color: "#0284c7",
    fontWeight: "600",
  },
  descText: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 6,
    lineHeight: 16,
  },
  managerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    marginTop: 10,
  },
  managerInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  managerText: {
    fontSize: 12,
    color: "#64748b",
  },
  managerBold: {
    fontWeight: "700",
    color: "#334155",
  },
  callBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#a7f3d0",
    gap: 4,
  },
  callText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#059669",
  },
  cardActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  actionBtnFilter: {
    flex: 1.4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ecfdf5",
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#a7f3d0",
    gap: 4,
  },
  actionBtnFilterText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#059669",
  },
  actionBtnEdit: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eff6ff",
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    gap: 4,
  },
  actionBtnEditText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2563eb",
  },
  actionBtnDelete: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fef2f2",
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#fecdd3",
    gap: 4,
  },
  actionBtnDeleteText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#dc2626",
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 10,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#475569",
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 4,
    textAlign: "center",
    paddingHorizontal: 32,
  },
});
