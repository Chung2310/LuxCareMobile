import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { randomUUID } from "expo-crypto";
import type { HRTask, Project, TaskAttachment, TaskSubtask } from "../../../../src/types/hr";
import type { UserProfile } from "../../../../src/types/common";
import type { TaskInput } from "../../../../src/services/kanbanService";
import { kanban, roster } from "../../api/services";
import { messageOf, useSession } from "../../auth/SessionProvider";
import { shareLeaveFile } from "../leave/files";
import { pickImageAttachment, pickWorkAttachment } from "./attachments";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  calculateEstimatedHours,
  draftForTask,
  evaluateTaskKpi,
  isTaskManager,
  localDateTime,
  parseDateTime,
  taskPayload,
  type TaskDraft,
} from "./model";
import { DateTimePickerModal } from "./DateTimePickerModal";
import {
  X,
  AlertCircle,
  Folder,
  Check,
  Trash2,
  Paperclip,
  Image as ImageIcon,
  Link as LinkIcon,
  Video as VideoIcon,
  Music as MusicIcon,
  FileText,
  Calendar,
  Zap,
  Search,
  Ban,
} from "lucide-react-native";

function AttachmentTypeIcon({ type }: { type?: string }) {
  if (type === "link") return <LinkIcon size={16} color="#2563eb" />;
  if (type === "image") return <ImageIcon size={16} color="#059669" />;
  if (type === "video") return <VideoIcon size={16} color="#d97706" />;
  if (type === "audio") return <MusicIcon size={16} color="#8b5cf6" />;
  return <FileText size={16} color="#64748b" />;
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  High: { label: "Cao", color: "#b91c1c", bg: "#fef2f2", border: "#fca5a5" },
  Medium: { label: "Trung bình", color: "#b45309", bg: "#fffbeb", border: "#fde68a" },
  Low: { label: "Thấp", color: "#475569", bg: "#f8fafc", border: "#e2e8f0" },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  "Not Started": { label: "Chưa bắt đầu", color: "#475569", bg: "#f1f5f9", border: "#cbd5e1" },
  "In Progress": { label: "Đang làm", color: "#1d4ed8", bg: "#eff6ff", border: "#93c5fd" },
  "Review/Testing": { label: "Chờ duyệt", color: "#7c3aed", bg: "#f5f3ff", border: "#c4b5fd" },
  Done: { label: "Hoàn thành", color: "#047857", bg: "#ecfdf5", border: "#a7f3d0" },
  Archived: { label: "Lưu trữ", color: "#64748b", bg: "#f8fafc", border: "#cbd5e1" },
};

const SUGGESTED_TAGS = ["ƯuTiên", "KhẩnCấp", "Họp", "BáoCáo", "KháchHàng", "KỹThuật"];

function formatNowPlusDays(days: number, hour = 18): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return localDateTime(d.toISOString());
}

function formatDisplayDate(str: string): string {
  if (!str) return "";
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (match) {
    return `${match[3]}/${match[2]}/${match[1]} lúc ${match[4]}:${match[5]}`;
  }
  return str;
}

function parseDateToTime(str?: string): number {
  if (!str || !str.trim()) return 0;
  const s = str.trim();
  const match = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (match) {
    const y = parseInt(match[1], 10);
    const m = parseInt(match[2], 10) - 1;
    const d = parseInt(match[3], 10);
    const h = parseInt(match[4], 10);
    const min = parseInt(match[5], 10);
    return new Date(y, m, d, h, min, 0, 0).getTime();
  }
  const t = new Date(s).getTime();
  return Number.isFinite(t) ? t : 0;
}

function calculateDurationHours(startStr?: string, endStr?: string): number {
  const s = parseDateToTime(startStr);
  const e = parseDateToTime(endStr);
  if (s > 0 && e > 0 && e > s) {
    const diffHours = (e - s) / (1000 * 60 * 60);
    return Math.round(diffHours * 10) / 10;
  }
  return 0;
}

