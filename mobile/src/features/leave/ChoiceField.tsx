import React, { useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

export function ChoiceField<T extends string>({
  label,
  value,
  choices,
  onChange,
  disabled = false,
}: {
  label: string;
  value: T;
  choices: { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedItem = choices.find((c) => c.value === value);
  const filtered = choices.filter((c) =>
    search ? c.label.toLowerCase().includes(search.toLowerCase()) : true,
  );

  return (
    <View style={s.container}>
      {!!label && <Text style={s.label}>{label}</Text>}
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        style={({ pressed }) => [
          s.trigger,
          disabled && s.triggerDisabled,
          pressed && !disabled && s.triggerPressed,
        ]}
        onPress={() => {
          setSearch("");
          setOpen(true);
        }}
      >
        <Text style={[s.triggerText, !selectedItem && s.placeholder]} numberOfLines={1}>
          {selectedItem?.label || "Chọn một tùy chọn"}
        </Text>
        <Ionicons name="chevron-down" size={18} color={disabled ? "#94a3b8" : "#64748b"} />
      </Pressable>

      <Modal
        visible={open}
        animationType="fade"
        transparent
        onRequestClose={() => setOpen(false)}
      >
        <View style={s.modalOverlay}>
          <SafeAreaView style={s.modalSafe}>
            <View style={s.modalBox}>
              <View style={s.modalHeader}>
                <View>
                  <Text style={s.modalTitle}>{label || "Lựa chọn"}</Text>
                  <Text style={s.modalSubtitle}>Chọn một trong các mục bên dưới</Text>
                </View>
                <Pressable
                  style={s.closeBtn}
                  onPress={() => setOpen(false)}
                  hitSlop={8}
                >
                  <Ionicons name="close" size={20} color="#475569" />
                </Pressable>
              </View>

              {choices.length > 6 && (
                <View style={s.searchWrap}>
                  <Ionicons name="search" size={16} color="#94a3b8" />
                  <TextInput
                    style={s.searchInput}
                    placeholder="Tìm kiếm..."
                    placeholderTextColor="#94a3b8"
                    value={search}
                    onChangeText={setSearch}
                  />
                  {!!search && (
                    <Pressable onPress={() => setSearch("")}>
                      <Ionicons name="close-circle" size={16} color="#94a3b8" />
                    </Pressable>
                  )}
                </View>
              )}

              <FlatList
                contentContainerStyle={s.listContent}
                data={filtered}
                keyExtractor={(item) => item.value}
                renderItem={({ item }) => {
                  const isSelected = item.value === value;
                  return (
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityState={{ checked: isSelected }}
                      style={({ pressed }) => [
                        s.itemRow,
                        isSelected && s.itemRowSelected,
                        pressed && s.itemRowPressed,
                      ]}
                      onPress={() => {
                        onChange(item.value);
                        setOpen(false);
                      }}
                    >
                      <Text
                        style={[s.itemText, isSelected && s.itemTextSelected]}
                        numberOfLines={2}
                      >
                        {item.label}
                      </Text>
                      {isSelected ? (
                        <View style={s.checkBadge}>
                          <Ionicons name="checkmark" size={16} color="#ffffff" />
                        </View>
                      ) : (
                        <View style={s.uncheckCircle} />
                      )}
                    </Pressable>
                  );
                }}
                ListEmptyComponent={
                  <View style={s.emptyBox}>
                    <Text style={s.emptyText}>Không tìm thấy tùy chọn phù hợp</Text>
                  </View>
                }
              />
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
  },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    paddingHorizontal: 14,
    minHeight: 46,
  },
  triggerDisabled: {
    opacity: 0.6,
    backgroundColor: "#f1f5f9",
  },
  triggerPressed: {
    backgroundColor: "#e2e8f0",
  },
  triggerText: {
    fontSize: 14,
    color: "#0f172a",
    fontWeight: "500",
    flex: 1,
  },
  placeholder: {
    color: "#94a3b8",
    fontWeight: "400",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "center",
    padding: 16,
  },
  modalSafe: {
    maxHeight: "85%",
    alignItems: "center",
  },
  modalBox: {
    width: "100%",
    maxWidth: 480,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  modalSubtitle: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 6,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#0f172a",
    padding: 0,
  },
  listContent: {
    padding: 12,
    gap: 6,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  itemRowSelected: {
    backgroundColor: "#ecfdf5",
    borderColor: "#a7f3d0",
  },
  itemRowPressed: {
    backgroundColor: "#f8fafc",
  },
  itemText: {
    fontSize: 14,
    color: "#334155",
    fontWeight: "500",
    flex: 1,
    paddingRight: 12,
  },
  itemTextSelected: {
    color: "#047857",
    fontWeight: "700",
  },
  checkBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#059669",
    alignItems: "center",
    justifyContent: "center",
  },
  uncheckCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#cbd5e1",
  },
  emptyBox: {
    padding: 24,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 13,
    color: "#94a3b8",
  },
});
