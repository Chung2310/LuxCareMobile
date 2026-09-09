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
import type { InventorySupplier } from "./types";
import { SupplierFormModal } from "./SupplierFormModal";

interface SuppliersViewProps {
  suppliers: InventorySupplier[];
  loading: boolean;
  onRefresh: () => void;
  onAddSupplier?: (data: {
    name: string;
    code: string;
    phone?: string;
    email?: string;
    address?: string;
    contactPerson?: string;
    taxCode?: string;
  }) => Promise<void>;
  onEditSupplier?: (
    id: string,
    data: {
      name: string;
      code: string;
      phone?: string;
      email?: string;
      address?: string;
      contactPerson?: string;
      taxCode?: string;
    },
  ) => Promise<void>;
  onDeleteSupplier?: (supplier: InventorySupplier) => void;
}

export function SuppliersView({
  suppliers,
  loading,
  onRefresh,
  onAddSupplier,
  onEditSupplier,
  onDeleteSupplier,
}: SuppliersViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [formModal, setFormModal] = useState<{
    visible: boolean;
    item: InventorySupplier | null;
  }>({
    visible: false,
    item: null,
  });

  const filteredSuppliers = useMemo(() => {
    if (!searchQuery.trim()) return suppliers;
    const q = searchQuery.toLowerCase().trim();
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        s.contactPerson.toLowerCase().includes(q) ||
        s.phone.includes(q),
    );
  }, [suppliers, searchQuery]);

  const handleCallPhone = (phone: string) => {
    if (!phone) return;
    const cleaned = phone.replace(/[^0-9+]/g, "");
    Linking.openURL(`tel:${cleaned}`).catch(() => {});
  };

  const handleSendEmail = (email: string) => {
    if (!email) return;
    Linking.openURL(`mailto:${email}`).catch(() => {});
  };

  const handleCreate = () => {
    setFormModal({ visible: true, item: null });
  };

  const handleEdit = (item: InventorySupplier) => {
    setFormModal({ visible: true, item });
  };

  const handleDelete = (item: InventorySupplier) => {
    Alert.alert(
      "Xác nhận xóa nhà cung cấp",
      `Bạn có chắc chắn muốn ngừng hợp tác / xóa nhà cung cấp "${item.name}" (Mã: ${item.code}) không?`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xóa",
          style: "destructive",
          onPress: () => onDeleteSupplier?.(item),
        },
      ],
    );
  };

  const handleFormSubmit = async (formData: {
    name: string;
    code: string;
    phone?: string;
    email?: string;
    address?: string;
    contactPerson?: string;
    taxCode?: string;
  }) => {
    if (formModal.item && onEditSupplier) {
      await onEditSupplier(formModal.item.id, formData);
    } else if (onAddSupplier) {
      await onAddSupplier(formData);
    }
  };

  const renderSupplierCard = ({ item }: { item: InventorySupplier }) => {
    return (
      <View style={styles.card}>
        {/* Header: Tên NCC & Mã */}
        <View style={styles.headerRow}>
          <View style={styles.nameCol}>
            <View style={styles.titleWithIcon}>
              <Ionicons name="business" size={16} color="#059669" />
              <Text style={styles.supplierName} numberOfLines={2}>
                {item.name}
              </Text>
            </View>
            <Text style={styles.codeText}>Mã: {item.code}</Text>
          </View>

          <View style={styles.countBadge}>
            <Text style={styles.countNum}>{item.suppliedItemsCount}</Text>
            <Text style={styles.countLabel}>Mặt hàng</Text>
          </View>
        </View>

        {/* Đại diện liên hệ */}
        {item.contactPerson && (
          <View style={styles.contactRow}>
            <Ionicons name="person-outline" size={14} color="#64748b" />
            <Text style={styles.contactText}>
              Đại diện: <Text style={{ fontWeight: "700", color: "#334155" }}>{item.contactPerson}</Text>
            </Text>
          </View>
        )}

        {/* Địa chỉ */}
        {item.address && (
          <View style={styles.addressRow}>
            <Ionicons name="location-outline" size={14} color="#64748b" />
            <Text style={styles.addressText} numberOfLines={2}>
              {item.address}
            </Text>
          </View>
        )}

        {/* Mã số thuế */}
        {item.taxCode ? (
          <View style={styles.taxRow}>
            <Ionicons name="receipt-outline" size={14} color="#64748b" />
            <Text style={styles.taxText}>MST: {item.taxCode}</Text>
          </View>
        ) : null}

        {/* Actions Row 1: Gọi & Email */}
        <View style={styles.quickContactRow}>
          {item.phone ? (
            <TouchableOpacity
              style={styles.callBtn}
              onPress={() => handleCallPhone(item.phone)}
              activeOpacity={0.7}
            >
              <Ionicons name="call" size={14} color="#059669" />
              <Text style={styles.callBtnText}>Gọi {item.phone}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.callBtnDisabled}>
              <Text style={styles.disabledText}>Chưa có SĐT</Text>
            </View>
          )}

          {item.email ? (
            <TouchableOpacity
              style={styles.emailBtn}
              onPress={() => handleSendEmail(item.email)}
              activeOpacity={0.7}
            >
              <Ionicons name="mail" size={14} color="#0284c7" />
              <Text style={styles.emailBtnText}>Gửi Email</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Actions Row 2: Sửa & Xóa */}
        <View style={styles.crudActionsRow}>
          <TouchableOpacity
            style={styles.actionBtnEdit}
            onPress={() => handleEdit(item)}
            activeOpacity={0.7}
          >
            <Ionicons name="create-outline" size={14} color="#2563eb" />
            <Text style={styles.actionBtnEditText}>Chỉnh sửa thông tin</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtnDelete}
            onPress={() => handleDelete(item)}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={14} color="#dc2626" />
            <Text style={styles.actionBtnDeleteText}>Xóa NCC</Text>
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
            placeholder="Tìm theo tên, mã, người liên hệ, SĐT..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryText}>Tổng cộng {suppliers.length} nhà cung ứng</Text>
          <TouchableOpacity
            style={styles.addSupplierBtn}
            onPress={handleCreate}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={16} color="#ffffff" />
            <Text style={styles.addSupplierBtnText}>Thêm NCC mới</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* List */}
      {loading && suppliers.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#059669" />
          <Text style={styles.loadingText}>Đang tải danh sách đối tác cung ứng...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredSuppliers}
          keyExtractor={(item) => item.id}
          renderItem={renderSupplierCard}
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
              <Ionicons name="business-outline" size={48} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>Chưa có nhà cung cấp nào</Text>
              <Text style={styles.emptySubtitle}>Bấm "+ Thêm NCC mới" để lưu thông tin đối tác.</Text>
            </View>
          }
        />
      )}

      {/* Form Modal Thêm / Sửa */}
      <SupplierFormModal
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
  addSupplierBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#059669",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 4,
  },
  addSupplierBtnText: {
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
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  nameCol: {
    flex: 1,
    marginRight: 10,
  },
  titleWithIcon: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  supplierName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
    flex: 1,
    lineHeight: 20,
  },
  codeText: {
    fontSize: 12,
    color: "#64748b",
    fontFamily: "monospace",
    fontWeight: "600",
    marginTop: 2,
  },
  countBadge: {
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    alignItems: "center",
  },
  countNum: {
    fontSize: 13,
    fontWeight: "800",
    color: "#059669",
  },
  countLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#059669",
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
  contactText: {
    fontSize: 12,
    color: "#64748b",
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  addressText: {
    fontSize: 12,
    color: "#64748b",
    lineHeight: 16,
    flex: 1,
  },
  taxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  taxText: {
    fontSize: 12,
    color: "#64748b",
    fontFamily: "monospace",
  },
  quickContactRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  callBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ecfdf5",
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#a7f3d0",
    gap: 4,
  },
  callBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#059669",
  },
  callBtnDisabled: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  disabledText: {
    fontSize: 11,
    color: "#94a3b8",
  },
  emailBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f0f9ff",
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#bae6fd",
    gap: 4,
  },
  emailBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0284c7",
  },
  crudActionsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  actionBtnEdit: {
    flex: 1.4,
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
