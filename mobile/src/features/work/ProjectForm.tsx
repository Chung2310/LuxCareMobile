import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { randomUUID } from "expo-crypto";
import type { Project, TaskAttachment } from "../../../../src/types/hr";
import type { ProjectInput } from "../../../../src/services/kanbanService";
import { kanban } from "../../api/services";
import { messageOf } from "../../auth/SessionProvider";
import { projectDraft, projectPayload, PROJECT_STATUSES, PROJECT_PRIORITIES } from "./project";
import { localDateTime } from "./model";
import { DateTimePickerModal } from "./DateTimePickerModal";
import {
  pickMultipleImageAttachments,
  pickMultipleWorkAttachments,
  pickImageAttachment,
  pickWorkAttachment,
} from "./attachments";
import { shareLeaveFile } from "../leave/files";
import {
  X,
  AlertCircle,
  Zap,
  Calendar,
  Target,
  Paperclip,
  Image as ImageIcon,
  Link as LinkIcon,
  Video as VideoIcon,
  Music as MusicIcon,
  FileText,
  Plus,
  Trash2,
  ExternalLink,
  Layers,
} from "lucide-react-native";

function formatDisplayDate(str: string): string {
  if (!str) return "";
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (match) {
    return `${match[3]}/${match[2]}/${match[1]} lúc ${match[4]}:${match[5]}`;
  }
  return str;
}

function AttachmentTypeIcon({ type }: { type?: string }) {
  if (type === "link") return <LinkIcon size={16} color="#2563eb" />;
  if (type === "image") return <ImageIcon size={16} color="#059669" />;
  if (type === "video") return <VideoIcon size={16} color="#d97706" />;
  if (type === "audio") return <MusicIcon size={16} color="#8b5cf6" />;
  return <FileText size={16} color="#475569" />;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  not_started: { label: "Chưa bắt đầu", color: "#475569", bg: "#f1f5f9", border: "#cbd5e1" },
  in_progress: { label: "Đang làm", color: "#1d4ed8", bg: "#eff6ff", border: "#93c5fd" },
  paused: { label: "Tạm dừng", color: "#b45309", bg: "#fffbeb", border: "#fde68a" },
  completed: { label: "Hoàn thành", color: "#047857", bg: "#ecfdf5", border: "#a7f3d0" },
  cancelled: { label: "Đã hủy", color: "#b91c1c", bg: "#fef2f2", border: "#fca5a5" },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  urgent: { label: "Khẩn cấp", color: "#b91c1c", bg: "#fef2f2", border: "#fca5a5" },
  high: { label: "Cao", color: "#c2410c", bg: "#fff7ed", border: "#fed7aa" },
  medium: { label: "Trung bình", color: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe" },
  low: { label: "Thấp", color: "#475569", bg: "#f8fafc", border: "#e2e8f0" },
};

function formatNowPlusDays(days: number, hour = 18): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return localDateTime(d.toISOString());
}

