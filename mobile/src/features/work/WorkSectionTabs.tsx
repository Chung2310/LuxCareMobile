import React from "react";
import { Pressable, ScrollView, Text } from "react-native";
import { colors } from "../../ui";

export type WorkSection = "tasks" | "projects" | "kpi";

const sections: Array<{ value: WorkSection; label: string }> = [
  { value: "tasks", label: "Công việc" },
  { value: "projects", label: "Dự án" },
  { value: "kpi", label: "KPI tháng" },
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
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 12 }}
      style={{ backgroundColor: colors.background }}
    >
      {sections
        .filter((section) => section.value !== "kpi" || canViewKpi)
        .map((section) => {
          const active = section.value === value;
          return (
            <Pressable
              key={section.value}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => onChange(section.value)}
              style={({ pressed }) => ({
                borderRadius: 999,
                borderWidth: 1,
                borderColor: active ? colors.primary : colors.border,
                backgroundColor: active ? colors.primary : "white",
                opacity: pressed ? 0.75 : 1,
                paddingHorizontal: 16,
                paddingVertical: 10,
              })}
            >
              <Text style={{ color: active ? "white" : colors.ink, fontWeight: "600", fontSize: 14 }}>
                {section.label}
              </Text>
            </Pressable>
          );
        })}
    </ScrollView>
  );
}
