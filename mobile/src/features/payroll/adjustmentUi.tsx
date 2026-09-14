import { Pressable, StyleSheet, Text } from "react-native";

export function AdjustmentAction({ title, onPress, disabled = false, tone = "primary" }: {
  title: string; onPress: () => void; disabled?: boolean; tone?: "primary" | "secondary" | "danger";
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
      style={({ pressed }) => [adjustmentStyles.action, tone === "secondary" && adjustmentStyles.secondary,
        tone === "danger" && adjustmentStyles.danger, (pressed || disabled) && { opacity: 0.5 }]}>
      <Text style={[adjustmentStyles.actionText, tone === "secondary" && { color: "#475569" }, tone === "danger" && { color: "#be123c" }]}>{title}</Text>
    </Pressable>
  );
}

export const adjustmentStyles = StyleSheet.create({
  section: { gap: 14 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  title: { fontSize: 17, fontWeight: "800", color: "#0f172a" },
  subtitle: { fontSize: 12, color: "#64748b", lineHeight: 18 },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tab: { flexGrow: 1, flexBasis: "30%", minHeight: 56, padding: 8, borderRadius: 12, borderWidth: 1, borderColor: "#e2e8f0", backgroundColor: "#f8fafc", alignItems: "center", justifyContent: "center", gap: 4 },
  tabActive: { backgroundColor: "#ecfdf5", borderColor: "#059669" },
  tabText: { fontSize: 11, fontWeight: "600", color: "#64748b", textAlign: "center" },
  tabCount: { fontSize: 17, fontWeight: "800", color: "#334155" },
  activeText: { color: "#047857" },
  search: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 46, paddingHorizontal: 12, backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 12 },
  searchInput: { flex: 1, minWidth: 0, paddingVertical: 12, color: "#0f172a", fontSize: 13 },
  iconButton: { minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "#f1f5f9" },
  notice: { backgroundColor: "#ecfdf5", borderWidth: 1, borderColor: "#a7f3d0", borderRadius: 12, padding: 12 },
  noticeText: { color: "#047857", fontSize: 13, lineHeight: 20 },
  info: { backgroundColor: "#f8fafc", padding: 12, borderRadius: 12 },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "#ecfdf5" },
  avatarText: { color: "#047857", fontSize: 16, fontWeight: "800" },
  name: { fontSize: 14, color: "#0f172a", fontWeight: "700" },
  badge: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: "#f1f5f9" },
  badgeText: { fontSize: 11, fontWeight: "700", color: "#475569" },
  amount: { fontSize: 23, fontWeight: "800", color: "#059669" },
  reason: { fontSize: 13, color: "#334155", lineHeight: 21 },
  actions: { flexDirection: "row", gap: 10 },
  action: { flexGrow: 1, minHeight: 46, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#059669" },
  actionText: { color: "#ffffff", fontSize: 13, fontWeight: "700", textAlign: "center" },
  secondary: { backgroundColor: "#f1f5f9" },
  danger: { backgroundColor: "#fff1f2" },
  empty: { alignItems: "center", padding: 24, gap: 10 },
});
