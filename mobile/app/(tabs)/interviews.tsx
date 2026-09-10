import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import type { RecruitmentApplicant, RecruitmentInterview, RecruitmentJob } from "../../../src/types/recruitment";
import type { UserProfile } from "../../../src/types/common";
import { emptyPagination, type PaginationMeta } from "../../../src/types/pagination";
import { recruitment, roster } from "../../src/api/services";
import { messageOf, useSession } from "../../src/auth/SessionProvider";
import { Button, Card, EmptyState, ErrorText, Loading, Page, styles } from "../../src/ui";
import { ChoiceField } from "../../src/features/leave/ChoiceField";
import { RecruitmentGate } from "../../src/features/recruitment/RecruitmentGate";
import { RecruitmentModal } from "../../src/features/recruitment/RecruitmentModal";
import { RecruitmentSubnav } from "../../src/features/recruitment/RecruitmentSubnav";
import { InterviewForm } from "../../src/features/recruitment/InterviewForm";
import { formatDateTime, INTERVIEW_STATUS_CHOICES } from "../../src/features/recruitment/recruitmentModel";
import { recruitmentAccess } from "../../src/features/recruitment/access";

function Pagination({ meta, onChange }: { meta: PaginationMeta; onChange: (page: number) => void }) {
  if (meta.totalPages <= 1) return null;
  return (
    <View style={styles.row}>
      <Button title="‹ Trước" disabled={meta.page <= 1} onPress={() => onChange(meta.page - 1)} />
      <Text style={styles.muted}>Trang {meta.page}/{meta.totalPages}</Text>
      <Button title="Sau ›" disabled={meta.page >= meta.totalPages} onPress={() => onChange(meta.page + 1)} />
    </View>
  );
}

function interviewPlace(item: RecruitmentInterview) {
  if (item.format === "online") return item.meetingLink || "Trực tuyến";
  if (item.format === "phone") return "Điện thoại";
  return item.location || "Tại văn phòng";
}

