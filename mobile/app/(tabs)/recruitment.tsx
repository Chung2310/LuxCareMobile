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
import { recruitment } from "../../src/api/services";
import { messageOf, useSession } from "../../src/auth/SessionProvider";
import { RecruitmentSubnav } from "../../src/features/recruitment/RecruitmentSubnav";
import { JOB_STATUSES, recruitmentAccess } from "../../src/features/recruitment/access";
import { JobForm } from "../../src/features/recruitment/JobForm";
import { AttachmentPanel } from "../../src/features/recruitment/AttachmentPanel";
import { PublicDocumentLink } from "../../src/features/recruitment/PublicDocumentLink";
import { EmptyState, ErrorText, Loading, Page, styles as baseStyles } from "../../src/ui";
import { BranchSelector } from "../../src/features/branches/BranchSelector";

const WORKPLACE_LABELS: Record<string, string> = {
  onsite: "Tại chỗ",
  hybrid: "Kết hợp",
  remote: "Từ xa",
};

export default function Recruitment() {
  const { showAlert, alertView } = useAppAlert();
  const { user, selectedBranch } = useSession();
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
    if (formLock.current) return;
    setEditing(null);
    setRevision((v) => v + 1);
  };

  const scopeReady = Boolean(user?.companyCode || selectedBranch?._id || user?.branchId || isOwner);

  const [seeding, setSeeding] = useState(false);
  const handleSeedDemo = async () => {
    if (seeding || !access.manage) return;
    setSeeding(true);
    try {
      await recruitment.createJob({
        code: `BS-${Date.now().toString().slice(-4)}`,
        title: "Bác sĩ Đa khoa",
        department: "Khám bệnh",
        headcount: 2,
        employmentType: "full_time",
        workplaceType: "onsite",
        location: selectedBranch?.name || "Cơ sở chính",
        salaryMin: 25000000,
        salaryMax: 40000000,
        showSalary: true,
        description: "Khám, chẩn đoán và điều trị bệnh nhân tại phòng khám theo đúng quy trình chuyên môn.",
        requirements: "Tốt nghiệp Đại học Y Dược, có CCHN khám chữa bệnh, tối thiểu 2 năm kinh nghiệm.",
        benefits: "Lương thưởng cạnh tranh, BHXH theo luật, hỗ trợ ăn trưa, đào tạo chuyên sâu.",
        status: "open",
        applicationDeadline: new Date(Date.now() + 30 * 86400000).toISOString(),
      });
      await recruitment.createJob({
        code: `DD-${Date.now().toString().slice(-4)}`,
        title: "Điều dưỡng viên Chăm sóc",
        department: "Điều dưỡng",
        headcount: 5,
        employmentType: "full_time",
        workplaceType: "onsite",
        location: selectedBranch?.name || "Cơ sở chính",
        salaryMin: 12000000,
        salaryMax: 18000000,
        showSalary: true,
        description: "Thực hiện y lệnh của bác sĩ, chăm sóc bệnh nhân, tiêm truyền và xử lý vết thương.",
        requirements: "Tốt nghiệp CĐ/ĐH Điều dưỡng, có CCHN, nhanh nhẹn, tận tâm.",
        benefits: "Phụ cấp trực ca, thưởng KPI hàng tháng, đồng phục và bảo hiểm đầy đủ.",
        status: "open",
        applicationDeadline: new Date(Date.now() + 20 * 86400000).toISOString(),
      });
      await recruitment.createJob({
        code: `DS-${Date.now().toString().slice(-4)}`,
        title: "Dược sĩ Nhà thuốc",
        department: "Dược",
        headcount: 2,
        employmentType: "full_time",
        workplaceType: "onsite",
        location: selectedBranch?.name || "Cơ sở chính",
        salaryMin: 15000000,
        salaryMax: 22000000,
        showSalary: true,
        description: "Tư vấn và bán thuốc theo đơn, quản lý tồn kho, kiểm soát hạn dùng thuốc.",
        requirements: "Tốt nghiệp Đại học Dược, có CCHN dược, nắm vững quy chế bán lẻ.",
        benefits: "Hoa hồng doanh số bán lẻ, du lịch hàng năm, phụ cấp trách nhiệm.",
        status: "open",
        applicationDeadline: new Date(Date.now() + 25 * 86400000).toISOString(),
      });
      setSuccess("Đã khởi tạo thành công 3 tin tuyển dụng mẫu!");
      setTimeout(() => setSuccess(null), 4000);
      setRevision((v) => v + 1);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setSeeding(false);
    }
  };

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
    if (lock.current || !access.manage) return;
    lock.current = true;
    setBusy(true);
    setMutationError(null);
    setSuccess(null);

    try {
      if (action === "delete") await recruitment.deleteJob(job._id, job.version);
      else if (action === "restore") await recruitment.restoreJob(job._id, job.version);
      else await recruitment.changeJobStatus(job._id, job.version, action as RecruitmentJob["status"]);

      setSuccess("Đã cập nhật trạng thái tin tuyển dụng.");
      setTimeout(() => setSuccess(null), 4000);
      setRevision((v) => v + 1);
    } catch (err) {
      setUncertain(true);
      setMutationError(`${messageOf(err)} Vui lòng tải lại dữ liệu trước khi thao tác.`);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const confirm = (job: RecruitmentJob, action: string, title: string) => {
    showAlert(title, `Mã: ${job.code} · ${job.title}`, [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xác nhận",
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

  const getStatusBadge = (jobStatus: string, isDeleted?: boolean) => {
    if (isDeleted) {
      return { label: "Đã xóa", bg: "#fee2e2", border: "#fca5a5", color: "#b91c1c", icon: "🗑️" };
    }
    switch (jobStatus) {
      case "open":
        return { label: "Đang tuyển", bg: "#ecfdf5", border: "#a7f3d0", color: "#047857", icon: "🟢" };
      case "draft":
        return { label: "Bản nháp", bg: "#fef3c7", border: "#fde68a", color: "#b45309", icon: "📝" };
      case "paused":
        return { label: "Tạm dừng", bg: "#fff7ed", border: "#fed7aa", color: "#c2410c", icon: "⏸️" };
      case "closed":
        return { label: "Đã đóng", bg: "#f1f5f9", border: "#cbd5e1", color: "#475569", icon: "🔒" };
      default:
        return { label: jobStatus, bg: "#f8fafc", border: "#e2e8f0", color: "#64748b", icon: "📌" };
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
          <Text style={uiStyles.emptyIcon}>🔒</Text>
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
          <Text style={uiStyles.emptyIcon}>🏢</Text>
          <Text style={uiStyles.emptyTitle}>Chưa chọn chi nhánh</Text>
          <Text style={uiStyles.emptyText}>
            {user?.role === "admin"
              ? "Vui lòng chọn chi nhánh làm việc trong mục Tài khoản để quản lý tin tuyển dụng."
              : "Hồ sơ của bạn chưa được liên kết với chi nhánh làm việc."}
          </Text>
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
                <Text style={{ fontSize: 18, color: "#334155", fontWeight: "700" }}>‹</Text>
              </Pressable>
              <View style={uiStyles.headerLeft}>
                <Text style={uiStyles.headerTitle}>Tin tuyển dụng</Text>
                {isOwner ? (
                  <BranchSelector
                    renderCustomTrigger={(open) => (
                      <Pressable
                        onPress={open}
                        style={[
                          uiStyles.branchRow,
                          {
                            backgroundColor: "#f0fdf4",
                            borderColor: "#bbf7d0",
                            borderWidth: 1,
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                            borderRadius: 10,
                            marginTop: 2,
                          },
                        ]}
                      >
                        <View style={[uiStyles.branchDot, { backgroundColor: "#16a34a" }]} />
                        <Text style={[uiStyles.branchName, { color: "#15803d", fontWeight: "700" }]}>
                          {selectedBranch?.name || "Toàn công ty"} ▾
                        </Text>
                      </Pressable>
                    )}
                  />
                ) : (
                  <View style={uiStyles.branchRow}>
                    <View style={uiStyles.branchDot} />
                    <Text style={uiStyles.branchName}>
                      {selectedBranch?.name || user?.branchName || "Toàn công ty"}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            <View style={uiStyles.headerRight}>
              <Pressable
                style={({ pressed }) => [uiStyles.refreshBtn, pressed && { opacity: 0.7 }]}
                onPress={() => setRevision((v) => v + 1)}
                disabled={disabled}
              >
                <Text style={uiStyles.refreshBtnText}>↻</Text>
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
                  <Text style={uiStyles.createBtnIcon}>+</Text>
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
            <Text style={uiStyles.searchIcon}>🔍</Text>
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
                <Text style={uiStyles.clearSearchText}>✕</Text>
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
                  <Text
                    style={[
                      uiStyles.filterChipText,
                      isSelected && uiStyles.filterChipTextActive,
                    ]}
                  >
                    {item.value === "open"
                      ? "🟢 Đang tuyển"
                      : item.value === "draft"
                        ? "📝 Bản nháp"
                        : item.value === "paused"
                          ? "⏸️ Tạm dừng"
                          : "🔒 Đã đóng"}
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
              <Text
                style={[
                  uiStyles.filterChipText,
                  deleted && uiStyles.filterChipTextActiveDanger,
                ]}
              >
                {deleted ? "✓ Thùng rác" : "🗑️ Thùng rác"}
              </Text>
            </Pressable>
          </ScrollView>

          {/* Alert / Notification banners */}
          <ErrorText message={error} />
          <ErrorText message={mutationError} />
          {success && (
            <View style={uiStyles.successBanner}>
              <Text style={uiStyles.successBannerIcon}>✓</Text>
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
                    <Text style={[uiStyles.statusBadgeText, { color: badge.color }]}>
                      {badge.icon} {badge.label}
                    </Text>
                  </View>
                </View>

                {/* Job Title & Department */}
                <Text style={uiStyles.jobTitle}>{job.title || "Chưa đặt tiêu đề"}</Text>
                <View style={uiStyles.departmentRow}>
                  <Text style={uiStyles.deptIcon}>🏢</Text>
                  <Text style={uiStyles.departmentText}>
                    {job.department || "Chưa phân bổ phòng ban"}
                  </Text>
                </View>

                {/* 2x2 Key Info Grid */}
                <View style={uiStyles.gridContainer}>
                  <View style={uiStyles.gridItem}>
                    <Text style={uiStyles.gridItemIcon}>👥</Text>
                    <View style={uiStyles.gridItemContent}>
                      <Text style={uiStyles.gridItemLabel}>Số lượng</Text>
                      <Text style={uiStyles.gridItemVal}>{job.headcount} chỉ tiêu</Text>
                    </View>
                  </View>

                  <View style={uiStyles.gridItem}>
                    <Text style={uiStyles.gridItemIcon}>💰</Text>
                    <View style={uiStyles.gridItemContent}>
                      <Text style={uiStyles.gridItemLabel}>Mức lương</Text>
                      <Text style={uiStyles.gridItemVal} numberOfLines={1}>
                        {formatSalaryRange(job)}
                      </Text>
                    </View>
                  </View>

                  <View style={uiStyles.gridItem}>
                    <Text style={uiStyles.gridItemIcon}>📍</Text>
                    <View style={uiStyles.gridItemContent}>
                      <Text style={uiStyles.gridItemLabel}>Địa điểm</Text>
                      <Text style={uiStyles.gridItemVal} numberOfLines={1}>
                        {job.location || "Tại chi nhánh"}
                      </Text>
                    </View>
                  </View>

                  <View style={uiStyles.gridItem}>
                    <Text style={uiStyles.gridItemIcon}>💼</Text>
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
                    <Text style={uiStyles.deadlineIcon}>
                      {deadline.isExpired ? "⚠️" : deadline.isNear ? "⏳" : "📅"}
                    </Text>
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
                      <Text style={uiStyles.applicantsBtnIcon}>👥</Text>
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
                      <Text style={uiStyles.editBtnText}>✏️ Sửa</Text>
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
                    <Text
                      style={[
                        uiStyles.expandBtnText,
                        isExpanded && uiStyles.expandBtnTextActive,
                      ]}
                    >
                      {isExpanded ? "Thu gọn ▲" : "Chi tiết ▼"}
                    </Text>
                  </Pressable>
                </View>

                {/* Collapsible Expanded Details */}
                {isExpanded && (
                  <View style={uiStyles.expandedSection}>
                    {/* JD and Attachments */}
                    <PublicDocumentLink title="📄 Mô tả công việc (JD File)" url={job.jdFileUrl} />
                    {!deleted && <AttachmentPanel kind="job" id={job._id} manage={access.manage} />}

                    {/* Detailed Content Blocks */}
                    {job.description ? (
                      <View style={uiStyles.detailBlock}>
                        <Text style={uiStyles.detailBlockTitle}>📋 Mô tả công việc</Text>
                        <Text style={uiStyles.detailBlockContent}>{job.description}</Text>
                      </View>
                    ) : null}

                    {job.requirements ? (
                      <View style={uiStyles.detailBlock}>
                        <Text style={uiStyles.detailBlockTitle}>🎯 Yêu cầu ứng viên</Text>
                        <Text style={uiStyles.detailBlockContent}>{job.requirements}</Text>
                      </View>
                    ) : null}

                    {job.benefits ? (
                      <View style={uiStyles.detailBlock}>
                        <Text style={uiStyles.detailBlockTitle}>🎁 Quyền lợi đãi ngộ</Text>
                        <Text style={uiStyles.detailBlockContent}>{job.benefits}</Text>
                      </View>
                    ) : null}

                    {/* Management Action Buttons */}
                    {access.manage && (
                      <View style={uiStyles.manageSection}>
                        <Text style={uiStyles.manageSectionTitle}>⚙️ Thao tác quản lý tin</Text>
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
                            <Text style={uiStyles.restoreActionBtnText}>♻️ Khôi phục tin</Text>
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
                                  <Text style={uiStyles.statusChangeBtnText}>
                                    {item.value === "open"
                                      ? "🟢 Đang tuyển"
                                      : item.value === "draft"
                                        ? "📝 Bản nháp"
                                        : item.value === "paused"
                                          ? "⏸️ Tạm dừng"
                                          : "🔒 Đóng tin"}
                                  </Text>
                                </Pressable>
                              ))}
                            </View>

                            <Pressable
                              style={({ pressed }) => [
                                uiStyles.deleteActionBtn,
                                disabled && uiStyles.btnDisabled,
                                pressed && { opacity: 0.8 },
                              ]}
                              disabled={disabled || uncertain}
                              onPress={() => confirm(job, "delete", "Chuyển tin vào thùng rác?")}
                            >
                              <Text style={uiStyles.deleteActionBtnText}>🗑️ Xóa vào thùng rác</Text>
                            </Pressable>
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
              <Text style={uiStyles.emptyStateEmoji}>💼</Text>
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
                    style={[uiStyles.createBtn, { paddingHorizontal: 16 }]}
                    onPress={() => setEditing("new")}
                  >
                    <Text style={uiStyles.createBtnText}>+ Tạo tin mới</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      uiStyles.createBtn,
                      { backgroundColor: "#0284c7", paddingHorizontal: 16 },
                      seeding && uiStyles.btnDisabled,
                    ]}
                    disabled={seeding}
                    onPress={handleSeedDemo}
                  >
                    <Text style={uiStyles.createBtnText}>
                      {seeding ? "Đang tạo..." : "✨ Thêm 3 tin mẫu"}
                    </Text>
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
                <Text
                  style={[
                    uiStyles.pageBtnText,
                    (disabled || page <= 1) && uiStyles.pageBtnTextDisabled,
                  ]}
                >
                  ◀ Trang trước
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
                  Trang sau ▶
                </Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Modal for Creating / Editing Job */}
      <Modal
        visible={editing !== null && access.manage}
        animationType="slide"
        onRequestClose={closeForm}
      >
        <SafeAreaView style={uiStyles.modalSafeArea} edges={["top", "bottom"]}>
          <View style={uiStyles.modalHeader}>
            <View>
              <Text style={uiStyles.modalTitle}>
                {editing === "new" ? "Tạo tin tuyển dụng mới" : `Sửa tin: ${typeof editing === "object" ? editing?.code : ""}`}
              </Text>
              <Text style={uiStyles.modalSubtitle}>
                Điền đầy đủ thông tin để thu hút ứng viên tài năng
              </Text>
            </View>
            <Pressable
              style={({ pressed }) => [uiStyles.modalCloseBtn, pressed && { opacity: 0.7 }]}
              onPress={closeForm}
            >
              <Text style={uiStyles.modalCloseText}>✕</Text>
            </Pressable>
          </View>

          {editing && access.manage && (
            <JobForm
              job={editing === "new" ? undefined : editing}
              setLocked={(val) => {
                formLock.current = val;
              }}
              onClose={() => {
                setEditing(null);
                setRevision((v) => v + 1);
              }}
            />
          )}
        </SafeAreaView>
      </Modal>
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
    marginBottom: 2,
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
  },
  statusChangeBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#334155",
  },
  deleteActionBtn: {
    backgroundColor: "#fee2e2",
    borderWidth: 1,
    borderColor: "#fca5a5",
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
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
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
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
