import { RecruitmentSubnav } from "../../src/features/recruitment/RecruitmentSubnav";
import { RecruitmentGate } from "../../src/features/recruitment/RecruitmentGate";
import { useCallback, useEffect, useRef, useState } from "react";
import { Modal, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import type { RecruitmentInterview } from "../../../src/types/recruitment";
import { emptyPagination } from "../../../src/types/pagination";
import { recruitment } from "../../src/api/services";
import { messageOf, useSession } from "../../src/auth/SessionProvider";
import { Button, Card, EmptyState, ErrorText, Loading, Page, styles } from "../../src/ui";
import { ChoiceField } from "../../src/features/leave/ChoiceField";
import { recruitmentAccess } from "../../src/features/recruitment/access";
import { INTERVIEW_STATUSES } from "../../src/features/recruitment/interviewModel";
import { InterviewForm } from "../../src/features/recruitment/InterviewForm";
import { TrashAction } from "../../src/features/recruitment/TrashAction";
export default function Interviews() {
  const { user, selectedBranch } = useSession();
  const access = recruitmentAccess(user);
  const params = useLocalSearchParams<{ applicantId?: string; jobId?: string }>();
  const applicantId = typeof params.applicantId === "string" ? params.applicantId : "";
  const jobId = typeof params.jobId === "string" ? params.jobId : "";
  const [rows, setRows] = useState<RecruitmentInterview[]>([]);
  const [pagination, setPagination] = useState(emptyPagination);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [mine, setMine] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [trashBusy, setTrashBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState<RecruitmentInterview | "new" | null>(null);
  const lock = useRef(false);
  useEffect(() => {
    setPage(1);
  }, [applicantId]);
  const scopeReady = user?.role === "admin" ? !!selectedBranch?._id : !!user?.branchId;
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setRows([]);
      setError(null);
      setPagination(emptyPagination);
      setLoading(false);
      if (!access.read || !scopeReady) return;
      setLoading(true);
      void recruitment
        .listInterviewsPage({
          page,
          limit: 20,
          status,
          applicantId,
          interviewerId: mine ? user?.uid : undefined,
          ...(deleted ? { deleted: true } : {}),
        })
        .then((value) => {
          if (active) {
            setRows(value.data);
            setPagination(value.pagination);
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
    }, [access.read, scopeReady, selectedBranch?._id, page, status, mine, user?.uid, applicantId, revision, deleted]),
  );
  if (!access.read || !scopeReady)
    return <RecruitmentGate title="Phỏng vấn" user={user} access={access} scopeReady={scopeReady} />;
  const time = (value: string) => new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
  return (
    <>
      <Page title="Lịch phỏng vấn">
        <RecruitmentSubnav active="interviews" />
        <Button
          title={deleted ? "✓ Thùng rác · Xem lịch hiện tại" : "Xem thùng rác"}
          disabled={loading || trashBusy}
          onPress={() => {
            setDeleted((value) => !value);
            setPage(1);
          }}
        />
        {applicantId && (
          <>
            <Text style={styles.muted}>Ứng viên: {applicantId}</Text>
            <Button
              title="Xem tất cả ứng viên"
              onPress={() => {
                router.setParams({ applicantId: "", jobId: "" });
                setPage(1);
              }}
            />
          </>
        )}
        {access.manage &&
          !deleted &&
          (applicantId && jobId ? (
            <Button title="Đặt lịch cho ứng viên" onPress={() => setEditing("new")} />
          ) : (
            <Button title="Chọn ứng viên để đặt lịch" onPress={() => router.push("/(tabs)/applicants")} />
          ))}
        <ChoiceField
          label="Trạng thái"
          value={status}
          choices={[{ value: "", label: "Tất cả" }, ...INTERVIEW_STATUSES]}
          onChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
        />
        <Button
          title={mine ? "✓ Tôi phỏng vấn" : "Lọc lịch tôi phỏng vấn"}
          onPress={() => {
            setMine((value) => !value);
            setPage(1);
          }}
        />
        <ErrorText message={error} />
        {loading && <Loading />}
        {rows.map((item) => (
          <Card key={item._id}>
            <Text style={styles.heading}>
              {time(item.scheduledStart)} → {time(item.scheduledEnd)}
            </Text>
            <Text style={styles.text}>
              Ứng viên: {item.applicantId}
              {"\n"}
              {INTERVIEW_STATUSES.find((status) => status.value === item.status)?.label} ·{" "}
              {{ onsite: "Trực tiếp", online: "Trực tuyến", phone: "Điện thoại" }[item.format]}
              {"\n"}Địa điểm: {item.location || "—"}
              {"\n"}Liên kết: {item.meetingLink || "—"}
              {"\n"}Người phỏng vấn: {item.interviewerIds.join(", ") || "Chưa gán"}
              {"\n"}Kết quả: {item.result || "—"}
              {"\n"}Ghi chú: {item.notes || "—"}
            </Text>
            {access.manage && !deleted && (
              <Button title="Sửa lịch / cập nhật kết quả" disabled={trashBusy} onPress={() => setEditing(item)} />
            )}
            {access.manage && (
              <TrashAction
                kind="interview"
                id={item._id}
                version={item.version}
                title={`${time(item.scheduledStart)} · ${item.applicantId}`}
                deleted={deleted}
                setBusy={setTrashBusy}
                onSaved={() => setRevision((value) => value + 1)}
              />
            )}
          </Card>
        ))}
        {!loading && !error && !rows.length && (
          <EmptyState message="Không có lịch phỏng vấn phù hợp" />
        )}
        <Text style={styles.muted}>
          Trang {page}/{Math.max(1, pagination.totalPages)} · {pagination.total} lịch
        </Text>
        <Button title="Trang trước" disabled={loading || page <= 1} onPress={() => setPage((value) => value - 1)} />
        <Button
          title="Trang sau"
          disabled={loading || page >= pagination.totalPages}
          onPress={() => setPage((value) => value + 1)}
        />
        <Button title="Tải lại" disabled={loading} onPress={() => setRevision((value) => value + 1)} />
      </Page>
      <Modal
        visible={editing !== null && access.manage}
        animationType="slide"
        onRequestClose={() => {
          if (!lock.current) {
            setEditing(null);
            setRevision((value) => value + 1);
          }
        }}
      >
        <SafeAreaView style={styles.page}>
          {editing && access.manage && (
            <InterviewForm
              interview={editing === "new" ? undefined : editing}
              applicantId={editing === "new" ? applicantId : editing.applicantId}
              jobId={editing === "new" ? jobId : editing.jobId}
              setLocked={(value) => {
                lock.current = value;
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
