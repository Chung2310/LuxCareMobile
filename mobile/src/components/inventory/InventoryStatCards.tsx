import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { InventoryStats } from "./types";

interface InventoryStatCardsProps {
  stats: InventoryStats;
  selectedFilter: string;
  onSelectFilter: (filterKey: string) => void;
}

export const InventoryStatCards: React.FC<InventoryStatCardsProps> = ({
  stats,
  selectedFilter,
  onSelectFilter,
}) => {
  const formatCurrency = (val: number) => {
    if (val >= 1_000_000_000) {
      return `${(val / 1_000_000_000).toFixed(1)}Tỷ`;
    }
    if (val >= 1_000_000) {
      return `${(val / 1_000_000).toFixed(1)}Tr`;
    }
    return val.toLocaleString("vi-VN") + "đ";
  };

  const cards = [
    {
      id: "all",
      label: "Mặt hàng",
      value: `${stats.totalItems}`,
      sub: `${stats.totalQuantity} tồn`,
      icon: "cube" as const,
      color: "#059669",
      bgColor: "#ecfdf5",
    },
    {
      id: "low-stock",
      label: "Sắp hết",
      value: `${stats.lowStockCount + stats.outOfStockCount}`,
      sub: `${stats.outOfStockCount} hết`,
      icon: "alert-circle" as const,
      color: "#d97706",
      bgColor: "#fffbeb",
    },
    {
      id: "expiring",
      label: "Cận hạn/Quá hạn",
      value: `${stats.expiringSoonCount + stats.expiredCount}`,
      sub: `${stats.expiredCount} hết hạn`,
      icon: "time" as const,
      color: "#e11d48",
      bgColor: "#fff1f2",
    },
    {
      id: "value",
      label: "Giá trị kho",
      value: formatCurrency(stats.totalValue),
      sub: "Giá nhập",
      icon: "wallet" as const,
      color: "#0284c7",
      bgColor: "#f0f9ff",
    },
  ];

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {cards.map((card) => {
          const isSelected = selectedFilter === card.id;
          return (
            <TouchableOpacity
              key={card.id}
              style={[styles.miniCard, isSelected && styles.miniCardSelected]}
              onPress={() => onSelectFilter(card.id)}
              activeOpacity={0.75}
            >
              <View style={[styles.iconBox, { backgroundColor: card.bgColor }]}>
                <Ionicons name={card.icon} size={15} color={card.color} />
              </View>

              <View style={styles.textBox}>
                <View style={styles.valRow}>
                  <Text style={[styles.valText, isSelected && { color: "#059669" }]}>
                    {card.value}
                  </Text>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={12} color="#059669" style={{ marginLeft: 3 }} />
                  )}
                </View>
                <Text style={styles.labelText} numberOfLines={1}>
                  {card.label}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
  },
  scrollContent: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 4,
  },
  miniCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
    gap: 8,
    minWidth: 110,
  },
  miniCardSelected: {
    borderColor: "#059669",
    backgroundColor: "#f0fdf4",
  },
  iconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  textBox: {
    justifyContent: "center",
  },
  valRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  valText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.2,
  },
  labelText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748b",
    marginTop: 1,
  },
});
