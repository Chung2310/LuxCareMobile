import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSession } from "../../src/auth/SessionProvider";
import { availableModules } from "../../src/features/navigation/modules";
import { Button, Card, Page, styles } from "../../src/ui";

const recruitmentSections = [
  { label: "Tin tuyển dụng", href: "/(tabs)/recruitment" as const },
  { label: "Ứng viên", href: "/(tabs)/applicants" as const },
  { label: "Lịch phỏng vấn", href: "/(tabs)/interviews" as const },
];

export default function Modules() {
  const { user } = useSession();
  const modules = availableModules(user);
  const recruitment = modules.find((item) => item.href === "/(tabs)/recruitment");
  const otherModules = modules.filter((item) => item.href !== "/(tabs)/recruitment");

  return (
    <Page title="Chức năng">
      {recruitment && (
        <Card>
          <View style={moduleStyles.recruitmentHeader}>
            <View style={moduleStyles.recruitmentIcon}>
              <Text style={moduleStyles.recruitmentIconText}>↗</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heading}>Tuyển dụng</Text>
              <Text style={styles.muted}>{recruitment.description}</Text>
            </View>
          </View>

          <View style={moduleStyles.sectionGrid}>
            {recruitmentSections.map((section) => (
              <Pressable
                key={section.href}
                accessibilityRole="button"
                onPress={() => router.push(section.href)}
                style={({ pressed }) => [moduleStyles.sectionButton, pressed && { opacity: 0.75 }]}
              >
                <Text style={moduleStyles.sectionButtonText}>{section.label}</Text>
                <Text style={moduleStyles.sectionArrow}>›</Text>
              </Pressable>
            ))}
          </View>
        </Card>
      )}

      {otherModules.map((item) => (
        <Card key={item.href}>
          <Text style={styles.heading}>{item.title}</Text>
          <Text style={styles.muted}>{item.description}</Text>
          <Button title={"Mở " + item.title.toLowerCase()} onPress={() => router.push(item.href)} />
        </Card>
      ))}
    </Page>
  );
}

const moduleStyles = StyleSheet.create({
  recruitmentHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  recruitmentIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#a7f3d0",
    alignItems: "center",
    justifyContent: "center",
  },
  recruitmentIconText: {
    color: "#047857",
    fontSize: 20,
    fontWeight: "800",
  },
  sectionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  sectionButton: {
    width: "48%",
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  sectionButtonText: {
    flex: 1,
    color: "#334155",
    fontSize: 12,
    fontWeight: "700",
  },
  sectionArrow: {
    color: "#059669",
    fontSize: 19,
    lineHeight: 19,
    fontWeight: "700",
  },
});