export function TaskForm({
  task,
  projects,
  onClose,
  onSaved,
  setLocked,
}: {
  task?: HRTask;
  projects: Project[];
  onClose: () => void;
  onSaved: () => void;
  setLocked: (value: boolean) => void;
}) {
  const { user } = useSession();
  const manager = !task || isTaskManager(user);
  const [draft, setDraft] = useState(() => {
    const d = draftForTask(task);
    if (!task) {
      if (!d.assigneeUid && user?.uid) d.assigneeUid = user.uid;
      if (!d.dueDate) d.dueDate = formatNowPlusDays(0, 18);
      if (!d.startTime) {
        const now = new Date();
        now.setHours(8, 0, 0, 0);
        d.startTime = localDateTime(now.toISOString());
      }
      const initialEst = calculateDurationHours(d.startTime, d.dueDate);
      if (initialEst > 0 && !d.estTime) d.estTime = String(initialEst);
    }
    return d;
  });
  const [people, setPeople] = useState<UserProfile[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [peopleError, setPeopleError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);

  // Tự động tính toán lại Giờ dự tính và Giờ thực tế khi có thay đổi về ngày giờ
  useEffect(() => {
    const effectiveStart =
      draft.startTime ||
      localDateTime(new Date(new Date().setHours(8, 0, 0, 0)).toISOString());
    const estTarget = draft.endTime || draft.dueDate;

    let nextEst: string | undefined;
    let nextActual: string | undefined;

    if (estTarget) {
      const estH = calculateDurationHours(effectiveStart, estTarget);
      if (estH > 0) {
        nextEst = String(estH);
      }
    }

    if (draft.startTime && draft.endTime) {
      const actH = calculateDurationHours(draft.startTime, draft.endTime);
      if (actH > 0) {
        nextActual = String(actH);
      }
    } else if (!draft.endTime) {
      nextActual = "";
    }

    setDraft((prev) => {
      let changed = false;
      const patch: Partial<TaskDraft> = {};
      if (nextEst !== undefined && prev.estTime !== nextEst) {
        patch.estTime = nextEst;
        changed = true;
      }
      if (nextActual !== undefined && prev.actualTime !== nextActual) {
        patch.actualTime = nextActual;
        changed = true;
      }
      return changed ? { ...prev, ...patch } : prev;
    });
  }, [draft.startTime, draft.endTime, draft.dueDate]);

  // Cập nhật ngày và kích hoạt tính toán
  const updateDatesAndRecalculateTimes = (patch: Partial<TaskDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  const handleStatusChange = (statusVal: string) => {
    setDraft((prev) => {
      const next = { ...prev, status: statusVal };
      if (statusVal === "Done") {
        if (!next.startTime) {
          const now = new Date();
          now.setHours(8, 0, 0, 0);
          next.startTime = localDateTime(now.toISOString());
        }
        if (!next.endTime) {
          next.endTime = localDateTime(new Date().toISOString());
        }
        const estTarget = next.endTime || next.dueDate;
        if (next.startTime && estTarget) {
          const estH = calculateDurationHours(next.startTime, estTarget);
          if (estH > 0) next.estTime = String(estH);
        }
        if (next.startTime && next.endTime) {
          const actH = calculateDurationHours(next.startTime, next.endTime);
          if (actH > 0) next.actualTime = String(actH);
        }
      }
      return next;
    });
  };

  // Assignee picker modal
  const [assigneeModal, setAssigneeModal] = useState(false);
  const [assigneeSearch, setAssigneeSearch] = useState("");

  // Project picker modal
  const [projectModal, setProjectModal] = useState(false);

  // Date picker modal
  const [activeDatePicker, setActiveDatePicker] = useState<"dueDate" | "startTime" | "endTime" | null>(null);

  // Tags input
  const [tagInput, setTagInput] = useState("");

  // Subtask input
  const [subtaskInput, setSubtaskInput] = useState("");

  // Attachment link modal
  const [linkModal, setLinkModal] = useState(false);
  const [linkName, setLinkName] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!manager) return;
    setPeopleLoading(true);
    setPeopleError(null);
    void roster
      .colleagues()
      .then((data) => {
        if (active) setPeople(data);
      })
      .catch((err) => {
        if (active) setPeopleError(messageOf(err));
      })
      .finally(() => {
        if (active) setPeopleLoading(false);
      });
    return () => {
      active = false;
    };
  }, [manager, revision]);

  const save = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setLocked(true);
    setError(null);
    try {
      const input = taskPayload(draft, manager, !task);
      if (task) {
        await kanban.updateTask(task.id, {
          ...input,
          expectedRevision: task.revision !== undefined ? task.revision : 0,
        });
      } else {
        // Tạo công việc mới: Thử tạo với đầy đủ trường dữ liệu
        try {
          await kanban.createTask(input as TaskInput);
        } catch (postErr) {
          // Fallback nếu backend POST chưa hỗ trợ subtasks/attachments/tags trực tiếp
          const fallbackInput: any = { ...input };
          delete fallbackInput.subtasks;
          delete fallbackInput.attachments;
          delete fallbackInput.tags;
          const created = await kanban.createTask(fallbackInput as TaskInput);
          if (created?.id && (input.subtasks?.length || input.attachments?.length || input.tags?.length)) {
            try {
              await kanban.updateTask(created.id, {
                subtasks: input.subtasks,
                attachments: input.attachments,
                tags: input.tags,
              });
            } catch {}
          }
        }
      }
      onSaved();
    } catch (err) {
      const msg = messageOf(err);
      if (task && /thay đổi|phiên bản|revision|version|409/i.test(msg)) {
        try {
          const list = await kanban.listTasks();
          const fresh = list.find((t) => t.id === task.id);
          if (fresh && fresh.revision !== undefined) {
            task.revision = fresh.revision;
            setError(`${msg}\n\nHệ thống đã tự động lấy phiên bản mới nhất từ máy chủ. Bạn có thể nhấn "Lưu công việc" để hoàn tất.`);
            return;
          }
        } catch {}
      }
      setError(msg);
    } finally {
      lock.current = false;
      setBusy(false);
      setLocked(false);
    }
  };

  const disabled = busy;

  // Selected assignee info
  const selectedAssignee = people.find((p) => p.uid === draft.assigneeUid);
  const selectedAssigneeName =
    selectedAssignee?.displayName ||
    (task?.assigneeUid === draft.assigneeUid ? task.assignee : "") ||
    "";

  // Selected project info
  const selectedProject = projects.find((p) => p.id === draft.projectId);

  // Filtered colleagues
  const filteredPeople = people.filter((p) => {
    const q = assigneeSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      p.displayName?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q) ||
      p.department?.toLowerCase().includes(q)
    );
  });

  // Tag actions
  const handleAddTag = (text: string) => {
    const clean = text.trim().replace(/^#+/, "");
    if (!clean) return;
    if (!draft.tags.includes(clean)) {
      setDraft((v) => ({ ...v, tags: [...v.tags, clean] }));
    }
    setTagInput("");
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setDraft((v) => ({ ...v, tags: v.tags.filter((t) => t !== tagToRemove) }));
  };

  // Subtask actions
  const handleAddSubtask = () => {
    const title = subtaskInput.trim();
    if (!title) return;
    const newSubtask: TaskSubtask = {
      id: randomUUID(),
      title,
      completed: false,
      assigneeUid: draft.assigneeUid || undefined,
    };
    setDraft((v) => ({ ...v, subtasks: [...v.subtasks, newSubtask] }));
    setSubtaskInput("");
  };

  const handleToggleSubtask = (id: string) => {
    setDraft((v) => ({
      ...v,
      subtasks: v.subtasks.map((s) => (s.id === id ? { ...s, completed: !s.completed } : s)),
    }));
  };

  const handleRemoveSubtask = (id: string) => {
    setDraft((v) => ({ ...v, subtasks: v.subtasks.filter((s) => s.id !== id) }));
  };

  // Attachment actions
  const handlePickFile = async () => {
    try {
      const file = await pickWorkAttachment();
      if (file) {
        setDraft((v) => ({ ...v, attachments: [...v.attachments, file] }));
      }
    } catch (err) {
      setError(messageOf(err));
    }
  };

  const handlePickImage = async () => {
    try {
      const file = await pickImageAttachment();
      if (file) {
        setDraft((v) => ({ ...v, attachments: [...v.attachments, file] }));
      }
    } catch (err) {
      setError(messageOf(err));
    }
  };

  const handleAddLink = () => {
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
      setLinkModal(false);
    } catch (err) {
      setLinkError(messageOf(err));
    }
  };

  const handleRemoveAttachment = (id: string) => {
    setDraft((v) => ({ ...v, attachments: v.attachments.filter((a) => a.id !== id) }));
  };

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
        <Text style={styles.titleText}>{task ? "Cập nhật công việc" : "Giao việc mới"}</Text>
        <Pressable
          onPress={() => void save()}
          disabled={disabled || (!task && !draft.assigneeUid) || !draft.title.trim()}
          style={({ pressed }) => [
            styles.headerSaveBtn,
            (!draft.title.trim() || (!task && !draft.assigneeUid) || disabled) &&
              styles.headerSaveBtnDisabled,
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

        {/* Section 1: Thông tin công việc */}
        <View style={styles.card}>
          <Text style={styles.cardSectionTitle}>THÔNG TIN CÔNG VIỆC</Text>

          {manager ? (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Tên công việc <Text style={styles.requiredStar}>*</Text>
              </Text>
              <TextInput
                style={styles.textInput}
                placeholder="VD: Kiểm tra hồ sơ ứng viên..."
                placeholderTextColor="#94a3b8"
                value={draft.title}
                editable={!disabled}
                onChangeText={(title) => setDraft((v) => ({ ...v, title }))}
              />
            </View>
          ) : (
            <View style={styles.readOnlyTitleBox}>
              <Text style={styles.readOnlyTitle}>{task?.title}</Text>
            </View>
          )}

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Mô tả công việc</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="Nhập nội dung yêu cầu, mục tiêu cần đạt..."
              placeholderTextColor="#94a3b8"
              value={draft.description}
              editable={!disabled}
              multiline
              numberOfLines={3}
              onChangeText={(description) => setDraft((v) => ({ ...v, description }))}
            />
          </View>
        </View>

        {/* Section 2: Phân công & Dự án (Chỉ Manager có thể chọn) */}
        {manager && (
          <View style={styles.card}>
            <Text style={styles.cardSectionTitle}>PHÂN CÔNG & DỰ ÁN</Text>

            {/* Người được giao */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Người thực hiện <Text style={styles.requiredStar}>*</Text>
              </Text>
              <Pressable
                onPress={() => setAssigneeModal(true)}
                disabled={disabled || peopleLoading}
                style={styles.selectorPressable}
              >
                {draft.assigneeUid ? (
                  <View style={styles.selectedPersonRow}>
                    <View style={styles.personAvatar}>
                      <Text style={styles.personAvatarText}>
                        {(selectedAssigneeName || "NV").slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.selectedPersonInfo}>
                      <Text style={styles.selectedPersonName} numberOfLines={1}>
                        {selectedAssigneeName || "Nhân sự được gán"}
                      </Text>
                      {selectedAssignee?.department ? (
                        <Text style={styles.selectedPersonSub} numberOfLines={1}>
                          {selectedAssignee.department}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ) : (
                  <Text style={styles.selectorPlaceholder}>
                    {peopleLoading ? "Đang tải danh sách nhân sự..." : "Chọn người thực hiện..."}
                  </Text>
                )}
                <Text style={styles.selectorChevron}>▾</Text>
              </Pressable>
              {!!peopleError && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                  <AlertCircle size={12} color="#dc2626" />
                  <Text style={styles.fieldErrorText}>{peopleError}</Text>
                </View>
              )}
            </View>

            {/* Thuộc dự án */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Dự án</Text>
              <Pressable
                onPress={() => setProjectModal(true)}
                disabled={disabled}
                style={styles.selectorPressable}
              >
                {draft.projectId && selectedProject ? (
                  <View style={styles.selectedProjectRow}>
                    <Folder size={15} color="#2563eb" style={{ marginRight: 6 }} />
                    <Text style={styles.selectedProjectName} numberOfLines={1}>
                      {selectedProject.name}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.selectorPlaceholder}>Không thuộc dự án (Độc lập)</Text>
                )}
                <Text style={styles.selectorChevron}>▾</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Section 3: Độ ưu tiên & Trạng thái */}
        <View style={styles.card}>
          <Text style={styles.cardSectionTitle}>ĐỘ ƯU TIÊN & TRẠNG THÁI</Text>

          {manager && (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Mức độ ưu tiên</Text>
              <View style={styles.chipsRow}>
                {TASK_PRIORITIES.map((pr) => {
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
                      onPress={() => setDraft((v) => ({ ...v, priority: pr.value }))}
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
          )}

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Trạng thái hiện tại</Text>
            <View style={styles.chipsRow}>
              {TASK_STATUSES.filter((item) => manager || item.value !== "Archived").map((st) => {
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
                    onPress={() => handleStatusChange(st.value)}
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
        </View>

        {/* Section 4: Thẻ phân loại (Tags) */}
        <View style={styles.card}>
          <Text style={styles.cardSectionTitle}>THẺ PHÂN LOẠI (TAGS)</Text>

          {/* Tag input row */}
          <View style={styles.tagInputRow}>
            <TextInput
              style={[styles.textInput, { flex: 1 }]}
              placeholder="Nhập tên thẻ (#marketing, #gấp...)"
              placeholderTextColor="#94a3b8"
              value={tagInput}
              editable={!disabled}
              onChangeText={setTagInput}
              onSubmitEditing={() => handleAddTag(tagInput)}
            />
            <Pressable
              style={styles.addTagBtn}
              onPress={() => handleAddTag(tagInput)}
              disabled={disabled || !tagInput.trim()}
            >
              <Text style={styles.addTagBtnText}>+ Thêm</Text>
            </Pressable>
          </View>

          {/* Quick suggested tags */}
          <View style={styles.suggestedTagsRow}>
            <Text style={styles.quickLabel}>Gợi ý:</Text>
            {SUGGESTED_TAGS.map((st) => (
              <Pressable
                key={st}
                disabled={disabled || draft.tags.includes(st)}
                style={[styles.suggestedTagPill, draft.tags.includes(st) && { opacity: 0.4 }]}
                onPress={() => handleAddTag(st)}
              >
                <Text style={styles.suggestedTagText}>#{st}</Text>
              </Pressable>
            ))}
          </View>

          {/* Selected tags */}
          {draft.tags.length > 0 ? (
            <View style={styles.selectedTagsWrap}>
              {draft.tags.map((tag) => (
                <View key={tag} style={styles.tagBadge}>
                  <Text style={styles.tagBadgeText}>#{tag}</Text>
                  <Pressable
                    onPress={() => handleRemoveTag(tag)}
                    hitSlop={8}
                    style={styles.tagRemoveBtn}
                  >
                    <X size={11} color="#64748b" />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyTipText}>Chưa có thẻ nào được gắn.</Text>
          )}
        </View>

        {/* Section 5: Công việc nhỏ (Subtasks) */}
        <View style={styles.card}>
          <View style={styles.cardHeaderWithCount}>
            <Text style={styles.cardSectionTitle}>
              CÔNG VIỆC CON ({draft.subtasks.filter((s) => s.completed).length}/{draft.subtasks.length})
            </Text>
          </View>

          {/* Add subtask input row */}
          <View style={styles.subtaskInputRow}>
            <TextInput
              style={[styles.textInput, { flex: 1 }]}
              placeholder="Thêm đầu việc nhỏ cần làm..."
              placeholderTextColor="#94a3b8"
              value={subtaskInput}
              editable={!disabled}
              onChangeText={setSubtaskInput}
              onSubmitEditing={handleAddSubtask}
            />
            <Pressable
              style={styles.addSubtaskBtn}
              onPress={handleAddSubtask}
              disabled={disabled || !subtaskInput.trim()}
            >
              <Text style={styles.addSubtaskBtnText}>+ Thêm việc</Text>
            </Pressable>
          </View>

          {/* Subtasks list */}
          {draft.subtasks.length > 0 ? (
            <View style={styles.subtaskList}>
              {draft.subtasks.map((st) => (
                <View key={st.id} style={styles.subtaskItem}>
                  <Pressable
                    onPress={() => handleToggleSubtask(st.id)}
                    style={[styles.subtaskCheckbox, st.completed && styles.subtaskCheckboxChecked]}
                  >
                    {st.completed && <Check size={11} color="#ffffff" strokeWidth={3} />}
                  </Pressable>
                  <Text
                    style={[styles.subtaskTitle, st.completed && styles.subtaskTitleDone]}
                    numberOfLines={2}
                  >
                    {st.title}
                  </Text>
                  <Pressable
                    onPress={() => handleRemoveSubtask(st.id)}
                    hitSlop={8}
                    style={styles.subtaskDeleteBtn}
                  >
                    <Trash2 size={13} color="#dc2626" />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyTipText}>Chưa có việc con nào. Chia nhỏ công việc để theo dõi tốt hơn.</Text>
          )}
        </View>

        {/* Section 6: Danh sách tệp & Liên kết đính kèm */}
        <View style={styles.card}>
          <View style={styles.cardHeaderWithCount}>
            <Text style={styles.cardSectionTitle}>
              TỆP & LIÊN KẾT ĐÍNH KÈM ({draft.attachments.length})
            </Text>
          </View>

          {/* Buttons to add attachment */}
          <View style={styles.attachmentBtnRow}>
            <Pressable
              style={[styles.attachActionBtn, { flexDirection: "row", alignItems: "center", gap: 4 }]}
              onPress={() => void handlePickFile()}
              disabled={disabled}
            >
              <Paperclip size={13} color="#334155" />
              <Text style={styles.attachActionText}>Chọn tệp</Text>
            </Pressable>

            <Pressable
              style={[styles.attachActionBtn, { flexDirection: "row", alignItems: "center", gap: 4 }]}
              onPress={() => void handlePickImage()}
              disabled={disabled}
            >
              <ImageIcon size={13} color="#334155" />
              <Text style={styles.attachActionText}>Chọn ảnh</Text>
            </Pressable>

            <Pressable
              style={[styles.attachActionBtn, { flexDirection: "row", alignItems: "center", gap: 4 }]}
              onPress={() => setLinkModal(true)}
              disabled={disabled}
            >
              <LinkIcon size={13} color="#334155" />
              <Text style={styles.attachActionText}>Thêm link</Text>
            </Pressable>
          </View>

          {/* Attachments List */}
          {draft.attachments.length > 0 ? (
            <View style={styles.attachmentList}>
              {draft.attachments.map((att) => {
                return (
                  <View key={att.id} style={styles.attachmentItem}>
                    <AttachmentTypeIcon type={att.type} />
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
                      onPress={() => {
                        if (att.type === "link") {
                          void Linking.openURL(att.url);
                        } else {
                          void shareLeaveFile(att.url, att.name);
                        }
                      }}
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
                      <X size={13} color="#94a3b8" />
                    </Pressable>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={styles.emptyTipText}>Chưa có tệp hoặc tài liệu nào được đính kèm.</Text>
          )}
        </View>

        {/* Section 7: Thời hạn & Kế hoạch */}
        <View style={styles.card}>
          <Text style={styles.cardSectionTitle}>THỜI HẠN & KẾ HOẠCH</Text>

          {/* Quick chips for due date */}
          <Text style={styles.quickLabel}>Chọn nhanh hạn chót:</Text>
          <View style={styles.quickRow}>
            <Pressable
              disabled={disabled}
              style={styles.quickPill}
              onPress={() => updateDatesAndRecalculateTimes({ dueDate: formatNowPlusDays(0, 18) })}
            >
              <Text style={styles.quickPillText}>Hôm nay 18:00</Text>
            </Pressable>
            <Pressable
              disabled={disabled}
              style={styles.quickPill}
              onPress={() => updateDatesAndRecalculateTimes({ dueDate: formatNowPlusDays(1, 18) })}
            >
              <Text style={styles.quickPillText}>Ngày mai</Text>
            </Pressable>
            <Pressable
              disabled={disabled}
              style={styles.quickPill}
              onPress={() => updateDatesAndRecalculateTimes({ dueDate: formatNowPlusDays(3, 18) })}
            >
              <Text style={styles.quickPillText}>+3 ngày</Text>
            </Pressable>
            <Pressable
              disabled={disabled}
              style={styles.quickPill}
              onPress={() => updateDatesAndRecalculateTimes({ dueDate: formatNowPlusDays(7, 18) })}
            >
              <Text style={styles.quickPillText}>+1 tuần</Text>
            </Pressable>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              Hạn chót <Text style={styles.requiredStar}>*</Text>
            </Text>
            <Pressable
              onPress={() => setActiveDatePicker("dueDate")}
              disabled={disabled}
              style={styles.datePickerTrigger}
            >
              <Calendar size={14} color="#64748b" style={{ marginRight: 6 }} />
              <Text
                style={[
                  styles.datePickerValue,
                  !draft.dueDate && styles.datePickerPlaceholder,
                ]}
                numberOfLines={1}
              >
                {draft.dueDate ? formatDisplayDate(draft.dueDate) : "Chọn thời hạn hoàn thành..."}
              </Text>
              {!!draft.dueDate && (
                <Pressable
                  onPress={() => updateDatesAndRecalculateTimes({ dueDate: "" })}
                  hitSlop={8}
                  style={styles.dateClearBtn}
                >
                  <X size={12} color="#94a3b8" />
                </Pressable>
              )}
            </Pressable>
          </View>

          {/* Start & End time */}
          <View style={styles.twoColRow}>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Bắt đầu</Text>
              <Pressable
                onPress={() => setActiveDatePicker("startTime")}
                disabled={disabled}
                style={styles.datePickerTrigger}
              >
                <Calendar size={14} color="#64748b" style={{ marginRight: 6 }} />
                <Text
                  style={[
                    styles.datePickerValue,
                    !draft.startTime && styles.datePickerPlaceholder,
                  ]}
                  numberOfLines={1}
                >
                  {draft.startTime ? formatDisplayDate(draft.startTime) : "Bắt đầu..."}
                </Text>
                {!!draft.startTime && (
                  <Pressable
                    onPress={() => updateDatesAndRecalculateTimes({ startTime: "" })}
                    hitSlop={8}
                    style={styles.dateClearBtn}
                  >
                    <X size={12} color="#94a3b8" />
                  </Pressable>
                )}
              </Pressable>
            </View>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Kết thúc</Text>
              <Pressable
                onPress={() => setActiveDatePicker("endTime")}
                disabled={disabled}
                style={styles.datePickerTrigger}
              >
                <Calendar size={14} color="#64748b" style={{ marginRight: 6 }} />
                <Text
                  style={[
                    styles.datePickerValue,
                    !draft.endTime && styles.datePickerPlaceholder,
                  ]}
                  numberOfLines={1}
                >
                  {draft.endTime ? formatDisplayDate(draft.endTime) : "Kết thúc..."}
                </Text>
                {!!draft.endTime && (
                  <Pressable
                    onPress={() => updateDatesAndRecalculateTimes({ endTime: "" })}
                    hitSlop={8}
                    style={styles.dateClearBtn}
                  >
                    <X size={12} color="#94a3b8" />
                  </Pressable>
                )}
              </Pressable>
            </View>
          </View>

          {/* Auto calculate hours indicator */}
          <View style={styles.calcRow}>
            <View style={[styles.autoCalculatedBadge, { flexDirection: "row", alignItems: "center", gap: 4 }]}>
              <Zap size={12} color="#1d4ed8" />
              <Text style={styles.autoCalculatedBadgeText}>
                Tự động tính: Dự tính {draft.estTime || "0"}h · Thực tế {draft.actualTime || "0"}h
              </Text>
            </View>
          </View>

          {/* Hours inputs */}
          <View style={styles.twoColRow}>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Giờ dự tính (h)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="VD: 8"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
                value={draft.estTime}
                editable={!disabled}
                onChangeText={(estTime) => setDraft((v) => ({ ...v, estTime }))}
              />
            </View>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Giờ thực tế (h)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="VD: 7.5"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
                value={draft.actualTime}
                editable={!disabled}
                onChangeText={(actualTime) => setDraft((v) => ({ ...v, actualTime }))}
              />
            </View>
          </View>

          {/* KPI Evaluation Banner based on hours & dates */}
          {(() => {
            const kpiInfo = evaluateTaskKpi(draft.estTime, draft.actualTime, draft.endTime, draft.dueDate);
            if (!kpiInfo) return null;
            return (
              <View
                style={[
                  styles.kpiBanner,
                  { backgroundColor: kpiInfo.bg, borderColor: kpiInfo.borderColor },
                ]}
              >
                <View style={styles.kpiBannerHeader}>
                  <Text style={styles.kpiBannerIcon}>{kpiInfo.icon}</Text>
                  <Text style={[styles.kpiBannerTitle, { color: kpiInfo.color }]}>
                    {kpiInfo.label}
                  </Text>
                </View>
                <Text style={[styles.kpiBannerDetail, { color: kpiInfo.color }]}>
                  {kpiInfo.detail}
                </Text>
              </View>
            );
          })()}
        </View>

        {/* Section 8: Ghi chú kết quả & Bàn giao */}
        <View style={styles.card}>
          <Text style={styles.cardSectionTitle}>GHI CHÚ KẾT QUẢ / BÀN GIAO</Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            placeholder="Dán link tài liệu, kết quả thực hiện hoặc ghi chú bàn giao..."
            placeholderTextColor="#94a3b8"
            value={draft.linkNote}
            editable={!disabled}
            multiline
            numberOfLines={2}
            onChangeText={(linkNote) => setDraft((v) => ({ ...v, linkNote }))}
          />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Bottom Sticky Actions */}
      <View style={styles.bottomBar}>
        <Pressable
          onPress={onClose}
          disabled={busy}
          style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.cancelBtnText}>Hủy</Text>
        </Pressable>

        <Pressable
          onPress={() => void save()}
          disabled={disabled || (!task && !draft.assigneeUid) || !draft.title.trim()}
          style={({ pressed }) => [
            styles.submitBtn,
            (!draft.title.trim() || (!task && !draft.assigneeUid) || disabled) &&
              styles.submitBtnDisabled,
            pressed && { opacity: 0.85 },
          ]}
        >
          {busy ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.submitBtnText}>{task ? "Lưu công việc" : "Giao việc ngay"}</Text>
          )}
        </Pressable>
      </View>

      {/* Modal: Chọn người thực hiện */}
      <Modal
        visible={assigneeModal}
        animationType="slide"
        transparent
        onRequestClose={() => setAssigneeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chọn người thực hiện</Text>
              <Pressable
                onPress={() => setAssigneeModal(false)}
                style={styles.modalCloseBtn}
              >
                <X size={16} color="#64748b" />
              </Pressable>
            </View>

            <View style={styles.modalSearchBox}>
              <Search size={15} color="#94a3b8" style={{ marginRight: 6 }} />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Tìm nhân sự theo tên, email..."
                placeholderTextColor="#94a3b8"
                value={assigneeSearch}
                onChangeText={setAssigneeSearch}
                autoFocus
              />
              {assigneeSearch.length > 0 && (
                <Pressable onPress={() => setAssigneeSearch("")}>
                  <X size={14} color="#94a3b8" />
                </Pressable>
              )}
            </View>

            <FlatList
              data={filteredPeople}
              keyExtractor={(p) => p.uid}
              contentContainerStyle={{ paddingVertical: 8 }}
              renderItem={({ item }) => {
                const selected = draft.assigneeUid === item.uid;
                return (
                  <Pressable
                    style={[styles.personRow, selected && styles.personRowSelected]}
                    onPress={() => {
                      setDraft((v) => ({ ...v, assigneeUid: item.uid }));
                      setAssigneeModal(false);
                    }}
                  >
                    <View style={[styles.avatarCircle, selected && styles.avatarCircleSelected]}>
                      <Text style={styles.avatarLetter}>
                        {(item.displayName || "NV").slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.personRowInfo}>
                      <Text style={[styles.personRowName, selected && styles.personRowNameSelected]}>
                        {item.displayName}
                      </Text>
                      <Text style={styles.personRowEmail}>{item.email}</Text>
                    </View>
                    {selected && <Check size={16} color="#059669" strokeWidth={2.5} />}
                  </Pressable>
                );
              }}
              ListEmptyComponent={
                <View style={{ padding: 24, alignItems: "center" }}>
                  <Text style={{ color: "#94a3b8", fontSize: 14 }}>
                    {peopleLoading ? "Đang tải..." : "Không tìm thấy nhân sự phù hợp"}
                  </Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>

      {/* Modal: Chọn dự án */}
      <Modal
        visible={projectModal}
        animationType="fade"
        transparent
        onRequestClose={() => setProjectModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chọn dự án liên kết</Text>
              <Pressable
                onPress={() => setProjectModal(false)}
                style={styles.modalCloseBtn}
              >
                <X size={16} color="#64748b" />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ padding: 12, gap: 8 }}>
              {/* Option: Không thuộc dự án */}
              <Pressable
                style={[styles.projectChoiceItem, !draft.projectId && styles.projectChoiceSelected]}
                onPress={() => {
                  setDraft((v) => ({ ...v, projectId: "" }));
                  setProjectModal(false);
                }}
              >
                <Ban size={18} color="#94a3b8" style={{ marginRight: 6 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.projectChoiceName, !draft.projectId && styles.projectChoiceNameSelected]}>
                    Không thuộc dự án nào
                  </Text>
                  <Text style={styles.projectChoiceSub}>Công việc độc lập</Text>
                </View>
                {!draft.projectId && <Check size={16} color="#059669" strokeWidth={2.5} />}
              </Pressable>

              {/* Projects list */}
              {projects.map((p) => {
                const selected = draft.projectId === p.id;
                return (
                  <Pressable
                    key={p.id}
                    style={[styles.projectChoiceItem, selected && styles.projectChoiceSelected]}
                    onPress={() => {
                      setDraft((v) => ({ ...v, projectId: p.id }));
                      setProjectModal(false);
                    }}
                  >
                    <Folder size={18} color="#2563eb" style={{ marginRight: 6 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.projectChoiceName, selected && styles.projectChoiceNameSelected]}>
                        {p.name}
                      </Text>
                      <Text style={styles.projectChoiceSub}>
                        {p.progress ? `${p.progress.percent}% hoàn thành` : "Dự án"}
                      </Text>
                    </View>
                    {selected && <Check size={16} color="#059669" strokeWidth={2.5} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal: Thêm liên kết đính kèm */}
      <Modal
        visible={linkModal}
        animationType="fade"
        transparent
        onRequestClose={() => setLinkModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Thêm liên kết đính kèm</Text>
              <Pressable
                onPress={() => setLinkModal(false)}
                style={styles.modalCloseBtn}
              >
                <X size={16} color="#64748b" />
              </Pressable>
            </View>

            <View style={{ padding: 16, gap: 12 }}>
              {!!linkError && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <AlertCircle size={14} color="#dc2626" />
                  <Text style={{ color: "#dc2626", fontSize: 13 }}>{linkError}</Text>
                </View>
              )}

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Tên liên kết</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="VD: Tài liệu hướng dẫn, Figma thiết kế..."
                  placeholderTextColor="#94a3b8"
                  value={linkName}
                  onChangeText={setLinkName}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Địa chỉ URL (https://...)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="https://..."
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="none"
                  keyboardType="url"
                  value={linkUrl}
                  onChangeText={setLinkUrl}
                />
              </View>

              <Pressable
                style={styles.modalAddLinkBtn}
                onPress={handleAddLink}
              >
                <Text style={styles.modalAddLinkBtnText}>Thêm liên kết</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Date Time Picker Modal */}
      <DateTimePickerModal
        visible={activeDatePicker !== null}
        onClose={() => setActiveDatePicker(null)}
        title={
          activeDatePicker === "dueDate"
            ? "Chọn hạn chót hoàn thành"
            : activeDatePicker === "startTime"
            ? "Chọn thời gian bắt đầu"
            : "Chọn thời gian kết thúc"
        }
        value={activeDatePicker ? draft[activeDatePicker] : ""}
        allowClear={activeDatePicker !== "dueDate"}
        onChange={(val) => {
          if (activeDatePicker) {
            updateDatesAndRecalculateTimes({ [activeDatePicker]: val });
          }
        }}
      />
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
  closeBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#64748b",
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
  errorIcon: {
    fontSize: 18,
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
  fieldErrorText: {
    fontSize: 12,
    color: "#dc2626",
    marginTop: 2,
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
  textArea: {
    minHeight: 70,
    textAlignVertical: "top",
  },
  readOnlyTitleBox: {
    backgroundColor: "#f1f5f9",
    borderRadius: 10,
    padding: 12,
  },
  readOnlyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
  },
  selectorPressable: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  selectorPlaceholder: {
    fontSize: 14,
    color: "#94a3b8",
  },
  selectorChevron: {
    fontSize: 14,
    color: "#64748b",
    marginLeft: 6,
  },
  selectedPersonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  personAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#e0f2fe",
    alignItems: "center",
    justifyContent: "center",
  },
  personAvatarText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0284c7",
  },
  selectedPersonInfo: {
    flex: 1,
  },
  selectedPersonName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
  },
  selectedPersonSub: {
    fontSize: 12,
    color: "#64748b",
  },
  selectedProjectRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  projectIcon: {
    fontSize: 16,
  },
  selectedProjectName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
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
  // Tags styling
  tagInputRow: {
    flexDirection: "row",
    gap: 8,
  },
  addTagBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#008852",
    alignItems: "center",
    justifyContent: "center",
  },
  addTagBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  suggestedTagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
  },
  suggestedTagPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  suggestedTagText: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "500",
  },
  selectedTagsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  tagBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 6,
  },
  tagBadgeText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#008852",
  },
  tagRemoveBtn: {
    padding: 2,
  },
  tagRemoveText: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "700",
  },
  emptyTipText: {
    fontSize: 12,
    color: "#94a3b8",
    fontStyle: "italic",
  },
  // Subtasks styling
  subtaskInputRow: {
    flexDirection: "row",
    gap: 8,
  },
  addSubtaskBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#0284c7",
    alignItems: "center",
    justifyContent: "center",
  },
  addSubtaskBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  subtaskList: {
    gap: 8,
    marginTop: 4,
  },
  subtaskItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  subtaskCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#94a3b8",
    alignItems: "center",
    justifyContent: "center",
  },
  subtaskCheckboxChecked: {
    backgroundColor: "#008852",
    borderColor: "#008852",
  },
  subtaskCheckmark: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
  subtaskTitle: {
    flex: 1,
    fontSize: 13,
    color: "#0f172a",
    fontWeight: "500",
  },
  subtaskTitleDone: {
    textDecorationLine: "line-through",
    color: "#94a3b8",
  },
  subtaskDeleteBtn: {
    padding: 4,
  },
  subtaskDeleteText: {
    fontSize: 15,
  },
  // Attachments styling
  attachmentBtnRow: {
    flexDirection: "row",
    gap: 10,
  },
  attachActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    gap: 6,
  },
  attachActionIcon: {
    fontSize: 15,
  },
  attachActionText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
  },
  attachmentList: {
    gap: 8,
    marginTop: 4,
  },
  attachmentItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  attachmentItemIcon: {
    fontSize: 18,
  },
  attachmentItemInfo: {
    flex: 1,
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
    backgroundColor: "#e0f2fe",
  },
  viewAttachBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0369a1",
  },
  removeAttachBtn: {
    padding: 4,
  },
  removeAttachText: {
    fontSize: 14,
    color: "#94a3b8",
    fontWeight: "700",
  },
  modalAddLinkBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#008852",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  modalAddLinkBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  // Dates & hours styling
  quickLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "500",
  },
  quickRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  quickPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  quickPillText: {
    fontSize: 12,
    color: "#1d4ed8",
    fontWeight: "600",
  },
  twoColRow: {
    flexDirection: "row",
    gap: 12,
  },
  calcRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginVertical: 4,
  },
  autoCalculatedBadge: {
    flex: 1,
    backgroundColor: "#f0fdf4",
    borderColor: "#bbf7d0",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  autoCalculatedBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#15803d",
  },
  kpiBanner: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 4,
  },
  kpiBannerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  kpiBannerIcon: {
    fontSize: 16,
  },
  kpiBannerTitle: {
    fontSize: 13,
    fontWeight: "800",
  },
  kpiBannerDetail: {
    fontSize: 12,
    fontWeight: "600",
    opacity: 0.9,
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
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 8,
  },
  datePickerIcon: {
    fontSize: 15,
  },
  datePickerValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
  },
  datePickerPlaceholder: {
    fontWeight: "400",
    color: "#94a3b8",
  },
  dateClearBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  dateClearText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748b",
  },
  // Modals styling
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "80%",
    paddingBottom: Platform.OS === "ios" ? 34 : 16,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCloseText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#64748b",
  },
  modalSearchBox: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  modalSearchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: "#0f172a",
  },
  clearSearchText: {
    fontSize: 14,
    color: "#94a3b8",
    padding: 4,
  },
  personRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f8fafc",
  },
  personRowSelected: {
    backgroundColor: "#f0fdf4",
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarCircleSelected: {
    backgroundColor: "#bbf7d0",
  },
  avatarLetter: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
  },
  personRowInfo: {
    flex: 1,
  },
  personRowName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
  },
  personRowNameSelected: {
    color: "#008852",
  },
  personRowEmail: {
    fontSize: 12,
    color: "#64748b",
  },
  checkIcon: {
    fontSize: 16,
    fontWeight: "700",
    color: "#008852",
  },
  projectChoiceItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 12,
  },
  projectChoiceSelected: {
    backgroundColor: "#f0fdf4",
    borderColor: "#86efac",
  },
  projectChoiceIcon: {
    fontSize: 20,
  },
  projectChoiceName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
  },
  projectChoiceNameSelected: {
    color: "#008852",
  },
  projectChoiceSub: {
    fontSize: 12,
    color: "#64748b",
  },
});