export default function Interviews() {
  const { user, selectedBranch } = useSession();
  const access = recruitmentAccess(user);
  const params = useLocalSearchParams<{ applicantId?: string; jobId?: string }>();
  const applicantId = typeof params.applicantId === "string" ? params.applicantId : "";
  const jobId = typeof params.jobId === "string" ? params.jobId : "";
  const scopeReady = user?.role === "admin" ? Boolean(selectedBranch?._id) : Boolean(user?.branchId);
  const [rows, setRows] = useState<RecruitmentInterview[]>([]);
  const [applicants, setApplicants] = useState<RecruitmentApplicant[]>([]);
  const [jobs, setJobs] = useState<RecruitmentJob[]>([]);
  const [people, setPeople] = useState<UserProfile[]>([]);
  const [pagination, setPagination] = useState(emptyPagination);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [mine, setMine] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<RecruitmentInterview | "new" | null>(null);
  const [viewing, setViewing] = useState<RecruitmentInterview | null>(null);

  const load = useCallback(async () => {
    if (!access.read || !scopeReady || !user?.companyCode) return;
    setLoading(true);
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
        recruitment.listApplicants({ limit: 100 }),
        recruitment.listJobs({ limit: 100 }),
        roster.list(user.companyCode, user.role === "admin" ? selectedBranch?._id : user.branchId),
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
    }
  }, [access.read, applicantId, mine, page, scopeReady, selectedBranch?._id, status, user?.branchId, user?.companyCode, user?.role, user?.uid]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  if (!access.read || !scopeReady)
    return <RecruitmentGate title="Lịch hẹn phỏng vấn" user={user} access={access} scopeReady={scopeReady} />;

  return (
    <>
      <Page title="Lịch hẹn phỏng vấn">
        <RecruitmentSubnav active="interviews" />
        <View style={styles.row}>
          {access.manage && (
            <Button
              title={applicantId ? "Lên lịch cho ứng viên" : "+ Lên lịch phỏng vấn"}
              onPress={() => setEditing("new")}
            />
          )}
          <Button title="Tải lại" disabled={loading} onPress={() => void load()} />
        </View>
        {!!applicantId && (
          <Card>
            <Text style={styles.text}>Đang lọc ứng viên: {applicants.find((item) => item._id === applicantId)?.fullName || applicantId}</Text>
            <Button title="Xem toàn bộ lịch" onPress={() => router.setParams({ applicantId: "", jobId: "" })} />
          </Card>
        )}
        <ChoiceField
          label="Trạng thái"
          value={status}
          choices={[{ value: "", label: "Mọi trạng thái" }, ...INTERVIEW_STATUS_CHOICES]}
          disabled={loading}
          onChange={(value) => { setStatus(value); setPage(1); }}
        />
        <Button title={mine ? "✓ Chỉ lịch tôi tham gia" : "Chỉ xem lịch tôi tham gia"} onPress={() => { setMine((value) => !value); setPage(1); }} />
        <ErrorText message={error} />
        {loading && <Loading />}
        {!loading && !rows.length && <EmptyState message="Chưa có lịch phỏng vấn trong chi nhánh này." />}
        {!loading && rows.map((item) => (
          <Card key={item._id}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.heading}>{formatDateTime(item.scheduledStart)}</Text>
                <Text style={styles.muted}>đến {formatDateTime(item.scheduledEnd)}</Text>
              </View>
              <Text style={styles.text}>{INTERVIEW_STATUS_CHOICES.find((choice) => choice.value === item.status)?.label || item.status}</Text>
            </View>
            <Text style={styles.text}>Ứng viên: {applicants.find((candidate) => candidate._id === item.applicantId)?.fullName || "Ứng viên"}</Text>
            <Text style={styles.muted}>Vị trí: {jobs.find((job) => job._id === item.jobId)?.title || "—"}</Text>
            <Text style={styles.muted}>{interviewPlace(item)}</Text>
            <View style={styles.row}>
              <Button title="Xem chi tiết" onPress={() => setViewing(item)} />
              {access.manage && <Button title="Sửa" onPress={() => setEditing(item)} />}
            </View>
          </Card>
        ))}
        <Pagination meta={pagination} onChange={setPage} />
      </Page>
      {editing && (
        <InterviewForm
          interview={editing === "new" ? undefined : editing}
          applicantId={applicantId}
          jobId={jobId}
          applicants={applicants}
          jobs={jobs}
          people={people}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await load(); }}
        />
      )}
      {viewing && (
        <RecruitmentModal title="Chi tiết lịch phỏng vấn" visible onClose={() => setViewing(null)}>
          <Card>
            <Text style={styles.heading}>{applicants.find((candidate) => candidate._id === viewing.applicantId)?.fullName || "Ứng viên"}</Text>
            <Text style={styles.text}>Vị trí: {jobs.find((job) => job._id === viewing.jobId)?.title || "—"}</Text>
            <Text style={styles.text}>Bắt đầu: {formatDateTime(viewing.scheduledStart)}</Text>
            <Text style={styles.text}>Kết thúc: {formatDateTime(viewing.scheduledEnd)}</Text>
            <Text style={styles.text}>Hình thức: {viewing.format === "online" ? "Trực tuyến" : viewing.format === "phone" ? "Điện thoại" : "Tại văn phòng"}</Text>
            <Text style={styles.text}>Địa điểm/link: {interviewPlace(viewing)}</Text>
            <Text style={styles.text}>Người phỏng vấn: {viewing.interviewerIds.map((id) => people.find((person) => person.uid === id)?.displayName || id).join(", ") || "—"}</Text>
            <Text style={styles.text}>Kết quả: {viewing.result || "—"}</Text>
            <Text style={styles.text}>Ghi chú: {viewing.notes || "—"}</Text>
          </Card>
          {access.manage && <Button title="Chỉnh sửa" onPress={() => { setEditing(viewing); setViewing(null); }} />}
          <Button title="Đóng" onPress={() => setViewing(null)} />
        </RecruitmentModal>
      )}
    </>
  );
}
