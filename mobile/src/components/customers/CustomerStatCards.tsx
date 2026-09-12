import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { CustomerLeadStats } from "../../api/customerLeadApi";

interface CustomerStatCardsProps {
  stats: CustomerLeadStats;
  selectedStatus?: string;
  onSelectStatus: (status: string) => void;
}

export const CustomerStatCards: React.FC<CustomerStatCardsProps> = ({
  stats,
  selectedStatus = "all",
  onSelectStatus,
}) => {
  const cards = [
    {
      id: "all",
      label: "Tất cả",
      count: stats.total,
      icon: "people-outline" as const,
      color: "#0f172a",
      bg: "#f8fafc",
      activeBg: "#0f172a",
      activeText: "#ffffff",
    },
    {
      id: "today",
      label: "Hôm nay mới",
      count: stats.todayNew,
      icon: "flash-outline" as const,
      color: "#ea580c",
      bg: "#fff7ed",
      activeBg: "#ea580c",
      activeText: "#ffffff",
    },
    {
      id: "new",
      label: "Mới tiếp nhận",
      count: stats.new,
      icon: "sparkles-outline" as const,
      color: "#2563eb",
      bg: "#eff6ff",
      activeBg: "#2563eb",
      activeText: "#ffffff",
    },
    {
      id: "in_consultation",
      label: "Đang tư vấn",
      count: stats.in_consultation,
      icon: "chatbubbles-outline" as const,
      color: "#d97706",
      bg: "#fffbeb",
      activeBg: "#d97706",
      activeText: "#ffffff",
    },
    {
      id: "converted",
      label: "Thành công",
      count: stats.converted,
      icon: "checkmark-circle-outline" as const,
      color: "#059669",
      bg: "#ecfdf5",
      activeBg: "#059669",
      activeText: "#ffffff",
    },
  ];

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {cards.map((item) => {
          const isSelected = selectedStatus === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.statCard,
                { backgroundColor: item.bg, borderColor: isSelected ? item.color : "#e2e8f0" },
                isSelected && { backgroundColor: item.activeBg, borderColor: item.activeBg },
              ]}
              onPress={() => onSelectStatus(item.id)}
              activeOpacity={0.75}
            >
              <View style={styles.topRow}>
                <Ionicons
                  name={item.icon}
                  size={15}
                  color={isSelected ? item.activeText : item.color}
                />
                <Text
                  style={[
                    styles.countText,
                    { color: isSelected ? item.activeText : item.color },
                  ]}
                >
                  {item.count}
                </Text>
              </View>
              <Text
                style={[
                  styles.labelText,
                  { color: isSelected ? item.activeText : "#475569" },
                ]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 6,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  statCard: {
    minWidth: 105,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  countText: {
    fontSize: 16,
    fontWeight: "700",
  },
  labelText: {
    fontSize: 11.5,
    fontWeight: "600",
  },
});
