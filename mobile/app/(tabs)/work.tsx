import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { HRTask, Project } from "../../../src/types/hr";
import { kanban } from "../../src/api/services";
import { messageOf, useSession } from "../../src/auth/SessionProvider";
import { canUseModule, hasPermission } from "../../src/auth/access";
import { EmptyState, Page } from "../../src/ui";
import { shareLeaveFile } from "../../src/features/leave/files";
import { TaskForm } from "../../src/features/work/TaskForm";
import Projects from "./projects";
import Kpi from "./kpi";
import { WorkSectionTabs, type WorkSection } from "../../src/features/work/WorkSectionTabs";
import {
  Search,
  X,
  User,
  Folder,
  AlertCircle,
  Paperclip,
  Calendar,
  Play,
  Flag,
  Clock,
  Sparkles,
  Check,
  Link as LinkIcon,
  Image as ImageIcon,
  Video as VideoIcon,
  Music as MusicIcon,
  FileText,
  Pencil,
  Trash2,
  RotateCw,
  AlertTriangle,
  Target,
  Star,
} from "lucide-react-native";

function KpiIcon({ icon, color, size = 12 }: { icon: string; color: string; size?: number }) {
  switch (icon) {
    case "alert-triangle":
      return <AlertTriangle size={size} color={color} />;
    case "star":
      return <Star size={size} color={color} />;
    case "clock":
      return <Clock size={size} color={color} />;
    case "target":
    default:
      return <Target size={size} color={color} />;
  }
}

function AttachmentTypeIcon({ type }: { type?: string }) {
  if (type === "link") return <LinkIcon size={16} color="#2563eb" />;
  if (type === "image") return <ImageIcon size={16} color="#059669" />;
  if (type === "video") return <VideoIcon size={16} color="#d97706" />;
  if (type === "audio") return <MusicIcon size={16} color="#8b5cf6" />;
  return <FileText size={16} color="#64748b" />;
}
import {
  canUpdateTask,
  evaluateTaskKpi,
  normalizePriority,
  normalizeTaskStatus,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from "../../src/features/work/model";

function formatDetailDateTime(str?: string): string {
  if (!str) return "--";
  try {
    const match = str.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
    if (match) {
      return `${match[3]}/${match[2]}/${match[1]} lúc ${match[4]}:${match[5]}`;
    }
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      const hour = String(d.getHours()).padStart(2, "0");
      const minute = String(d.getMinutes()).padStart(2, "0");
      return `${day}/${month}/${year} lúc ${hour}:${minute}`;
    }
  } catch {}
  return str;
}

function formatTaskDueDate(dueDateString: string, isCompleted: boolean) {
  try {
    const due = new Date(dueDateString);
    if (isNaN(due.getTime())) return { text: dueDateString, isOverdue: false, isToday: false };
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const dueStart = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
    const diffDays = Math.round((dueStart - todayStart) / (1000 * 60 * 60 * 24));

    const dateFormatted = `${String(due.getDate()).padStart(2, "0")}/${String(due.getMonth() + 1).padStart(2, "0")}`;

    if (!isCompleted && diffDays < 0) {
      return {
        text: `Quá hạn ${Math.abs(diffDays)} ngày`,
        isOverdue: true,
        isToday: false,
      };
    }
    if (!isCompleted && diffDays === 0) {
      return {
        text: "Hạn hôm nay",
        isOverdue: false,
        isToday: true,
      };
    }
    if (diffDays === 1) {
      return { text: "Hạn ngày mai", isOverdue: false, isToday: false };
    }
    return { text: `Hạn ${dateFormatted}`, isOverdue: false, isToday: false };
  } catch {
    return { text: dueDateString, isOverdue: false, isToday: false };
  }
}

function getPriorityInfo(priority: string) {
  const norm = normalizePriority(priority);
  switch (norm) {
    case "urgent":
      return { label: "Khẩn cấp", color: "#dc2626", bg: "#fef2f2" };
    case "high":
      return { label: "Cao", color: "#ea580c", bg: "#fff7ed" };
    case "low":
      return { label: "Thấp", color: "#64748b", bg: "#f1f5f9" };
    default:
      return { label: "Bình thường", color: "#2563eb", bg: "#eff6ff" };
  }
}

function getStatusInfo(status: string) {
  const norm = normalizeTaskStatus(status);
  switch (norm) {
    case "completed":
      return { label: "Hoàn thành", color: "#059669", bg: "#ecfdf5" };
    case "in_progress":
      return { label: "Đang làm", color: "#d97706", bg: "#fffbeb" };
    case "cancelled":
      return { label: "Đã hủy", color: "#e11d48", bg: "#fff1f2" };
    default:
      return { label: "Chưa bắt đầu", color: "#475569", bg: "#f1f5f9" };
  }
}

