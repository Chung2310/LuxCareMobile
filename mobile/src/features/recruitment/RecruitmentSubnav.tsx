import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

type RecruitmentSection = "jobs" | "applicants" | "interviews" | "pipeline";

const sections: Array<{
  key: RecruitmentSection;
  label: string;
  href: "/(tabs)/recruitment" | "/(tabs)/applicants" | "/(tabs)/interviews" | "/(tabs)/recruitment-pipeline";
}> = [
  { key: "jobs", label: "Tin tuyển dụng", href: "/(tabs)/recruitment" },
  { key: "applicants", label: "Ứng viên", href: "/(tabs)/applicants" },
  { key: "interviews", label: "Lịch phỏng vấn", href: "/(tabs)/interviews" },
  { key: "pipeline", label: "Quy trình", href: "/(tabs)/recruitment-pipeline" },
];

export function RecruitmentSubnav({ active }: { active: RecruitmentSection }) {
  return (
    <View style={subnavStyles.wrapper}>
      <Text style={subnavStyles.label}>Quản lý tuyển dụng</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={subnavStyles.row}>
        {sections.map((section) => {
          const selected = section.key === active;
          return (
            <Pressable
              key={section.key}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => {
                if (!selected) router.push(section.href);
              }}
              style={({ pressed }) => [
                subnavStyles.item,
                selected && subnavStyles.itemActive,
                pressed && { opacity: 0.78 },
              ]}
            >
              <Text style={[subnavStyles.itemText, selected && subnavStyles.itemTextActive]}>
                {section.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const subnavStyles = StyleSheet.create({
  wrapper: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 10,
    gap: 8,
  },
  label: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  row: {
    gap: 7,
    paddingRight: 4,
  },
  item: {
    backgroundColor: "#f1f5f9",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  itemActive: {
    backgroundColor: "#ecfdf5",
    borderColor: "#a7f3d0",
  },
  itemText: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "700",
  },
  itemTextActive: {
    color: "#047857",
  },
});