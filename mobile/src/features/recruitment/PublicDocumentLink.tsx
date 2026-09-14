import { useAppAlert } from "../../components/AppAlert";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { ExternalLink, FileText } from "lucide-react-native";
import { messageOf } from "../../auth/SessionProvider";
import { validatePublicLink } from "./publicLink";

function getCleanFileName(url?: string | null, fallback = "Tài liệu đính kèm"): string {
  if (!url) return fallback;
  try {
    const parsed = new URL(url);
    const lastPart = parsed.pathname.split("/").filter(Boolean).pop() || "";
    const decoded = decodeURIComponent(lastPart);
    const clean = decoded.replace(/^[0-9a-fA-F-]{36}-?/, "").trim();
    return clean || fallback;
  } catch {
    const clean = url.split("/").pop()?.split("?")[0] || "";
    return decodeURIComponent(clean) || fallback;
  }
}

export function PublicDocumentLink({
  title = "Bản mô tả công việc (JD File)",
  url,
}: {
  title?: string;
  url?: string;
}) {
  const { showAlert, alertView } = useAppAlert();
  if (!url) return null;

  const fileName = getCleanFileName(url, title);

  const openDocument = () => {
    try {
      const target = validatePublicLink(url);
      showAlert("Mở tài liệu?", fileName, [
        { text: "Hủy", style: "cancel" },
        {
          text: "Mở xem",
          onPress: () =>
            void Linking.openURL(target).catch((error) =>
              showAlert("Không thể mở liên kết", messageOf(error), undefined, "error"),
            ),
        },
      ]);
    } catch (error) {
      showAlert("Liên kết không hợp lệ", messageOf(error), undefined, "error");
    }
  };

  return (
    <>
      <Pressable
        style={({ pressed }) => [docStyles.fileCard, pressed && { opacity: 0.85 }]}
        onPress={openDocument}
      >
        <View style={docStyles.iconContainer}>
          <FileText size={18} color="#0284c7" />
        </View>
        <View style={docStyles.metaContainer}>
          <Text style={docStyles.fileName} numberOfLines={1}>
            {fileName}
          </Text>
          <Text style={docStyles.fileSubtitle} numberOfLines={1}>
            {title}
          </Text>
        </View>
        <View style={docStyles.actionBadge}>
          <ExternalLink size={13} color="#0284c7" />
          <Text style={docStyles.actionText}>Xem</Text>
        </View>
      </Pressable>
      {alertView}
    </>
  );
}

const docStyles = StyleSheet.create({
  fileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f9ff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#bae6fd",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  iconContainer: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: "#e0f2fe",
    alignItems: "center",
    justifyContent: "center",
  },
  metaContainer: {
    flex: 1,
    gap: 2,
  },
  fileName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0369a1",
  },
  fileSubtitle: {
    fontSize: 11,
    color: "#64748b",
  },
  actionBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ffffff",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#bae6fd",
  },
  actionText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0284c7",
  },
});
