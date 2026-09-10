import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { LeaveAttachment, LeaveTemplate, RequestKind } from "../../../../src/types/leave";
import { REQUEST_KIND_OPTIONS } from "../../../../src/types/leave";
import { leave } from "../../api/services";
import { messageOf } from "../../auth/SessionProvider";
import { ChoiceField } from "./ChoiceField";
import { pickLeaveAttachment, shareLeaveFile } from "./files";

const KIND_LABELS: Record<RequestKind, { label: string; color: string; bg: string }> = {
  leave: { label: "Nghỉ phép", color: "#059669", bg: "#ecfdf5" },
  wfh: { label: "Làm tại nhà", color: "#4f46e5", bg: "#eef2ff" },
  exception: { label: "Ngoại lệ", color: "#d97706", bg: "#fffbeb" },
  event: { label: "Sự kiện", color: "#7c3aed", bg: "#f5f3ff" },
};

export function LeaveTemplates({
  templates,
  canManage,
  reload,
  onClose,
  setLocked,
}: {
  templates: LeaveTemplate[];
  canManage: boolean;
  reload: () => Promise<void>;
  onClose: () => void;
  setLocked: (value: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<RequestKind>("leave");
  const [file, setFile] = useState<(LeaveAttachment & { uploadToken: string }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const lock = useRef(false);

  const run = async (action: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setLocked(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
      setLocked(false);
      lock.current = false;
    }
  };

  return (
    <View style={s.container}>
      {/* Top Header */}
      <View style={s.topBar}>
        <View style={s.dragHandle} />
        <View style={s.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Biểu mẫu đơn từ</Text>
            <Text style={s.headerSubtitle}>Tài liệu & biểu mẫu chuẩn của tổ chức</Text>
          </View>
          <Pressable
            style={({ pressed }) => [s.closeCircle, pressed && s.pressedCircle]}
            onPress={onClose}
            disabled={busy}
          >
            <Ionicons name="close" size={20} color="#475569" />
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {!!error && (
          <View style={s.errorBox}>
            <Ionicons name="alert-circle" size={18} color="#e11d48" />
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}

        {/* Action to toggle upload (if manager) */}
        {canManage && (
          <Pressable
            style={({ pressed }) => [s.addToggleBtn, pressed && { opacity: 0.85 }]}
            onPress={() => setShowAddForm((v) => !v)}
            disabled={busy}
          >
            <Ionicons
              name={showAddForm ? "remove-circle-outline" : "add-circle-outline"}
              size={18}
              color="#059669"
            />
            <Text style={s.addToggleText}>
              {showAddForm ? "Đóng biểu mẫu đăng mới" : "+ Đăng biểu mẫu mới"}
            </Text>
          </Pressable>
        )}

        {/* Manager Add Template Card */}
        {canManage && showAddForm && (
          <View style={s.formCard}>
            <Text style={s.formTitle}>Đăng tải biểu mẫu mới</Text>

            <View style={{ gap: 6 }}>
              <Text style={s.inputLabel}>Tên biểu mẫu</Text>
              <TextInput
                style={s.textInput}
                placeholder="VD: Mẫu xin nghỉ ốm dài ngày..."
                placeholderTextColor="#94a3b8"
                value={name}
                onChangeText={setName}
                maxLength={200}
                editable={!busy}
              />
            </View>

            <ChoiceField
              label="Loại yêu cầu áp dụng"
              value={kind}
              choices={REQUEST_KIND_OPTIONS}
              onChange={setKind}
              disabled={busy}
            />

            <View style={{ gap: 6 }}>
              <Text style={s.inputLabel}>Tệp biểu mẫu đính kèm</Text>
              {file ? (
                <View style={s.attachedFileCard}>
                  <Ionicons name="document-attach" size={20} color="#0284c7" />
                  <Text style={s.attachedFileName} numberOfLines={1}>
                    {file.name}
                  </Text>
                  <Pressable
                    onPress={() =>
                      void run(async () => {
                        const selected = await pickLeaveAttachment();
                        if (selected) setFile(selected);
                      })
                    }
                    disabled={busy}
                  >
                    <Text style={s.changeFileLink}>Đổi tệp</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  style={({ pressed }) => [s.uploadBtn, pressed && s.uploadBtnPressed]}
                  disabled={busy}
                  onPress={() =>
                    void run(async () => {
                      const selected = await pickLeaveAttachment();
                      if (selected) setFile(selected);
                    })
                  }
                >
                  <Ionicons name="cloud-upload-outline" size={20} color="#059669" />
                  <Text style={s.uploadBtnText}>
                    {busy ? "Đang xử lý..." : "Chọn tệp biểu mẫu (PDF, Word, Excel)"}
                  </Text>
                </Pressable>
              )}
            </View>

            <Pressable
              style={({ pressed }) => [
                s.submitFormBtn,
                (!file || !name.trim() || busy) && s.submitFormBtnDisabled,
                pressed && { opacity: 0.85 },
              ]}
              disabled={busy || !file || !name.trim()}
              onPress={() =>
                void run(async () => {
                  if (!file) return;
                  await leave.createTemplate({
                    name: name.trim(),
                    requestKind: kind,
                    fileUrl: file.url,
                    fileName: file.name,
                    uploadToken: file.uploadToken,
                  });
                  setName("");
                  setFile(null);
                  setShowAddForm(false);
                  await reload();
                })
              }
            >
              {busy ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={s.submitFormBtnText}>Đăng biểu mẫu</Text>
              )}
            </Pressable>
          </View>
        )}

        {/* Templates List */}
        <View style={{ gap: 10 }}>
          <Text style={s.listHeaderTitle}>
            Danh sách biểu mẫu ({templates.length})
          </Text>

          {templates.length === 0 ? (
            <View style={s.emptyBox}>
              <Ionicons name="folder-open-outline" size={40} color="#cbd5e1" />
              <Text style={s.emptyTitle}>Chưa có biểu mẫu nào</Text>
              <Text style={s.emptySub}>
                Khi phòng nhân sự đăng tải các mẫu đơn quy định, bạn có thể tải về và sử dụng tại đây.
              </Text>
            </View>
          ) : (
            templates.map((item) => {
              const kInfo = KIND_LABELS[item.requestKind] || KIND_LABELS.leave;
              return (
                <View key={item._id} style={s.tplCard}>
                  <View style={s.tplCardTop}>
                    <View style={s.tplIconBox}>
                      <Ionicons name="document-text" size={20} color="#0284c7" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.tplName}>{item.name}</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 }}>
                        <View style={[s.tplKindBadge, { backgroundColor: kInfo.bg }]}>
                          <Text style={[s.tplKindText, { color: kInfo.color }]}>
                            {kInfo.label}
                          </Text>
                        </View>
                        <Text style={s.tplFileName} numberOfLines={1}>
                          {item.fileName}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={s.tplActionsRow}>
                    <Pressable
                      style={({ pressed }) => [s.downloadBtn, pressed && { opacity: 0.7 }]}
                      onPress={() => void run(() => shareLeaveFile(item.fileUrl, item.fileName))}
                      disabled={busy}
                    >
                      <Ionicons name="download-outline" size={15} color="#0284c7" />
                      <Text style={s.downloadBtnText}>Tải về / Chia sẻ</Text>
                    </Pressable>

                    {canManage && (
                      <Pressable
                        style={({ pressed }) => [s.deleteBtn, pressed && { opacity: 0.7 }]}
                        disabled={busy}
                        onPress={() =>
                          Alert.alert("Xóa biểu mẫu?", item.name, [
                            { text: "Hủy", style: "cancel" },
                            {
                              text: "Xóa",
                              style: "destructive",
                              onPress: () =>
                                void run(async () => {
                                  await leave.removeTemplate(item._id);
                                  await reload();
                                }),
                            },
                          ])
                        }
                      >
                        <Ionicons name="trash-outline" size={15} color="#e11d48" />
                        <Text style={s.deleteBtnText}>Xóa</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>

      {/* Footer Close Button */}
      <SafeAreaView edges={["bottom"]} style={s.bottomSafe}>
        <Pressable style={s.closeFooterBtn} onPress={onClose} disabled={busy}>
          <Text style={s.closeFooterText}>Đóng</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  topBar: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  dragHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#cbd5e1",
    alignSelf: "center",
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 2,
  },
  closeCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  pressedCircle: {
    backgroundColor: "#e2e8f0",
  },
  content: {
    padding: 16,
    gap: 14,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff1f2",
    borderWidth: 1,
    borderColor: "#fecdd3",
    borderRadius: 10,
    padding: 10,
  },
  errorText: {
    fontSize: 12,
    color: "#be123c",
    flex: 1,
  },
  addToggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  addToggleText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#047857",
  },
  formCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    padding: 14,
    gap: 12,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  formTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  textInput: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 13,
    color: "#0f172a",
  },
  attachedFileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f0f9ff",
    borderWidth: 1,
    borderColor: "#bae6fd",
    padding: 10,
    borderRadius: 10,
  },
  attachedFileName: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0369a1",
    flex: 1,
  },
  changeFileLink: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0284c7",
  },
  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    backgroundColor: "#f8fafc",
    borderWidth: 1.5,
    borderColor: "#cbd5e1",
    borderStyle: "dashed",
    borderRadius: 12,
  },
  uploadBtnPressed: {
    backgroundColor: "#f1f5f9",
  },
  uploadBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#059669",
  },
  submitFormBtn: {
    height: 44,
    borderRadius: 12,
    backgroundColor: "#059669",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  submitFormBtnDisabled: {
    backgroundColor: "#94a3b8",
  },
  submitFormBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff",
  },
  listHeaderTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1e293b",
  },
  emptyBox: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 24,
    alignItems: "center",
    gap: 6,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#334155",
  },
  emptySub: {
    fontSize: 12,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 17,
  },
  tplCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 12,
    gap: 10,
  },
  tplCardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  tplIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#f0f9ff",
    alignItems: "center",
    justifyContent: "center",
  },
  tplName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  tplKindBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tplKindText: {
    fontSize: 11,
    fontWeight: "700",
  },
  tplFileName: {
    fontSize: 11,
    color: "#64748b",
    flex: 1,
  },
  tplActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 8,
  },
  downloadBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#f0f9ff",
    borderWidth: 1,
    borderColor: "#bae6fd",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  downloadBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0284c7",
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#fff1f2",
  },
  deleteBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#e11d48",
  },
  bottomSafe: {
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  closeFooterBtn: {
    height: 44,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
  },
  closeFooterText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#475569",
  },
});
