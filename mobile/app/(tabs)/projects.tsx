import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import type { Project } from "../../../src/types/hr";
import { kanban } from "../../src/api/services";
import { useSession, messageOf } from "../../src/auth/SessionProvider";
import { canUseModule, hasPermission } from "../../src/auth/access";
import { ProjectForm } from "../../src/features/work/ProjectForm";
import { AttachmentsForm } from "../../src/features/work/AttachmentsForm";
import { PROJECT_PRIORITIES, PROJECT_STATUSES } from "../../src/features/work/project";
import { EmptyState, Page } from "../../src/ui";
import { WorkSectionTabs, type WorkSection } from "../../src/features/work/WorkSectionTabs";

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  not_started: { label: "Chưa bắt đầu", color: "#475569", bg: "#f1f5f9" },
  in_progress: { label: "Đang làm", color: "#2563eb", bg: "#eff6ff" },
  paused: { label: "Tạm dừng", color: "#d97706", bg: "#fffbeb" },
  completed: { label: "Hoàn thành", color: "#059669", bg: "#ecfdf5" },
  cancelled: { label: "Đã hủy", color: "#dc2626", bg: "#fef2f2" },
};

const PRIORITY_MAP: Record<string, { label: string; color: string; bg: string }> = {
  urgent: { label: "Khẩn cấp", color: "#dc2626", bg: "#fef2f2" },
  high: { label: "Cao", color: "#ea580c", bg: "#fff7ed" },
  normal: { label: "Bình thường", color: "#2563eb", bg: "#eff6ff" },
  low: { label: "Thấp", color: "#64748b", bg: "#f1f5f9" },
};

interface ProjectsProps {
  onSectionChange?: (section: WorkSection) => void;
}

