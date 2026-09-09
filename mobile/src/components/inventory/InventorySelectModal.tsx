import React, { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

export interface SelectOption {
  id: string;
  label: string;
  subLabel?: string;
  badge?: string;
  badgeColor?: string;
  icon?: string;
}

interface InventorySelectModalProps {
  visible: boolean;
  title: string;
  placeholderSearch?: string;
  options: SelectOption[];
  selectedValue?: string;
  onSelect: (option: SelectOption) => void;
  onClose: () => void;
  onAddNew?: () => void;
  addNewLabel?: string;
}

export const InventorySelectModal: React.FC<InventorySelectModalProps> = ({
  visible,
  title,
  placeholderSearch = "Tìm kiếm...",
  options,
  selectedValue,
  onSelect,
  onClose,
  onAddNew,
  addNewLabel,
}) => {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase().trim();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.subLabel && opt.subLabel.toLowerCase().includes(q)),
    );
  }, [options, search]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleBox}>
              <Text style={styles.headerTitle}>{title}</Text>
              <Text style={styles.headerSubtitle}>{options.length} lựa chọn khả dụng</Text>
            </View>

            <View style={styles.headerRight}>
              {onAddNew && (
                <TouchableOpacity
                  style={styles.addNewBtn}
                  onPress={() => {
                    onClose();
                    onAddNew();
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={16} color="#059669" />
                  <Text style={styles.addNewText}>{addNewLabel || "Thêm mới"}</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={10}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <Ionicons name="search-outline" size={18} color="#94a3b8" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder={placeholderSearch}
              placeholderTextColor="#94a3b8"
              value={search}
              onChangeText={setSearch}
              clearButtonMode="while-editing"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch("")}>
                <Ionicons name="close-circle" size={18} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>

          {/* Options List */}
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const isSelected = selectedValue === item.id || selectedValue === item.label;
              return (
                <TouchableOpacity
                  style={[styles.itemCard, isSelected && styles.itemCardSelected]}
                  onPress={() => {
                    onSelect(item);
                    onClose();
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.itemLeft}>
                    <View
                      style={[
                        styles.iconCircle,
                        item.badgeColor
                          ? { backgroundColor: `${item.badgeColor}15` }
                          : { backgroundColor: "#f1f5f9" },
                      ]}
                    >
                      <Ionicons
                        name={(item.icon as any) || "ellipse"}
                        size={18}
                        color={item.badgeColor || "#059669"}
                      />
                    </View>

                    <View style={styles.itemInfo}>
                      <View style={styles.labelRow}>
                        <Text
                          style={[styles.itemLabel, isSelected && styles.itemLabelSelected]}
                          numberOfLines={1}
                        >
                          {item.label}
                        </Text>
                        {item.badge && (
                          <View
                            style={[
                              styles.itemBadge,
                              item.badgeColor ? { backgroundColor: `${item.badgeColor}20` } : null,
                            ]}
                          >
                            <Text
                              style={[
                                styles.itemBadgeText,
                                item.badgeColor ? { color: item.badgeColor } : null,
                              ]}
                            >
                              {item.badge}
                            </Text>
                          </View>
                        )}
                      </View>

                      {item.subLabel ? (
                        <Text style={styles.itemSubLabel} numberOfLines={1}>
                          {item.subLabel}
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={22} color="#059669" />
                  )}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Ionicons name="file-tray-outline" size={36} color="#cbd5e1" />
                <Text style={styles.emptyText}>Không tìm thấy kết quả phù hợp</Text>
              </View>
            }
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
    minHeight: "50%",
    paddingTop: 16,
    paddingBottom: 24,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  headerTitleBox: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0f172a",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  addNewBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#a7f3d0",
    gap: 4,
  },
  addNewText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#059669",
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#0f172a",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 20,
  },
  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  itemCardSelected: {
    backgroundColor: "#f0fdf4",
    borderColor: "#86efac",
  },
  itemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 10,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  itemLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1e293b",
  },
  itemLabelSelected: {
    color: "#059669",
  },
  itemBadge: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  itemBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748b",
  },
  itemSubLabel: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  emptyBox: {
    paddingVertical: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 13,
    color: "#94a3b8",
    marginTop: 8,
  },
});
