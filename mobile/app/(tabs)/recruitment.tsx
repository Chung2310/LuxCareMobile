import { useCallback, useRef, useState } from "react";
import { Alert, Modal, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { JobForm } from "../../src/features/recruitment/JobForm";
import { AttachmentPanel } from "../../src/features/recruitment/AttachmentPanel";
import { PublicDocumentLink } from "../../src/features/recruitment/PublicDocumentLink";
import { router, useFocusEffect } from "expo-router";
import type { RecruitmentJob } from "../../../src/types/recruitment";
import { emptyPagination } from "../../../src/types/pagination";
import { recruitment } from "../../src/api/services";
import { messageOf, useSession } from "../../src/auth/SessionProvider";
import { RecruitmentSubnav } from "../../src/features/recruitment/RecruitmentSubnav";
import { Button, Card, EmptyState, ErrorText, Field, Loading, Page, styles } from "../../src/ui";
import { ChoiceField } from "../../src/features/leave/ChoiceField";
import { JOB_STATUSES, recruitmentAccess } from "../../src/features/recruitment/access";
export default function Recruitment() {
  const { user, selectedBranch } = useSession();
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
    setRevision((value) => value + 1);
  };
  const scopeReady = user?.role === "admin" ? !!selectedBranch?._id : !!user?.branchId;
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setJobs([]);
      setExpanded(null);
      setError(null);
      setPagination(emptyPagination);
      setLoading(false);
      if (!access.read || !scopeReady) return;
      setLoading(true);
      void recruitment
        .listJobsPage({ page, limit: 20, search, status, ...(deleted ? { deleted: true } : {}) })
        .then((result) => {
          if (active) {
            setJobs(result.data);
            setPagination(result.pagination);
            setUncertain(false);
          }
        })
        .catch((error) => {
          if (active) setError(messageOf(error));
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
      setSuccess("Đã cập nhật tin tuyển dụng.");
      setRevision((value) => value + 1);
    } catch (error) {
      setUncertain(true);
      setMutationError(`${messageOf(error)} Tải lại dữ liệu trước khi thao tác tiếp.`);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const confirm = (job: RecruitmentJob, action: string, title: string) =>
    Alert.alert(title, `${job.code} · ${job.title}`, [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xác nhận",
        style: action === "delete" ? "destructive" : "default",
        onPress: () => void mutate(job, action),
      },
    ]);
  if (!access.read)
    return (
      <Page title="Tuyển dụng">
        <Text style={styles.text}>Cần doanh nghiệp, phân hệ HR và quyền đọc tuyển dụng.</Text>
      </Page>
    );
  if (!scopeReady)
    return (
      <Page title="Tuyển dụng">
        <Text style={styles.text}>
          {user?.role === "admin"
            ? "Chọn chi nhánh trong Tài khoản để xem tuyển dụng."
            : "Hồ sơ cần được gán chi nhánh để xem tuyển dụng."}
        </Text>
      </Page>
    );
  const disabled = busy || loading;
  const formatMoney = (value?: number | null) => (value == null ? "Chưa nhập" : value.toLocaleString("vi-VN"));
  return (
    <>
      <Page title="Tin tuyển dụng">
        <RecruitmentSubnav active="jobs" />
        {access.manage && (
          <Button title="Tạo tin tuyển dụng" disabled={disabled || uncertain} onPress={() => setEditing("new")} />
        )}
        <Field
          label="Tìm mã, tiêu đề hoặc phòng ban"
          value={draftSearch}
          onChangeText={setDraftSearch}
          editable={!disabled}
        />
        <Button
          title="Tìm kiếm"
          disabled={disabled}
          onPress={() => {
            setSearch(draftSearch.trim());
            setPage(1);
            setRevision((value) => value + 1);
          }}
        />
        <ChoiceField
          label="Trạng thái"
          value={status}
          choices={[{ value: "", label: "Tất cả trạng thái" }, ...JOB_STATUSES]}
          disabled={disabled}
          onChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
        />
        <Button
          title={deleted ? "✓ Đang xem thùng rác · Xem tin hiện tại" : "Xem thùng rác"}
          disabled={disabled}
          onPress={() => {
            setDeleted((value) => !value);
            setPage(1);
          }}
        />
        <ErrorText message={error} />
        <ErrorText message={mutationError} />
        {success && <Text style={styles.text}>{success}</Text>}
        {loading && <Loading />}
        {jobs.map((job) => (
          <Card key={job._id}>
            {!deleted && (
              <Button
                title="Xem ứng viên"
                disabled={busy}
                onPress={() => router.push({ pathname: "/(tabs)/applicants", params: { jobId: job._id } })}
              />
            )}
            {access.manage && !deleted && (
              <Button title="Sửa nội dung" disabled={disabled || uncertain} onPress={() => setEditing(job)} />
            )}
            <Text style={styles.heading}>
              {job.code} · {job.title || "Chưa có tiêu đề"}
            </Text>
            <Text style={styles.text}>
              {job.department || "Chưa có phòng ban"} · {job.headcount} người
            </Text>
            <Text style={styles.muted}>
              {JOB_STATUSES.find((item) => item.value === job.status)?.label || job.status} ·{" "}
              {job.location || "Chưa có địa điểm"}
            </Text>
            <Button
              title={expanded === job._id ? "Thu gọn" : "Xem chi tiết"}
              disabled={busy}
              onPress={() => setExpanded(expanded === job._id ? null : job._id)}
            />
            {expanded === job._id && (
              <>
                <PublicDocumentLink title="JD công khai" url={job.jdFileUrl} />
                {!deleted && <AttachmentPanel kind="job" id={job._id} manage={access.manage} />}
                <Text style={styles.text}>
                  Mô tả: {job.description || "—"}
                  {"\n"}Yêu cầu: {job.requirements || "—"}
                  {"\n"}Quyền lợi: {job.benefits || "—"}
                </Text>
                <Text style={styles.muted}>
                  Hình thức:{" "}
                  {{ onsite: "Tại chỗ", hybrid: "Kết hợp", remote: "Từ xa" }[job.workplaceType] || job.workplaceType} ·{" "}
                  {job.employmentType}
                  {"\n"}Lương: {formatMoney(job.salaryMin)} – {formatMoney(job.salaryMax)}
                  {job.showSalary ? " (công khai)" : " (không công khai)"}
                  {"\n"}Hạn nộp:{" "}
                  {job.applicationDeadline
                    ? new Date(job.applicationDeadline).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })
                    : "Chưa có"}
                </Text>
                {access.manage &&
                  (deleted ? (
                    <Button
                      title="Khôi phục"
                      disabled={disabled || uncertain}
                      onPress={() => confirm(job, "restore", "Khôi phục tin tuyển dụng?")}
                    />
                  ) : (
                    <>
                      {JOB_STATUSES.filter((item) => item.value !== job.status).map((item) => (
                        <Button
                          key={item.value}
                          title={`Chuyển sang ${item.label}`}
                          disabled={disabled || uncertain}
                          onPress={() => confirm(job, item.value, `Chuyển sang ${item.label}?`)}
                        />
                      ))}
                      <Button
                        title="Chuyển vào thùng rác"
                        disabled={disabled || uncertain}
                        onPress={() => confirm(job, "delete", "Xóa mềm tin tuyển dụng?")}
                      />
                    </>
                  ))}
              </>
            )}
          </Card>
        ))}
        {!loading && !error && !jobs.length && (
          <EmptyState
            message="Không có tin tuyển dụng phù hợp"
            subtitle={search ? "Không tìm thấy tin theo từ khóa." : undefined}
          />
        )}
        <Text style={styles.muted}>
          Trang {page}/{Math.max(1, pagination.totalPages)} · {pagination.total} tin
        </Text>
        <Button title="Trang trước" disabled={disabled || page <= 1} onPress={() => setPage((value) => value - 1)} />
        <Button
          title="Trang sau"
          disabled={disabled || page >= pagination.totalPages}
          onPress={() => setPage((value) => value + 1)}
        />
        <Button title="Tải lại" disabled={disabled} onPress={() => setRevision((value) => value + 1)} />
      </Page>
      <Modal visible={editing !== null && access.manage} animationType="slide" onRequestClose={closeForm}>
        <SafeAreaView style={styles.page}>
          {editing && access.manage && (
            <JobForm
              job={editing === "new" ? undefined : editing}
              setLocked={(value) => {
                formLock.current = value;
              }}
              onClose={() => {
                setEditing(null);
                setRevision((value) => value + 1);
              }}
            />
          )}
        </SafeAreaView>
      </Modal>
    </>
  );
}
