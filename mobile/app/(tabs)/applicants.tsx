import { useCallback, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import type { RecruitmentApplicant, RecruitmentJob, RecruitmentPipeline } from "../../../src/types/recruitment";
import { emptyPagination, type PaginationMeta } from "../../../src/types/pagination";
import { recruitment } from "../../src/api/services";
import { messageOf, useSession } from "../../src/auth/SessionProvider";
import { Button, Card, EmptyState, ErrorText, Field, Loading, Page, styles } from "../../src/ui";
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
    <View style={styles.row}>
      <Button title="‹ Trước" disabled={meta.page <= 1} onPress={() => onChange(meta.page - 1)} />
      <Text style={styles.muted}>Trang {meta.page}/{meta.totalPages}</Text>
      <Button title="Sau ›" disabled={meta.page >= meta.totalPages} onPress={() => onChange(meta.page + 1)} />
    </View>
  );
}

export default function Applicants() {
  const { user, selectedBranch } = useSession();
  const access = recruitmentAccess(user);
  const params = useLocalSearchParams<{ jobId?: string }>();
  const jobId = typeof params.jobId === "string" ? params.jobId : "";
  const scopeReady = user?.role === "admin" ? Boolean(selectedBranch?._id) : Boolean(user?.branchId);
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
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<RecruitmentApplicant | "new" | null>(null);
  const [selected, setSelected] = useState<RecruitmentApplicant | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!access.read || !scopeReady) return;
    setLoading(true);
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
        recruitment.listJobs({ limit: 100 }),
        recruitment.getPipeline(),
      ]);
      setRows(applicantPage.data);
      setPagination(applicantPage.pagination);
      setJobs(jobRows);
      setPipeline(nextPipeline);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setLoading(false);
    }
  }, [access.read, jobId, outcome, page, search, scopeReady, stage]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  if (!access.read || !scopeReady)
    return <RecruitmentGate title="Hồ sơ ứng viên" user={user} access={access} scopeReady={scopeReady} />;

  const move = async (applicant: RecruitmentApplicant, nextStage: string) => {
    if (!access.manage || nextStage === applicant.stageId) return;
    setBusyId(applicant._id);
    try {
      await recruitment.transitionApplicant(applicant._id, applicant.version, nextStage);
      await load();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusyId(null);
    }
  };

  const stageChoices = pipeline?.stages
    .filter((item) => item.isActive)
    .map((item) => ({ value: item.id, label: item.name })) || [];

  return (
    <>
      <Page title="Hồ sơ ứng viên">
        <RecruitmentSubnav active="applicants" />
        <View style={styles.row}>
          <Button title="Danh sách" onPress={() => setMode("list")} />
          <Button title="Kanban" onPress={() => setMode("kanban")} />
          {access.manage && <Button title="+ Thêm ứng viên" onPress={() => setEditing("new")} />}
        </View>
        {!!jobId && (
          <Card>
            <Text style={styles.text}>Đang lọc theo tin: {jobs.find((job) => job._id === jobId)?.title || jobId}</Text>
            <Button title="Xem tất cả hồ sơ" onPress={() => router.setParams({ jobId: "" })} />
          </Card>
        )}
        <Field label="Tìm tên, email hoặc điện thoại" value={draftSearch} onChangeText={setDraftSearch} />
        <Button title="Tìm kiếm" disabled={loading} onPress={() => { setSearch(draftSearch.trim()); setPage(1); }} />
        <ChoiceField label="Giai đoạn" value={stage} choices={[{ value: "", label: "Mọi giai đoạn" }, ...stageChoices]} disabled={loading} onChange={(value) => { setStage(value); setPage(1); }} />
        <ChoiceField label="Kết quả" value={outcome} choices={[{ value: "", label: "Mọi kết quả" }, ...OUTCOME_CHOICES]} disabled={loading} onChange={(value) => { setOutcome(value); setPage(1); }} />
        <ErrorText message={error} />
        {loading && <Loading />}
        {!loading && !rows.length && <EmptyState message="Chưa có hồ sơ ứng viên trong chi nhánh này." />}
        {!loading && mode === "list" && rows.map((applicant) => (
          <Card key={applicant._id}>
            <View style={styles.row}>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.heading}>{applicant.fullName}</Text>
                <Text style={styles.muted}>{applicant.email || applicant.phone || "Chưa có liên hệ"}</Text>
              </View>
              <Text style={styles.text}>{formatOutcome(applicant.outcome)}</Text>
            </View>
            <Text style={styles.text}>Vị trí: {jobs.find((job) => job._id === applicant.jobId)?.title || "—"}</Text>
            <Text style={styles.muted}>Nguồn: {applicant.source || "—"}</Text>
            {access.manage && stageChoices.length > 0 && (
              <ChoiceField
                label="Giai đoạn"
                value={applicant.stageId}
                choices={stageChoices}
                disabled={busyId === applicant._id}
                onChange={(value) => void move(applicant, value)}
              />
            )}
            {!access.manage && <Text style={styles.muted}>Giai đoạn: {pipeline?.stages.find((item) => item.id === applicant.stageId)?.name || "—"}</Text>}
            <View style={styles.row}>
              <Button title="Xem chi tiết" onPress={() => setSelected(applicant)} />
              {access.manage && <Button title="Sửa" onPress={() => setEditing(applicant)} />}
              <Button title="Lịch phỏng vấn" onPress={() => router.push({ pathname: "/(tabs)/interviews", params: { applicantId: applicant._id, jobId: applicant.jobId } })} />
            </View>
          </Card>
        ))}
        {!loading && mode === "kanban" && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {pipeline?.stages.filter((item) => item.isActive).map((stageItem) => {
                const items = rows.filter((item) => item.stageId === stageItem.id);
                return (
                  <View key={stageItem.id} style={{ width: 260, minHeight: 280, padding: 10, borderRadius: 14, borderTopWidth: 4, borderTopColor: stageItem.color, backgroundColor: "#f1f5f9", gap: 8 }}>
                    <View style={styles.row}>
                      <Text style={styles.heading}>{stageItem.name}</Text>
                      <Text style={styles.muted}>{items.length}</Text>
                    </View>
                    {items.map((item) => (
                      <Card key={item._id}>
                        <Text style={styles.heading}>{item.fullName}</Text>
                        <Text style={styles.muted}>{jobs.find((job) => job._id === item.jobId)?.title || "—"}</Text>
                        <Button title="Xem" onPress={() => setSelected(item)} />
                      </Card>
                    ))}
                  </View>
                );
              })}
            </View>
          </ScrollView>
        )}
        <Pagination meta={pagination} onChange={setPage} />
      </Page>
      {editing && (
        <ApplicantForm
          applicant={editing === "new" ? undefined : editing}
          jobs={jobs}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await load(); }}
        />
      )}
      {selected && (
        <ApplicantDetail
          applicant={selected}
          jobs={jobs}
          stages={pipeline?.stages || []}
          canManage={access.manage}
          onClose={() => setSelected(null)}
          onChanged={async () => { await load(); }}
        />
      )}
    </>
  );
}
