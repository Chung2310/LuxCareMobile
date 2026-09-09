import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { InventoryCategory } from "./types";
import { CategoryFormModal } from "./CategoryFormModal";

interface CategoriesViewProps {
  categories: InventoryCategory[];
  loading: boolean;
  onRefresh: () => void;
  onSelectCategory: (categoryName: string) => void;
  onAddCategory?: (data: {
    name: string;
    code: string;
    description?: string;
    color?: string;
  }) => Promise<void>;
  onEditCategory?: (
    id: string,
    data: { name: string; code: string; description?: string; color?: string },
  ) => Promise<void>;
  onDeleteCategory?: (category: InventoryCategory) => void;
}

export function CategoriesView({
  categories,
  loading,
  onRefresh,
  onSelectCategory,
  onAddCategory,
  onEditCategory,
  onDeleteCategory,
}: CategoriesViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [formModal, setFormModal] = useState<{
    visible: boolean;
    item: InventoryCategory | null;
  }>({
    visible: false,
    item: null,
  });

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;
    const q = searchQuery.toLowerCase().trim();
    return categories.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q),
    );
  }, [categories, searchQuery]);

  const handleCreate = () => {
    setFormModal({ visible: true, item: null });
  };

  const handleEdit = (item: InventoryCategory) => {
    setFormModal({ visible: true, item });
  };

  const handleDelete = (item: InventoryCategory) => {
    Alert.alert(
      "Xác nhận xóa phân loại",
      `Bạn có chắc chắn muốn xóa danh mục "${item.name}" (Mã: ${item.code}) không?\nCác mặt hàng thuộc danh mục này vẫn sẽ được giữ lại.`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xóa",
          style: "destructive",
          onPress: () => onDeleteCategory?.(item),
        },
      ],
    );
  };

  const handleFormSubmit = async (formData: {
    name: string;
    code: string;
    description?: string;
    color?: string;
  }) => {
    if (formModal.item && onEditCategory) {
      await onEditCategory(formModal.item.id, formData);
    } else if (onAddCategory) {
      await onAddCategory(formData);
    }
  };

  const renderCategoryCard = ({ item }: { item: InventoryCategory }) => {
    return (
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.cardHeader}
          onPress={() => onSelectCategory(item.name)}
          activeOpacity={0.7}
        >
          <View style={[styles.iconBox, { backgroundColor: `${item.color}15` }]}>
            <Ionicons name={(item.icon as any) || "layers"} size={22} color={item.color} />
          </View>

          <View style={styles.contentCol}>
            <View style={styles.titleRow}>
              <Text style={styles.categoryName} numberOfLines={1}>
                {item.name}
              </Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.itemCount} SP</Text>
              </View>
            </View>

            <Text style={styles.codeText}>Mã: {item.code}</Text>

            {item.description && (
              <Text style={styles.descText} numberOfLines={2}>
                {item.description}
              </Text>
            )}
          </View>
        </TouchableOpacity>

        {/* Action Row: Lọc SP, Sửa, Xóa */}
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.actionBtnFilter}
            onPress={() => onSelectCategory(item.name)}
            activeOpacity={0.7}
          >
            <Ionicons name="filter-outline" size={14} color="#059669" />
            <Text style={styles.actionBtnFilterText}>Xem sản phẩm</Text>
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
      {/* Search & Top Action */}
      <View style={styles.topControl}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={17} color="#94a3b8" style={{ marginLeft: 10 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm kiếm danh mục phân loại..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryText}>Tổng cộng {categories.length} phân loại y tế</Text>
          <TouchableOpacity
            style={styles.addCategoryBtn}
            onPress={handleCreate}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={16} color="#ffffff" />
            <Text style={styles.addCategoryBtnText}>Thêm phân loại</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* List */}
      {loading && categories.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#059669" />
          <Text style={styles.loadingText}>Đang tải danh mục phân loại...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredCategories}
          keyExtractor={(item) => item.id}
          renderItem={renderCategoryCard}
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
              <Ionicons name="layers-outline" size={48} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>Chưa có danh mục nào</Text>
              <Text style={styles.emptySubtitle}>Bấm "+ Thêm phân loại" để tạo danh mục đầu tiên.</Text>
            </View>
          }
        />
      )}

      {/* Form Modal Thêm / Sửa */}
      <CategoryFormModal
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
  addCategoryBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#059669",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 4,
  },
  addCategoryBtnText: {
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
    flexDirection: "row",
    alignItems: "center",
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  contentCol: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  categoryName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
    flex: 1,
    marginRight: 8,
  },
  badge: {
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#059669",
  },
  codeText: {
    fontSize: 12,
    color: "#64748b",
    fontFamily: "monospace",
    fontWeight: "600",
    marginTop: 2,
  },
  descText: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 4,
    lineHeight: 16,
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