export default function Work() {
  const { user, selectedBranch } = useSession();
  const allowed = canUseModule(user, "hr");
  const manage = hasPermission(user, "work:manage");

  const [items, setItems] = useState<HRTask[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [projectId, setProjectId] = useState("");
  const [mine, setMine] = useState(false);

  const [selected, setSelected] = useState<HRTask | null>(null);
  const [editing, setEditing] = useState<HRTask | "new" | null>(null);
  const [section, setSection] = useState<WorkSection>("tasks");

  const [busy, setBusy] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [subtaskUpdatingId, setSubtaskUpdatingId] = useState<string | null>(null);
  const lock = useRef(false);
  const formLock = useRef(false);

  const branchId = selectedBranch?._id || user?.branchId || undefined;

  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (!allowed) return;
      setLoading(true);
      setError(null);
      setItems([]);
      setProjectError(null);

      void kanban
        .listTasks(branchId)
        .then((data) => {
          if (active) setItems(data);
        })
        .catch((err) => {
          if (active) {
            setItems([]);
            setError(messageOf(err));
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });

      void kanban
        .listProjects(branchId)
        .then((data) => {
          if (active) setProjects(data);
        })
        .catch((err) => {
          if (active) {
            setProjects([]);
            setProjectError(messageOf(err));
          }
        });

      return () => {
        active = false;
      };
    }, [allowed, branchId, user?.uid, revision]),
  );

  const run = async (action: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setDetailError(null);
    try {
      await action();
    } catch (err) {
      setDetailError(messageOf(err));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const reload = () => {
    setSelected(null);
    setEditing(null);
    setRevision((value) => value + 1);
  };

  const handleToggleSubtaskInDetail = async (subtaskId: string) => {
    if (!selected || subtaskUpdatingId) return;
    const currentSubtasks = selected.subtasks || [];
    const prevTask = selected;
    const updatedSubtasks = currentSubtasks.map((s) =>
      s.id === subtaskId ? { ...s, completed: !s.completed } : s,
    );
    const updatedTask: HRTask = { ...selected, subtasks: updatedSubtasks };
    setSelected(updatedTask);
    setItems((prev) => prev.map((t) => (t.id === selected.id ? updatedTask : t)));
    setDetailError(null);
    setSubtaskUpdatingId(subtaskId);

    try {
      const res = await kanban.updateTask(selected.id, {
        subtasks: updatedSubtasks,
        expectedRevision: selected.revision !== undefined ? selected.revision : 0,
      });
      const nextRevision =
        res?.revision !== undefined
          ? res.revision
          : (selected.revision !== undefined ? selected.revision + 1 : 1);
      const syncedTask: HRTask = {
        ...updatedTask,
        ...(res?.id ? res : {}),
        subtasks: res?.subtasks || updatedSubtasks,
        revision: nextRevision,
      };
      setSelected(syncedTask);
      setItems((prev) => prev.map((t) => (t.id === selected.id ? syncedTask : t)));
    } catch (err) {
      const msg = messageOf(err);
      if (/thay đổi|phiên bản|revision|version|409/i.test(msg)) {
        try {
          const freshTasks = await kanban.listTasks(branchId);
          setItems(freshTasks);
          const matched = freshTasks.find((t) => t.id === prevTask.id);
          if (matched) {
            setSelected(matched);
            setDetailError("Công việc đã được đồng bộ phiên bản mới nhất từ máy chủ. Vui lòng thử lại.");
            return;
          }
        } catch {}
      }
      setSelected(prevTask);
      setItems((prev) => prev.map((t) => (t.id === selected.id ? prevTask : t)));
      setDetailError(msg);
    } finally {
      setSubtaskUpdatingId(null);
    }
  };

  const handleQuickStatusChange = async (newStatus: string) => {
    if (!selected || busy) return;
    const prevTask = selected;
    const updatedTask: HRTask = { ...selected, status: newStatus as any };
    setSelected(updatedTask);
    setItems((prev) => prev.map((t) => (t.id === selected.id ? updatedTask : t)));
    setDetailError(null);
    setBusy(true);

    try {
      const res = await kanban.updateTask(selected.id, {
        status: newStatus as any,
        expectedRevision: selected.revision !== undefined ? selected.revision : 0,
      });
      const nextRevision =
        res?.revision !== undefined
          ? res.revision
          : (selected.revision !== undefined ? selected.revision + 1 : 1);
      const syncedTask: HRTask = {
        ...updatedTask,
        ...(res?.id ? res : {}),
        revision: nextRevision,
      };
      setSelected(syncedTask);
      setItems((prev) => prev.map((t) => (t.id === selected.id ? syncedTask : t)));
    } catch (err) {
      const msg = messageOf(err);
      if (/thay đổi|phiên bản|revision|version|409/i.test(msg)) {
        try {
          const freshTasks = await kanban.listTasks(branchId);
          setItems(freshTasks);
          const matched = freshTasks.find((t) => t.id === prevTask.id);
          if (matched) {
            setSelected(matched);
            setDetailError("Công việc đã được đồng bộ phiên bản mới nhất từ máy chủ. Vui lòng thử lại.");
            return;
          }
        } catch {}
      }
      setSelected(prevTask);
      setItems((prev) => prev.map((t) => (t.id === selected.id ? prevTask : t)));
      setDetailError(msg);
    } finally {
      setBusy(false);
    }
  };

  if (!allowed)
    return (
      <Page title="Công việc">
        <Text style={styles.emptySubtitle}>Phân hệ nhân sự chưa được kích hoạt.</Text>
      </Page>
    );

  if (section === "projects") {
    return <Projects onSectionChange={setSection} />;
  }

  if (section === "kpi") {
    return <Kpi onSectionChange={setSection} />;
  }

  const query = search.trim().toLocaleLowerCase("vi-VN");
  const filtered = items.filter((task) => {
    const normStatus = normalizeTaskStatus(task.status);
    const matchesStatus = !status || normStatus === status;
    const matchesProject = !projectId || task.projectId === projectId;
    const matchesMine =
      !mine ||
      task.assigneeUid === user?.uid ||
      task.subtasks?.some((sub) => sub.assigneeUid === user?.uid);
    const matchesQuery =
      !query ||
      [task.title, task.description, task.assignee].some((val) =>
        val?.toLocaleLowerCase("vi-VN").includes(query),
      );
    return matchesStatus && matchesProject && matchesMine && matchesQuery;
  });

  const projectMap = new Map(projects.map((p) => [p.id, p.name]));

  return (
    <SafeAreaView edges={["top"]} style={styles.container}>
      {/* Subnav Tabs */}
      <WorkSectionTabs
        value="tasks"
        canViewKpi={hasPermission(user, "work:read")}
        onChange={setSection}
      />

      {/* Screen Header */}
      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Công việc</Text>
          <Text style={styles.headerSub}>
            {selectedBranch?.name || user?.branchName || "Chi nhánh hiện tại"} · {filtered.length} việc
          </Text>
        </View>

        {manage && (
          <Pressable
            style={({ pressed }) => [styles.createBtn, pressed && { opacity: 0.85 }]}
            onPress={() => setEditing("new")}
          >
            <Text style={styles.createBtnIcon}>+</Text>
            <Text style={styles.createBtnText}>Giao việc</Text>
          </Pressable>
        )}
      </View>

      {/* Filter & Search Bar */}
      <View style={styles.filterSection}>
        {/* Search Input */}
        <View style={styles.searchBox}>
          <Search size={15} color="#94a3b8" style={{ marginRight: 6 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm tên công việc, người thực hiện..."
            placeholderTextColor="#94a3b8"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")} style={styles.searchClearBtn}>
              <X size={14} color="#94a3b8" />
            </Pressable>
          )}
        </View>

        {/* Quick Filter Pills Row */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {/* Mine vs All Pill */}
          <Pressable
            style={[styles.filterPill, mine && styles.filterPillActive, { flexDirection: "row", alignItems: "center", gap: 5 }]}
            onPress={() => setMine((v) => !v)}
          >
            <User size={13} color={mine ? "#ffffff" : "#475569"} />
            <Text style={[styles.filterPillText, mine && styles.filterPillTextActive]}>
              Việc của tôi
            </Text>
          </Pressable>

          {/* Status Pills */}
          <Pressable
            style={[styles.filterPill, !status && !mine && styles.filterPillActive]}
            onPress={() => {
              setStatus("");
              setMine(false);
            }}
          >
            <Text
              style={[
                styles.filterPillText,
                !status && !mine && styles.filterPillTextActive,
              ]}
            >
              Tất cả ({items.length})
            </Text>
          </Pressable>

          {TASK_STATUSES.map((st) => {
            const active = status === st.value;
            const count = items.filter(
              (t) => normalizeTaskStatus(t.status) === st.value,
            ).length;
            return (
              <Pressable
                key={st.value}
                style={[styles.filterPill, active && styles.filterPillActive]}
                onPress={() => setStatus(active ? "" : st.value)}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    active && styles.filterPillTextActive,
                  ]}
                >
                  {st.label} ({count})
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Project Selector if projects available */}
        {projects.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.projectScroll}
          >
            <Pressable
              style={[styles.projectChip, !projectId && styles.projectChipActive]}
              onPress={() => setProjectId("")}
            >
              <Text style={[styles.projectChipText, !projectId && styles.projectChipTextActive]}>
                Tất cả dự án
              </Text>
            </Pressable>
            {projects.map((p) => {
              const active = projectId === p.id;
              return (
                <Pressable
                  key={p.id}
                  style={[styles.projectChip, active && styles.projectChipActive, { flexDirection: "row", alignItems: "center", gap: 4 }]}
                  onPress={() => setProjectId(active ? "" : p.id)}
                >
                  <Folder size={12} color={active ? "#1d4ed8" : "#475569"} />
                  <Text style={[styles.projectChipText, active && styles.projectChipTextActive]}>
                    {p.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* Error Notices */}
      {!!error && (
        <View style={[styles.errorBox, { flexDirection: "row", alignItems: "center", gap: 6 }]}>
          <AlertCircle size={15} color="#b91c1c" />
          <Text style={[styles.errorText, { flex: 1 }]}>{error}</Text>
        </View>
      )}

      {/* Tasks FlatList */}
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => setRevision((v) => v + 1)}
            colors={["#059669"]}
            tintColor="#059669"
          />
        }
        renderItem={({ item }) => {
          const priorityInfo = getPriorityInfo(item.priority);
          const statusInfo = getStatusInfo(item.status);
          const isDone = normalizeTaskStatus(item.status) === "completed";
          const dueInfo = formatTaskDueDate(item.dueDate, isDone);
          const projectName = item.projectId ? projectMap.get(item.projectId) : undefined;

          const totalSubtasks = item.subtasks?.length || 0;
          const completedSubtasks = item.subtasks?.filter((s) => s.completed).length || 0;
          const subtaskPercent = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;

          return (
            <Pressable
              style={({ pressed }) => [
                styles.taskCard,
                pressed && { opacity: 0.95 },
                dueInfo.isOverdue && styles.taskCardOverdue,
              ]}
              onPress={() => {
                setSelected(item);
                setDetailError(null);
              }}
            >
              {/* Badges Row */}
              <View style={styles.taskCardHeader}>
                <View style={styles.badgesGroup}>
                  {/* Status Badge */}
                  <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
                    <Text style={[styles.statusBadgeText, { color: statusInfo.color }]}>
                      {statusInfo.label}
                    </Text>
                  </View>

                  {/* Priority Badge */}
                  <View style={[styles.priorityBadge, { backgroundColor: priorityInfo.bg }]}>
                    <Text style={[styles.priorityBadgeText, { color: priorityInfo.color }]}>
                      {priorityInfo.label}
                    </Text>
                  </View>

                  {/* KPI Status Badge (if has hours or done) */}
                  {(() => {
                    const cardKpi = evaluateTaskKpi(item.estTime, item.actualTime, item.endTime, item.dueDate);
                    if (!cardKpi || (!item.actualTime && !isDone)) return null;
                    return (
                      <View
                        style={[
                          styles.kpiCardBadge,
                          { backgroundColor: cardKpi.bg, borderColor: cardKpi.borderColor, flexDirection: "row", alignItems: "center", gap: 3 },
                        ]}
                      >
                        <KpiIcon icon={cardKpi.icon} color={cardKpi.color} size={11} />
                        <Text style={[styles.kpiCardBadgeText, { color: cardKpi.color }]}>
                          {cardKpi.status === "ontime" ? "Đúng hạn" : cardKpi.status === "ahead" ? "Sớm hạn" : "Trễ hạn"}
                        </Text>
                      </View>
                    );
                  })()}
                </View>

                {/* Due Date Indicator */}
                <View
                  style={[
                    styles.dueBadge,
                    dueInfo.isOverdue && styles.dueBadgeOverdue,
                    dueInfo.isToday && styles.dueBadgeToday,
                  ]}
                >
                  <Ionicons
                    name={dueInfo.isOverdue ? "alert-circle" : dueInfo.isToday ? "time" : "calendar-outline"}
                    size={12}
                    color={dueInfo.isOverdue ? "#dc2626" : dueInfo.isToday ? "#d97706" : "#64748b"}
                  />
                  <Text
                    style={[
                      styles.dueBadgeText,
                      dueInfo.isOverdue && styles.dueBadgeTextOverdue,
                      dueInfo.isToday && styles.dueBadgeTextToday,
                    ]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {dueInfo.text}
                  </Text>
                </View>
              </View>

              {/* Title & Description */}
              <Text style={[styles.taskTitle, isDone && styles.taskTitleDone]}>
                {item.title}
              </Text>
              {!!item.description && (
                <Text style={styles.taskDesc} numberOfLines={2}>
                  {item.description}
                </Text>
              )}

              {/* Subtasks Mini Progress Bar (if any) */}
              {totalSubtasks > 0 && (
                <View style={styles.subtasksProgressWrap}>
                  <View style={styles.subtasksInfoRow}>
                    <Text style={styles.subtasksProgressLabel}>
                      Việc nhỏ: {completedSubtasks}/{totalSubtasks}
                    </Text>
                    <Text style={styles.subtasksProgressPercent}>{subtaskPercent}%</Text>
                  </View>
                  <View style={styles.progressBarTrack}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${subtaskPercent}%`,
                          backgroundColor: isDone ? "#059669" : "#2563eb",
                        },
                      ]}
                    />
                  </View>
                </View>
              )}

              {/* Tags in card */}
              {!!item.tags?.length && (
                <View style={styles.cardTagsWrap}>
                  {item.tags.map((tag) => (
                    <View key={tag} style={styles.cardTagBadge}>
                      <Text style={styles.cardTagText}>#{tag}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Card Footer: Assignee & Project Tag / Attachments */}
              <View style={styles.taskFooter}>
                <View style={styles.assigneeBox}>
                  <View style={styles.assigneeAvatar}>
                    <Text style={styles.assigneeAvatarText}>
                      {(item.assignee || "U").charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.assigneeName} numberOfLines={1}>
                    {item.assignee || "Chưa phân công"}
                  </Text>
                </View>

                <View style={styles.taskFooterRight}>
                  {!!item.attachments?.length && (
                    <View style={[styles.cardAttachmentBadge, { flexDirection: "row", alignItems: "center", gap: 3 }]}>
                      <Paperclip size={11} color="#64748b" />
                      <Text style={styles.cardAttachmentText}>{item.attachments.length}</Text>
                    </View>
                  )}
                  {projectName && (
                    <View style={[styles.projectTag, { flexDirection: "row", alignItems: "center", gap: 3 }]}>
                      <Folder size={11} color="#475569" />
                      <Text style={styles.projectTagText} numberOfLines={1}>
                        {projectName}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyContainer}>
              <ActivityIndicator size="large" color="#059669" />
              <Text style={styles.emptyLoadingText}>Đang tải công việc...</Text>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <EmptyState
                message="Không có công việc phù hợp"
                subtitle={
                  query || status || mine || projectId
                    ? "Thử thay đổi bộ lọc tìm kiếm hoặc trạng thái."
                    : "Chưa có công việc nào được phân công trong phạm vi này."
                }
              />
              {(query || status || mine || projectId) && (
                <Pressable
                  style={styles.resetFiltersBtn}
                  onPress={() => {
                    setSearch("");
                    setStatus("");
                    setProjectId("");
                    setMine(false);
                  }}
                >
                  <Text style={styles.resetFiltersBtnText}>Xóa bộ lọc</Text>
                </Pressable>
              )}
            </View>
          )
        }
      />

      {/* Task Detail Modal */}
      <Modal
        visible={selected !== null}
        animationType="slide"
        onRequestClose={() => {
          if (!lock.current) setSelected(null);
        }}
      >
        <SafeAreaView edges={["top"]} style={styles.modalContainer}>
          {selected && (
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.modalTitle}>{selected.title}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 }}>
                    {selected.projectId ? (
                      <>
                        <Folder size={13} color="#64748b" />
                        <Text style={[styles.modalSub, { marginTop: 0 }]}>
                          {projectMap.get(selected.projectId) || "Dự án"}
                        </Text>
                      </>
                    ) : (
                      <Text style={[styles.modalSub, { marginTop: 0 }]}>Công việc độc lập</Text>
                    )}
                  </View>
                  {!!selected.tags?.length && (
                    <View style={styles.detailTagsWrap}>
                      {selected.tags.map((tag) => (
                        <View key={tag} style={styles.detailTagBadge}>
                          <Text style={styles.detailTagText}>#{tag}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  {!!selected.createdAt && (
                    <Text style={styles.modalMetaText}>
                      Tạo ngày {formatDetailDateTime(selected.createdAt)}
                      {selected.category ? ` · ${selected.category}` : ""}
                    </Text>
                  )}
                </View>
                <Pressable
                  style={styles.modalCloseBtn}
                  onPress={() => setSelected(null)}
                >
                  <X size={16} color="#64748b" />
                </Pressable>
              </View>

              {/* Status & Details Grid */}
              <View style={styles.detailCard}>
                <View style={styles.detailGrid}>
                  <View style={styles.detailGridItem}>
                    <Text style={styles.detailGridLabel}>Trạng thái</Text>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: getStatusInfo(selected.status).bg },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusBadgeText,
                          { color: getStatusInfo(selected.status).color },
                        ]}
                      >
                        {getStatusInfo(selected.status).label}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.detailGridItem}>
                    <Text style={styles.detailGridLabel}>Độ ưu tiên</Text>
                    <View
                      style={[
                        styles.priorityBadge,
                        { backgroundColor: getPriorityInfo(selected.priority).bg },
                      ]}
                    >
                      <Text
                        style={[
                          styles.priorityBadgeText,
                          { color: getPriorityInfo(selected.priority).color },
                        ]}
                      >
                        {getPriorityInfo(selected.priority).label}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.detailGridItem}>
                    <Text style={styles.detailGridLabel}>Người thực hiện</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <User size={13} color="#475569" />
                      <Text style={styles.detailGridVal}>
                        {selected.assignee || "Chưa phân công"}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.detailGridItem}>
                    <Text style={styles.detailGridLabel}>Hạn chót (Deadline)</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Calendar size={13} color="#b91c1c" />
                      <Text style={[styles.detailGridVal, { color: "#b91c1c" }]}>
                        {formatDetailDateTime(selected.dueDate)}
                      </Text>
                    </View>
                  </View>

                  {!!selected.startTime && (
                    <View style={styles.detailGridItem}>
                      <Text style={styles.detailGridLabel}>Bắt đầu</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Play size={13} color="#475569" />
                        <Text style={styles.detailGridVal}>
                          {formatDetailDateTime(selected.startTime)}
                        </Text>
                      </View>
                    </View>
                  )}

                  {!!selected.endTime && (
                    <View style={styles.detailGridItem}>
                      <Text style={styles.detailGridLabel}>Kết thúc</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Flag size={13} color="#475569" />
                        <Text style={styles.detailGridVal}>
                          {formatDetailDateTime(selected.endTime)}
                        </Text>
                      </View>
                    </View>
                  )}

                  <View style={styles.detailGridItem}>
                    <Text style={styles.detailGridLabel}>Dự tính / Thực tế</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Clock size={13} color="#475569" />
                      <Text style={styles.detailGridVal}>
                        {selected.estTime || 0}h / {selected.actualTime || 0}h
                      </Text>
                    </View>
                  </View>

                  {/* KPI Evaluation in Detail */}
                  {(() => {
                    const detailKpi = evaluateTaskKpi(selected.estTime, selected.actualTime, selected.endTime, selected.dueDate);
                    if (!detailKpi) return null;
                    return (
                      <View style={[styles.detailGridItem, { width: "100%", marginTop: 4 }]}>
                        <Text style={styles.detailGridLabel}>Đánh giá KPI</Text>
                        <View
                          style={[
                            styles.detailKpiBox,
                            { backgroundColor: detailKpi.bg, borderColor: detailKpi.borderColor },
                          ]}
                        >
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                            <KpiIcon icon={detailKpi.icon} color={detailKpi.color} size={13} />
                            <Text style={[styles.detailKpiTitle, { color: detailKpi.color }]}>
                              {detailKpi.label}
                            </Text>
                          </View>
                          <Text style={[styles.detailKpiDetail, { color: detailKpi.color }]}>
                            {detailKpi.detail}
                          </Text>
                        </View>
                      </View>
                    );
                  })()}

                  {!!selected.completedAt && (
                    <View style={styles.detailGridItem}>
                      <Text style={styles.detailGridLabel}>Hoàn thành lúc</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Sparkles size={13} color="#059669" />
                        <Text style={[styles.detailGridVal, { color: "#059669" }]}>
                          {formatDetailDateTime(selected.completedAt)}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              </View>

              {/* Description Card */}
              <View style={styles.detailCard}>
                <Text style={styles.detailSectionTitle}>Mô tả công việc</Text>
                <Text style={styles.detailDescText}>
                  {selected.description || "Chưa có mô tả chi tiết cho công việc này."}
                </Text>
                {!!selected.linkNote && (
                  <View style={styles.noteBox}>
                    <Text style={styles.noteBoxLabel}>Ghi chú thêm / Kết quả bàn giao:</Text>
                    <Text style={styles.noteBoxText}>{selected.linkNote}</Text>
                  </View>
                )}
              </View>

              {/* Subtasks Card */}
              <View style={styles.detailCard}>
                <View style={styles.detailHeaderRow}>
                  <Text style={styles.detailSectionTitle}>
                    Danh sách việc nhỏ ({selected.subtasks?.filter((s) => s.completed).length || 0}/
                    {selected.subtasks?.length || 0})
                  </Text>
                  {!!selected.subtasks?.length && (
                    <Text style={styles.detailSectionBadge}>
                      {Math.round(
                        ((selected.subtasks.filter((s) => s.completed).length || 0) /
                          (selected.subtasks.length || 1)) *
                          100,
                      )}
                      %
                    </Text>
                  )}
                </View>

                {selected.subtasks && selected.subtasks.length > 0 ? (
                  <View style={styles.subtasksList}>
                    {selected.subtasks.map((sub) => {
                      const isUpdatingThis = subtaskUpdatingId === sub.id;
                      return (
                        <Pressable
                          key={sub.id}
                          style={styles.subtaskRow}
                          disabled={subtaskUpdatingId !== null}
                          onPress={() => void handleToggleSubtaskInDetail(sub.id)}
                        >
                          <View
                            style={[
                              styles.detailSubtaskCheckbox,
                              sub.completed && styles.detailSubtaskCheckboxChecked,
                            ]}
                          >
                            {isUpdatingThis ? (
                              <ActivityIndicator size="small" color={sub.completed ? "#ffffff" : "#059669"} />
                            ) : sub.completed ? (
                              <Check size={13} color="#ffffff" strokeWidth={3} />
                            ) : null}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[
                                styles.subtaskTitle,
                                sub.completed && styles.subtaskTitleCompleted,
                              ]}
                            >
                              {sub.title}
                            </Text>
                            {!!sub.assignee && (
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                                <User size={11} color="#64748b" />
                                <Text style={styles.subtaskAssignee}>{sub.assignee}</Text>
                              </View>
                            )}
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={styles.detailEmptyText}>
                    Chưa có việc con nào. Nhấn "Sửa công việc" để thêm và chia nhỏ đầu việc.
                  </Text>
                )}
              </View>

              {/* Attachments Card */}
              <View style={styles.detailCard}>
                <Text style={styles.detailSectionTitle}>
                  Tệp & Liên kết đính kèm ({selected.attachments?.length || 0})
                </Text>
                {selected.attachments && selected.attachments.length > 0 ? (
                  <View style={styles.attachmentsList}>
                    {selected.attachments.map((file) => {
                      return (
                        <Pressable
                          key={file.id}
                          style={styles.attachmentItem}
                          onPress={() =>
                            void run(async () => {
                              if (file.type === "link") {
                                const url = new URL(file.url);
                                if (!["https:", "http:"].includes(url.protocol))
                                  throw new Error("Đường dẫn không được hỗ trợ.");
                                await Linking.openURL(url.toString());
                              } else await shareLeaveFile(file.url, file.name);
                            })
                          }
                        >
                          <AttachmentTypeIcon type={file.type} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.attachmentName} numberOfLines={1}>
                              {file.name}
                            </Text>
                            <Text style={styles.attachmentSubText} numberOfLines={1}>
                              {file.type === "link"
                                ? file.url
                                : file.size
                                ? `${Math.round(file.size / 1024)} KB`
                                : "Tệp đính kèm"}
                            </Text>
                          </View>
                          <Text style={styles.attachmentAction}>
                            {file.type === "link" ? "Mở ↗" : "Xem"}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={styles.detailEmptyText}>
                    Chưa có tệp hoặc tài liệu đính kèm. Nhấn "Sửa công việc" để tải lên hoặc dán link.
                  </Text>
                )}
              </View>

              {/* History Timeline */}
              {!!selected.history?.length && (
                <View style={styles.detailCard}>
                  <Text style={styles.detailSectionTitle}>Lịch sử thao tác</Text>
                  <View style={styles.historyList}>
                    {selected.history.map((entry, idx) => (
                      <View key={idx} style={styles.historyItem}>
                        <View style={styles.historyDot} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.historyText}>
                            <Text style={{ fontWeight: "700" }}>{entry.user}</Text>: {entry.action}
                          </Text>
                          <Text style={styles.historyTime}>
                            {new Date(entry.time).toLocaleString("vi-VN")}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Action Buttons in Modal (Cleaned up: No redundant 'Việc nhỏ' / 'Đính kèm' buttons) */}
              <View style={styles.modalActionButtons}>
                {canUpdateTask(user, selected) && (
                  <View style={styles.modalBtnRow}>
                    <Pressable
                      style={[styles.modalActionBtn, styles.modalActionBtnPrimary, { flex: 1, flexDirection: "row", gap: 6 }]}
                      onPress={() => {
                        setEditing(selected);
                        setSelected(null);
                      }}
                    >
                      <Pencil size={14} color="#ffffff" />
                      <Text style={styles.modalActionBtnTextPrimary}>Sửa công việc</Text>
                    </Pressable>

                    {selected.status !== "Done" && (
                      <Pressable
                        style={[styles.modalActionBtn, styles.modalActionBtnSuccess, { flexDirection: "row", gap: 6 }]}
                        onPress={() => void handleQuickStatusChange("Done")}
                      >
                        <Check size={14} color="#047857" strokeWidth={2.5} />
                        <Text style={styles.modalActionBtnTextSuccess}>Hoàn thành</Text>
                      </Pressable>
                    )}
                  </View>
                )}

                {manage && (
                  <Pressable
                    style={[styles.modalDeleteBtn, { flexDirection: "row", justifyContent: "center", gap: 6 }]}
                    onPress={() =>
                      Alert.alert("Xóa công việc?", `Bạn có chắc muốn xóa "${selected.title}"?`, [
                        { text: "Hủy", style: "cancel" },
                        {
                          text: "Xóa",
                          style: "destructive",
                          onPress: () =>
                            void run(async () => {
                              await kanban.removeTask(selected.id);
                              reload();
                            }),
                        },
                      ])
                    }
                  >
                    <Trash2 size={14} color="#dc2626" />
                    <Text style={styles.modalDeleteBtnText}>Xóa công việc này</Text>
                  </Pressable>
                )}
              </View>

              {!!detailError && (
                <View style={styles.errorBox}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <AlertCircle size={15} color="#b91c1c" />
                    <Text style={[styles.errorText, { flex: 1 }]}>{detailError}</Text>
                  </View>
                  <Pressable
                    style={[styles.errorReloadBtn, { flexDirection: "row", alignItems: "center", gap: 6 }]}
                    onPress={async () => {
                      setDetailError(null);
                      try {
                        setBusy(true);
                        const freshTasks = await kanban.listTasks(branchId);
                        setItems(freshTasks);
                        const matched = freshTasks.find((t) => t.id === selected.id);
                        if (matched) setSelected(matched);
                      } catch (err) {
                        setDetailError(messageOf(err));
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <RotateCw size={13} color="#b91c1c" />
                    <Text style={styles.errorReloadBtnText}>Tải lại dữ liệu công việc</Text>
                  </Pressable>
                </View>
              )}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      {/* Editing Modal */}
      <Modal
        visible={editing !== null}
        animationType="slide"
        onRequestClose={() => {
          if (!formLock.current) reload();
        }}
      >
        <SafeAreaView edges={["top"]} style={styles.modalContainer}>
          {editing && (
            <TaskForm
              task={editing === "new" ? undefined : editing}
              projects={projects}
              setLocked={(value) => {
                formLock.current = value;
              }}
              onClose={reload}
              onSaved={reload}
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  headerInfo: {
    flex: 1,
    gap: 2,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "500",
  },
  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#059669",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  createBtnIcon: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
  createBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  filterSection: {
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingBottom: 10,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
  },
  searchIcon: {
    fontSize: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#0f172a",
    paddingVertical: 2,
  },
  searchClearBtn: {
    padding: 4,
  },
  searchClearText: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "700",
  },
  filterScroll: {
    paddingHorizontal: 14,
    paddingTop: 10,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  filterPillActive: {
    backgroundColor: "#059669",
    borderColor: "#059669",
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  filterPillTextActive: {
    color: "#ffffff",
    fontWeight: "700",
  },
  projectScroll: {
    paddingHorizontal: 14,
    paddingTop: 8,
    gap: 6,
  },
  projectChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
  },
  projectChipActive: {
    backgroundColor: "#dbeafe",
  },
  projectChipText: {
    fontSize: 11,
    color: "#475569",
    fontWeight: "600",
  },
  projectChipTextActive: {
    color: "#1d4ed8",
    fontWeight: "700",
  },
  errorBox: {
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: "#fef2f2",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  errorText: {
    fontSize: 13,
    color: "#b91c1c",
    fontWeight: "500",
  },
  errorReloadBtn: {
    marginTop: 8,
    alignSelf: "flex-start",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#fca5a5",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  errorReloadBtnText: {
    color: "#b91c1c",
    fontSize: 12,
    fontWeight: "700",
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  taskCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 10,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  taskCardOverdue: {
    borderColor: "#fca5a5",
    borderLeftWidth: 4,
    borderLeftColor: "#ef4444",
  },
  taskCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 6,
  },
  badgesGroup: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    flexShrink: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  priorityBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  kpiCardBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  kpiCardBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  dueBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: "flex-start",
    maxWidth: "100%",
  },
  dueBadgeOverdue: {
    backgroundColor: "#fef2f2",
  },
  dueBadgeToday: {
    backgroundColor: "#fffbeb",
  },
  dueBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
  },
  dueBadgeTextOverdue: {
    color: "#dc2626",
    fontWeight: "700",
  },
  dueBadgeTextToday: {
    color: "#d97706",
    fontWeight: "700",
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
    lineHeight: 22,
  },
  taskTitleDone: {
    textDecorationLine: "line-through",
    color: "#94a3b8",
  },
  taskDesc: {
    fontSize: 13,
    color: "#475569",
    lineHeight: 18,
  },
  subtasksProgressWrap: {
    backgroundColor: "#f8fafc",
    padding: 8,
    borderRadius: 8,
    gap: 5,
  },
  subtasksInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  subtasksProgressLabel: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "600",
  },
  subtasksProgressPercent: {
    fontSize: 11,
    color: "#0f172a",
    fontWeight: "700",
  },
  progressBarTrack: {
    height: 5,
    backgroundColor: "#e2e8f0",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  taskFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 10,
    marginTop: 2,
  },
  assigneeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  assigneeAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  assigneeAvatarText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#334155",
  },
  assigneeName: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
  },
  projectTag: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    maxWidth: 140,
  },
  projectTagText: {
    fontSize: 11,
    color: "#475569",
    fontWeight: "600",
  },
  cardTagsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 2,
  },
  cardTagBadge: {
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  cardTagText: {
    fontSize: 11,
    color: "#1d4ed8",
    fontWeight: "600",
  },
  taskFooterRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  cardAttachmentBadge: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  cardAttachmentText: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "600",
  },
  detailTagsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
  },
  detailTagBadge: {
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  detailTagText: {
    fontSize: 12,
    color: "#1d4ed8",
    fontWeight: "600",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    gap: 12,
  },
  emptyLoadingText: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
  },
  resetFiltersBtn: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  resetFiltersBtnText: {
    fontSize: 13,
    color: "#334155",
    fontWeight: "600",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  modalScroll: {
    flex: 1,
  },
  modalContent: {
    padding: 16,
    gap: 14,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
    lineHeight: 24,
  },
  modalSub: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 3,
    fontWeight: "500",
  },
  modalMetaText: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCloseBtnText: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "700",
  },
  detailCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 12,
  },
  detailGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  detailGridItem: {
    width: "47%",
    gap: 4,
  },
  detailGridLabel: {
    fontSize: 11,
    color: "#94a3b8",
    fontWeight: "600",
    textTransform: "uppercase",
  },
  detailGridVal: {
    fontSize: 13,
    color: "#0f172a",
    fontWeight: "700",
  },
  detailKpiBox: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    gap: 3,
  },
  detailKpiTitle: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  detailKpiDetail: {
    fontSize: 11,
    fontWeight: "600",
    opacity: 0.9,
  },
  detailSectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  detailDescText: {
    fontSize: 14,
    color: "#334155",
    lineHeight: 21,
  },
  noteBox: {
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fde68a",
    borderRadius: 8,
    padding: 10,
    gap: 3,
  },
  noteBoxLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#b45309",
  },
  noteBoxText: {
    fontSize: 13,
    color: "#78350f",
  },
  detailHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  detailSectionBadge: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
  },
  subtasksList: {
    gap: 8,
  },
  subtaskRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#f8fafc",
    padding: 10,
    borderRadius: 10,
  },
  subtaskCheck: {
    fontSize: 14,
  },
  subtaskTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
  },
  subtaskTitleCompleted: {
    textDecorationLine: "line-through",
    color: "#94a3b8",
  },
  subtaskAssignee: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
  },
  detailSubtaskCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    backgroundColor: "#ffffff",
  },
  detailSubtaskCheckboxChecked: {
    backgroundColor: "#059669",
    borderColor: "#059669",
  },
  detailCheckmark: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 14,
  },
  detailEmptyText: {
    fontSize: 13,
    color: "#94a3b8",
    fontStyle: "italic",
    paddingVertical: 4,
  },
  attachmentsList: {
    gap: 8,
  },
  attachmentItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 10,
    borderRadius: 10,
    gap: 8,
  },
  attachmentIcon: {
    fontSize: 16,
  },
  attachmentName: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
  },
  attachmentAction: {
    fontSize: 12,
    color: "#2563eb",
    fontWeight: "700",
  },
  attachmentSubText: {
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 1,
  },
  historyList: {
    gap: 10,
  },
  historyItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  historyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#94a3b8",
    marginTop: 5,
  },
  historyText: {
    fontSize: 12,
    color: "#334155",
  },
  historyTime: {
    fontSize: 11,
    color: "#94a3b8",
  },
  modalActionButtons: {
    gap: 10,
    marginTop: 6,
  },
  modalBtnRow: {
    flexDirection: "row",
    gap: 8,
  },
  modalActionBtn: {
    flex: 1,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  modalActionBtnPrimary: {
    backgroundColor: "#059669",
    borderColor: "#059669",
  },
  modalActionBtnSuccess: {
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  modalActionBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
  },
  modalActionBtnTextPrimary: {
    fontSize: 12,
    fontWeight: "700",
    color: "#ffffff",
  },
  modalActionBtnTextSuccess: {
    color: "#047857",
    fontWeight: "700",
    fontSize: 13,
  },
  modalDeleteBtn: {
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    alignItems: "center",
  },
  modalDeleteBtnText: {
    color: "#dc2626",
    fontSize: 13,
    fontWeight: "700",
  },
});
