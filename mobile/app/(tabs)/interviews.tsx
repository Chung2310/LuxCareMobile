import { useCallback, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import type { RecruitmentApplicant, RecruitmentInterview, RecruitmentJob } from "../../../src/types/recruitment";
import type { UserProfile } from "../../../src/types/common";
import { emptyPagination, type PaginationMeta } from "../../../src/types/pagination";
import { recruitment, roster } from "../../src/api/services";
import { messageOf, useSession } from "../../src/auth/SessionProvider";
import { EmptyState, ErrorText, Loading, Page } from "../../src/ui";
import { RecruitmentGate } from "../../src/features/recruitment/RecruitmentGate";
import { RecruitmentModal } from "../../src/features/recruitment/RecruitmentModal";
import { RecruitmentSubnav } from "../../src/features/recruitment/RecruitmentSubnav";
import { InterviewForm } from "../../src/features/recruitment/InterviewForm";
import { formatDateTime, INTERVIEW_STATUS_CHOICES } from "../../src/features/recruitment/recruitmentModel";
import { recruitmentAccess } from "../../src/features/recruitment/access";

function Pagination({ meta, onChange }: { meta: PaginationMeta; onChange: (page: number) => void }) {
  if (meta.totalPages <= 1) return null;
  return (
    <View style={ivStyles.paginationRow}>
      <Pressable
        style={[ivStyles.pageBtn, meta.page <= 1 && ivStyles.pageBtnDisabled]}
        disabled={meta.page <= 1}
        onPress={() => onChange(meta.page - 1)}
      >
        <Text style={ivStyles.pageBtnText}>‹ Trước</Text>
      </Pressable>
      <Text style={ivStyles.pageInfo}>
        Trang {meta.page}/{meta.totalPages} ({meta.total} lịch)
      </Text>
      <Pressable
        style={[ivStyles.pageBtn, meta.page >= meta.totalPages && ivStyles.pageBtnDisabled]}
        disabled={meta.page >= meta.totalPages}
        onPress={() => onChange(meta.page + 1)}
      >
        <Text style={ivStyles.pageBtnText}>Sau ›</Text>
      </Pressable>
    </View>
  );
}

function interviewPlace(item: RecruitmentInterview) {
  if (item.format === "online") return item.meetingLink ? `💻 ${item.meetingLink}` : "💻 Trực tuyến";
  if (item.format === "phone") return "📞 Phỏng vấn qua điện thoại";
  return item.location ? `🏢 ${item.location}` : "🏢 Tại văn phòng cơ sở";
}

export default function Interviews() {
  const { user, selectedBranch } = useSession();
  const access = recruitmentAccess(user);
  const params = useLocalSearchParams<{ applicantId?: string; jobId?: string }>();
  const applicantId = typeof params.applicantId === "string" ? params.applicantId : "";
  const jobId = typeof params.jobId === "string" ? params.jobId : "";
  const scopeReady = Boolean(user?.companyCode || selectedBranch?._id || user?.branchId);

  const [rows, setRows] = useState<RecruitmentInterview[]>([]);
  const [applicants, setApplicants] = useState<RecruitmentApplicant[]>([]);
  const [jobs, setJobs] = useState<RecruitmentJob[]>([]);
  const [people, setPeople] = useState<UserProfile[]>([]);
  const [pagination, setPagination] = useState(emptyPagination);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [mine, setMine] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<RecruitmentInterview | "new" | null>(null);
  const [viewing, setViewing] = useState<RecruitmentInterview | null>(null);
  const [seeding, setSeeding] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (!access.read || !scopeReady || !user?.companyCode) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [interviewPage, applicantRows, jobRows, peopleRows] = await Promise.all([
        recruitment.listInterviewsPage({
          page,
          limit: 20,
          status,
          ...(applicantId ? { applicantId } : {}),
          ...(mine ? { interviewerId: user.uid } : {}),
        }),
        recruitment.listApplicants({ limit: 100 }).catch(() => [] as RecruitmentApplicant[]),
        recruitment.listJobs({ limit: 100 }).catch(() => [] as RecruitmentJob[]),
        roster
          .list(user.companyCode, selectedBranch?._id || user.branchId)
          .catch(() => [] as UserProfile[]),
      ]);
      setRows(interviewPage.data);
      setPagination(interviewPage.pagination);
      setApplicants(applicantRows);
      setJobs(jobRows);
      setPeople(peopleRows);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [access.read, applicantId, mine, page, scopeReady, selectedBranch?._id, status, user?.branchId, user?.companyCode, user?.uid]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const handleSeedDemoInterviews = async () => {
    if (seeding || !access.manage) return;
    setSeeding(true);
    try {
      let activeJobs = jobs;
      if (!activeJobs || activeJobs.length === 0) {
        const j = await recruitment.createJob({
          code: `TD-${Date.now().toString().slice(-4)}`,
          title: "Bác sĩ Đa khoa",
          department: "Khám bệnh",
          headcount: 2,
          employmentType: "full_time",
          workplaceType: "onsite",
          location: selectedBranch?.name || "Cơ sở chính",
          salaryMin: 25000000,
          salaryMax: 40000000,
          showSalary: true,
          status: "open",
        });
        activeJobs = [j];
        setJobs(activeJobs);
      }

      let activeApplicants = applicants;
      if (!activeApplicants || activeApplicants.length === 0) {
        const a = await recruitment.createApplicant({
          jobId: activeJobs[0]._id,
          fullName: "Nguyễn Văn An",
          email: "nguyenvanan.bs@gmail.com",
          phone: "0912345678",
          source: "Website tuyển dụng",
          confirmDuplicate: true,
        });
        activeApplicants = [a];
        setApplicants(activeApplicants);
      }

      const targetApplicant = activeApplicants[0];
      const tomorrow = new Date(Date.now() + 86400000);
      tomorrow.setHours(9, 0, 0, 0);
      const tomorrowEnd = new Date(tomorrow.getTime() + 60 * 60000);

      await recruitment.createInterview({
        applicantId: targetApplicant._id,
        jobId: targetApplicant.jobId || activeJobs[0]._id,
        scheduledStart: tomorrow.toISOString(),
        scheduledEnd: tomorrowEnd.toISOString(),
        format: "onsite",
        location: selectedBranch?.name || "Phòng hội chẩn 1 - Cơ sở chính",
        interviewerIds: user?.uid ? [user.uid] : [],
        notes: "Phỏng vấn chuyên môn y khoa & đánh giá kinh nghiệm lâm sàng.",
        status: "scheduled",
      });

      const dayAfter = new Date(Date.now() + 2 * 86400000);
      dayAfter.setHours(14, 30, 0, 0);
      const dayAfterEnd = new Date(dayAfter.getTime() + 45 * 60000);

      await recruitment.createInterview({
        applicantId: targetApplicant._id,
        jobId: targetApplicant.jobId || activeJobs[0]._id,
        scheduledStart: dayAfter.toISOString(),
        scheduledEnd: dayAfterEnd.toISOString(),
        format: "online",
        meetingLink: "https://meet.google.com/lux-care-interview",
        interviewerIds: user?.uid ? [user.uid] : [],
        notes: "Phỏng vấn sơ loại tác phong làm việc & mức độ phù hợp văn hóa.",
        status: "scheduled",
      });

      await load();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setSeeding(false);
    }
  };

  const getStatusBadge = (ivStatus: string) => {
    switch (ivStatus) {
      case "scheduled":
        return { label: "Đã lên lịch", bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" };
      case "completed":
        return { label: "Đã hoàn thành", bg: "#ecfdf5", color: "#047857", border: "#a7f3d0" };
      case "cancelled":
        return { label: "Đã hủy", bg: "#fff1f2", color: "#be123c", border: "#fecdd3" };
      case "rescheduled":
        return { label: "Dời lịch", bg: "#fef3c7", color: "#b45309", border: "#fde68a" };
      default:
        return { label: ivStatus, bg: "#f8fafc", color: "#64748b", border: "#e2e8f0" };
    }
  };

  if (!access.read) {
    return (
      <Page title="Lịch hẹn phỏng vấn">
        <RecruitmentSubnav active="interviews" />
        <EmptyState
          message="Không có quyền truy cập"
          subtitle="Tài khoản của bạn cần có quyền đọc phân hệ Tuyển dụng / HR."
        />
      </Page>
    );
  }

  return (
    <>
      <SafeAreaView style={ivStyles.safeContainer} edges={["top"]}>
        <ScrollView
          style={ivStyles.scroll}
          contentContainerStyle={ivStyles.scrollContent}
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
          <View style={ivStyles.headerRow}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
              <Pressable
                onPress={() => (router.canGoBack() ? router.back() : router.push("/(tabs)/recruitment"))}
                style={ivStyles.backBtn}
              >
                <Text style={ivStyles.backBtnText}>‹</Text>
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={ivStyles.headerTitle}>Lịch phỏng vấn</Text>
                <Text style={ivStyles.headerSub}>
                  {selectedBranch?.name || user?.branchName || "Toàn công ty"} · {pagination.total || rows.length} lịch hẹn
                </Text>
              </View>
            </View>

            {access.manage && (
              <Pressable
                style={({ pressed }) => [ivStyles.addBtn, pressed && { opacity: 0.8 }]}
                onPress={() => setEditing("new")}
              >
                <Text style={ivStyles.addBtnIcon}>+</Text>
                <Text style={ivStyles.addBtnText}>Lên lịch</Text>
              </Pressable>
            )}
          </View>

          {/* Sub Navigation Bar */}
          <RecruitmentSubnav active="interviews" />

          {/* Filter By Applicant notice if active */}
          {!!applicantId && (
            <View style={ivStyles.filterBanner}>
              <Text style={ivStyles.filterBannerText}>
                📌 Đang lọc ứng viên:{" "}
                <Text style={{ fontWeight: "700" }}>
                  {applicants.find((a) => a._id === applicantId)?.fullName || applicantId}
                </Text>
              </Text>
              <Pressable onPress={() => router.setParams({ applicantId: "", jobId: "" })}>
                <Text style={ivStyles.filterBannerClear}>✕ Xem toàn bộ</Text>
              </Pressable>
            </View>
          )}

          {/* Status Filter Chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ivStyles.chipsScroll}>
            <Pressable
              style={[ivStyles.filterChip, status === "" && !mine && ivStyles.filterChipActive]}
              onPress={() => {
                setStatus("");
                setMine(false);
                setPage(1);
              }}
            >
              <Text style={[ivStyles.filterChipText, status === "" && !mine && ivStyles.filterChipTextActive]}>
                Tất cả
              </Text>
            </Pressable>

            <Pressable
              style={[ivStyles.filterChip, mine && ivStyles.filterChipActive]}
              onPress={() => {
                setMine((v) => !v);
                setPage(1);
              }}
            >
              <Text style={[ivStyles.filterChipText, mine && ivStyles.filterChipTextActive]}>
                👤 Lịch của tôi
              </Text>
            </Pressable>

            {INTERVIEW_STATUS_CHOICES.map((choice) => (
              <Pressable
                key={choice.value}
                style={[ivStyles.filterChip, status === choice.value && ivStyles.filterChipActive]}
                onPress={() => {
                  setStatus(choice.value);
                  setPage(1);
                }}
              >
                <Text style={[ivStyles.filterChipText, status === choice.value && ivStyles.filterChipTextActive]}>
                  {choice.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <ErrorText message={error} />
          {loading && <Loading />}

          {/* Interview Cards List */}
          {!loading && rows.length > 0 && (
            <View style={{ gap: 10 }}>
              {rows.map((item) => {
                const badge = getStatusBadge(item.status);
                const candidate = applicants.find((a) => a._id === item.applicantId);
                const job = jobs.find((j) => j._id === item.jobId);
                const interviewerNames = item.interviewerIds
                  .map((id) => people.find((p) => p.uid === id)?.displayName || id)
                  .filter(Boolean);

                return (
                  <View key={item._id} style={ivStyles.interviewCard}>
                    {/* Header Row: Time & Status */}
                    <View style={ivStyles.cardHeaderRow}>
                      <View style={ivStyles.timeBadge}>
                        <Text style={ivStyles.timeBadgeText}>
                          🕒 {formatDateTime(item.scheduledStart)}
                        </Text>
                      </View>
                      <View
                        style={[
                          ivStyles.badgePill,
                          { backgroundColor: badge.bg, borderColor: badge.border },
                        ]}
                      >
                        <Text style={[ivStyles.badgePillText, { color: badge.color }]}>
                          {badge.label}
                        </Text>
                      </View>
                    </View>

                    {/* Candidate & Job Info */}
                    <View style={{ gap: 2 }}>
                      <Text style={ivStyles.candidateName}>
                        👤 {candidate?.fullName || "Ứng viên"}
                      </Text>
                      <Text style={ivStyles.jobTitleText}>
                        💼 Vị trí: {job?.title || "Chưa gán tin"}
                      </Text>
                    </View>

                    {/* Location / Meeting format */}
                    <View style={ivStyles.placeBox}>
                      <Text style={ivStyles.placeText}>{interviewPlace(item)}</Text>
                    </View>

                    {/* Interviewers info */}
                    {interviewerNames.length > 0 && (
                      <Text style={ivStyles.interviewerText}>
                        👥 Hội đồng PV: {interviewerNames.join(", ")}
                      </Text>
                    )}

                    {/* Action buttons */}
                    <View style={ivStyles.cardActionsRow}>
                      <Pressable
                        style={ivStyles.actionBtn}
                        onPress={() => setViewing(item)}
                      >
                        <Text style={ivStyles.actionBtnText}>👁️ Chi tiết</Text>
                      </Pressable>

                      {access.manage && (
                        <Pressable
                          style={[ivStyles.actionBtn, ivStyles.actionBtnPrimary]}
                          onPress={() => setEditing(item)}
                        >
                          <Text style={[ivStyles.actionBtnText, ivStyles.actionBtnPrimaryText]}>
                            ✏️ Sửa
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Empty State with Seed Action */}
          {!loading && rows.length === 0 && (
            <View style={ivStyles.emptyBox}>
              <Text style={ivStyles.emptyEmoji}>📅</Text>
              <Text style={ivStyles.emptyTitle}>Chưa có lịch hẹn phỏng vấn</Text>
              <Text style={ivStyles.emptyDesc}>
                {status || mine
                  ? "Không tìm thấy lịch hẹn phỏng vấn phù hợp với bộ lọc."
                  : "Chưa có buổi phỏng vấn nào được lên lịch trong hệ thống."}
              </Text>
              {status || mine ? (
                <Pressable
                  style={ivStyles.resetBtn}
                  onPress={() => {
                    setStatus("");
                    setMine(false);
                    setPage(1);
                  }}
                >
                  <Text style={ivStyles.resetBtnText}>Xóa bộ lọc</Text>
                </Pressable>
              ) : access.manage ? (
                <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
                  <Pressable
                    style={ivStyles.primaryBtn}
                    onPress={() => setEditing("new")}
                  >
                    <Text style={ivStyles.primaryBtnText}>+ Lên lịch mới</Text>
                  </Pressable>
                  <Pressable
                    style={[ivStyles.primaryBtn, { backgroundColor: "#0284c7" }, seeding && { opacity: 0.6 }]}
                    disabled={seeding}
                    onPress={handleSeedDemoInterviews}
                  >
                    <Text style={ivStyles.primaryBtnText}>
                      {seeding ? "Đang tạo..." : "✨ Thêm 2 lịch PV mẫu"}
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
        <InterviewForm
          interview={editing === "new" ? undefined : editing}
          applicantId={applicantId}
          jobId={jobId}
          applicants={applicants}
          jobs={jobs}
          people={people}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await load();
          }}
        />
      )}

      {viewing && (
        <RecruitmentModal title="Chi tiết lịch phỏng vấn" visible onClose={() => setViewing(null)}>
          <View style={{ gap: 10, padding: 4 }}>
            <View style={{ gap: 2 }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: "#0f172a" }}>
                {applicants.find((c) => c._id === viewing.applicantId)?.fullName || "Ứng viên"}
              </Text>
              <Text style={{ fontSize: 13, color: "#64748b" }}>
                Vị trí: {jobs.find((j) => j._id === viewing.jobId)?.title || "—"}
              </Text>
            </View>

            <View style={{ backgroundColor: "#f8fafc", padding: 12, borderRadius: 10, gap: 6 }}>
              <Text style={{ fontSize: 12, color: "#334155" }}>
                🕒 <Text style={{ fontWeight: "700" }}>Bắt đầu:</Text> {formatDateTime(viewing.scheduledStart)}
              </Text>
              <Text style={{ fontSize: 12, color: "#334155" }}>
                🕒 <Text style={{ fontWeight: "700" }}>Kết thúc:</Text> {formatDateTime(viewing.scheduledEnd)}
              </Text>
              <Text style={{ fontSize: 12, color: "#334155" }}>
                📍 <Text style={{ fontWeight: "700" }}>Hình thức:</Text>{" "}
                {viewing.format === "online" ? "Trực tuyến" : viewing.format === "phone" ? "Điện thoại" : "Tại văn phòng"}
              </Text>
              <Text style={{ fontSize: 12, color: "#334155" }}>
                🏢 <Text style={{ fontWeight: "700" }}>Địa điểm/link:</Text> {interviewPlace(viewing)}
              </Text>
              <Text style={{ fontSize: 12, color: "#334155" }}>
                👥 <Text style={{ fontWeight: "700" }}>Người PV:</Text>{" "}
                {viewing.interviewerIds.map((id) => people.find((p) => p.uid === id)?.displayName || id).join(", ") || "—"}
              </Text>
              {viewing.result ? (
                <Text style={{ fontSize: 12, color: "#334155" }}>
                  🎯 <Text style={{ fontWeight: "700" }}>Kết quả:</Text> {viewing.result}
                </Text>
              ) : null}
              {viewing.notes ? (
                <Text style={{ fontSize: 12, color: "#334155" }}>
                  📝 <Text style={{ fontWeight: "700" }}>Ghi chú:</Text> {viewing.notes}
                </Text>
              ) : null}
            </View>

            <View style={{ flexDirection: "row", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
              {access.manage && (
                <Pressable
                  style={[ivStyles.primaryBtn, { backgroundColor: "#0284c7" }]}
                  onPress={() => {
                    setEditing(viewing);
                    setViewing(null);
                  }}
                >
                  <Text style={ivStyles.primaryBtnText}>Chỉnh sửa</Text>
                </Pressable>
              )}
              <Pressable style={ivStyles.resetBtn} onPress={() => setViewing(null)}>
                <Text style={ivStyles.resetBtnText}>Đóng</Text>
              </Pressable>
            </View>
          </View>
        </RecruitmentModal>
      )}
    </>
  );
}

const ivStyles = StyleSheet.create({
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
  filterBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#eff6ff",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  filterBannerText: {
    fontSize: 12,
    color: "#1e40af",
    flex: 1,
  },
  filterBannerClear: {
    fontSize: 12,
    fontWeight: "700",
    color: "#dc2626",
    marginLeft: 8,
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
  interviewCard: {
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
    justifyContent: "space-between",
    gap: 10,
  },
  timeBadge: {
    backgroundColor: "#f8fafc",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  timeBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0f172a",
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
  candidateName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
  },
  jobTitleText: {
    fontSize: 12,
    color: "#64748b",
  },
  placeBox: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  placeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#334155",
  },
  interviewerText: {
    fontSize: 11,
    color: "#64748b",
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
