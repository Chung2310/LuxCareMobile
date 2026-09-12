import { useAppAlert } from "../../src/components/AppAlert";
import { useCallback, useMemo, useRef, useState } from "react";
import {
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
import type { RecruitmentJob } from "../../../src/types/recruitment";
import { emptyPagination } from "../../../src/types/pagination";
import { branches, recruitment } from "../../src/api/services";
import { messageOf, useSession } from "../../src/auth/SessionProvider";
import { BranchSelector } from "../../src/features/branches/BranchSelector";
import { RecruitmentSubnav } from "../../src/features/recruitment/RecruitmentSubnav";
import { JOB_STATUSES, recruitmentAccess } from "../../src/features/recruitment/access";
import { JobForm } from "../../src/features/recruitment/JobForm";
import { AttachmentPanel } from "../../src/features/recruitment/AttachmentPanel";
import { PublicDocumentLink } from "../../src/features/recruitment/PublicDocumentLink";
import { EmptyState, ErrorText, Loading, Page, styles as baseStyles } from "../../src/ui";

import {
  AlertTriangle,
  Banknote,
  Briefcase,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  FileEdit,
  FileText,
  Gift,
  Lock,
  MapPin,
  PauseCircle,
  Pencil,
  Pin,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Target,
  Trash2,
  Users,
  X,
  type LucideIcon,
} from "lucide-react-native";

const WORKPLACE_LABELS: Record<string, string> = {
  onsite: "Tại chỗ",
  hybrid: "Kết hợp",
  remote: "Từ xa",
};

export default function Recruitment() {
  const { showAlert, alertView } = useAppAlert();
  const { user, selectedBranch, selectBranch } = useSession();
  const selectBranchRef = useRef(selectBranch);
  selectBranchRef.current = selectBranch;
  const [branchError, setBranchError] = useState<string | null>(null);
  const isOwner = ["admin", "superadmin", "branch_owner"].includes(user?.role || "");
  const access = recruitmentAccess(user);

  const [jobs, setJobs] = useState<RecruitmentJob[]>([]);
  const [pagination, setPagination] = useState(emptyPagination);
  const [page, setPage] = useState(1);
  const [draftSearch, setDraftSearch] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [deleted, setDeleted] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  const lock = useRef(false);
  const formLock = useRef(false);
  const [editing, setEditing] = useState<RecruitmentJob | "new" | null>(null);

  const closeForm = () => {
    formLock.current = false;
    setEditing(null);
    setRevision((v) => v + 1);
  };

  const scopeReady = isOwner
    ? Boolean(selectedBranch?._id)
    : Boolean(user?.companyCode || selectedBranch?._id || user?.branchId);

  useFocusEffect(useCallback(() => {
    if (!isOwner || !access.read || selectedBranch?._id) return;
    let active = true;
    setBranchError(null);
    branches.list().then(items => {
      if (!active) return;
      const available = items.filter(item => item.isActive &&
        item.companyCode.toUpperCase() === user?.companyCode?.toUpperCase());
      const branch = available.find(item => item._id === user?.branchId) || available[0];
      if (branch) selectBranchRef.current(branch);
      else setBranchError("Chưa có chi nhánh đang hoạt động để chọn.");
    }).catch(err => {
      if (active) setBranchError(messageOf(err));
    });
    return () => { active = false; };
  }, [isOwner, access.read, selectedBranch?._id, user?.uid, user?.companyCode, user?.branchId, revision]));

  const loadData = useCallback(
    async (isRefresh = false) => {
      if (!access.read || !scopeReady) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const result = await recruitment.listJobsPage({
          page,
          limit: 20,
          search,
          status,
          ...(deleted ? { deleted: true } : {}),
        });
        setJobs(result.data);
        setPagination(result.pagination);
        setUncertain(false);
      } catch (err) {
        setError(messageOf(err));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [access.read, scopeReady, page, search, status, deleted, user?.uid, selectedBranch?._id],
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setJobs([]);
      setExpanded(null);
      setError(null);
      setPagination(emptyPagination);

      if (!access.read || !scopeReady) return;
      setLoading(true);

      recruitment
        .listJobsPage({
          page,
          limit: 20,
          search,
          status,
          ...(deleted ? { deleted: true } : {}),
        })
        .then((result) => {
          if (active) {
            setJobs(result.data);
            setPagination(result.pagination);
            setUncertain(false);
          }
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
    }, [access.read, scopeReady, user?.uid, selectedBranch?._id, page, search, status, deleted, revision]),
  );

  const mutate = async (job: RecruitmentJob, action: string) => {
    if (lock.current || !access.manage || uncertain || loading || !scopeReady) return;
    lock.current = true;
    setBusy(true);
    setMutationError(null);
    setSuccess(null);

    try {
      if (action === "delete") await recruitment.deleteJob(job._id, job.version);
      else if (action === "restore") await recruitment.restoreJob(job._id, job.version);
      else await recruitment.changeJobStatus(job._id, job.version, action as RecruitmentJob["status"]);

      if (action === "delete" || action === "restore") setPage(1);
      showAlert(
        "Thành công",
        action === "delete"
          ? `Đã chuyển tin ${job.code} vào thùng rác.`
          : action === "restore"
          ? `Đã khôi phục tin ${job.code} thành công.`
          : `Đã cập nhật trạng thái tin ${job.code} thành công.`,
        [{ text: "Đóng" }],
        "success",
      );
      setRevision((v) => v + 1);
    } catch (err) {
      setUncertain(true);
      showAlert(
        "Thao tác không thành công",
        `${messageOf(err)}\nVui lòng tải lại dữ liệu trước khi thao tác tiếp.`,
        [{ text: "Đã hiểu" }],
        "error",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const confirm = (job: RecruitmentJob, action: string, title: string) => {
    if (lock.current || !access.manage || uncertain || loading || !scopeReady) return;
    showAlert(title, `Mã: ${job.code} · ${job.title}${action === "delete" ? "\nTin sẽ được chuyển vào thùng rác. Bạn có thể khôi phục lại sau." : ""}`, [
      { text: "Hủy", style: "cancel" },
      {
        text: action === "delete" ? "Xóa tin" : "Xác nhận",
        style: action === "delete" ? "destructive" : "default",
        onPress: () => void mutate(job, action),
      },
    ]);
  };

  const formatMoney = (val?: number | null) => {
    if (val == null || val === 0) return "Thỏa thuận";
    if (val >= 1000000) {
      const millions = val / 1000000;
      return Number.isInteger(millions) ? `${millions} Tr` : `${millions.toFixed(1)} Tr`;
    }
    return val.toLocaleString("vi-VN") + " đ";
  };

  const formatSalaryRange = (job: RecruitmentJob) => {
    if (!job.showSalary) return "Lương thỏa thuận (kín)";
    if (!job.salaryMin && !job.salaryMax) return "Thỏa thuận";
    if (job.salaryMin && !job.salaryMax) return `Từ ${formatMoney(job.salaryMin)}`;
    if (!job.salaryMin && job.salaryMax) return `Đến ${formatMoney(job.salaryMax)}`;
    return `${formatMoney(job.salaryMin)} - ${formatMoney(job.salaryMax)}`;
  };

  const formatDeadline = (deadlineStr?: string | null) => {
    if (!deadlineStr) return { text: "Không giới hạn", isExpired: false, isNear: false };
    const date = new Date(deadlineStr);
    const now = new Date();
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    const dateStr = date.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    if (diffDays < 0) return { text: `Hết hạn (${dateStr})`, isExpired: true, isNear: false };
    if (diffDays <= 5) return { text: `${diffDays} ngày nữa (${dateStr})`, isExpired: false, isNear: true };
    return { text: dateStr, isExpired: false, isNear: false };
  };

  const getStatusBadge = (jobStatus: string, isDeleted?: boolean): { label: string; bg: string; border: string; color: string; Icon: LucideIcon } => {
    if (isDeleted) {
      return { label: "Đã xóa", bg: "#fee2e2", border: "#fca5a5", color: "#b91c1c", Icon: Trash2 };
    }
    switch (jobStatus) {
      case "open":
        return { label: "Đang tuyển", bg: "#ecfdf5", border: "#a7f3d0", color: "#047857", Icon: CheckCircle2 };
      case "draft":
        return { label: "Bản nháp", bg: "#fef3c7", border: "#fde68a", color: "#b45309", Icon: FileEdit };
      case "paused":
        return { label: "Tạm dừng", bg: "#fff7ed", border: "#fed7aa", color: "#c2410c", Icon: PauseCircle };
      case "closed":
        return { label: "Đã đóng", bg: "#f1f5f9", border: "#cbd5e1", color: "#475569", Icon: Lock };
      default:
        return { label: jobStatus, bg: "#f8fafc", border: "#e2e8f0", color: "#64748b", Icon: Pin };
    }
  };

  // Stats overview counts
  const stats = useMemo(() => {
    const openCount = jobs.filter((j) => j.status === "open").length;
    const draftCount = jobs.filter((j) => j.status === "draft").length;
    const pausedOrClosedCount = jobs.filter((j) => j.status === "paused" || j.status === "closed").length;
    return {
      total: pagination.total || jobs.length,
      open: openCount,
      draft: draftCount,
      other: pausedOrClosedCount,
    };
  }, [jobs, pagination.total]);

  if (!access.read) {
    return (
      <Page title="Tuyển dụng">
        <View style={uiStyles.emptyBox}>
          <Lock size={40} color="#94a3b8" />
          <Text style={uiStyles.emptyTitle}>Không có quyền truy cập</Text>
          <Text style={uiStyles.emptyText}>
            Tài khoản của bạn cần thuộc doanh nghiệp và có quyền đọc phân hệ HR / Tuyển dụng.
          </Text>
        </View>
        {alertView}
      </Page>
    );
  }

  if (!scopeReady) {
    return (
      <Page title="Tuyển dụng">
        <View style={uiStyles.emptyBox}>
          <Building2 size={40} color="#94a3b8" />
          <Text style={uiStyles.emptyTitle}>Chưa chọn chi nhánh</Text>
          {isOwner ? (
            <>
              <Text style={uiStyles.emptyText}>{branchError || "Đang chọn chi nhánh..."}</Text>
              <BranchSelector allowAll={false} />
              {!!branchError && (
                <Pressable onPress={() => setRevision(v => v + 1)}>
                  <Text style={uiStyles.emptyText}>Thử lại</Text>
                </Pressable>
              )}
            </>
          ) : (
            <Text style={uiStyles.emptyText}>Hồ sơ của bạn chưa được liên kết với chi nhánh làm việc.</Text>
          )}
        </View>
        {alertView}
      </Page>
    );
  }

  const disabled = busy || loading;

  const handleSearchSubmit = () => {
    setSearch(draftSearch.trim());
    setPage(1);
    setRevision((v) => v + 1);
  };

  const handleClearSearch = () => {
    setDraftSearch("");
    setSearch("");
    setPage(1);
    setRevision((v) => v + 1);
  };

  return (
    <>
      <SafeAreaView style={uiStyles.safeContainer} edges={["top"]}>
        <ScrollView
          style={uiStyles.scroll}
          contentContainerStyle={uiStyles.scrollContent}
          showsVerticalScrollIndicator={false}
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
        >
          {/* Top Header Bar */}
          <View style={uiStyles.headerContainer}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
              <Pressable
                onPress={() => (router.canGoBack() ? router.back() : router.push("/(tabs)/modules"))}
                style={uiStyles.backBtn}
              >
                <ChevronLeft size={20} color="#334155" />
              </Pressable>
              <View style={uiStyles.headerLeft}>
                <Text style={uiStyles.headerTitle}>Tin tuyển dụng</Text>
                {isOwner ? (
                  <BranchSelector
                    allowAll={false}
                    renderCustomTrigger={(open, currentName) => (
                      <Pressable onPress={open} style={uiStyles.branchRow}>
                        <View style={uiStyles.branchDot} />
                        <Text style={uiStyles.branchName}>{currentName}</Text>
                        <ChevronDown size={13} color="#15803d" />
                      </Pressable>
                    )}
                  />
                ) : (
                  <Text style={uiStyles.branchName}>{selectedBranch?.name || user?.branchName}</Text>
                )}
              </View>
            </View>

            <View style={uiStyles.headerRight}>
              <Pressable
                style={({ pressed }) => [uiStyles.refreshBtn, pressed && { opacity: 0.7 }]}
                onPress={() => setRevision((v) => v + 1)}
                disabled={disabled}
              >
                <RotateCcw size={15} color="#059669" />
              </Pressable>

              {access.manage && (
                <Pressable
                  style={({ pressed }) => [
                    uiStyles.createBtn,
                    (disabled || uncertain) && uiStyles.btnDisabled,
                    pressed && { opacity: 0.8 },
                  ]}
                  onPress={() => setEditing("new")}
                  disabled={disabled || uncertain}
                >
                  <Plus size={14} color="#ffffff" style={{ marginRight: 4 }} />
                  <Text style={uiStyles.createBtnText}>Tạo tin</Text>
                </Pressable>
              )}
            </View>
          </View>

          {/* Sub Navigation Bar */}
          <RecruitmentSubnav active="jobs" />

          {/* Quick Metrics Cards */}
          <View style={uiStyles.statsRow}>
            <View style={[uiStyles.statCard, { borderLeftColor: "#3b82f6" }]}>
              <Text style={uiStyles.statValue}>{stats.total}</Text>
              <Text style={uiStyles.statLabel}>Tổng tin</Text>
            </View>
            <View style={[uiStyles.statCard, { borderLeftColor: "#10b981" }]}>
              <Text style={[uiStyles.statValue, { color: "#047857" }]}>{stats.open}</Text>
              <Text style={uiStyles.statLabel}>Đang tuyển</Text>
            </View>
            <View style={[uiStyles.statCard, { borderLeftColor: "#f59e0b" }]}>
              <Text style={[uiStyles.statValue, { color: "#b45309" }]}>{stats.draft}</Text>
              <Text style={uiStyles.statLabel}>Bản nháp</Text>
            </View>
            <View style={[uiStyles.statCard, { borderLeftColor: "#64748b" }]}>
              <Text style={[uiStyles.statValue, { color: "#475569" }]}>{stats.other}</Text>
              <Text style={uiStyles.statLabel}>Dừng/Đóng</Text>
            </View>
          </View>

          {/* Search Input Box */}
          <View style={uiStyles.searchContainer}>
            <Search size={16} color="#94a3b8" style={{ marginRight: 6 }} />
            <TextInput
              style={uiStyles.searchInput}
              placeholder="Tìm theo mã, chức danh, phòng ban..."
              placeholderTextColor="#94a3b8"
              value={draftSearch}
              onChangeText={setDraftSearch}
              onSubmitEditing={handleSearchSubmit}
              returnKeyType="search"
              editable={!disabled}
            />
            {draftSearch.length > 0 && (
              <Pressable
                onPress={handleClearSearch}
                style={({ pressed }) => [uiStyles.clearSearchBtn, pressed && { opacity: 0.6 }]}
              >
                <X size={16} color="#94a3b8" />
              </Pressable>
            )}
            <Pressable
              style={({ pressed }) => [uiStyles.searchSubmitBtn, pressed && { opacity: 0.8 }]}
              onPress={handleSearchSubmit}
              disabled={disabled}
            >
              <Text style={uiStyles.searchSubmitText}>Tìm</Text>
            </Pressable>
          </View>

          {/* Status Filter Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={uiStyles.filterChipsRow}
          >
            <Pressable
              style={[
                uiStyles.filterChip,
                status === "" && !deleted && uiStyles.filterChipActive,
              ]}
              onPress={() => {
                if (deleted) setDeleted(false);
                setStatus("");
                setPage(1);
              }}
            >
              <Text
                style={[
                  uiStyles.filterChipText,
                  status === "" && !deleted && uiStyles.filterChipTextActive,
                ]}
              >
                Tất cả
              </Text>
            </Pressable>

            {JOB_STATUSES.map((item) => {
              const isSelected = status === item.value && !deleted;
              return (
                <Pressable
                  key={item.value}
                  style={[uiStyles.filterChip, isSelected && uiStyles.filterChipActive]}
                  onPress={() => {
                    if (deleted) setDeleted(false);
                    setStatus(item.value);
                    setPage(1);
                  }}
                >
                  {item.value === "open" && <CheckCircle2 size={13} color={isSelected ? "#047857" : "#64748b"} />}
                  {item.value === "draft" && <FileEdit size={13} color={isSelected ? "#047857" : "#64748b"} />}
                  {item.value === "paused" && <PauseCircle size={13} color={isSelected ? "#047857" : "#64748b"} />}
                  {item.value === "closed" && <Lock size={13} color={isSelected ? "#047857" : "#64748b"} />}
                  <Text
                    style={[
                      uiStyles.filterChipText,
                      isSelected && uiStyles.filterChipTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}

            <Pressable
              style={[uiStyles.filterChip, deleted && uiStyles.filterChipActiveDanger]}
              onPress={() => {
                setDeleted((prev) => !prev);
                setStatus("");
                setPage(1);
              }}
            >
              <Trash2 size={13} color={deleted ? "#dc2626" : "#64748b"} />
              <Text
                style={[
                  uiStyles.filterChipText,
                  deleted && uiStyles.filterChipTextActiveDanger,
                ]}
              >
                Thùng rác
              </Text>
            </Pressable>
          </ScrollView>

          {/* Alert / Notification banners */}
          <ErrorText message={error} />
          <ErrorText message={mutationError} />
          {success && (
            <View style={uiStyles.successBanner}>
              <Check size={16} color="#059669" />
              <Text style={uiStyles.successBannerText}>{success}</Text>
            </View>
          )}

          {/* Loading Indicator */}
          {loading && <Loading />}

          {/* Job Cards List */}
          {jobs.map((job) => {
            const badge = getStatusBadge(job.status, deleted);
            const isExpanded = expanded === job._id;
            const deadline = formatDeadline(job.applicationDeadline);
            const workplace = WORKPLACE_LABELS[job.workplaceType] || job.workplaceType || "Tại chỗ";

            return (
              <View key={job._id} style={uiStyles.jobCard}>
                {/* Top Badge & Code */}
                <View style={uiStyles.cardTopRow}>
                  <View style={uiStyles.jobCodeBadge}>
                    <Text style={uiStyles.jobCodeText}>#{job.code}</Text>
                  </View>
                  <View
                    style={[
                      uiStyles.statusBadge,
                      { backgroundColor: badge.bg, borderColor: badge.border },
                    ]}
                  >
                    <badge.Icon size={12} color={badge.color} />
                    <Text style={[uiStyles.statusBadgeText, { color: badge.color }]}>
                      {badge.label}
                    </Text>
                  </View>
                </View>

                {/* Job Title & Department */}
                <Text style={uiStyles.jobTitle}>{job.title || "Chưa đặt tiêu đề"}</Text>
                <View style={uiStyles.departmentRow}>
                  <Building2 size={13} color="#64748b" />
                  <Text style={uiStyles.departmentText}>
                    {job.department || "Chưa phân bổ phòng ban"}
                  </Text>
                </View>

                {/* 2x2 Key Info Grid */}
                <View style={uiStyles.gridContainer}>
                  <View style={uiStyles.gridItem}>
                    <Users size={15} color="#0284c7" style={uiStyles.gridItemIcon} />
                    <View style={uiStyles.gridItemContent}>
                      <Text style={uiStyles.gridItemLabel}>Số lượng</Text>
                      <Text style={uiStyles.gridItemVal}>{job.headcount} chỉ tiêu</Text>
                    </View>
                  </View>

                  <View style={uiStyles.gridItem}>
                    <Banknote size={15} color="#059669" style={uiStyles.gridItemIcon} />
                    <View style={uiStyles.gridItemContent}>
                      <Text style={uiStyles.gridItemLabel}>Mức lương</Text>
                      <Text style={uiStyles.gridItemVal} numberOfLines={1}>
                        {formatSalaryRange(job)}
                      </Text>
                    </View>
                  </View>

                  <View style={uiStyles.gridItem}>
                    <MapPin size={15} color="#ea580c" style={uiStyles.gridItemIcon} />
                    <View style={uiStyles.gridItemContent}>
                      <Text style={uiStyles.gridItemLabel}>Địa điểm</Text>
                      <Text style={uiStyles.gridItemVal} numberOfLines={1}>
                        {job.location || "Tại chi nhánh"}
                      </Text>
                    </View>
                  </View>

                  <View style={uiStyles.gridItem}>
                    <Briefcase size={15} color="#7c3aed" style={uiStyles.gridItemIcon} />
                    <View style={uiStyles.gridItemContent}>
                      <Text style={uiStyles.gridItemLabel}>Hình thức</Text>
                      <Text style={uiStyles.gridItemVal} numberOfLines={1}>
                        {workplace} · {job.employmentType || "Toàn thời gian"}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Deadline indicator pill */}
                {job.applicationDeadline && (
                  <View
                    style={[
                      uiStyles.deadlinePill,
                      deadline.isExpired
                        ? uiStyles.deadlineExpired
                        : deadline.isNear
                          ? uiStyles.deadlineNear
                          : uiStyles.deadlineValid,
                    ]}
                  >
                    {deadline.isExpired ? (
                      <AlertTriangle size={13} color="#dc2626" />
                    ) : deadline.isNear ? (
                      <Clock size={13} color="#d97706" />
                    ) : (
                      <Calendar size={13} color="#64748b" />
                    )}
                    <Text
                      style={[
                        uiStyles.deadlineText,
                        deadline.isExpired && { color: "#dc2626" },
                        deadline.isNear && { color: "#d97706" },
                      ]}
                    >
                      Hạn ứng tuyển: {deadline.text}
                    </Text>
                  </View>
                )}

                {/* Action Buttons Row */}
                <View style={uiStyles.cardActionRow}>
                  {!deleted && (
                    <Pressable
                      style={({ pressed }) => [
                        uiStyles.applicantsBtn,
                        pressed && { opacity: 0.8 },
                      ]}
                      onPress={() =>
                        router.push({
                          pathname: "/(tabs)/applicants",
                          params: { jobId: job._id },
                        })
                      }
                    >
                      <Users size={14} color="#ffffff" />
                      <Text style={uiStyles.applicantsBtnText}>Ứng viên</Text>
                    </Pressable>
                  )}

                  {access.manage && !deleted && (
                    <Pressable
                      style={({ pressed }) => [
                        uiStyles.editBtn,
                        disabled && uiStyles.btnDisabled,
                        pressed && { opacity: 0.8 },
                      ]}
                      onPress={() => setEditing(job)}
                      disabled={disabled || uncertain}
                    >
                      <Pencil size={13} color="#334155" />
                      <Text style={uiStyles.editBtnText}>Sửa</Text>
                    </Pressable>
                  )}

                  {access.manage && !deleted && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Xóa tin tuyển dụng ${job.title}`}
                      style={({ pressed }) => [
                        uiStyles.deleteActionBtn,
                        (disabled || uncertain) && uiStyles.btnDisabled,
                        pressed && { opacity: 0.8 },
                      ]}
                      disabled={disabled || uncertain}
                      onPress={() => confirm(job, "delete", "Xóa tin tuyển dụng?")}
                    >
                      <Trash2 size={14} color="#b91c1c" />
                      <Text style={uiStyles.deleteActionBtnText}>Xóa tin</Text>
                    </Pressable>
                  )}

                  <Pressable
                    style={({ pressed }) => [
                      uiStyles.expandBtn,
                      isExpanded && uiStyles.expandBtnActive,
                      pressed && { opacity: 0.8 },
                    ]}
                    onPress={() => setExpanded(isExpanded ? null : job._id)}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                      {isExpanded ? (
                        <>
                          <ChevronUp size={13} color="#059669" />
                          <Text style={[uiStyles.expandBtnText, uiStyles.expandBtnTextActive]}>Thu gọn</Text>
                        </>
                      ) : (
                        <>
                          <ChevronDown size={13} color="#64748b" />
                          <Text style={uiStyles.expandBtnText}>Chi tiết</Text>
                        </>
                      )}
                    </View>
                  </Pressable>
                </View>

                {/* Collapsible Expanded Details */}
                {isExpanded && (
                  <View style={uiStyles.expandedSection}>
                    {/* JD and Attachments */}
                    <PublicDocumentLink title="Mô tả công việc (JD File)" url={job.jdFileUrl} />
                    {!deleted && <AttachmentPanel kind="job" id={job._id} manage={access.manage} />}

                    {/* Detailed Content Blocks */}
                    {job.description ? (
                      <View style={uiStyles.detailBlock}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <FileText size={15} color="#0284c7" />
                          <Text style={uiStyles.detailBlockTitle}>Mô tả công việc</Text>
                        </View>
                        <Text style={uiStyles.detailBlockContent}>{job.description}</Text>
                      </View>
                    ) : null}

                    {job.requirements ? (
                      <View style={uiStyles.detailBlock}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Target size={15} color="#0284c7" />
                          <Text style={uiStyles.detailBlockTitle}>Yêu cầu ứng viên</Text>
                        </View>
                        <Text style={uiStyles.detailBlockContent}>{job.requirements}</Text>
                      </View>
                    ) : null}

                    {job.benefits ? (
                      <View style={uiStyles.detailBlock}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Gift size={15} color="#0284c7" />
                          <Text style={uiStyles.detailBlockTitle}>Quyền lợi đãi ngộ</Text>
                        </View>
                        <Text style={uiStyles.detailBlockContent}>{job.benefits}</Text>
                      </View>
                    ) : null}

                    {/* Management Action Buttons */}
                    {access.manage && (
                      <View style={uiStyles.manageSection}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
                          <Settings size={14} color="#475569" />
                          <Text style={uiStyles.manageSectionTitle}>Thao tác quản lý tin</Text>
                        </View>
                        {deleted ? (
                          <Pressable
                            style={({ pressed }) => [
                              uiStyles.restoreActionBtn,
                              disabled && uiStyles.btnDisabled,
                              pressed && { opacity: 0.8 },
                            ]}
                            disabled={disabled || uncertain}
                            onPress={() => confirm(job, "restore", "Khôi phục tin tuyển dụng này?")}
                          >
                            <RotateCcw size={14} color="#047857" />
                            <Text style={uiStyles.restoreActionBtnText}>Khôi phục tin</Text>
                          </Pressable>
                        ) : (
                          <>
                            <View style={uiStyles.statusChangeRow}>
                              {JOB_STATUSES.filter((item) => item.value !== job.status).map((item) => (
                                <Pressable
                                  key={item.value}
                                  style={({ pressed }) => [
                                    uiStyles.statusChangeBtn,
                                    disabled && uiStyles.btnDisabled,
                                    pressed && { opacity: 0.75 },
                                  ]}
                                  disabled={disabled || uncertain}
                                  onPress={() =>
                                    confirm(job, item.value, `Chuyển trạng thái sang "${item.label}"?`)
                                  }
                                >
                                  {item.value === "open" && <CheckCircle2 size={12} color="#047857" />}
                                  {item.value === "draft" && <FileEdit size={12} color="#b45309" />}
                                  {item.value === "paused" && <PauseCircle size={12} color="#c2410c" />}
                                  {item.value === "closed" && <Lock size={12} color="#475569" />}
                                  <Text style={uiStyles.statusChangeBtnText}>
                                    {item.label}
                                  </Text>
                                </Pressable>
                              ))}
                            </View>
                          </>
                        )}
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })}

          {/* Empty State */}
          {!loading && !error && jobs.length === 0 && (
            <View style={uiStyles.emptyStateContainer}>
              <Briefcase size={44} color="#94a3b8" style={{ marginBottom: 4 }} />
              <Text style={uiStyles.emptyStateTitle}>Không có tin tuyển dụng</Text>
              <Text style={uiStyles.emptyStateDesc}>
                {search
                  ? `Không tìm thấy tin phù hợp với từ khóa "${search}".`
                  : deleted
                    ? "Thùng rác hiện đang trống."
                    : "Chưa có tin tuyển dụng nào trong mục này."}
              </Text>
              {search ? (
                <Pressable style={uiStyles.emptyStateResetBtn} onPress={handleClearSearch}>
                  <Text style={uiStyles.emptyStateResetText}>Xóa bộ lọc tìm kiếm</Text>
                </Pressable>
              ) : !deleted && access.manage ? (
                <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
                  <Pressable
                    style={[uiStyles.createBtn, { paddingHorizontal: 16, flexDirection: "row", alignItems: "center" }]}
                    onPress={() => setEditing("new")}
                  >
                    <Plus size={14} color="#ffffff" style={{ marginRight: 4 }} />
                    <Text style={uiStyles.createBtnText}>Tạo tin mới</Text>
                  </Pressable>

                </View>
              ) : null}
            </View>
          )}

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <View style={uiStyles.paginationCard}>
              <Pressable
                style={({ pressed }) => [
                  uiStyles.pageBtn,
                  (disabled || page <= 1) && uiStyles.pageBtnDisabled,
                  pressed && { opacity: 0.7 },
                ]}
                disabled={disabled || page <= 1}
                onPress={() => setPage((v) => v - 1)}
              >
                <ChevronLeft size={14} color={disabled || page <= 1 ? "#94a3b8" : "#0f172a"} />
                <Text
                  style={[
                    uiStyles.pageBtnText,
                    (disabled || page <= 1) && uiStyles.pageBtnTextDisabled,
                  ]}
                >
                  Trang trước
                </Text>
              </Pressable>

              <Text style={uiStyles.pageNumberText}>
                {page} / {pagination.totalPages}
              </Text>

              <Pressable
                style={({ pressed }) => [
                  uiStyles.pageBtn,
                  (disabled || page >= pagination.totalPages) && uiStyles.pageBtnDisabled,
                  pressed && { opacity: 0.7 },
                ]}
                disabled={disabled || page >= pagination.totalPages}
                onPress={() => setPage((v) => v + 1)}
              >
                <Text
                  style={[
                    uiStyles.pageBtnText,
                    (disabled || page >= pagination.totalPages) && uiStyles.pageBtnTextDisabled,
                  ]}
                >
                  Trang sau
                </Text>
                <ChevronRight size={14} color={disabled || page >= pagination.totalPages ? "#94a3b8" : "#0f172a"} />
              </Pressable>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Modal for Creating / Editing Job */}
      {editing && access.manage && (
        <JobForm
          job={editing === "new" ? undefined : editing}
          setLocked={(val) => {
            formLock.current = val;
          }}
          onClose={closeForm}
          onSaved={closeForm}
        />
      )}
      {alertView}
    </>
  );
}

const uiStyles = StyleSheet.create({
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
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
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
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.3,
  },
  branchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  branchDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#10b981",
  },
  branchName: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  refreshBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#475569",
  },
  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#059669",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
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
  btnDisabled: {
    opacity: 0.5,
  },

  // Stats banner
  statsRow: {
    flexDirection: "row",
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderLeftWidth: 4,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  statValue: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0f172a",
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
    marginTop: 1,
  },

  // Search
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 44,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#0f172a",
    paddingVertical: 6,
  },
  clearSearchBtn: {
    padding: 4,
    marginRight: 4,
  },
  clearSearchText: {
    fontSize: 14,
    color: "#94a3b8",
  },
  searchSubmitBtn: {
    backgroundColor: "#0f172a",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  searchSubmitText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600",
  },

  // Filter chips
  filterChipsRow: {
    flexDirection: "row",
    gap: 7,
    paddingVertical: 2,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  filterChipActive: {
    backgroundColor: "#ecfdf5",
    borderColor: "#059669",
  },
  filterChipActiveDanger: {
    backgroundColor: "#fef2f2",
    borderColor: "#ef4444",
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  filterChipTextActive: {
    color: "#059669",
    fontWeight: "700",
  },
  filterChipTextActiveDanger: {
    color: "#dc2626",
    fontWeight: "700",
  },

  // Banners
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#a7f3d0",
    borderRadius: 12,
    padding: 10,
    gap: 8,
  },
  successBannerIcon: {
    color: "#059669",
    fontWeight: "800",
  },
  successBannerText: {
    color: "#047857",
    fontSize: 13,
    fontWeight: "600",
  },

  // Job Card
  jobCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
    gap: 10,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  jobCodeBadge: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  jobCodeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  jobTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    lineHeight: 22,
  },
  departmentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: -4,
  },
  deptIcon: {
    fontSize: 12,
  },
  departmentText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
  },

  // 2x2 Grid
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    backgroundColor: "#f8fafc",
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  gridItem: {
    width: "48%",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  gridItemIcon: {
    fontSize: 13,
    marginTop: 1,
  },
  gridItemContent: {
    flex: 1,
  },
  gridItemLabel: {
    fontSize: 10,
    color: "#94a3b8",
    fontWeight: "600",
  },
  gridItemVal: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1e293b",
  },

  // Deadline pill
  deadlinePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  deadlineValid: {
    backgroundColor: "#f0fdf4",
  },
  deadlineNear: {
    backgroundColor: "#fffbeb",
  },
  deadlineExpired: {
    backgroundColor: "#fef2f2",
  },
  deadlineIcon: {
    fontSize: 11,
  },
  deadlineText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#475569",
  },

  // Card Action Row
  cardActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  applicantsBtn: {
    flex: 1.2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: "#059669",
    paddingVertical: 9,
    borderRadius: 10,
  },
  applicantsBtnIcon: {
    fontSize: 13,
    color: "#ffffff",
  },
  applicantsBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  editBtn: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
  },
  expandBtn: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  expandBtnActive: {
    backgroundColor: "#f8fafc",
    borderColor: "#94a3b8",
  },
  expandBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  expandBtnTextActive: {
    color: "#0f172a",
    fontWeight: "700",
  },

  // Expanded Details
  expandedSection: {
    gap: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  detailBlock: {
    backgroundColor: "#f8fafc",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 5,
  },
  detailBlockTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
  },
  detailBlockContent: {
    fontSize: 13,
    lineHeight: 20,
    color: "#334155",
  },

  // Manage Section
  manageSection: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 8,
  },
  manageSectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
  },
  statusChangeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  statusChangeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statusChangeBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#334155",
  },
  deleteActionBtn: {
    paddingHorizontal: 10,
    backgroundColor: "#fee2e2",
    borderWidth: 1,
    borderColor: "#fca5a5",
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  deleteActionBtnText: {
    color: "#b91c1c",
    fontSize: 12,
    fontWeight: "700",
  },
  restoreActionBtn: {
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#a7f3d0",
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  restoreActionBtnText: {
    color: "#047857",
    fontSize: 12,
    fontWeight: "700",
  },

  // Empty State
  emptyStateContainer: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 30,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 8,
  },
  emptyStateEmoji: {
    fontSize: 40,
    marginBottom: 4,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  emptyStateDesc: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 19,
  },
  emptyStateResetBtn: {
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
  },
  emptyStateResetText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#059669",
  },

  // Pagination
  paginationCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  pageBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  pageBtnDisabled: {
    opacity: 0.4,
  },
  pageBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0f172a",
  },
  pageBtnTextDisabled: {
    color: "#94a3b8",
  },
  pageNumberText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
  },

  // Modals & Empty Boxes
  emptyBox: {
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 8,
  },
  emptyIcon: {
    fontSize: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  emptyText: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 20,
  },
  modalSafeArea: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0f172a",
  },
  modalSubtitle: {
    fontSize: 12,
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
  modalCloseText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#475569",
  },
});
