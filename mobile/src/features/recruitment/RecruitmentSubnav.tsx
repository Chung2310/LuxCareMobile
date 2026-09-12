import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Briefcase, Users, Calendar, GitFork, type LucideIcon } from "lucide-react-native";

type RecruitmentSection = "jobs" | "applicants" | "interviews" | "pipeline";

const sections: Array<{
  key: RecruitmentSection;
  label: string;
  Icon: LucideIcon;
  href: "/(tabs)/recruitment" | "/(tabs)/applicants" | "/(tabs)/interviews" | "/(tabs)/recruitment-pipeline";
}> = [
  { key: "jobs", label: "Tin tuyển dụng", Icon: Briefcase, href: "/(tabs)/recruitment" },
  { key: "applicants", label: "Ứng viên", Icon: Users, href: "/(tabs)/applicants" },
  { key: "interviews", label: "Lịch phỏng vấn", Icon: Calendar, href: "/(tabs)/interviews" },
  { key: "pipeline", label: "Quy trình", Icon: GitFork, href: "/(tabs)/recruitment-pipeline" },
];

export function RecruitmentSubnav({ active }: { active: RecruitmentSection }) {
  return (
    <View style={subnavStyles.wrapper}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={subnavStyles.row}>
        {sections.map((section) => {
          const selected = section.key === active;
          const Icon = section.Icon;
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
              <Icon size={14} color={selected ? "#047857" : "#64748b"} />
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
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 6,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  row: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 2,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  itemActive: {
    backgroundColor: "#ecfdf5",
    borderColor: "#059669",
  },
  itemIcon: {
    fontSize: 14,
  },
  itemText: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
  },
  itemTextActive: {
    color: "#047857",
    fontWeight: "800",
  },
});