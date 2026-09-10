import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { UserStats } from "../../api/userManagementApi";

interface UserStatCardsProps {
  stats: UserStats;
  selectedRole?: string;
  onSelectRole: (role: string) => void;
}

export const UserStatCards: React.FC<UserStatCardsProps> = ({
  stats,
  selectedRole = "all",
  onSelectRole,
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
      id: "admin",
      label: "Quản trị viên",
      count: stats.admin,
      icon: "shield-checkmark-outline" as const,
      color: "#dc2626",
      bg: "#fef2f2",
      activeBg: "#dc2626",
      activeText: "#ffffff",
    },
    {
      id: "branch_owner",
      label: "Chủ chi nhánh",
      count: stats.branch_owner,
      icon: "business-outline" as const,
      color: "#7c3aed",
      bg: "#f5f3ff",
      activeBg: "#7c3aed",
      activeText: "#ffffff",
    },
    {
      id: "manager",
      label: "Quản lý",
      count: stats.manager,
      icon: "briefcase-outline" as const,
      color: "#d97706",
      bg: "#fffbeb",
      activeBg: "#d97706",
      activeText: "#ffffff",
    },
    {
      id: "user",
      label: "Nhân viên",
      count: stats.user,
      icon: "person-outline" as const,
      color: "#0284c7",
      bg: "#f0f9ff",
      activeBg: "#0284c7",
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
          const isSelected = selectedRole === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.statCard,
                { backgroundColor: item.bg, borderColor: isSelected ? item.color : "#e2e8f0" },
                isSelected && { backgroundColor: item.activeBg, borderColor: item.activeBg },
              ]}
              onPress={() => onSelectRole(item.id)}
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
    borderRadius: 12,
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
