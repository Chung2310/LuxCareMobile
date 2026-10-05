import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import type { useAiSharing } from "./useAiSharing";
type Sharing = ReturnType<typeof useAiSharing>;
const action = { minHeight: 44, justifyContent: "center" as const, paddingHorizontal: 12, paddingVertical: 10 };
const link = { color: "#047857", textDecorationLine: "underline" as const, fontSize: 13 };
export function AiSharingNotice({ sharing, compact = false }: { sharing: Sharing; compact?: boolean }) {
  if (sharing.accepted) return <View style={{ padding: 10, gap: 6 }}>
    <Text style={{ fontSize: 12, color: "#475569" }}>Đã đồng ý chia sẻ dữ liệu với bên xử lý AI.</Text>
    <Pressable accessibilityRole="button" disabled={sharing.busy} onPress={() => void sharing.revoke()} style={action}><Text style={link}>Thu hồi đồng ý</Text></Pressable>
    {!!sharing.error && <Text accessibilityRole="alert" style={{ color: "#b45309" }}>{sharing.error}</Text>}
  </View>;
  const content = <>
    <Text style={{ fontWeight: "700", fontSize: 16, color: "#0f172a" }}>Chia sẻ dữ liệu với AI</Text>
    {!!sharing.error && <Text accessibilityRole="alert" style={{ color: "#b45309" }}>{sharing.error}</Text>}
    {!sharing.disclosure && <Pressable accessibilityRole="button" disabled={sharing.busy} onPress={sharing.refresh} style={action}><Text style={link}>{sharing.busy ? "Đang tải thông tin…" : "Tải lại thông tin"}</Text></Pressable>}
    {sharing.disclosure && !sharing.declined && <>
      <Text style={{ fontSize: 13, lineHeight: 20 }}>{sharing.disclosure.purpose}</Text>
      {sharing.disclosure.dataTypes.map(text => <Text key={text} style={{ fontSize: 13, lineHeight: 20 }}>• {text}</Text>)}
      <Text style={{ fontSize: 13, fontWeight: "600" }}>Bên nhận dữ liệu ({sharing.disclosure.model}):</Text>
      {sharing.disclosure.recipients.map(item => <Pressable key={item.name} accessibilityRole="link" style={action} onPress={() => void Linking.openURL(item.privacyUrl).catch(() => {})}><Text style={link}>{item.name} — chính sách dữ liệu</Text></Pressable>)}
      <Pressable accessibilityRole="link" style={action} onPress={() => router.push("/privacy-policy")}><Text style={link}>Chính sách bảo mật LuxCare</Text></Pressable>
      <Text style={{ fontSize: 13, lineHeight: 20 }}>Bạn có thể từ chối hoặc thu hồi sự đồng ý. Các tính năng khác của tài khoản vẫn sử dụng được.</Text>
      <Pressable accessibilityRole="button" disabled={sharing.busy} onPress={() => void sharing.accept()} style={[action, { backgroundColor: "#047857", borderRadius: 8, opacity: sharing.busy ? 0.5 : 1 }]}><Text style={{ color: "white", fontWeight: "600" }}>Đồng ý và bật AI</Text></Pressable>
      <Pressable accessibilityRole="button" disabled={sharing.busy} onPress={sharing.decline} style={action}><Text style={link}>Không đồng ý</Text></Pressable>
    </>}
    {sharing.declined && <><Text style={{ fontSize: 13 }}>AI đang tắt vì bạn chưa đồng ý chia sẻ dữ liệu.</Text><Pressable accessibilityRole="button" onPress={sharing.reconsider} style={action}><Text style={link}>Xem thông tin và bật AI</Text></Pressable></>}
  </>;
  const contentStyle = { padding: 12, gap: 10, backgroundColor: "#f8fafc" };
  return compact ? <ScrollView style={{ maxHeight: 260 }} contentContainerStyle={contentStyle} keyboardShouldPersistTaps="handled">{content}</ScrollView>
    : <View style={contentStyle}>{content}</View>;
}
