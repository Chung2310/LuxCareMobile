import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export interface CategoryTabItem {
  id: string;
  label: string;
}

interface CategoryTabsProps {
  categories: CategoryTabItem[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export const CategoryTabs: React.FC<CategoryTabsProps> = ({
  categories,
  selectedId,
  onSelect,
}) => {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {categories.map((cat) => {
          const isActive = selectedId === cat.id;
          return (
            <TouchableOpacity
              key={cat.id}
              style={[styles.tabPill, isActive && styles.tabPillActive]}
              onPress={() => onSelect(cat.id)}
              activeOpacity={0.7}
            >
              <Text
                style={[styles.tabPillText, isActive && styles.tabPillTextActive]}
              >
                {cat.label}
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f8fafc",
    backgroundColor: "#ffffff",
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tabPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "transparent",
  },
  tabPillActive: {
    backgroundColor: "#ecfdf5",
    borderColor: "#059669",
  },
  tabPillText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#64748b",
  },
  tabPillTextActive: {
    color: "#059669",
    fontWeight: "700",
  },
});