export function ProjectForm({
  project,
  onClose,
  onSaved,
  setLocked,
}: {
  project?: Project;
  onClose: () => void;
  onSaved: () => void;
  setLocked: (value: boolean) => void;
}) {
  const [draft, setDraft] = useState(() => projectDraft(project));
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeDatePicker, setActiveDatePicker] = useState<"startAt" | "dueAt" | null>(null);

  // Link modal state
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkMode, setLinkMode] = useState<"single" | "batch">("single");
  const [linkName, setLinkName] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [batchLinks, setBatchLinks] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);

  const lock = useRef(false);

  // Attachment actions
  const handlePickFiles = async () => {
    setUploading(true);
    setUploadMessage("Đang tải tệp lên...");
    try {
      let files = await pickMultipleWorkAttachments();
      if (!files.length) {
        // Fallback to single pick if multiple wasn't returned
        const single = await pickWorkAttachment();
        if (single) files = [single];
      }
      if (files.length > 0) {
        setDraft((v) => ({ ...v, attachments: [...v.attachments, ...files] }));
      }
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setUploading(false);
      setUploadMessage("");
    }
  };

  const handlePickImages = async () => {
    setUploading(true);
    setUploadMessage("Đang tải ảnh/video lên...");
    try {
      let files = await pickMultipleImageAttachments();
      if (!files.length) {
        const single = await pickImageAttachment();
        if (single) files = [single];
      }
      if (files.length > 0) {
        setDraft((v) => ({ ...v, attachments: [...v.attachments, ...files] }));
      }
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setUploading(false);
      setUploadMessage("");
    }
  };

  const handleAddSingleLink = () => {
    setLinkError(null);
    try {
      const trimmedUrl = linkUrl.trim();
      const target = new URL(trimmedUrl);
      if (!["https:", "http:"].includes(target.protocol)) {
        throw new Error("Chỉ hỗ trợ liên kết web bắt đầu bằng http:// hoặc https://");
      }
      const newAttachment: TaskAttachment = {
        id: randomUUID(),
        name: linkName.trim() || target.hostname,
        url: target.toString(),
        type: "link",
      };
      setDraft((v) => ({ ...v, attachments: [...v.attachments, newAttachment] }));
      setLinkName("");
      setLinkUrl("");
      setLinkModalOpen(false);
    } catch (err) {
      setLinkError(messageOf(err));
    }
  };

  const handleAddBatchLinks = () => {
    setLinkError(null);
    const lines = batchLinks
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      setLinkError("Vui lòng nhập ít nhất một liên kết.");
      return;
    }

    const newAttachments: TaskAttachment[] = [];
    const errors: string[] = [];

    for (const line of lines) {
      let name = "";
      let url = "";

      if (line.includes("|")) {
        const parts = line.split("|");
        name = parts[0].trim();
        url = parts.slice(1).join("|").trim();
      } else {
        url = line;
      }

      try {
        const target = new URL(url);
        if (!["https:", "http:"].includes(target.protocol)) {
          errors.push(`"${url}": Chỉ hỗ trợ liên kết http/https.`);
          continue;
        }
        newAttachments.push({
          id: randomUUID(),
          name: name || target.hostname,
          url: target.toString(),
          type: "link",
        });
      } catch {
        errors.push(`"${url}": URL không đúng định dạng.`);
      }
    }

    if (newAttachments.length === 0) {
      setLinkError(errors.join("\n") || "Không tìm thấy liên kết hợp lệ nào.");
      return;
    }

    setDraft((v) => ({ ...v, attachments: [...v.attachments, ...newAttachments] }));
    setBatchLinks("");
    setLinkModalOpen(false);
  };

  const handleRemoveAttachment = (id: string) => {
    setDraft((v) => ({
      ...v,
      attachments: v.attachments.filter((a) => a.id !== id),
    }));
  };

  const handleOpenAttachment = (att: TaskAttachment) => {
    if (att.type === "link") {
      void Linking.openURL(att.url);
    } else {
      void shareLeaveFile(att.url, att.name);
    }
  };

  const save = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setLocked(true);
    setError(null);
    try {
      const input = projectPayload(draft, project);
      try {
        if (project) {
          if (Object.keys(input).length) await kanban.updateProject(project.id, input);
        } else {
          const created = await kanban.createProject(input as ProjectInput);
          if (
            created?.id &&
            draft.attachments.length > 0 &&
            (!created.attachments || created.attachments.length === 0)
          ) {
            try {
              await kanban.updateProject(created.id, { attachments: draft.attachments });
            } catch {}
          }
        }
      } catch (err) {
        if (!(err && typeof err === "object" && "status" in err) || Number((err as any).status) >= 500) {
          setUncertain(true);
          throw new Error(
            "Chưa xác nhận được kết quả lưu. Vui lòng quay lại danh sách để kiểm tra trước khi thao tác tiếp.",
          );
        }
        throw err;
      }
      onSaved();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      lock.current = false;
      setBusy(false);
      setLocked(false);
    }
  };

  const disabled = busy || uploading || uncertain;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Top Header */}
      <View style={styles.topHeader}>
        <Pressable
          onPress={onClose}
          style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.7 }]}
          hitSlop={12}
        >
          <X size={18} color="#64748b" />
        </Pressable>
        <Text style={styles.titleText}>{project ? "Sửa dự án" : "Tạo dự án mới"}</Text>
        <Pressable
          onPress={() => void save()}
          disabled={disabled || !draft.name.trim()}
          style={({ pressed }) => [
            styles.headerSaveBtn,
            (!draft.name.trim() || disabled) && styles.headerSaveBtnDisabled,
            pressed && { opacity: 0.8 },
          ]}
        >
          {busy ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.headerSaveBtnText}>Lưu</Text>
          )}
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Error Banner */}
        {!!error && (
          <View style={[styles.errorCard, { flexDirection: "row", alignItems: "center", gap: 8 }]}>
            <AlertCircle size={16} color="#b91c1c" />
            <Text style={[styles.errorText, { flex: 1 }]}>{error}</Text>
          </View>
        )}

        {/* Section: Thông tin dự án */}
        <View style={styles.card}>
          <Text style={styles.cardSectionTitle}>THÔNG TIN DỰ ÁN</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              Tên dự án <Text style={styles.requiredStar}>*</Text>
            </Text>
            <TextInput
              style={styles.textInput}
              placeholder="VD: Triển khai chiến dịch chăm sóc khách hàng..."
              placeholderTextColor="#94a3b8"
              value={draft.name}
              editable={!disabled}
              onChangeText={(name) => setDraft((v) => ({ ...v, name }))}
            />
          </View>
        </View>

        {/* Section: Trạng thái */}
        <View style={styles.card}>
          <Text style={styles.cardSectionTitle}>TRẠNG THÁI</Text>
          <View style={styles.chipsRow}>
            {PROJECT_STATUSES.filter((item) => !!project || item.value !== "completed").map((st) => {
              const selected = draft.status === st.value;
              const config = STATUS_CONFIG[st.value] || {
                label: st.label,
                color: "#475569",
                bg: "#f1f5f9",
                border: "#cbd5e1",
              };
              return (
                <Pressable
                  key={st.value}
                  disabled={disabled}
                  onPress={() => setDraft((v) => ({ ...v, status: st.value as Project["status"] }))}
                  style={[
                    styles.chip,
                    selected && {
                      backgroundColor: config.bg,
                      borderColor: config.border,
                      borderWidth: 1.5,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selected && { color: config.color, fontWeight: "700" },
                    ]}
                  >
                    {config.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Section: Mức độ ưu tiên */}
        <View style={styles.card}>
          <Text style={styles.cardSectionTitle}>MỨC ĐỘ ƯU TIÊN</Text>
          <View style={styles.chipsRow}>
            {PROJECT_PRIORITIES.map((pr) => {
              const selected = draft.priority === pr.value;
              const config = PRIORITY_CONFIG[pr.value] || {
                label: pr.label,
                color: "#475569",
                bg: "#f1f5f9",
                border: "#cbd5e1",
              };
              return (
                <Pressable
                  key={pr.value}
                  disabled={disabled}
                  onPress={() => setDraft((v) => ({ ...v, priority: pr.value as Project["priority"] }))}
                  style={[
                    styles.chip,
                    selected && {
                      backgroundColor: config.bg,
                      borderColor: config.border,
                      borderWidth: 1.5,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selected && { color: config.color, fontWeight: "700" },
                    ]}
                  >
                    {config.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Section: Thời gian thực hiện */}
        <View style={styles.card}>
          <Text style={styles.cardSectionTitle}>THỜI GIAN THỰC HIỆN</Text>

          {/* Quick chips for dates */}
          <Text style={styles.quickLabel}>Chọn nhanh thời hạn:</Text>
          <View style={styles.quickRow}>
            <Pressable
              disabled={disabled}
              style={styles.quickPill}
              onPress={() => {
                setDraft((v) => ({
                  ...v,
                  startAt: formatNowPlusDays(0, 8),
                  dueAt: formatNowPlusDays(7, 18),
                }));
              }}
            >
              <>
                <Zap size={12} color="#2563eb" style={{ marginRight: 4 }} />
                <Text style={styles.quickPillText}>1 tuần</Text>
              </>
            </Pressable>
            <Pressable
              disabled={disabled}
              style={styles.quickPill}
              onPress={() => {
                setDraft((v) => ({
                  ...v,
                  startAt: formatNowPlusDays(0, 8),
                  dueAt: formatNowPlusDays(30, 18),
                }));
              }}
            >
              <>
                <Calendar size={12} color="#2563eb" style={{ marginRight: 4 }} />
                <Text style={styles.quickPillText}>1 tháng</Text>
              </>
            </Pressable>
            <Pressable
              disabled={disabled}
              style={styles.quickPill}
              onPress={() => {
                setDraft((v) => ({
                  ...v,
                  startAt: formatNowPlusDays(0, 8),
                  dueAt: formatNowPlusDays(90, 18),
                }));
              }}
            >
              <>
                <Target size={12} color="#2563eb" style={{ marginRight: 4 }} />
                <Text style={styles.quickPillText}>1 quý</Text>
              </>
            </Pressable>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Thời gian bắt đầu</Text>
            <Pressable
              onPress={() => setActiveDatePicker("startAt")}
              disabled={disabled}
              style={styles.datePickerTrigger}
            >
              <Calendar size={14} color="#64748b" style={{ marginRight: 6 }} />
              <Text
                style={[
                  styles.datePickerValue,
                  !draft.startAt && styles.datePickerPlaceholder,
                ]}
                numberOfLines={1}
              >
                {draft.startAt ? formatDisplayDate(draft.startAt) : "Chọn thời gian bắt đầu..."}
              </Text>
              {!!draft.startAt && (
                <Pressable
                  onPress={() => setDraft((v) => ({ ...v, startAt: "" }))}
                  hitSlop={8}
                  style={styles.dateClearBtn}
                >
                  <X size={12} color="#94a3b8" />
                </Pressable>
              )}
            </Pressable>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Hạn chót dự án</Text>
            <Pressable
              onPress={() => setActiveDatePicker("dueAt")}
              disabled={disabled}
              style={styles.datePickerTrigger}
            >
              <Calendar size={14} color="#64748b" style={{ marginRight: 6 }} />
              <Text
                style={[
                  styles.datePickerValue,
                  !draft.dueAt && styles.datePickerPlaceholder,
                ]}
                numberOfLines={1}
              >
                {draft.dueAt ? formatDisplayDate(draft.dueAt) : "Chọn hạn chót hoàn thành..."}
              </Text>
              {!!draft.dueAt && (
                <Pressable
                  onPress={() => setDraft((v) => ({ ...v, dueAt: "" }))}
                  hitSlop={8}
                  style={styles.dateClearBtn}
                >
                  <X size={12} color="#94a3b8" />
                </Pressable>
              )}
            </Pressable>
          </View>
        </View>

        {/* Section: Tệp & Liên kết đính kèm */}
        <View style={styles.card}>
          <View style={styles.cardHeaderWithCount}>
            <Text style={styles.cardSectionTitle}>
              TỆP & LIÊN KẾT ĐÍNH KÈM ({draft.attachments.length})
            </Text>
          </View>
          <Text style={styles.sectionSubtitle}>
            Đính kèm tài liệu, hình ảnh hoặc danh sách liên kết tham chiếu cho dự án.
          </Text>

          {/* Action buttons */}
          <View style={styles.attachmentBtnRow}>
            <Pressable
              style={[styles.attachActionBtn, { flexDirection: "row", alignItems: "center", gap: 5 }]}
              onPress={() => void handlePickFiles()}
              disabled={disabled}
            >
              <Paperclip size={14} color="#059669" />
              <Text style={styles.attachActionText}>Tải tệp lên</Text>
            </Pressable>

            <Pressable
              style={[styles.attachActionBtn, { flexDirection: "row", alignItems: "center", gap: 5 }]}
              onPress={() => void handlePickImages()}
              disabled={disabled}
            >
              <ImageIcon size={14} color="#0284c7" />
              <Text style={styles.attachActionText}>Tải ảnh lên</Text>
            </Pressable>

            <Pressable
              style={[styles.attachActionBtn, { flexDirection: "row", alignItems: "center", gap: 5 }]}
              onPress={() => {
                setLinkError(null);
                setLinkModalOpen(true);
              }}
              disabled={disabled}
            >
              <LinkIcon size={14} color="#7c3aed" />
              <Text style={styles.attachActionText}>Điền liên kết</Text>
            </Pressable>
          </View>

          {/* Uploading progress indicator */}
          {uploading && (
            <View style={styles.uploadingBox}>
              <ActivityIndicator size="small" color="#059669" />
              <Text style={styles.uploadingText}>{uploadMessage || "Đang xử lý tệp đính kèm..."}</Text>
            </View>
          )}

          {/* Attachments List */}
          {draft.attachments.length > 0 ? (
            <View style={styles.attachmentList}>
              {draft.attachments.map((att) => (
                <View key={att.id} style={styles.attachmentItem}>
                  <View style={styles.attachmentIconWrap}>
                    <AttachmentTypeIcon type={att.type} />
                  </View>
                  <View style={styles.attachmentItemInfo}>
                    <Text style={styles.attachmentItemName} numberOfLines={1}>
                      {att.name}
                    </Text>
                    <Text style={styles.attachmentItemSub} numberOfLines={1}>
                      {att.type === "link"
                        ? att.url
                        : att.size
                        ? `${Math.round(att.size / 1024)} KB`
                        : "Tệp đính kèm"}
                    </Text>
                  </View>

                  <Pressable
                    style={styles.viewAttachBtn}
                    onPress={() => handleOpenAttachment(att)}
                  >
                    <Text style={styles.viewAttachBtnText}>
                      {att.type === "link" ? "Mở" : "Xem"}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => handleRemoveAttachment(att.id)}
                    hitSlop={8}
                    style={styles.removeAttachBtn}
                  >
                    <X size={14} color="#94a3b8" />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyTipText}>Chưa có tài liệu hoặc tệp đính kèm nào.</Text>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Date Time Picker Modal */}
      <DateTimePickerModal
        visible={activeDatePicker !== null}
        onClose={() => setActiveDatePicker(null)}
        title={activeDatePicker === "startAt" ? "Chọn thời gian bắt đầu" : "Chọn hạn chót dự án"}
        value={activeDatePicker ? draft[activeDatePicker] : ""}
        onChange={(val) => {
          if (activeDatePicker) {
            setDraft((v) => ({ ...v, [activeDatePicker]: val }));
          }
        }}
      />

      {/* Link Modal (Supports Single & Batch/Điền nhiều) */}
      <Modal
        visible={linkModalOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setLinkModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.linkModalBox}>
            <View style={styles.linkModalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.linkModalTitle}>Thêm liên kết dự án</Text>
                <Text style={styles.linkModalSubtitle}>
                  Thêm tài liệu trực tuyến (Google Drive, Docs, Figma,...)
                </Text>
              </View>
              <TouchableOpacity
                style={styles.linkModalCloseBtn}
                onPress={() => setLinkModalOpen(false)}
                hitSlop={8}
              >
                <X size={18} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Mode Switcher Tabs */}
            <View style={styles.linkTabsRow}>
              <TouchableOpacity
                style={[
                  styles.linkTab,
                  linkMode === "single" && styles.linkTabActive,
                ]}
                onPress={() => {
                  setLinkMode("single");
                  setLinkError(null);
                }}
              >
                <Text
                  style={[
                    styles.linkTabText,
                    linkMode === "single" && styles.linkTabTextActive,
                  ]}
                >
                  Thêm 1 liên kết
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.linkTab,
                  linkMode === "batch" && styles.linkTabActive,
                ]}
                onPress={() => {
                  setLinkMode("batch");
                  setLinkError(null);
                }}
              >
                <Text
                  style={[
                    styles.linkTabText,
                    linkMode === "batch" && styles.linkTabTextActive,
                  ]}
                >
                  Điền nhiều liên kết (Hàng loạt)
                </Text>
              </TouchableOpacity>
            </View>

            {linkError && (
              <View style={styles.linkErrorBanner}>
                <AlertCircle size={14} color="#dc2626" />
                <Text style={styles.linkErrorText}>{linkError}</Text>
              </View>
            )}

            {linkMode === "single" ? (
              <View style={styles.linkFormBody}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Tên liên kết (tùy chọn)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="VD: Bản thiết kế Figma, File phân tích dữ liệu..."
                    placeholderTextColor="#94a3b8"
                    value={linkName}
                    onChangeText={setLinkName}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>
                    Địa chỉ URL <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="https://example.com/..."
                    placeholderTextColor="#94a3b8"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    value={linkUrl}
                    onChangeText={setLinkUrl}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.addLinkBtn, !linkUrl.trim() && styles.btnDisabled]}
                  disabled={!linkUrl.trim()}
                  onPress={handleAddSingleLink}
                >
                  <Plus size={16} color="#ffffff" />
                  <Text style={styles.addLinkBtnText}>Thêm vào danh sách</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.linkFormBody}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>
                    Dán danh sách các liên kết (mỗi dòng 1 link)
                  </Text>
                  <TextInput
                    style={[styles.textInput, { minHeight: 110, textAlignVertical: "top" }]}
                    placeholder={`Ví dụ:\nhttps://docs.google.com/document/...\nBản vẽ | https://figma.com/file/...\nhttps://drive.google.com/...`}
                    placeholderTextColor="#94a3b8"
                    multiline
                    numberOfLines={5}
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={batchLinks}
                    onChangeText={setBatchLinks}
                  />
                  <Text style={styles.batchTip}>
                    Mẹo: Có thể dán trực tiếp nhiều URL hoặc dùng định dạng "Tên hiển thị | URL".
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.addLinkBtn, !batchLinks.trim() && styles.btnDisabled]}
                  disabled={!batchLinks.trim()}
                  onPress={handleAddBatchLinks}
                >
                  <Plus size={16} color="#ffffff" />
                  <Text style={styles.addLinkBtnText}>Thêm tất cả các link</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Bottom Sticky Actions */}
      <View style={styles.bottomBar}>
        <Pressable
          onPress={onClose}
          disabled={busy}
          style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.cancelBtnText}>{uncertain ? "Quay lại danh sách" : "Hủy"}</Text>
        </Pressable>

        <Pressable
          onPress={() => void save()}
          disabled={disabled || !draft.name.trim()}
          style={({ pressed }) => [
            styles.submitBtn,
            (!draft.name.trim() || disabled) && styles.submitBtnDisabled,
            pressed && { opacity: 0.85 },
          ]}
        >
          {busy ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.submitBtnText}>{project ? "Lưu thay đổi" : "Tạo dự án"}</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  topHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  titleText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0f172a",
    fontFamily: "Inter-Bold",
  },
  headerSaveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#008852",
    minWidth: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  headerSaveBtnDisabled: {
    backgroundColor: "#cbd5e1",
  },
  headerSaveBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    gap: 14,
  },
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  errorText: {
    flex: 1,
    color: "#dc2626",
    fontSize: 13,
    fontWeight: "500",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 12,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  cardSectionTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748b",
    letterSpacing: 0.6,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: "#64748b",
    lineHeight: 18,
    marginTop: -4,
  },
  cardHeaderWithCount: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
  },
  requiredStar: {
    color: "#dc2626",
  },
  textInput: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: "#0f172a",
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  chipText: {
    fontSize: 13,
    color: "#475569",
    fontWeight: "500",
  },
  quickLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "500",
  },
  quickRow: {
    flexDirection: "row",
    gap: 8,
  },
  quickPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#a7f3d0",
    flexDirection: "row",
    alignItems: "center",
  },
  quickPillText: {
    fontSize: 12,
    color: "#047857",
    fontWeight: "600",
  },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#475569",
  },
  submitBtn: {
    flex: 2,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: "#008852",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#008852",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  submitBtnDisabled: {
    backgroundColor: "#cbd5e1",
    shadowOpacity: 0,
    elevation: 0,
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ffffff",
  },
  datePickerTrigger: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  datePickerValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
  },
  datePickerPlaceholder: {
    fontWeight: "400",
    color: "#94a3b8",
  },
  dateClearBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  // Attachments styling
  attachmentBtnRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  attachActionBtn: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
  },
  attachActionText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
  },
  uploadingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  uploadingText: {
    fontSize: 12,
    color: "#047857",
    fontWeight: "600",
  },
  attachmentList: {
    gap: 8,
    marginTop: 4,
  },
  attachmentItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#f8fafc",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  attachmentIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  attachmentItemInfo: {
    flex: 1,
    gap: 2,
  },
  attachmentItemName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
  },
  attachmentItemSub: {
    fontSize: 11,
    color: "#64748b",
  },
  viewAttachBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  viewAttachBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#059669",
  },
  removeAttachBtn: {
    padding: 4,
  },
  emptyTipText: {
    fontSize: 12,
    color: "#94a3b8",
    fontStyle: "italic",
  },
  // Modal overlay & link box
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  linkModalBox: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 18,
    gap: 12,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  linkModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  linkModalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  linkModalSubtitle: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  linkModalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  linkTabsRow: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderRadius: 10,
    padding: 3,
    gap: 4,
  },
  linkTab: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  linkTabActive: {
    backgroundColor: "#ffffff",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  linkTabText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#64748b",
  },
  linkTabTextActive: {
    fontWeight: "700",
    color: "#0f172a",
  },
  linkErrorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fef2f2",
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  linkErrorText: {
    fontSize: 12,
    color: "#dc2626",
    flex: 1,
  },
  linkFormBody: {
    gap: 12,
    marginTop: 2,
  },
  batchTip: {
    fontSize: 11,
    color: "#64748b",
    fontStyle: "italic",
    marginTop: 2,
  },
  addLinkBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#059669",
    paddingVertical: 11,
    borderRadius: 10,
    marginTop: 4,
  },
  addLinkBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff",
  },
  btnDisabled: {
    opacity: 0.5,
  },
});
