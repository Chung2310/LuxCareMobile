import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ClipboardList, Folder, BarChart3 } from "lucide-react-native";

export type WorkSection = "tasks" | "projects" | "kpi";

const sections: Array<{
  value: WorkSection;
  label: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
}> = [
  { value: "tasks", label: "Công việc", icon: ClipboardList },
  { value: "projects", label: "Dự án", icon: Folder },
  { value: "kpi", label: "KPI tháng", icon: BarChart3 },
];

export function WorkSectionTabs({
  value,
  canViewKpi,
  onChange,
}: {
  value: WorkSection;
  canViewKpi: boolean;
  onChange: (section: WorkSection) => void;
}) {
  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.container}
      >
        {sections
          .filter((section) => section.value !== "kpi" || canViewKpi)
          .map((section) => {
            const active = section.value === value;
            const IconComponent = section.icon;
            return (
              <Pressable
                key={section.value}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => onChange(section.value)}
                style={({ pressed }) => [
                  styles.tabPill,
                  active && styles.tabPillActive,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <IconComponent
                  size={14}
                  color={active ? "#ffffff" : "#475569"}
                />
                <Text
                  style={[
                    styles.tabLabel,
                    active && styles.tabLabelActive,
                  ]}
                >
                  {section.label}
                </Text>
              </Pressable>
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
    borderBottomColor: "#e2e8f0",
  },
  container: {
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  tabPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  tabPillActive: {
    backgroundColor: "#059669",
    borderColor: "#059669",
  },
  tabIcon: {
    fontSize: 13,
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
