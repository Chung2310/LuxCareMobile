import { useCallback, useEffect, useRef, useState } from "react";
import { Modal, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, router } from "expo-router";
import type { RecruitmentApplicant, RecruitmentStage } from "../../../src/types/recruitment";
import { emptyPagination } from "../../../src/types/pagination";
import { recruitment } from "../../src/api/services";
import { messageOf, useSession } from "../../src/auth/SessionProvider";
import { Button, Card, ErrorText, Field, Loading, Page, styles } from "../../src/ui";
import { ChoiceField } from "../../src/features/leave/ChoiceField";
import { recruitmentAccess } from "../../src/features/recruitment/access";
import { applicantFilters, OUTCOMES } from "../../src/features/recruitment/applicantModel";
import { ApplicantDetail } from "../../src/features/recruitment/ApplicantDetail";
import { ApplicantForm } from "../../src/features/recruitment/ApplicantForm";
import { TrashAction } from "../../src/features/recruitment/TrashAction";
export default function Applicants() {
  const { user, selectedBranch } = useSession();
  const access = recruitmentAccess(user);
  const params = useLocalSearchParams<{ jobId?: string }>();
  const jobId = typeof params.jobId === "string" ? params.jobId : undefined;
  const [rows, setRows] = useState<RecruitmentApplicant[]>([]);
  const [stages, setStages] = useState<RecruitmentStage[]>([]);
  const [pagination, setPagination] = useState(emptyPagination);
  const [page, setPage] = useState(1);
  useEffect(() => {
    setPage(1);
  }, [jobId]);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("");
  const [outcome, setOutcome] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [trashBusy, setTrashBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<RecruitmentApplicant | null>(null);
  const [editing, setEditing] = useState<RecruitmentApplicant | "new" | null>(null);
  const lock = useRef(false);
  const scopeReady = user?.role === "admin" ? !!selectedBranch?._id : !!user?.branchId;
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setStages([]);
      setPipelineError(null);
      if (access.read && scopeReady)
        void recruitment
          .getPipeline()
          .then((value) => {
            if (active) setStages(value.stages);
          })
          .catch((error) => {
            if (active) setPipelineError(messageOf(error));
          });
      return () => {
        active = false;
      };
    }, [access.read, scopeReady, selectedBranch?._id, revision]),
  );
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
        .listApplicantsPage({
          ...applicantFilters(page, search, stage, outcome, jobId),
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
    }, [access.read, scopeReady, selectedBranch?._id, page, search, stage, outcome, jobId, revision, deleted]),
  );
  const close = () => {
    if (lock.current) return;
    setSelected(null);
    setRevision((value) => value + 1);
  };
  if (!access.read || !scopeReady)
    return (
      <Page title="Ứng viên">
        <Text style={styles.text}>
          Cần quyền đọc tuyển dụng và chi nhánh hợp lệ. Admin chọn chi nhánh trong Tài khoản.
        </Text>
      </Page>
    );
  return (
    <>
      <Page title="Ứng viên">
        {access.manage &&
          !deleted &&
          (jobId ? (
            <Button
              title="Thêm ứng viên cho tin này"
              disabled={loading || trashBusy}
              onPress={() => setEditing("new")}
            />
          ) : (
            <Button
              title="Chọn tin để thêm ứng viên"
              disabled={trashBusy}
              onPress={() => router.push("/(tabs)/recruitment")}
            />
          ))}
        <Button
          title={deleted ? "✓ Thùng rác · Xem hồ sơ hiện tại" : "Xem thùng rác"}
          disabled={loading || trashBusy}
          onPress={() => {
            setDeleted((value) => !value);
            setPage(1);
          }}
        />
        {jobId && (
          <>
            <Text style={styles.muted}>Tin tuyển dụng: {jobId}</Text>
            <Button
              title="Xem tất cả tin"
              onPress={() => {
                setPage(1);
                router.setParams({ jobId: "" });
              }}
            />
          </>
        )}
        <Field label="Tìm tên, email hoặc điện thoại" value={draft} onChangeText={setDraft} />
        <Button
          title="Tìm kiếm"
          disabled={loading}
          onPress={() => {
            setSearch(draft.trim());
            setPage(1);
            setRevision((value) => value + 1);
          }}
        />
        <ChoiceField
          label="Giai đoạn"
          value={stage}
          choices={[
            { value: "", label: "Tất cả giai đoạn" },
            ...stages.map((item) => ({ value: item.id, label: item.name })),
          ]}
          onChange={(value) => {
            setStage(value);
            setPage(1);
          }}
        />
        <ChoiceField
          label="Kết quả"
          value={outcome}
          choices={OUTCOMES}
          onChange={(value) => {
            setOutcome(value);
            setPage(1);
          }}
        />
        <ErrorText message={pipelineError} />
        <ErrorText message={error} />
        {loading && <Loading />}
        {rows.map((item) => (
          <Card key={item._id}>
            {!deleted && (
              <Button
                title="Lịch phỏng vấn"
                disabled={trashBusy}
                onPress={() =>
                  router.push({ pathname: "/(tabs)/interviews", params: { applicantId: item._id, jobId: item.jobId } })
                }
              />
            )}
            {access.manage && !deleted && (
              <Button title="Sửa hồ sơ" disabled={trashBusy} onPress={() => setEditing(item)} />
            )}
            <Text style={styles.heading}>{item.fullName}</Text>
            <Text style={styles.text}>
              {item.email} · {item.phone}
            </Text>
            <Text style={styles.muted}>
              {stages.find((stage) => stage.id === item.stageId)?.name || item.stageId} ·{" "}
              {OUTCOMES.find((outcome) => outcome.value === item.outcome)?.label || item.outcome}
            </Text>
            <Button title="Hồ sơ & lịch sử" disabled={trashBusy} onPress={() => setSelected(item)} />
            {access.manage && (
              <TrashAction
                kind="applicant"
                id={item._id}
                version={item.version}
                title={item.fullName}
                deleted={deleted}
                setBusy={setTrashBusy}
                onSaved={() => setRevision((value) => value + 1)}
              />
            )}
          </Card>
        ))}
        {!loading && !error && !rows.length && <Text style={styles.muted}>Không có ứng viên phù hợp.</Text>}
        <Text style={styles.muted}>
          Trang {page}/{Math.max(1, pagination.totalPages)} · {pagination.total} ứng viên
        </Text>
        <Button title="Trang trước" disabled={loading || page <= 1} onPress={() => setPage((value) => value - 1)} />
        <Button
          title="Trang sau"
          disabled={loading || page >= pagination.totalPages}
          onPress={() => setPage((value) => value + 1)}
        />
        <Button title="Tải lại" disabled={loading} onPress={() => setRevision((value) => value + 1)} />
      </Page>
      <Modal visible={!!selected} animationType="slide" onRequestClose={close}>
        <SafeAreaView style={styles.page}>
          {selected && (
            <ApplicantDetail
              applicant={selected}
              stages={stages}
              manage={access.manage && !pipelineError && !deleted}
              setLocked={(value) => {
                lock.current = value;
              }}
              onClose={() => {
                setSelected(null);
                setRevision((value) => value + 1);
              }}
            />
          )}
        </SafeAreaView>
      </Modal>
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
            <ApplicantForm
              applicant={editing === "new" ? undefined : editing}
              jobId={editing === "new" ? jobId || "" : editing.jobId}
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
