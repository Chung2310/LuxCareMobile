import React, { useMemo, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Search, Users, X } from "lucide-react-native";
import type { Employee } from "../../../../src/types/hrContract";

export interface EmployeeSelectModalProps {
  visible: boolean;
  onClose: () => void;
  employees: (Employee & { branchId?: string })[];
  selectedId?: string;
  onSelect: (employee: { _id: string; displayName?: string; email: string }) => void;
  title?: string;
  allowAll?: boolean;
  onSelectAll?: () => void;
}

const AVATAR_COLORS = [
  { bg: "#dbeafe", text: "#1d4ed8" },
  { bg: "#dcfce7", text: "#15803d" },
  { bg: "#fef3c7", text: "#b45309" },
  { bg: "#f3e8ff", text: "#7e22ce" },
  { bg: "#ffe4e6", text: "#be123c" },
  { bg: "#ccfbf1", text: "#0f766e" },
];

function getAvatarColors(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

export function EmployeeSelectModal({
  visible,
  onClose,
  employees,
  selectedId,
  onSelect,
  title = "Chọn nhân viên",
  allowAll = false,
  onSelectAll,
}: EmployeeSelectModalProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((emp) => {
      const name = (emp.displayName || "").toLowerCase();
      const email = (emp.email || "").toLowerCase();
      const dept = (emp.department || "").toLowerCase();
      return name.includes(q) || email.includes(q) || dept.includes(q);
    });
  }, [employees, search]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.backdrop}
      >
        <Pressable style={styles.backdropDismiss} onPress={onClose} />

        <View style={styles.sheetContainer}>
          {/* Handle bar */}
          <View style={styles.dragHandleBar}>
            <View style={styles.dragHandle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{filtered.length} nhân sự trong danh sách</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <X size={18} color="#64748b" />
            </Pressable>
          </View>

          {/* Search Box */}
          <View style={styles.searchBox}>
            <Search size={16} color="#94a3b8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm theo tên, email, phòng ban..."
              placeholderTextColor="#94a3b8"
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch("")} hitSlop={8} style={styles.searchClearBtn}>
                <X size={14} color="#94a3b8" />
              </Pressable>
            )}
          </View>

          {/* List */}
          <FlatList
            data={filtered}
            keyExtractor={(item) => item._id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              allowAll ? (
                <Pressable
                  style={[styles.itemCard, !selectedId && styles.itemCardSelected]}
                  onPress={() => {
                    onSelectAll?.();
                    onClose();
                  }}
                >
                  <View style={[styles.avatarCircle, { backgroundColor: "#f1f5f9" }]}>
                    <Users size={20} color="#475569" />
                  </View>
                  <View style={styles.itemInfo}>
                    <Text style={[styles.itemName, !selectedId && styles.itemNameSelected]}>
                      Tất cả nhân viên
                    </Text>
                    <Text style={styles.itemEmail}>Xem toàn bộ hồ sơ trong phạm vi</Text>
                  </View>
                  <View style={[styles.radioCircle, !selectedId && styles.radioCircleSelected]}>
                    {!selectedId && <View style={styles.radioInner} />}
                  </View>
                </Pressable>
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Search size={36} color="#94a3b8" style={{ marginBottom: 4 }} />
                <Text style={styles.emptyTitle}>Không tìm thấy nhân viên</Text>
                <Text style={styles.emptySubtitle}>
                  Thử tìm kiếm với từ khóa khác (họ tên, email hoặc phòng ban).
                </Text>
              </View>
            }
            renderItem={({ item: emp }) => {
              const isSelected = selectedId === emp._id;
              const name = emp.displayName || emp.email;
              const initial = (name[0] || "N").toUpperCase();
              const colors = getAvatarColors(name);

              return (
                <Pressable
                  style={({ pressed }) => [
                    styles.itemCard,
                    isSelected && styles.itemCardSelected,
                    pressed && { opacity: 0.8 },
                  ]}
                  onPress={() => {
                    onSelect(emp);
                    onClose();
                  }}
                >
                  <View style={[styles.avatarCircle, { backgroundColor: colors.bg }]}>
                    <Text style={[styles.avatarText, { color: colors.text }]}>{initial}</Text>
                  </View>

                  <View style={styles.itemInfo}>
                    <View style={styles.nameRow}>
                      <Text style={[styles.itemName, isSelected && styles.itemNameSelected]}>
                        {emp.displayName || emp.email}
                      </Text>
                      {emp.department ? (
                        <View style={styles.deptBadge}>
                          <Text style={styles.deptBadgeText}>{emp.department}</Text>
                        </View>
                      ) : null}
                    </View>
                    {emp.email ? <Text style={styles.itemEmail}>{emp.email}</Text> : null}
                  </View>

                  <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                    {isSelected && <View style={styles.radioInner} />}
                  </View>
                </Pressable>
              );
            }}
          />
          <SafeAreaView edges={["bottom"]} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "flex-end",
  },
  backdropDismiss: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "88%",
    minHeight: 400,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  dragHandleBar: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 4,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#cbd5e1",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
  },
  subtitle: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#64748b",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    height: 44,
    gap: 8,
  },
  searchIcon: {
    fontSize: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#0f172a",
    paddingVertical: 0,
  },
  searchClearBtn: {
    padding: 4,
  },
  searchClearText: {
    fontSize: 13,
    color: "#94a3b8",
    fontWeight: "700",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 12,
  },
  itemCardSelected: {
    borderColor: "#059669",
    backgroundColor: "#f0fdf4",
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "800",
  },
  itemInfo: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  itemName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  itemNameSelected: {
    color: "#059669",
  },
  deptBadge: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  deptBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#475569",
  },
  itemEmail: {
    fontSize: 12,
    color: "#64748b",
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
  },
  radioCircleSelected: {
    borderColor: "#059669",
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#059669",
  },
  emptyContainer: {
    padding: 32,
    alignItems: "center",
    gap: 6,
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
  },
  emptySubtitle: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
  },
});
