import { ActivityIndicator, Text, View } from "react-native";
export type FileUploadProgress = { stage: "preparing" | "uploading"; name: string };
export type UploadProgressHandler = (progress: FileUploadProgress) => void;
export function UploadProgress({ progress }: { progress: FileUploadProgress | null }) {
  if (!progress) return null;
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={"Đang tải tệp " + progress.name} accessibilityState={{ busy: true }}
      style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#ecfdf5", borderWidth: 1, borderColor: "#a7f3d0", borderRadius: 12, padding: 12 }}>
      <ActivityIndicator size="small" color="#059669" />
      <View style={{ flex: 1, minWidth: 0 }} accessibilityLiveRegion="polite">
        <Text style={{ color: "#047857", fontSize: 13, fontWeight: "700" }}>{progress.stage === "preparing" ? "Đang xử lý tệp…" : "Đang tải tệp lên…"}</Text>
        <Text numberOfLines={1} ellipsizeMode="middle" style={{ color: "#475569", fontSize: 12, marginTop: 3 }}>{progress.name}</Text>
      </View>
    </View>
  );
}