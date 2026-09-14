import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAppAlert } from "../../src/components/AppAlert";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import type { RecruitmentApplicant, RecruitmentJob, RecruitmentPipeline } from "../../../src/types/recruitment";
import {
  Briefcase,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Eye,
  Flag,
  LayoutGrid,
  List,
  Mail,
  Phone,
  Pin,
  Plus,
  Search,
  Users,
  X,
} from "lucide-react-native";
import { emptyPagination, type PaginationMeta } from "../../../src/types/pagination";
import { recruitment } from "../../src/api/services";
import { messageOf, useSession } from "../../src/auth/SessionProvider";
import { EmptyState, ErrorText, Loading, Page } from "../../src/ui";
import { ChoiceField } from "../../src/features/leave/ChoiceField";
import { ApplicantDetail } from "../../src/features/recruitment/ApplicantDetail";
import { ApplicantForm } from "../../src/features/recruitment/ApplicantForm";
import { RecruitmentGate } from "../../src/features/recruitment/RecruitmentGate";
import { RecruitmentSubnav } from "../../src/features/recruitment/RecruitmentSubnav";
import { OUTCOME_CHOICES, formatOutcome } from "../../src/features/recruitment/recruitmentModel";
import { recruitmentAccess } from "../../src/features/recruitment/access";

function Pagination({ meta, onChange }: { meta: PaginationMeta; onChange: (page: number) => void }) {
  if (meta.totalPages <= 1) return null;
  return (
    <View style={appStyles.paginationRow}>
      <Pressable
        style={[appStyles.pageBtn, meta.page <= 1 && appStyles.pageBtnDisabled, { flexDirection: "row", alignItems: "center" }]}
        disabled={meta.page <= 1}
        onPress={() => onChange(meta.page - 1)}
      >
        <ChevronLeft size={14} color={meta.page <= 1 ? "#94a3b8" : "#059669"} style={{ marginRight: 2 }} />
        <Text style={appStyles.pageBtnText}>Trước</Text>
      </Pressable>
      <Text style={appStyles.pageInfo}>
        Trang {meta.page}/{meta.totalPages} ({meta.total} hồ sơ)
      </Text>
      <Pressable
        style={[appStyles.pageBtn, meta.page >= meta.totalPages && appStyles.pageBtnDisabled, { flexDirection: "row", alignItems: "center" }]}
        disabled={meta.page >= meta.totalPages}
        onPress={() => onChange(meta.page + 1)}
      >
        <Text style={appStyles.pageBtnText}>Sau</Text>
        <ChevronRight size={14} color={meta.page >= meta.totalPages ? "#94a3b8" : "#059669"} style={{ marginLeft: 2 }} />
      </Pressable>
    </View>
  );
}

