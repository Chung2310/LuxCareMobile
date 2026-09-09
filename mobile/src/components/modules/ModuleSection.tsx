import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { ServiceGridItem } from "./ServiceGridItem";
import type { ServiceItem, ServiceModule } from "./types";

interface ModuleSectionProps {
  module: ServiceModule;
  onItemPress: (item: ServiceItem) => void;
}

export const ModuleSection: React.FC<ModuleSectionProps> = ({
  module,
  onItemPress,
}) => {
  if (module.items.length === 0) return null;

  return (
    <View style={styles.moduleSection}>
      <Text style={styles.moduleTitle}>{module.title}</Text>
      <View style={styles.gridContainer}>
        {module.items.map((item) => (
          <ServiceGridItem
            key={`${module.id}-${item.id}`}
            item={item}
            onPress={onItemPress}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  moduleSection: {
    paddingTop: 20,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f8fafc",
  },
  moduleTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0f172a",
    paddingHorizontal: 16,
    marginBottom: 16,
    letterSpacing: -0.2,
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 20,
  },
});