export default function Projects({ onSectionChange }: ProjectsProps = {}) {
  const { user, selectedBranch } = useSession();
  const allowed = canUseModule(user, "hr");
  const manage = hasPermission(user, "work:manage");
  const branchId = selectedBranch?._id || user?.branchId || undefined;

  const [editing, setEditing] = useState<Project | "new" | null>(null);
  const [attachmentProject, setAttachmentProject] = useState<Project | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const formLock = useRef(false);

  const [statusFilter, setStatusFilter] = useState("");
  const [items, setItems] = useState<Project[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  // Fetch immediately on mount and when revision/scope changes
  useEffect(() => {
    let active = true;
    if (!allowed) return;
    setLoading(true);
    setError(null);
    void kanban
      .listProjects(branchId)
      .then((data) => {
        if (active) setItems(data);
      })
      .catch((err) => {
        if (active) setError(messageOf(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [allowed, branchId, revision]);

  // Refresh when returning focus
  useFocusEffect(
    useCallback(() => {
      setRevision((v) => v + 1);
    }, []),
  );

  if (!allowed)
    return (
      <Page title="Dự án">
        <Text style={styles.emptySubtitle}>Phân hệ nhân sự chưa được kích hoạt.</Text>
      </Page>
    );

  const reload = () => {
    setEditing(null);
    setAttachmentProject(null);
    setRevision((value) => value + 1);
  };

  const remove = async (project: Project) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      await kanban.removeProject(project.id);
      reload();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const handleSectionChange = (nextSection: WorkSection) => {
    if (onSectionChange) {
      onSectionChange(nextSection);
      return;
    }
    if (nextSection === "tasks") {
      router.replace("/(tabs)/work");
    } else if (nextSection === "kpi") {
      router.replace("/(tabs)/kpi");
    }
  };

  const query = search.trim().toLocaleLowerCase("vi-VN");
  const filtered = items.filter(
    (item) =>
      (!statusFilter || item.status === statusFilter) &&
      (!query || item.name.toLocaleLowerCase("vi-VN").includes(query)),
  );

  return (
    <SafeAreaView edges={["top"]} style={styles.container}>
      {/* Unified Subnav */}
      <WorkSectionTabs
        value="projects"
        canViewKpi={hasPermission(user, "work:read")}
        onChange={handleSectionChange}
      />

      {/* Screen Header */}
      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Dự án</Text>
          <Text style={styles.headerSub}>
            {selectedBranch?.name || user?.branchName || "Chi nhánh hiện tại"} · {filtered.length} dự án
          </Text>
        </View>

        {manage && (
          <Pressable
            style={({ pressed }) => [styles.createBtn, pressed && { opacity: 0.85 }]}
            onPress={() => setEditing("new")}
          >
            <Text style={styles.createBtnIcon}>+</Text>
            <Text style={styles.createBtnText}>Tạo dự án</Text>
          </Pressable>
        )}
      </View>

      {/* Search & Status Filter Bar */}
      <View style={styles.filterSection}>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm kiếm dự án..."
            placeholderTextColor="#94a3b8"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")} style={styles.searchClearBtn}>
              <Text style={styles.searchClearText}>✕</Text>
            </Pressable>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          <Pressable
            style={[styles.filterPill, !statusFilter && styles.filterPillActive]}
            onPress={() => setStatusFilter("")}
          >
            <Text
              style={[
                styles.filterPillText,
                !statusFilter && styles.filterPillTextActive,
              ]}
            >
              Tất cả ({items.length})
            </Text>
          </Pressable>

          {PROJECT_STATUSES.map((st) => {
            const active = statusFilter === st.value;
            const count = items.filter((p) => p.status === st.value).length;
            return (
              <Pressable
                key={st.value}
                style={[styles.filterPill, active && styles.filterPillActive]}
                onPress={() => setStatusFilter(active ? "" : st.value)}
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
      </View>

      {/* Error Banner */}
      {!!error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
        </View>
      )}

      {/* Projects List */}
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
          const st = STATUS_MAP[item.status] || { label: item.status, color: "#475569", bg: "#f1f5f9" };
          const pr = PRIORITY_MAP[item.priority] || { label: item.priority, color: "#2563eb", bg: "#eff6ff" };
          const percent = item.progress?.percent ?? 0;
          const completed = item.progress?.completed ?? 0;
          const total = item.progress?.total ?? 0;

          return (
            <View style={styles.projectCard}>
              {/* Top Badges */}
              <View style={styles.cardTopRow}>
                <View style={styles.badgesGroup}>
                  <View style={[styles.badge, { backgroundColor: st.bg }]}>
                    <Text style={[styles.badgeText, { color: st.color }]}>{st.label}</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: pr.bg }]}>
                    <Text style={[styles.badgeText, { color: pr.color }]}>{pr.label}</Text>
                  </View>
                </View>

                {item.dueAt && (
                  <View style={styles.dueBadge}>
                    <Text style={styles.dueBadgeText}>
                      📅 {new Date(item.dueAt).toLocaleDateString("vi-VN")}
                    </Text>
                  </View>
                )}
              </View>

              {/* Title */}
              <Text style={styles.projectTitle}>{item.name}</Text>

              {/* Progress Bar Section */}
              <View style={styles.progressBox}>
                <View style={styles.progressHeader}>
                  <Text style={styles.progressSubtitle}>
                    {completed}/{total} việc hoàn thành
                  </Text>
                  <Text style={styles.progressPercentText}>{percent}%</Text>
                </View>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.min(100, Math.max(0, percent))}%`,
                        backgroundColor: percent === 100 ? "#059669" : "#2563eb",
                      },
                    ]}
                  />
                </View>
              </View>

              {/* Actions Footer */}
              <View style={styles.cardFooter}>
                <Pressable
                  style={styles.attachmentBtn}
                  disabled={busy}
                  onPress={() => setAttachmentProject(item)}
                >
                  <Text style={styles.attachmentBtnIcon}>📎</Text>
                  <Text style={styles.attachmentBtnText}>
                    Tệp đính kèm ({item.attachments?.length || 0})
                  </Text>
                </Pressable>

                {manage && (
                  <View style={styles.manageBtnGroup}>
                    <Pressable
                      style={styles.editBtn}
                      disabled={busy}
                      onPress={() => setEditing(item)}
                    >
                      <Text style={styles.editBtnText}>✏️ Sửa</Text>
                    </Pressable>

                    <Pressable
                      style={styles.deleteBtn}
                      disabled={busy}
                      onPress={() =>
                        Alert.alert(
                          "Xóa dự án?",
                          `Xóa "${item.name}" và gỡ liên kết dự án khỏi các công việc. Các công việc vẫn được giữ lại.`,
                          [
                            { text: "Hủy", style: "cancel" },
                            {
                              text: "Xóa",
                              style: "destructive",
                              onPress: () => void remove(item),
                            },
                          ],
                        )
                      }
                    >
                      <Text style={styles.deleteBtnText}>🗑️</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyContainer}>
              <ActivityIndicator size="large" color="#059669" />
              <Text style={styles.emptyLoadingText}>Đang tải dự án...</Text>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <EmptyState
                message="Không có dự án phù hợp"
                subtitle={
                  query || statusFilter
                    ? "Không tìm thấy dự án nào theo điều kiện tìm kiếm."
                    : "Chưa có dự án nào được tạo trong chi nhánh."
                }
              />
              {(query || statusFilter) && (
                <Pressable
                  style={styles.resetFiltersBtn}
                  onPress={() => {
                    setSearch("");
                    setStatusFilter("");
                  }}
                >
                  <Text style={styles.resetFiltersBtnText}>Xóa bộ lọc</Text>
                </Pressable>
              )}
            </View>
          )
        }
      />

      {/* Project Form / Attachments Modal */}
      <Modal
        visible={editing !== null || attachmentProject !== null}
        animationType="slide"
        onRequestClose={() => {
          if (!formLock.current) reload();
        }}
      >
        <SafeAreaView edges={["top"]} style={styles.modalContainer}>
          {editing && (
            <ProjectForm
              project={editing === "new" ? undefined : editing}
              onClose={reload}
              onSaved={reload}
              setLocked={(value) => {
                formLock.current = value;
              }}
            />
          )}
          {attachmentProject && (
            <AttachmentsForm
              initial={attachmentProject.attachments || []}
              save={
                manage
                  ? async (attachments) => {
                      await kanban.updateProject(attachmentProject.id, { attachments });
                    }
                  : undefined
              }
              onClose={reload}
              setLocked={(value) => {
                formLock.current = value;
              }}
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
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  projectCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 12,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  badgesGroup: {
    flexDirection: "row",
    gap: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  dueBadge: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  dueBadgeText: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "600",
  },
  projectTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0f172a",
    lineHeight: 23,
  },
  progressBox: {
    backgroundColor: "#f8fafc",
    padding: 12,
    borderRadius: 12,
    gap: 6,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressSubtitle: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "600",
  },
  progressPercentText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0f172a",
  },
  progressTrack: {
    height: 7,
    backgroundColor: "#e2e8f0",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 10,
    marginTop: 2,
  },
  attachmentBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#f1f5f9",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  attachmentBtnIcon: {
    fontSize: 12,
  },
  attachmentBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
  },
  manageBtnGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  editBtn: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
  },
  deleteBtn: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  deleteBtnText: {
    fontSize: 12,
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
});