export default function Applicants() {
  const { showAlert, alertView } = useAppAlert();
  const { user, selectedBranch } = useSession();
  const access = recruitmentAccess(user);
  const params = useLocalSearchParams<{ jobId?: string }>();
  const jobId = typeof params.jobId === "string" ? params.jobId : "";
  const scopeReady = Boolean(user?.companyCode || selectedBranch?._id || user?.branchId);

  const [rows, setRows] = useState<RecruitmentApplicant[]>([]);
  const [jobs, setJobs] = useState<RecruitmentJob[]>([]);
  const [pipeline, setPipeline] = useState<RecruitmentPipeline | null>(null);
  const [pagination, setPagination] = useState(emptyPagination);
  const [page, setPage] = useState(1);
  const [draftSearch, setDraftSearch] = useState("");
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("");
  const [outcome, setOutcome] = useState("");
  const [mode, setMode] = useState<"list" | "kanban">("list");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<RecruitmentApplicant | "new" | null>(null);
  const [selected, setSelected] = useState<RecruitmentApplicant | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!access.read || !scopeReady) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const [applicantPage, jobRows, nextPipeline] = await Promise.all([
          recruitment.listApplicantsPage({
            page,
            limit: 20,
            search,
            stageId: stage,
            outcome,
            ...(jobId ? { jobId } : {}),
          }),
          recruitment.listJobs({ limit: 100 }).catch(() => [] as RecruitmentJob[]),
          recruitment.getPipeline().catch(() => null),
        ]);
        setRows(applicantPage.data);
        setPagination(applicantPage.pagination);
        setJobs(jobRows);
        setPipeline(nextPipeline);
      } catch (err) {
        setError(messageOf(err));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [access.read, jobId, outcome, page, search, scopeReady, stage],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const handleSeedDemoApplicants = async () => {
    if (seeding || !access.manage) return;
    setSeeding(true);
    try {
      let activeJobs = jobs;
      if (!activeJobs || activeJobs.length === 0) {
        // Create a default job first if none exists
        const newJob = await recruitment.createJob({
          code: `TD-${Date.now().toString().slice(-4)}`,
          title: "Bác sĩ Chuyên khoa",
          department: "Khám bệnh",
          headcount: 2,
          employmentType: "full_time",
          workplaceType: "onsite",
          location: selectedBranch?.name || "Cơ sở chính",
          salaryMin: 25000000,
          salaryMax: 35000000,
          showSalary: true,
          status: "open",
        });
        activeJobs = [newJob];
        setJobs(activeJobs);
      }

      const defaultJobId = activeJobs[0]._id;
      const defaultStageId = pipeline?.stages?.[0]?.id || "";

      await recruitment.createApplicant({
        jobId: defaultJobId,
        fullName: "Nguyễn Văn An",
        email: "nguyenvanan.bs@gmail.com",
        phone: "0912345678",
        source: "Website tuyển dụng",
        stageId: defaultStageId,
        confirmDuplicate: true,
      });

      await recruitment.createApplicant({
        jobId: defaultJobId,
        fullName: "Trần Thị Mai",
        email: "tranmai.dieuduong@gmail.com",
        phone: "0987654321",
        source: "Giới thiệu nội bộ",
        stageId: defaultStageId,
        confirmDuplicate: true,
      });

      await recruitment.createApplicant({
        jobId: defaultJobId,
        fullName: "Lê Hoàng Long",
        email: "long.duocsi@gmail.com",
        phone: "0905123456",
        source: "LinkedIn",
        stageId: defaultStageId,
        confirmDuplicate: true,
      });

      await load();
      showAlert("Thành công", "Đã tạo 3 hồ sơ ứng viên mẫu thành công.", [{ text: "Đóng" }], "success");
    } catch (err) {
      setError(messageOf(err));
      showAlert("Không thể tạo dữ liệu mẫu", messageOf(err), [{ text: "Đã hiểu" }], "error");
    } finally {
      setSeeding(false);
    }
  };

  const move = async (applicant: RecruitmentApplicant, nextStage: string) => {
    if (!access.manage || nextStage === applicant.stageId) return;
    setBusyId(applicant._id);
    try {
      await recruitment.transitionApplicant(applicant._id, applicant.version, nextStage);
      await load();
      showAlert("Thành công", `Đã chuyển ứng viên ${applicant.fullName} sang giai đoạn mới.`, [{ text: "Đóng" }], "success");
    } catch (err) {
      setError(messageOf(err));
      showAlert("Không thể chuyển giai đoạn", messageOf(err), [{ text: "Đã hiểu" }], "error");
    } finally {
      setBusyId(null);
    }
  };

  const stageChoices =
    pipeline?.stages
      .filter((item) => item.isActive)
      .map((item) => ({ value: item.id, label: item.name })) || [];

  const getOutcomeBadge = (appOutcome: string) => {
    switch (appOutcome) {
      case "hire":
      case "hired":
        return { label: "Đã tuyển", bg: "#ecfdf5", color: "#047857", border: "#a7f3d0" };
      case "pass":
      case "passed":
        return { label: "Đạt", bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" };
      case "reject":
      case "rejected":
        return { label: "Không đạt", bg: "#fff1f2", color: "#be123c", border: "#fecdd3" };
      default:
        return { label: "Chờ xét", bg: "#f8fafc", color: "#64748b", border: "#e2e8f0" };
    }
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  if (!access.read) {
    return (
      <Page title="Hồ sơ ứng viên">
        <RecruitmentSubnav active="applicants" />
        <EmptyState
          message="Không có quyền truy cập"
          subtitle="Tài khoản của bạn cần có quyền đọc phân hệ Tuyển dụng / HR."
        />
      </Page>
    );
  }

  return (
    <>
      <SafeAreaView style={appStyles.safeContainer} edges={["top"]}>
        <ScrollView
          style={appStyles.scroll}
          contentContainerStyle={appStyles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void load(true)}
              colors={["#059669"]}
              tintColor="#059669"
            />
          }
        >
          {/* Header Bar with Back Button */}
          <View style={appStyles.headerRow}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
              <Pressable
                onPress={() => (router.canGoBack() ? router.back() : router.push("/(tabs)/recruitment"))}
                style={appStyles.backBtn}
              >
                <ChevronLeft size={20} color="#334155" />
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={appStyles.headerTitle}>Hồ sơ ứng viên</Text>
                <Text style={appStyles.headerSub}>
                  {selectedBranch?.name || user?.branchName || "Toàn công ty"} · {pagination.total || rows.length} hồ sơ
                </Text>
              </View>
            </View>

            {access.manage && (
              <Pressable
                style={({ pressed }) => [appStyles.addBtn, { flexDirection: "row", alignItems: "center" }, pressed && { opacity: 0.8 }]}
                onPress={() => setEditing("new")}
              >
                <Plus size={14} color="#ffffff" style={{ marginRight: 4 }} />
                <Text style={appStyles.addBtnText}>Thêm</Text>
              </Pressable>
            )}
          </View>

          {/* Sub Navigation Bar */}
          <RecruitmentSubnav active="applicants" />

          {/* Filter By Job notice if active */}
          {!!jobId && (
            <View style={appStyles.jobFilterBadge}>
              <View style={{ flexDirection: "row", alignItems: "center", flex: 1, gap: 4 }}>
                <Pin size={13} color="#047857" />
                <Text style={appStyles.jobFilterText}>
                  Đang lọc theo tin: <Text style={{ fontWeight: "700" }}>{jobs.find((j) => j._id === jobId)?.title || jobId}</Text>
                </Text>
              </View>
              <Pressable
                style={{ flexDirection: "row", alignItems: "center", gap: 3 }}
                onPress={() => router.setParams({ jobId: "" })}
              >
                <X size={12} color="#be123c" />
                <Text style={appStyles.jobFilterClear}>Xem tất cả</Text>
              </Pressable>
            </View>
          )}

          {/* Search Box */}
          <View style={appStyles.searchContainer}>
            <Search size={16} color="#94a3b8" />
            <TextInput
              style={appStyles.searchInput}
              placeholder="Tìm theo tên, email, số điện thoại..."
              placeholderTextColor="#94a3b8"
              value={draftSearch}
              onChangeText={setDraftSearch}
              onSubmitEditing={() => {
                setSearch(draftSearch.trim());
                setPage(1);
              }}
              returnKeyType="search"
            />
            {draftSearch.length > 0 && (
              <Pressable
                onPress={() => {
                  setDraftSearch("");
                  setSearch("");
                  setPage(1);
                }}
                style={appStyles.clearSearchBtn}
              >
                <X size={14} color="#94a3b8" />
              </Pressable>
            )}
            <Pressable
              style={appStyles.searchBtn}
              onPress={() => {
                setSearch(draftSearch.trim());
                setPage(1);
              }}
            >
              <Text style={appStyles.searchBtnText}>Tìm</Text>
            </Pressable>
          </View>

          {/* View Mode & Filter Row */}
          <View style={appStyles.toolsRow}>
            <View style={appStyles.modePill}>
              <Pressable
                style={[appStyles.modeBtn, mode === "list" && appStyles.modeBtnActive, { flexDirection: "row", alignItems: "center", gap: 4 }]}
                onPress={() => setMode("list")}
              >
                <List size={13} color={mode === "list" ? "#047857" : "#64748b"} />
                <Text style={[appStyles.modeBtnText, mode === "list" && appStyles.modeBtnTextActive]}>
                  Danh sách
                </Text>
              </Pressable>
              <Pressable
                style={[appStyles.modeBtn, mode === "kanban" && appStyles.modeBtnActive, { flexDirection: "row", alignItems: "center", gap: 4 }]}
                onPress={() => setMode("kanban")}
              >
                <LayoutGrid size={13} color={mode === "kanban" ? "#047857" : "#64748b"} />
                <Text style={[appStyles.modeBtnText, mode === "kanban" && appStyles.modeBtnTextActive]}>
                  Kanban
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Stage Filter Chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={appStyles.chipsScroll}>
            <Pressable
              style={[appStyles.filterChip, stage === "" && appStyles.filterChipActive]}
              onPress={() => {
                setStage("");
                setPage(1);
              }}
            >
              <Text style={[appStyles.filterChipText, stage === "" && appStyles.filterChipTextActive]}>
                Tất cả giai đoạn
              </Text>
            </Pressable>
            {stageChoices.map((choice) => (
              <Pressable
                key={choice.value}
                style={[appStyles.filterChip, stage === choice.value && appStyles.filterChipActive]}
                onPress={() => {
                  setStage(choice.value);
                  setPage(1);
                }}
              >
                <Text style={[appStyles.filterChipText, stage === choice.value && appStyles.filterChipTextActive]}>
                  {choice.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Outcome Filter Chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={appStyles.chipsScroll}>
            <Pressable
              style={[appStyles.filterChip, outcome === "" && appStyles.filterChipActive]}
              onPress={() => {
                setOutcome("");
                setPage(1);
              }}
            >
              <Text style={[appStyles.filterChipText, outcome === "" && appStyles.filterChipTextActive]}>
                Tất cả kết quả
              </Text>
            </Pressable>
            {OUTCOME_CHOICES.map((choice) => (
              <Pressable
                key={choice.value}
                style={[appStyles.filterChip, outcome === choice.value && appStyles.filterChipActive]}
                onPress={() => {
                  setOutcome(choice.value);
                  setPage(1);
                }}
              >
                <Text style={[appStyles.filterChipText, outcome === choice.value && appStyles.filterChipTextActive]}>
                  {choice.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <ErrorText message={error} />
          {loading && <Loading />}

          {/* List View */}
          {!loading && mode === "list" && rows.length > 0 && (
            <View style={{ gap: 10 }}>
              {rows.map((applicant) => {
                const outcomeBadge = getOutcomeBadge(applicant.outcome);
                const appliedJob = jobs.find((j) => j._id === applicant.jobId);
                const currentStageName =
                  pipeline?.stages.find((s) => s.id === applicant.stageId)?.name || "Chưa xác định";

                return (
                  <View key={applicant._id} style={appStyles.applicantCard}>
                    <View style={appStyles.cardHeaderRow}>
                      <View style={appStyles.avatarCircle}>
                        <Text style={appStyles.avatarText}>{getInitials(applicant.fullName)}</Text>
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={appStyles.applicantName}>{applicant.fullName}</Text>
                        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 2 }}>
                          {applicant.phone ? (
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                              <Phone size={11} color="#64748b" />
                              <Text style={appStyles.applicantContact}>{applicant.phone}</Text>
                            </View>
                          ) : null}
                          {applicant.email ? (
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                              <Mail size={11} color="#64748b" />
                              <Text style={appStyles.applicantContact}>{applicant.email}</Text>
                            </View>
                          ) : null}
                        </View>
                      </View>
                      <View
                        style={[
                          appStyles.badgePill,
                          {
                            backgroundColor: outcomeBadge.bg,
                            borderColor: outcomeBadge.border,
                          },
                        ]}
                      >
                        <Text style={[appStyles.badgePillText, { color: outcomeBadge.color }]}>
                          {outcomeBadge.label}
                        </Text>
                      </View>
                    </View>

                    {/* Job & Stage details */}
                    <View style={appStyles.cardInfoRow}>
                      <View style={appStyles.infoItem}>
                        <Text style={appStyles.infoLabel}>Vị trí ứng tuyển</Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                          <Briefcase size={12} color="#64748b" />
                          <Text style={appStyles.infoValue} numberOfLines={1}>
                            {appliedJob?.title || "Chưa gán tin"}
                          </Text>
                        </View>
                      </View>
                      <View style={appStyles.infoItem}>
                        <Text style={appStyles.infoLabel}>Giai đoạn</Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                          <Flag size={12} color="#059669" />
                          <Text style={[appStyles.infoValue, { color: "#059669" }]} numberOfLines={1}>
                            {currentStageName}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Quick Action Buttons */}
                    <View style={appStyles.cardActionsRow}>
                      <Pressable
                        style={[appStyles.actionBtn, { flexDirection: "row", alignItems: "center" }]}
                        onPress={() => setSelected(applicant)}
                      >
                        <Eye size={13} color="#475569" style={{ marginRight: 4 }} />
                        <Text style={appStyles.actionBtnText}>Chi tiết</Text>
                      </Pressable>

                      {access.manage && (
                        <Pressable
                          style={[appStyles.actionBtn, { flexDirection: "row", alignItems: "center" }]}
                          onPress={() => setEditing(applicant)}
                        >
                          <Edit3 size={13} color="#475569" style={{ marginRight: 4 }} />
                          <Text style={appStyles.actionBtnText}>Sửa</Text>
                        </Pressable>
                      )}

                      <Pressable
                        style={[appStyles.actionBtn, appStyles.actionBtnPrimary, { flexDirection: "row", alignItems: "center" }]}
                        onPress={() =>
                          router.push({
                            pathname: "/(tabs)/interviews",
                            params: { applicantId: applicant._id, jobId: applicant.jobId },
                          })
                        }
                      >
                        <Calendar size={13} color="#0369a1" style={{ marginRight: 4 }} />
                        <Text style={[appStyles.actionBtnText, appStyles.actionBtnPrimaryText]}>
                          Lịch PV
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Kanban Board View */}
          {!loading && mode === "kanban" && rows.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: "row", gap: 12, paddingVertical: 4 }}>
                {pipeline?.stages
                  .filter((s) => s.isActive)
                  .map((stageItem) => {
                    const items = rows.filter((item) => item.stageId === stageItem.id);
                    return (
                      <View key={stageItem.id} style={appStyles.kanbanCol}>
                        <View style={[appStyles.kanbanHeader, { borderTopColor: stageItem.color || "#059669" }]}>
                          <Text style={appStyles.kanbanColTitle}>{stageItem.name}</Text>
                          <View style={appStyles.kanbanCountBadge}>
                            <Text style={appStyles.kanbanCountText}>{items.length}</Text>
                          </View>
                        </View>

                        <ScrollView style={{ maxHeight: 420 }}>
                          <View style={{ gap: 8 }}>
                            {items.map((item) => (
                              <Pressable
                                key={item._id}
                                style={appStyles.kanbanCard}
                                onPress={() => setSelected(item)}
                              >
                                <Text style={appStyles.kanbanCardName}>{item.fullName}</Text>
                                <Text style={appStyles.kanbanCardJob} numberOfLines={1}>
                                  {jobs.find((j) => j._id === item.jobId)?.title || "—"}
                                </Text>
                                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
                                  <Text style={{ fontSize: 10, color: "#94a3b8" }}>
                                    {item.phone || item.email || ""}
                                  </Text>
                                  <Text style={{ fontSize: 10, color: "#059669", fontWeight: "700" }}>
                                    {formatOutcome(item.outcome)}
                                  </Text>
                                </View>
                              </Pressable>
                            ))}
                            {items.length === 0 && (
                              <Text style={appStyles.kanbanEmptyText}>Trống</Text>
                            )}
                          </View>
                        </ScrollView>
                      </View>
                    );
                  })}
              </View>
            </ScrollView>
          )}

          {/* Empty State with Seed Action */}
          {!loading && rows.length === 0 && (
            <View style={appStyles.emptyBox}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: "#f1f5f9", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                <Users size={32} color="#94a3b8" />
              </View>
              <Text style={appStyles.emptyTitle}>Chưa có hồ sơ ứng viên</Text>
              <Text style={appStyles.emptyDesc}>
                {search
                  ? `Không tìm thấy ứng viên nào phù hợp với từ khóa "${search}".`
                  : "Chưa có ứng viên nào nộp hồ sơ vào hệ thống tuyển dụng."}
              </Text>
              {search ? (
                <Pressable
                  style={appStyles.resetBtn}
                  onPress={() => {
                    setDraftSearch("");
                    setSearch("");
                    setPage(1);
                  }}
                >
                  <Text style={appStyles.resetBtnText}>Xóa bộ lọc tìm kiếm</Text>
                </Pressable>
              ) : access.manage ? (
                <View style={{ flexDirection: "row", gap: 10, marginTop: 14, alignItems: "center" }}>
                  <Pressable style={[appStyles.primaryBtn, { flexDirection: "row", alignItems: "center" }]} onPress={() => setEditing("new")}>
                    <Plus size={14} color="#ffffff" style={{ marginRight: 4 }} />
                    <Text style={appStyles.primaryBtnText}>Thêm ứng viên mới</Text>
                  </Pressable>
                  <Pressable
                    style={[appStyles.primaryBtn, { backgroundColor: "#0284c7" }, seeding && { opacity: 0.6 }]}
                    disabled={seeding}
                    onPress={handleSeedDemoApplicants}
                  >
                    <Text style={appStyles.primaryBtnText}>
                      {seeding ? "Đang tạo..." : "Thêm 3 hồ sơ mẫu"}
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          )}

          <Pagination meta={pagination} onChange={setPage} />
        </ScrollView>
      </SafeAreaView>

      {editing && (
        <ApplicantForm
          applicant={editing === "new" ? undefined : editing}
          jobs={jobs}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await load();
          }}
        />
      )}

      {selected && (
        <ApplicantDetail
          applicant={selected}
          jobs={jobs}
          stages={pipeline?.stages || []}
          canManage={access.manage}
          onClose={() => setSelected(null)}
          onChanged={async () => {
            await load();
          }}
        />
      )}
      {alertView}
    </>
  );
}

const appStyles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40,
    gap: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  backBtnText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#334155",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "500",
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#059669",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  addBtnIcon: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
  addBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  jobFilterBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  jobFilterText: {
    fontSize: 12,
    color: "#047857",
    flex: 1,
  },
  jobFilterClear: {
    fontSize: 12,
    fontWeight: "700",
    color: "#dc2626",
    marginLeft: 8,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 42,
    gap: 8,
  },
  searchIcon: {
    fontSize: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#0f172a",
    height: "100%",
  },
  clearSearchBtn: {
    padding: 4,
  },
  clearSearchText: {
    fontSize: 12,
    color: "#94a3b8",
  },
  searchBtn: {
    backgroundColor: "#059669",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  searchBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  toolsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modePill: {
    flexDirection: "row",
    backgroundColor: "#e2e8f0",
    borderRadius: 8,
    padding: 3,
    gap: 2,
  },
  modeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  modeBtnActive: {
    backgroundColor: "#ffffff",
  },
  modeBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
  },
  modeBtnTextActive: {
    color: "#0f172a",
    fontWeight: "700",
  },
  chipsScroll: {
    gap: 6,
    paddingVertical: 2,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  filterChipActive: {
    backgroundColor: "#ecfdf5",
    borderColor: "#059669",
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
  },
  filterChipTextActive: {
    color: "#047857",
    fontWeight: "700",
  },
  applicantCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
    gap: 10,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#e0f2fe",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#bae6fd",
  },
  avatarText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0369a1",
  },
  applicantName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
  },
  applicantContact: {
    fontSize: 11,
    color: "#64748b",
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgePillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  cardInfoRow: {
    flexDirection: "row",
    backgroundColor: "#f8fafc",
    padding: 10,
    borderRadius: 8,
    gap: 12,
  },
  infoItem: {
    flex: 1,
    gap: 2,
  },
  infoLabel: {
    fontSize: 10,
    color: "#94a3b8",
    fontWeight: "600",
    textTransform: "uppercase",
  },
  infoValue: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
  },
  cardActionsRow: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "flex-end",
  },
  actionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#475569",
  },
  actionBtnPrimary: {
    backgroundColor: "#ecfdf5",
    borderColor: "#a7f3d0",
  },
  actionBtnPrimaryText: {
    color: "#047857",
    fontWeight: "700",
  },
  kanbanCol: {
    width: 260,
    minHeight: 320,
    backgroundColor: "#f1f5f9",
    borderRadius: 12,
    padding: 10,
    gap: 8,
  },
  kanbanHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 3,
    paddingTop: 6,
  },
  kanbanColTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1e293b",
  },
  kanbanCountBadge: {
    backgroundColor: "#e2e8f0",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  kanbanCountText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#475569",
  },
  kanbanCard: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 4,
  },
  kanbanCardName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
  },
  kanbanCardJob: {
    fontSize: 11,
    color: "#64748b",
  },
  kanbanEmptyText: {
    textAlign: "center",
    fontSize: 11,
    color: "#94a3b8",
    paddingVertical: 16,
  },
  emptyBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 36,
    paddingHorizontal: 20,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 8,
  },
  emptyEmoji: {
    fontSize: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  emptyDesc: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
    maxWidth: 280,
  },
  resetBtn: {
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
  },
  resetBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  primaryBtn: {
    backgroundColor: "#059669",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  primaryBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  paginationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  pageBtn: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  pageBtnDisabled: {
    opacity: 0.4,
  },
  pageBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
  },
  pageInfo: {
    fontSize: 11,
    color: "#64748b",
  },
});
