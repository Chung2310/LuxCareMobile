import { useAppAlert } from "../../src/components/AppAlert";
import { shareApiFile } from "../../src/files/shareFile";
import { useCallback, useMemo, useRef, useState, type MutableRefObject } from "react";
import {
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  Eye,
  FileText,
  GitBranch,
  Layers,
  Paperclip,
  Pencil,
  Plus,
  RotateCw,
  Search,
  Target,
  Trash2,
  User,
  Users,
  Workflow as WorkflowIcon,
  X,
  XCircle,
} from "lucide-react-native";
import type { TaskAttachment, Workflow, WorkflowEdge, WorkflowStep } from "../../../src/types/hr";
import { workflow } from "../../src/api/services";
import { messageOf, useSession } from "../../src/auth/SessionProvider";
import { workflowAccess } from "../../src/features/workflow/access";
import { WorkflowForm } from "../../src/features/workflow/WorkflowForm";
import { ErrorText, Loading } from "../../src/ui";

export default function WorkflowPage() {
  const { showAlert, alertView } = useAppAlert();
  const { user, selectedBranch } = useSession();
  const access = workflowAccess(user);
  const scopeReady = !!user?.companyCode || !!selectedBranch?._id || !!user?.branchId || user?.role === "superadmin";

  const [items, setItems] = useState<Workflow[]>([]);
  const [selected, setSelected] = useState<Workflow | null>(null);
  const [stepDetail, setStepDetail] = useState<{ step: WorkflowStep; index: number } | null>(null);
  const [editing, setEditing] = useState<Workflow | "new" | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const formLock = useRef(false);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Tất cả");

  const loadData = useCallback(
    async (isRefresh = false) => {
      if (!access.read || !scopeReady) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const value = await workflow.list(user?.companyCode);
        setItems(value);
        if (selected) {
          const updated = value.find((w) => w.id === selected.id);
          if (updated) setSelected(updated);
        }
      } catch (loadError) {
        setError(messageOf(loadError));
      } finally {
        if (isRefresh) setRefreshing(false);
        else setLoading(false);
      }
    },
    [access.read, scopeReady, user?.companyCode, selected?.id],
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setError(null);
      if (!access.read || !scopeReady) return;
      setLoading(true);
      void workflow
        .list(user?.companyCode)
        .then((value) => {
          if (active) setItems(value);
        })
        .catch((loadError) => {
          if (active) setError(messageOf(loadError));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [access.read, scopeReady, user?.companyCode, revision]),
  );

  const closeEditor = () => {
    if (formLock.current) return;
    setEditing(null);
    setRevision((value) => value + 1);
  };

  const deleteWorkflow = (item: Workflow) => {
    showAlert("Xóa quy trình?", `Bạn có chắc muốn xóa “${item.name}”? Thao tác này không thể hoàn tác.`, [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa quy trình",
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              await workflow.remove(item.id);
              if (selected?.id === item.id) {
                setSelected(null);
                setStepDetail(null);
              }
              setRevision((value) => value + 1);
            } catch (deleteError) {
              setError(messageOf(deleteError));
            }
          })();
        },
      },
    ]);
  };

  // Categories list
  const categories = useMemo(() => {
    const list = new Set<string>();
    items.forEach((item) => {
      if (item.category?.trim()) list.add(item.category.trim());
    });
    return ["Tất cả", ...Array.from(list)];
  }, [items]);

  // Quick statistics
  const stats = useMemo(() => {
    let totalSteps = 0;
    let totalDays = 0;
    items.forEach((item) => {
      totalSteps += (item.steps || []).length;
      (item.steps || []).forEach((step) => {
        if (typeof step.estDays === "number") totalDays += step.estDays;
      });
    });
    return {
      total: items.length,
      totalSteps,
      totalDays,
      categoriesCount: categories.length > 1 ? categories.length - 1 : 0,
    };
  }, [items, categories]);

  // Filtered workflows
  const filteredWorkflows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (selectedCategory !== "Tất cả" && item.category?.trim() !== selectedCategory) {
        return false;
      }
      if (!query) return true;
      const matchName = (item.name || "").toLowerCase().includes(query);
      const matchCategory = (item.category || "").toLowerCase().includes(query);
      const matchDesc = (item.description || "").toLowerCase().includes(query);
      const matchSteps = (item.steps || []).some(
        (step) =>
          (step.title || "").toLowerCase().includes(query) ||
          (step.description || "").toLowerCase().includes(query) ||
          (step.assignee || "").toLowerCase().includes(query),
      );
      return matchName || matchCategory || matchDesc || matchSteps;
    });
  }, [items, selectedCategory, searchQuery]);

  const handleBack = () => {
    if (selected) {
      setSelected(null);
      setStepDetail(null);
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/modules");
    }
  };

  if (!access.read || !scopeReady) {
    return (
      <SafeAreaView edges={["top"]} style={uiStyles.container}>
        <View style={uiStyles.headerBar}>
          <TouchableOpacity style={uiStyles.backBtn} onPress={handleBack} activeOpacity={0.7}>
            <ArrowLeft size={20} color="#0f172a" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={uiStyles.headerTitle}>Quy trình làm việc</Text>
          </View>
        </View>
        <View style={uiStyles.permissionBox}>
          <AlertCircle size={36} color="#d97706" style={{ marginBottom: 8 }} />
          <Text style={uiStyles.permissionTitle}>Chưa có quyền truy cập</Text>
          <Text style={uiStyles.permissionText}>
            Cần quyền xem quy trình và một chi nhánh hợp lệ để sử dụng chức năng này.
          </Text>
        </View>
        {alertView}
      </SafeAreaView>
    );
  }

  // Selected Workflow Detail View
  if (selected) {
    const totalDays = (selected.steps || []).reduce(
      (sum, s) => sum + (typeof s.estDays === "number" ? s.estDays : 0),
      0,
    );
    const totalSubTasks = (selected.steps || []).reduce(
      (sum, s) => sum + (s.subTasks?.length || 0),
      0,
    );

    return (
      <SafeAreaView edges={["top"]} style={uiStyles.container}>
        {/* Detail Top Header */}
        <View style={uiStyles.headerBar}>
          <TouchableOpacity
            style={uiStyles.backBtn}
            onPress={() => {
              setSelected(null);
              setStepDetail(null);
            }}
            activeOpacity={0.7}
          >
            <ArrowLeft size={20} color="#0f172a" />
          </TouchableOpacity>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={uiStyles.headerTitle} numberOfLines={1}>
              {selected.name || "Quy trình chưa đặt tên"}
            </Text>
            <Text style={uiStyles.headerSubtitle} numberOfLines={1}>
              {selected.category || "Quy trình làm việc"} · {selected.steps.length} bước
            </Text>
          </View>

          {access.manage && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <TouchableOpacity
                style={uiStyles.headerIconBtn}
                onPress={() => setEditing(selected)}
                activeOpacity={0.7}
              >
                <Pencil size={16} color="#0284c7" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[uiStyles.headerIconBtn, uiStyles.deleteIconBtn]}
                onPress={() => deleteWorkflow(selected)}
                activeOpacity={0.7}
              >
                <Trash2 size={16} color="#dc2626" />
              </TouchableOpacity>
            </View>
          )}
        </View>

        <ScrollView
          style={uiStyles.scroll}
          contentContainerStyle={uiStyles.content}
          showsVerticalScrollIndicator={false}
        >
          <ErrorText message={error} />

          {/* Workflow Overview Card */}
          <View style={uiStyles.overviewCard}>
            <View style={uiStyles.overviewTopRow}>
              <View style={uiStyles.workflowIconBox}>
                <WorkflowIcon size={24} color="#059669" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={uiStyles.categoryBadge}>
                  <Text style={uiStyles.categoryBadgeText}>
                    {selected.category || "Tiêu chuẩn vận hành"}
                  </Text>
                </View>
                <Text style={uiStyles.overviewTitle}>{selected.name}</Text>
              </View>
            </View>

            {!!selected.description && (
              <Text style={uiStyles.overviewDesc}>{selected.description}</Text>
            )}

            {/* Metric Pills */}
            <View style={uiStyles.detailStatsRow}>
              <View style={uiStyles.detailStatPill}>
                <Layers size={13} color="#059669" />
                <Text style={uiStyles.detailStatText}>{selected.steps.length} bước</Text>
              </View>
              <View style={uiStyles.detailStatPill}>
                <Clock size={13} color="#0284c7" />
                <Text style={uiStyles.detailStatText}>~{totalDays} ngày</Text>
              </View>
              <View style={uiStyles.detailStatPill}>
                <CheckCircle2 size={13} color="#7c3aed" />
                <Text style={uiStyles.detailStatText}>{totalSubTasks} việc con</Text>
              </View>
              <View style={uiStyles.detailStatPill}>
                <GitBranch size={13} color="#d97706" />
                <Text style={uiStyles.detailStatText}>
                  {(selected.edges || []).length} rẽ nhánh
                </Text>
              </View>
            </View>
          </View>

          {/* Stepper Roadmap Header */}
          <View style={uiStyles.sectionHeaderRow}>
            <Text style={uiStyles.sectionHeading}>
              Lộ trình thực hiện ({selected.steps.length} bước)
            </Text>
            <Text style={uiStyles.sectionMuted}>Chạm vào bước để xem chi tiết</Text>
          </View>

          {/* Stepper Timeline List */}
          {selected.steps.length > 0 ? (
            <View style={uiStyles.stepperContainer}>
              {selected.steps.map((step, index) => {
                const isLast = index === selected.steps.length - 1;
                const outgoing = (selected.edges || []).filter((e) => e.source === step.id);

                return (
                  <View key={step.id} style={uiStyles.timelineItem}>
                    {/* Left node & vertical track */}
                    <View style={uiStyles.timelineNodeCol}>
                      <View style={uiStyles.timelineCircle}>
                        <Text style={uiStyles.timelineNumberText}>{index + 1}</Text>
                      </View>
                      {!isLast && <View style={uiStyles.timelineLine} />}
                    </View>

                    {/* Right Step Card */}
                    <Pressable
                      accessibilityRole="button"
                      style={({ pressed }) => [
                        uiStyles.timelineCard,
                        pressed && { opacity: 0.8 },
                      ]}
                      onPress={() => setStepDetail({ step, index })}
                    >
                      <View style={uiStyles.stepCardHeader}>
                        <View style={{ flex: 1, gap: 4 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <Text style={uiStyles.stepCardTitle} numberOfLines={1}>
                              {step.title}
                            </Text>
                            {index === 0 && (
                              <View style={uiStyles.startBadge}>
                                <Text style={uiStyles.startBadgeText}>Bắt đầu</Text>
                              </View>
                            )}
                          </View>
                          {!!step.description && (
                            <Text style={uiStyles.stepCardDesc} numberOfLines={2}>
                              {step.description}
                            </Text>
                          )}
                        </View>
                        <ChevronRight size={18} color="#94a3b8" />
                      </View>

                      {/* Step Metadata Badges */}
                      <View style={uiStyles.stepBadgesRow}>
                        {!!step.assignee && (
                          <View style={uiStyles.stepBadge}>
                            <User size={11} color="#0284c7" />
                            <Text style={uiStyles.stepBadgeText} numberOfLines={1}>
                              {step.assignee}
                            </Text>
                          </View>
                        )}
                        {step.estDays !== undefined && (
                          <View style={uiStyles.stepBadge}>
                            <Clock size={11} color="#d97706" />
                            <Text style={uiStyles.stepBadgeText}>{step.estDays} ngày</Text>
                          </View>
                        )}
                        <View style={uiStyles.stepBadge}>
                          <CheckCircle2 size={11} color="#059669" />
                          <Text style={uiStyles.stepBadgeText}>
                            {step.subTasks?.length || 0} việc con
                          </Text>
                        </View>
                        {outgoing.length > 0 && (
                          <View style={uiStyles.stepBadge}>
                            <GitBranch size={11} color="#7c3aed" />
                            <Text style={uiStyles.stepBadgeText}>
                              {outgoing.length} hướng rẽ
                            </Text>
                          </View>
                        )}
                      </View>

                      {!!step.deliverable && (
                        <View style={uiStyles.deliverablePreviewRow}>
                          <Target size={12} color="#059669" />
                          <Text style={uiStyles.deliverablePreviewText} numberOfLines={1}>
                            Kết quả: {step.deliverable}
                          </Text>
                        </View>
                      )}
                    </Pressable>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={uiStyles.emptyStateContainer}>
              <Layers size={40} color="#94a3b8" style={{ marginBottom: 6 }} />
              <Text style={uiStyles.emptyStateTitle}>Quy trình chưa có bước nào</Text>
              <Text style={uiStyles.emptyStateDesc}>
                Bấm nút sửa quy trình để bổ sung các bước thực hiện.
              </Text>
            </View>
          )}
        </ScrollView>

        <StepDetailModal
          detail={stepDetail}
          steps={selected.steps}
          edges={selected.edges || []}
          onClose={() => setStepDetail(null)}
        />

        <WorkflowEditorModal
          editing={editing}
          formLock={formLock}
          onClose={closeEditor}
        />
        {alertView}
      </SafeAreaView>
    );
  }

  // Main Workflow List View
  return (
    <SafeAreaView edges={["top"]} style={uiStyles.container}>
      <ScrollView
        style={uiStyles.scroll}
        contentContainerStyle={uiStyles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void loadData(true);
              setRevision((v) => v + 1);
            }}
            colors={["#059669"]}
            tintColor="#059669"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Top Header */}
        <View style={uiStyles.headerBarPlain}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
            <TouchableOpacity style={uiStyles.backBtn} onPress={handleBack} activeOpacity={0.7}>
              <ArrowLeft size={20} color="#0f172a" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={uiStyles.headerTitle}>Quy trình làm việc</Text>
              <View style={uiStyles.branchRow}>
                <View style={uiStyles.branchDot} />
                <Text style={uiStyles.branchName}>
                  {selectedBranch?.name || "LuxCare"} · {items.length} quy trình
                </Text>
              </View>
            </View>
          </View>

          <View style={uiStyles.headerRightActions}>
            <TouchableOpacity
              style={uiStyles.refreshBtn}
              onPress={() => setRevision((v) => v + 1)}
              disabled={loading}
              activeOpacity={0.7}
            >
              <RotateCw size={17} color="#475569" />
            </TouchableOpacity>

            {access.manage && (
              <TouchableOpacity
                style={uiStyles.createBtn}
                onPress={() => setEditing("new")}
                activeOpacity={0.8}
              >
                <Plus size={16} color="#ffffff" />
                <Text style={uiStyles.createBtnText}>Tạo quy trình</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Quick Metrics Banner */}
        <View style={uiStyles.summaryRow}>
          <View style={[uiStyles.summaryCard, { borderLeftColor: "#059669" }]}>
            <Text style={[uiStyles.summaryValue, { color: "#059669" }]}>{stats.total}</Text>
            <Text style={uiStyles.summaryLabel}>Quy trình</Text>
          </View>

          <View style={[uiStyles.summaryCard, { borderLeftColor: "#0284c7" }]}>
            <Text style={[uiStyles.summaryValue, { color: "#0284c7" }]}>
              {stats.totalSteps}
            </Text>
            <Text style={uiStyles.summaryLabel}>Bước làm</Text>
          </View>

          <View style={[uiStyles.summaryCard, { borderLeftColor: "#7c3aed" }]}>
            <Text style={[uiStyles.summaryValue, { color: "#7c3aed" }]}>
              ~{stats.totalDays}d
            </Text>
            <Text style={uiStyles.summaryLabel}>Thời lượng</Text>
          </View>

          <View style={[uiStyles.summaryCard, { borderLeftColor: "#d97706" }]}>
            <Text style={[uiStyles.summaryValue, { color: "#d97706" }]}>
              {stats.categoriesCount}
            </Text>
            <Text style={uiStyles.summaryLabel}>Nhóm loại</Text>
          </View>
        </View>

        {/* Search Box */}
        <View style={uiStyles.searchContainer}>
          <Search size={17} color="#64748b" style={{ marginRight: 8 }} />
          <TextInput
            style={uiStyles.searchInput}
            placeholder="Tìm theo tên quy trình, mô tả, các bước..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
              style={{ padding: 4 }}
              activeOpacity={0.6}
            >
              <XCircle size={17} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>

        {/* Category Filter Chips */}
        {categories.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={uiStyles.filterChipsRow}
          >
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  style={[uiStyles.filterChip, isSelected && uiStyles.filterChipActive]}
                  onPress={() => setSelectedCategory(cat)}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      uiStyles.filterChipText,
                      isSelected && uiStyles.filterChipTextActive,
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Error Banner */}
        <ErrorText message={error} />

        {/* Loading Indicator */}
        {loading && !items.length && <Loading />}

        {/* Empty State */}
        {!loading && !error && filteredWorkflows.length === 0 && (
          <View style={uiStyles.emptyStateContainer}>
            <WorkflowIcon size={44} color="#059669" style={{ marginBottom: 8 }} />
            <Text style={uiStyles.emptyStateTitle}>Không tìm thấy quy trình</Text>
            <Text style={uiStyles.emptyStateDesc}>
              {searchQuery
                ? `Không có quy trình nào khớp với từ khóa "${searchQuery}".`
                : selectedCategory !== "Tất cả"
                ? `Chưa có quy trình nào trong nhóm "${selectedCategory}".`
                : "Chưa có quy trình làm việc nào được khai báo trong chi nhánh."}
            </Text>
            {(searchQuery || selectedCategory !== "Tất cả") ? (
              <TouchableOpacity
                style={uiStyles.resetFilterBtn}
                onPress={() => {
                  setSearchQuery("");
                  setSelectedCategory("Tất cả");
                }}
                activeOpacity={0.7}
              >
                <Text style={uiStyles.resetFilterText}>Xóa bộ lọc</Text>
              </TouchableOpacity>
            ) : (
              access.manage && (
                <TouchableOpacity
                  style={uiStyles.createFirstBtn}
                  onPress={() => setEditing("new")}
                  activeOpacity={0.8}
                >
                  <Plus size={16} color="#ffffff" />
                  <Text style={uiStyles.createFirstBtnText}>Tạo quy trình đầu tiên</Text>
                </TouchableOpacity>
              )
            )}
          </View>
        )}

        {/* Workflow Cards */}
        {filteredWorkflows.map((item) => {
          const totalDays = (item.steps || []).reduce(
            (sum, s) => sum + (typeof s.estDays === "number" ? s.estDays : 0),
            0,
          );
          const assignees = new Set<string>();
          (item.steps || []).forEach((s) => {
            if (s.assignee?.trim()) assignees.add(s.assignee.trim());
          });

          return (
            <View key={item.id} style={uiStyles.workflowCard}>
              {/* Card Top Row */}
              <View style={uiStyles.cardTopRow}>
                <View style={uiStyles.workflowIconBox}>
                  <WorkflowIcon size={22} color="#059669" />
                </View>

                <View style={{ flex: 1 }}>
                  <View style={uiStyles.badgeGroup}>
                    <View style={uiStyles.categoryBadge}>
                      <Text style={uiStyles.categoryBadgeText}>
                        {item.category || "Quy trình"}
                      </Text>
                    </View>
                  </View>
                  <Text style={uiStyles.workflowTitle} numberOfLines={2}>
                    {item.name || "(Chưa đặt tên quy trình)"}
                  </Text>
                </View>
              </View>

              {/* Description */}
              {!!item.description && (
                <Text style={uiStyles.workflowDesc} numberOfLines={2}>
                  {item.description}
                </Text>
              )}

              {/* 4-Item Metadata Grid */}
              <View style={uiStyles.metaGrid}>
                <View style={uiStyles.metaItem}>
                  <Layers size={13} color="#64748b" />
                  <Text style={uiStyles.metaItemText}>{item.steps.length} bước</Text>
                </View>
                <View style={uiStyles.metaItem}>
                  <Clock size={13} color="#64748b" />
                  <Text style={uiStyles.metaItemText}>~{totalDays} ngày</Text>
                </View>
                <View style={uiStyles.metaItem}>
                  <Users size={13} color="#64748b" />
                  <Text style={uiStyles.metaItemText} numberOfLines={1}>
                    {assignees.size ? `${assignees.size} người thực hiện` : "Chưa phân công"}
                  </Text>
                </View>
                <View style={uiStyles.metaItem}>
                  <GitBranch size={13} color="#64748b" />
                  <Text style={uiStyles.metaItemText}>
                    {(item.edges || []).length} hướng xử lý
                  </Text>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={uiStyles.cardActionRow}>
                <TouchableOpacity
                  style={uiStyles.primaryActionBtn}
                  onPress={() => setSelected(item)}
                  activeOpacity={0.8}
                >
                  <Eye size={15} color="#ffffff" />
                  <Text style={uiStyles.primaryActionBtnText}>Xem chi tiết quy trình</Text>
                </TouchableOpacity>

                {access.manage && (
                  <TouchableOpacity
                    style={uiStyles.iconActionBtn}
                    onPress={() => setEditing(item)}
                    activeOpacity={0.7}
                  >
                    <Pencil size={16} color="#475569" />
                  </TouchableOpacity>
                )}

                {access.manage && (
                  <TouchableOpacity
                    style={[uiStyles.iconActionBtn, uiStyles.deleteIconBtn]}
                    onPress={() => deleteWorkflow(item)}
                    activeOpacity={0.7}
                  >
                    <Trash2 size={16} color="#dc2626" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Editor Modal */}
      <WorkflowEditorModal
        editing={editing}
        formLock={formLock}
        onClose={closeEditor}
      />
      {alertView}
    </SafeAreaView>
  );
}

function WorkflowEditorModal({
  editing,
  formLock,
  onClose,
}: {
  editing: Workflow | "new" | null;
  formLock: MutableRefObject<boolean>;
  onClose: () => void;
}) {
  return (
    <Modal visible={editing !== null} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f8fafc" }}>
        {editing && (
          <WorkflowForm
            initialWorkflow={editing === "new" ? undefined : editing}
            setLocked={(value) => {
              formLock.current = value;
            }}
            onClose={onClose}
            onSaved={onClose}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

function StepDetailModal({
  detail,
  steps,
  edges,
  onClose,
}: {
  detail: { step: WorkflowStep; index: number } | null;
  steps: WorkflowStep[];
  edges: WorkflowEdge[];
  onClose: () => void;
}) {
  const step = detail?.step;
  const outgoing = step ? edges.filter((edge) => edge.source === step.id) : [];

  return (
    <Modal visible={!!step} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f8fafc" }}>
        {step && (
          <View style={{ flex: 1 }}>
            {/* Modal Header */}
            <View style={modalStyles.headerBar}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={modalStyles.stepIndexTag}>
                    BƯỚC {(detail?.index ?? 0) + 1}
                  </Text>
                  {detail?.index === 0 && (
                    <View style={uiStyles.startBadge}>
                      <Text style={uiStyles.startBadgeText}>Khởi đầu</Text>
                    </View>
                  )}
                </View>
                <Text style={modalStyles.headerTitle} numberOfLines={2}>
                  {step.title}
                </Text>
              </View>
              <TouchableOpacity
                style={modalStyles.closeBtn}
                onPress={onClose}
                hitSlop={8}
                activeOpacity={0.7}
              >
                <X size={20} color="#475569" />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={modalStyles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* General Step Info Card */}
              <View style={modalStyles.card}>
                <Text style={modalStyles.cardHeading}>Thông tin cơ bản</Text>

                <View style={modalStyles.infoGrid}>
                  <View style={modalStyles.infoCol}>
                    <Text style={modalStyles.infoLabel}>Người / Nhóm phụ trách</Text>
                    <View style={modalStyles.infoValRow}>
                      <User size={14} color="#0284c7" />
                      <Text style={modalStyles.infoValText}>
                        {step.assignee || "Chưa chỉ định"}
                      </Text>
                    </View>
                  </View>

                  <View style={modalStyles.infoCol}>
                    <Text style={modalStyles.infoLabel}>Thời lượng ước tính</Text>
                    <View style={modalStyles.infoValRow}>
                      <Clock size={14} color="#d97706" />
                      <Text style={modalStyles.infoValText}>
                        {step.estDays !== undefined ? `${step.estDays} ngày` : "Linh hoạt"}
                      </Text>
                    </View>
                  </View>
                </View>

                {!!step.description && (
                  <View style={{ marginTop: 6 }}>
                    <Text style={modalStyles.infoLabel}>Hướng dẫn chi tiết</Text>
                    <Text style={modalStyles.descText}>{step.description}</Text>
                  </View>
                )}
              </View>

              {/* Deliverables / Kết quả cần đạt */}
              {!!step.deliverable && (
                <View style={[modalStyles.card, modalStyles.deliverableCard]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Target size={16} color="#059669" />
                    <Text style={modalStyles.deliverableTitle}>Kết quả cần đạt</Text>
                  </View>
                  <Text style={modalStyles.deliverableText}>{step.deliverable}</Text>
                </View>
              )}

              {/* Note / Lưu ý */}
              {!!step.note && (
                <View style={[modalStyles.card, modalStyles.noteCard]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <AlertCircle size={16} color="#d97706" />
                    <Text style={modalStyles.noteTitle}>Lưu ý quan trọng</Text>
                  </View>
                  <Text style={modalStyles.noteText}>{step.note}</Text>
                </View>
              )}

              {/* SubTasks */}
              {!!step.subTasks?.length && (
                <View style={modalStyles.card}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <CheckCircle2 size={16} color="#059669" />
                    <Text style={modalStyles.cardHeading}>
                      Công việc cần làm ({step.subTasks.length})
                    </Text>
                  </View>
                  <View style={{ gap: 8, marginTop: 4 }}>
                    {step.subTasks.map((task) => (
                      <View key={task.id} style={modalStyles.subTaskRow}>
                        <Check size={14} color="#059669" />
                        <Text style={modalStyles.subTaskText}>{task.title}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Branching Logic */}
              {!!outgoing.length && (
                <View style={modalStyles.card}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <GitBranch size={16} color="#7c3aed" />
                    <Text style={modalStyles.cardHeading}>
                      Hướng xử lý & rẽ nhánh ({outgoing.length})
                    </Text>
                  </View>
                  <View style={{ gap: 8, marginTop: 4 }}>
                    {outgoing.map((edge) => {
                      const targetStep = steps.find((c) => c.id === edge.target);
                      return (
                        <View key={edge.id} style={modalStyles.branchItemRow}>
                          <View style={modalStyles.branchBadge}>
                            <Text style={modalStyles.branchBadgeText}>{edge.label}</Text>
                          </View>
                          <ArrowRight size={14} color="#64748b" />
                          <Text style={modalStyles.branchTargetText} numberOfLines={1}>
                            {targetStep ? targetStep.title : "Bước tiếp theo"}
                          </Text>
                          {edge.isDefault && (
                            <View style={modalStyles.defaultPill}>
                              <Text style={modalStyles.defaultPillText}>Mặc định</Text>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Attachments */}
              {!!step.attachments?.length && (
                <View style={modalStyles.card}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Paperclip size={16} color="#0284c7" />
                    <Text style={modalStyles.cardHeading}>
                      Tệp đính kèm ({step.attachments.length})
                    </Text>
                  </View>
                  <View style={{ gap: 6, marginTop: 4 }}>
                    {step.attachments.map((attachment) => (
                      <AttachmentRow key={attachment.id} attachment={attachment} />
                    ))}
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

function AttachmentRow({ attachment }: { attachment: TaskAttachment }) {
  const { showAlert, alertView } = useAppAlert();
  return (
    <>
      <Pressable
        accessibilityRole="button"
        style={modalStyles.attachmentRow}
        onPress={() => {
          try {
            const url = new URL(attachment.url);
            if (!["http:", "https:"].includes(url.protocol)) {
              throw new Error("Đường dẫn không được hỗ trợ.");
            }
            if (attachment.type === "link") {
              void Linking.openURL(url.toString());
            } else {
              void shareApiFile(attachment.url, attachment.name).catch((err) => {
                showAlert(
                  "Không thể tải tệp",
                  err instanceof Error ? err.message : "Vui lòng thử lại.",
                  undefined,
                  "error",
                );
              });
            }
          } catch {
            showAlert("Không thể mở tệp", "Đường dẫn đính kèm không hợp lệ.", undefined, "error");
          }
        }}
      >
        <View style={modalStyles.attachmentIconBox}>
          {attachment.type === "link" ? (
            <ExternalLink size={16} color="#0284c7" />
          ) : (
            <FileText size={16} color="#059669" />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={modalStyles.attachmentName} numberOfLines={1}>
            {attachment.name}
          </Text>
          <Text style={modalStyles.attachmentUrl} numberOfLines={1}>
            {attachment.url}
          </Text>
        </View>
        <Text style={modalStyles.attachmentOpen}>Mở</Text>
      </Pressable>
      {alertView}
    </>
  );
}

const uiStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
    gap: 14,
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    gap: 12,
  },
  headerBarPlain: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingBottom: 2,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.3,
    fontFamily: "Inter-Bold",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  branchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  branchDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#059669",
  },
  branchName: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "500",
  },
  headerRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#059669",
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 12,
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  createBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  headerIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteIconBtn: {
    backgroundColor: "#fff1f2",
    borderColor: "#fecdd3",
  },
  summaryRow: {
    flexDirection: "row",
    gap: 8,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderLeftWidth: 3.5,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: "800",
    fontFamily: "Inter-Bold",
  },
  summaryLabel: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
    fontWeight: "500",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#0f172a",
    padding: 0,
  },
  filterChipsRow: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 2,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  filterChipActive: {
    backgroundColor: "#059669",
    borderColor: "#059669",
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
  },
  filterChipTextActive: {
    color: "#ffffff",
    fontWeight: "700",
  },
  emptyStateContainer: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 8,
  },
  emptyStateTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 4,
  },
  emptyStateDesc: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 280,
  },
  resetFilterBtn: {
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
  },
  resetFilterText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  createFirstBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#059669",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 14,
  },
  createFirstBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  workflowCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 15,
    gap: 12,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  workflowIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#a7f3d0",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeGroup: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  categoryBadge: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  categoryBadgeText: {
    color: "#059669",
    fontSize: 11,
    fontWeight: "700",
  },
  workflowTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    lineHeight: 22,
    fontFamily: "Inter-SemiBold",
  },
  workflowDesc: {
    fontSize: 12,
    color: "#64748b",
    lineHeight: 18,
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    backgroundColor: "#f8fafc",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    width: "47%",
  },
  metaItemText: {
    fontSize: 12,
    color: "#475569",
    fontWeight: "500",
  },
  cardActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 4,
  },
  primaryActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#059669",
    paddingVertical: 10,
    borderRadius: 10,
  },
  primaryActionBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  iconActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  permissionBox: {
    backgroundColor: "#ffffff",
    margin: 16,
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#fed7aa",
    alignItems: "center",
  },
  permissionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#9a3412",
    marginBottom: 4,
  },
  permissionText: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 20,
  },
  // Overview Card (Detail View)
  overviewCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 16,
    gap: 12,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  overviewTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  overviewTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0f172a",
    marginTop: 2,
  },
  overviewDesc: {
    fontSize: 13,
    color: "#475569",
    lineHeight: 20,
  },
  detailStatsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  detailStatPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#f8fafc",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  detailStatText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
  },
  sectionHeaderRow: {
    marginTop: 6,
    marginBottom: 2,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.2,
  },
  sectionMuted: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  // Stepper Roadmap
  stepperContainer: {
    paddingLeft: 4,
    gap: 2,
  },
  timelineItem: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 12,
  },
  timelineNodeCol: {
    width: 32,
    alignItems: "center",
  },
  timelineCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#ecfdf5",
    borderWidth: 1.5,
    borderColor: "#10b981",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  timelineNumberText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#059669",
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: "#cbd5e1",
    marginVertical: 3,
  },
  timelineCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 13,
    gap: 8,
    marginBottom: 12,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  stepCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  stepCardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
  },
  startBadge: {
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  startBadgeText: {
    color: "#059669",
    fontSize: 10,
    fontWeight: "700",
  },
  stepCardDesc: {
    fontSize: 12,
    color: "#64748b",
    lineHeight: 18,
  },
  stepBadgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  stepBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#f8fafc",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  stepBadgeText: {
    fontSize: 11,
    color: "#475569",
  },
  deliverablePreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#f0fdf4",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  deliverablePreviewText: {
    fontSize: 11,
    color: "#166534",
    fontWeight: "500",
    flex: 1,
  },
});

const modalStyles = StyleSheet.create({
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    gap: 12,
  },
  stepIndexTag: {
    fontSize: 11,
    fontWeight: "800",
    color: "#059669",
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0f172a",
    fontFamily: "Inter-Bold",
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    padding: 16,
    gap: 14,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 16,
    gap: 10,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  cardHeading: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
    fontFamily: "Inter-SemiBold",
  },
  infoGrid: {
    flexDirection: "row",
    gap: 12,
  },
  infoCol: {
    flex: 1,
    backgroundColor: "#f8fafc",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  infoLabel: {
    fontSize: 11,
    color: "#64748b",
    marginBottom: 4,
  },
  infoValRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  infoValText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
  },
  descText: {
    fontSize: 13,
    color: "#334155",
    lineHeight: 20,
    marginTop: 2,
  },
  deliverableCard: {
    backgroundColor: "#f0fdf4",
    borderColor: "#bbf7d0",
  },
  deliverableTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#166534",
  },
  deliverableText: {
    fontSize: 13,
    color: "#15803d",
    lineHeight: 19,
  },
  noteCard: {
    backgroundColor: "#fffbeb",
    borderColor: "#fde68a",
  },
  noteTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#b45309",
  },
  noteText: {
    fontSize: 13,
    color: "#92400e",
    lineHeight: 19,
  },
  subTaskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  subTaskText: {
    fontSize: 13,
    color: "#334155",
    flex: 1,
  },
  branchItemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  branchBadge: {
    backgroundColor: "#f5f3ff",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#ddd6fe",
  },
  branchBadgeText: {
    color: "#7c3aed",
    fontSize: 11,
    fontWeight: "700",
  },
  branchTargetText: {
    fontSize: 13,
    color: "#0f172a",
    fontWeight: "500",
    flex: 1,
  },
  defaultPill: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  defaultPillText: {
    fontSize: 10,
    color: "#64748b",
  },
  attachmentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  attachmentIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  attachmentName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
  },
  attachmentUrl: {
    fontSize: 11,
    color: "#64748b",
  },
  attachmentOpen: {
    fontSize: 12,
    fontWeight: "700",
    color: "#059669",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "#ecfdf5",
  },
});
