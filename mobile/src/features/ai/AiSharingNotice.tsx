import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import type { useAiSharing } from "./useAiSharing";

type Sharing = ReturnType<typeof useAiSharing>;
const action = { minHeight: 40, justifyContent: "center" as const, paddingHorizontal: 10, paddingVertical: 8 };
const link = { color: "#047857", textDecorationLine: "underline" as const, fontSize: 13 };

export function AiSharingNotice({ sharing, compact = false }: { sharing: Sharing; compact?: boolean }) {
  const content = (
    <View style={{ padding: 10, gap: 6, backgroundColor: "#f8fafc" }}>
      <Text style={{ fontWeight: "700", fontSize: 15, color: "#0f172a" }}>
        Allow AI to process this data? / Cho phép AI xử lý dữ liệu này?
      </Text>
      {!!sharing.error && <Text accessibilityRole="alert" style={{ color: "#b45309" }}>{sharing.error}</Text>}
      {!sharing.disclosure ? (
        <Pressable accessibilityRole="button" disabled={sharing.busy} onPress={sharing.refresh} style={action}>
          <Text style={link}>{sharing.busy ? "Loading… / Đang tải…" : "Reload / Tải lại"}</Text>
        </Pressable>
      ) : (
        <>
          <Text style={{ fontSize: 13, lineHeight: 19 }}>
            <Text style={{ fontWeight: "600" }}>Purpose / Mục đích: </Text>{sharing.disclosure.purpose}
          </Text>
          <Text style={{ fontSize: 13, fontWeight: "600" }}>Data sent / Dữ liệu gửi</Text>
          {sharing.disclosure.dataTypes.map((text) => (
            <Text key={text} style={{ fontSize: 13, lineHeight: 19 }}>• {text}</Text>
          ))}
          <Text style={{ fontSize: 13, lineHeight: 19 }}>
            <Text style={{ fontWeight: "600" }}>AI processing / Xử lý AI: </Text>OpenRouter
          </Text>
          {sharing.disclosure.recipients.slice(0, 1).map((item) => (
            <Pressable
              key={item.name}
              accessibilityRole="link"
              style={action}
              onPress={() => void Linking.openURL(item.privacyUrl).catch(() => {})}
            >
              <Text style={link}>OpenRouter privacy policy / Chính sách dữ liệu OpenRouter</Text>
            </Pressable>
          ))}
          <Pressable accessibilityRole="link" style={action} onPress={() => router.push("/privacy-policy")}>
            <Text style={link}>LuxCare Privacy Policy / Chính sách bảo mật</Text>
          </Pressable>
          {sharing.accepted ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Text style={{ fontSize: 13 }}>Consent active / Đã đồng ý</Text>
              <Pressable accessibilityRole="button" disabled={sharing.busy} onPress={() => void sharing.revoke()} style={action}>
                <Text style={link}>Revoke / Thu hồi</Text>
              </Pressable>
            </View>
          ) : sharing.declined ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Text style={{ fontSize: 13 }}>AI is off / AI đang tắt</Text>
              <Pressable accessibilityRole="button" onPress={sharing.reconsider} style={action}>
                <Text style={link}>Review / Xem lại</Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              <Pressable
                accessibilityRole="button"
                disabled={sharing.busy}
                onPress={() => void sharing.accept()}
                style={[action, { backgroundColor: "#047857", borderRadius: 8, opacity: sharing.busy ? 0.5 : 1 }]}
              >
                <Text style={{ color: "white", fontWeight: "600" }}>Allow AI / Cho phép AI</Text>
              </Pressable>
              <Pressable accessibilityRole="button" disabled={sharing.busy} onPress={sharing.decline} style={action}>
                <Text style={link}>Decline / Từ chối</Text>
              </Pressable>
            </View>
          )}
        </>
      )}
    </View>
  );

  return compact ? (
    <ScrollView style={{ maxHeight: 240 }} contentContainerStyle={{ gap: 6 }} keyboardShouldPersistTaps="handled">
      {content}
    </ScrollView>
  ) : content;
}
