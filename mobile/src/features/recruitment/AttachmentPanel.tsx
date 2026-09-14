import { useAppAlert } from "../../components/AppAlert";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Download, Paperclip, Plus, Trash2 } from "lucide-react-native";
import type { RecruitmentAttachment } from "../../../../src/types/recruitment";
import { recruitment } from "../../api/services";
import { messageOf } from "../../auth/SessionProvider";
import { shareRecruitmentFile, uploadRecruitmentFile } from "./files";

export function AttachmentPanel({
  kind,
  id,
  manage,
  hasJdFile = false,
}: {
  kind: "job" | "applicant";
  id: string;
  manage: boolean;
  hasJdFile?: boolean;
}) {
  const { showAlert, alertView } = useAppAlert();
  const [attachment, setAttachment] = useState<RecruitmentAttachment | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const lock = useRef(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setAttachment(null);
    void (kind === "job" ? recruitment.getJobAttachment(id) : recruitment.getApplicantAttachment(id))
      .then((value) => {
        if (active) {
          setAttachment(value);
        }
      })
      .catch(() => {
        if (active) {
          setAttachment(null);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [kind, id, revision]);

  const run = async (action: "upload" | "download" | "delete") => {
    if (lock.current || (action !== "download" && !manage)) return;
    lock.current = true;
    setBusy(true);
    try {
      if (action === "upload") await uploadRecruitmentFile(kind, id, attachment?.version);
      else if (attachment) {
        if (action === "download") await shareRecruitmentFile(attachment._id);
        else await recruitment.deleteAttachment(attachment._id);
      }
      if (action !== "download") setRevision((value) => value + 1);
    } catch (error) {
      showAlert("Thao tác tệp", messageOf(error), undefined, "error");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={panelStyles.loadingRow}>
        <ActivityIndicator size="small" color="#059669" />
        <Text style={panelStyles.loadingText}>Đang tải tệp đính kèm...</Text>
      </View>
    );
  }

  if (attachment) {
    return (
      <>
        <View style={panelStyles.fileCard}>
          <View style={panelStyles.iconBox}>
            <Paperclip size={18} color="#059669" />
          </View>
          <View style={panelStyles.metaBox}>
            <Text style={panelStyles.fileName} numberOfLines={1}>
              {attachment.originalName}
            </Text>
            <Text style={panelStyles.fileSize}>
              {Math.ceil(attachment.size / 1024)} KB · Phụ lục đính kèm
            </Text>
          </View>

          <View style={panelStyles.actionsBox}>
            <Pressable
              style={({ pressed }) => [panelStyles.downloadBtn, pressed && { opacity: 0.7 }]}
              disabled={busy}
              onPress={() => void run("download")}
            >
              <Download size={13} color="#047857" />
              <Text style={panelStyles.downloadBtnText}>Tải</Text>
            </Pressable>

            {manage && (
              <Pressable
                accessibilityLabel="Gỡ tệp đính kèm"
                style={({ pressed }) => [panelStyles.deleteBtn, pressed && { opacity: 0.7 }]}
                disabled={busy}
                onPress={() =>
                  showAlert("Gỡ tệp phụ lục?", attachment.originalName, [
                    { text: "Hủy", style: "cancel" },
                    { text: "Gỡ tệp", style: "destructive", onPress: () => void run("delete") },
                  ])
                }
              >
                <Trash2 size={13} color="#dc2626" />
              </Pressable>
            )}
          </View>
        </View>
        {alertView}
      </>
    );
  }

  // If no attachment:
  if (manage) {
    return (
      <>
        <Pressable
          style={({ pressed }) => [panelStyles.addBtn, pressed && { opacity: 0.75 }]}
          disabled={busy}
          onPress={() => void run("upload")}
        >
          <Plus size={14} color="#059669" />
          <Text style={panelStyles.addBtnText}>+ Đính kèm thêm tài liệu phụ lục</Text>
        </Pressable>
        {alertView}
      </>
    );
  }

  // Not manager and already has a JD file -> don't show empty placeholder
  if (hasJdFile) return null;

  return (
    <View style={panelStyles.emptyRow}>
      <Text style={panelStyles.emptyText}>Chưa có tài liệu phụ lục đính kèm.</Text>
    </View>
  );
}

const panelStyles = StyleSheet.create({
  fileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ecfdf5",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#a7f3d0",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: "#d1fae5",
    alignItems: "center",
    justifyContent: "center",
  },
  metaBox: {
    flex: 1,
    gap: 2,
  },
  fileName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#065f46",
  },
  fileSize: {
    fontSize: 11,
    color: "#047857",
  },
  actionsBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  downloadBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ffffff",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  downloadBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#047857",
  },
  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: "#fee2e2",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#fca5a5",
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#a7f3d0",
    borderStyle: "dashed",
    backgroundColor: "#f0fdf4",
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#047857",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  loadingText: {
    fontSize: 12,
    color: "#64748b",
  },
  emptyRow: {
    paddingVertical: 4,
  },
  emptyText: {
    fontSize: 12,
    color: "#94a3b8",
    fontStyle: "italic",
  },
});
