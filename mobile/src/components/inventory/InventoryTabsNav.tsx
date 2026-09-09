import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { InventorySectionTab } from "./types";

interface TabItem {
  id: InventorySectionTab;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  badge?: number;
}

const TABS: TabItem[] = [
  { id: "supplies", label: "Vật tư & Dược", icon: "cube-outline" },
  { id: "transactions", label: "Nhập / Xuất", icon: "swap-vertical-outline" },
  { id: "batches", label: "Tồn theo lô", icon: "barcode-outline" },
  { id: "suppliers", label: "Nhà cung cấp", icon: "business-outline" },
  { id: "warehouses", label: "Kho lưu trữ", icon: "archive-outline" },
  { id: "categories", label: "Danh mục", icon: "layers-outline" },
];

interface InventoryTabsNavProps {
  activeTab: InventorySectionTab;
  onSelectTab: (tab: InventorySectionTab) => void;
}

export function InventoryTabsNav({ activeTab, onSelectTab }: InventoryTabsNavProps) {
  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContainer}
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tabButton, isActive && styles.tabButtonActive]}
              onPress={() => onSelectTab(tab.id)}
              activeOpacity={0.7}
              delayPressIn={0}
            >
              <Ionicons
                name={tab.icon}
                size={16}
                color={isActive ? "#ffffff" : "#64748b"}
              />
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingVertical: 10,
  },
  scrollContainer: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tabButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  tabButtonActive: {
    backgroundColor: "#059669",
    borderColor: "#059669",
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
  },
  tabLabelActive: {
    color: "#ffffff",
    fontWeight: "700",
  },
});
