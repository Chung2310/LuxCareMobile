import React from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ServiceGridItem } from "./ServiceGridItem";
import type { ServiceItem } from "./types";

interface PinnedServicesSectionProps {
  pinnedServices: ServiceItem[];
  onEditPress: () => void;
  onItemPress: (item: ServiceItem) => void;
}

export const PinnedServicesSection: React.FC<PinnedServicesSectionProps> = ({
  pinnedServices,
  onEditPress,
  onItemPress,
}) => {
  return (
    <View style={styles.pinnedSection}>
      <View style={styles.pinnedHeaderRow}>
        <View>
          <Text style={styles.pinnedTitle}>Dịch vụ được ghim</Text>
          <Text style={styles.pinnedSubtitle}>Cố định dịch vụ thường dùng</Text>
        </View>

        <TouchableOpacity
          style={styles.editPillButton}
          onPress={onEditPress}
          activeOpacity={0.7}
        >
          <Text style={styles.editPillText}>Chỉnh sửa</Text>
          <Ionicons
            name="chevron-down"
            size={14}
            color="#059669"
            style={{ marginLeft: 2 }}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.pinnedGrid}>
        {pinnedServices.map((item) => (
          <ServiceGridItem
            key={`pinned-${item.id}`}
            item={item}
            onPress={onItemPress}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  pinnedSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  pinnedHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  pinnedTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0f172a",
    letterSpacing: -0.2,
  },
  pinnedSubtitle: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 2,
  },
  editPillButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  editPillText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#059669",
  },
  pinnedGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 16,
  },
});
