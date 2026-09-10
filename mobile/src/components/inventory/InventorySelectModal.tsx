import React, { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SearchInput } from "../common";

export interface SelectOption {
  id: string;
  label: string;
  subLabel?: string;
  badge?: string;
  badgeColor?: string;
  icon?: string;
}

export interface SelectTab {
  id: string;
  label: string;
  count?: number;
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
  bannerNode?: React.ReactNode;
  tabs?: SelectTab[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
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
  bannerNode,
  tabs,
  activeTab,
  onTabChange,
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

          {/* Banner Context (Ví dụ: Tên NCC hiện tại) */}
          {bannerNode && <View style={styles.bannerContainer}>{bannerNode}</View>}

          {/* Filter Tabs (Ví dụ: Sản phẩm của NCC vs Tất cả) */}
          {tabs && tabs.length > 0 && (
            <View style={styles.tabsRow}>
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <TouchableOpacity
                    key={tab.id}
                    style={[styles.tabChip, isActive && styles.tabChipActive]}
                    onPress={() => onTabChange?.(tab.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.tabChipText, isActive && styles.tabChipTextActive]}>
                      {tab.label} {tab.count !== undefined ? `(${tab.count})` : ""}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Search Bar */}
          <View style={styles.searchSection}>
            <SearchInput
              value={search}
              onChangeText={setSearch}
              placeholder={placeholderSearch}
            />
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
                          ellipsizeMode="tail"
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
                              numberOfLines={1}
                              ellipsizeMode="tail"
                            >
                              {item.badge}
                            </Text>
                          </View>
                        )}
                      </View>

                      {item.subLabel ? (
                        <Text
                          style={styles.itemSubLabel}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {item.subLabel}
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  {isSelected && (
                    <View style={styles.checkIconBox}>
                      <Ionicons name="checkmark-circle" size={22} color="#059669" />
                    </View>
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
  bannerContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  tabsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 8,
  },
  tabChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  tabChipActive: {
    backgroundColor: "#ecfdf5",
    borderColor: "#a7f3d0",
  },
  tabChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
  },
  tabChipTextActive: {
    color: "#059669",
    fontWeight: "700",
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
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
    marginRight: 8,
    minWidth: 0,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    flexShrink: 0,
  },
  itemInfo: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
  },
  itemLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1e293b",
    flexShrink: 1,
  },
  itemLabelSelected: {
    color: "#059669",
  },
  itemBadge: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    flexShrink: 0,
    maxWidth: 90,
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
  checkIconBox: {
    marginLeft: 6,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
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
