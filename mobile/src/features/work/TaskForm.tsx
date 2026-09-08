import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Text } from "react-native";
import type { HRTask, Project } from "../../../../src/types/hr";
import type { UserProfile } from "../../../../src/types/common";
import type { TaskInput } from "../../../../src/services/kanbanService";
import { kanban, roster } from "../../api/services";
import { messageOf, useSession } from "../../auth/SessionProvider";
import { Button, ErrorText, Field, Loading, Page, styles } from "../../ui";
import { ChoiceField } from "../leave/ChoiceField";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  calculateEstimatedHours,
  draftForTask,
  isTaskManager,
  parseDateTime,
  taskPayload,
} from "./model";
export function TaskForm({
  task,
  projects,
  onClose,
  onSaved,
  setLocked,
}: {
  task?: HRTask;
  projects: Project[];
  onClose: () => void;
  onSaved: () => void;
  setLocked: (value: boolean) => void;
}) {
  const { user } = useSession();
  const manager = !task || isTaskManager(user);
  const [draft, setDraft] = useState(() => draftForTask(task));
  const [people, setPeople] = useState<UserProfile[]>([]);
  const [peopleError, setPeopleError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  useEffect(() => {
    let active = true;
    if (!manager) return;
    setLoading(true);
    setPeopleError(null);
    void roster
      .colleagues()
      .then((data) => {
        if (active) setPeople(data);
      })
      .catch((error) => {
        if (active) setPeopleError(messageOf(error));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [manager, revision]);
  const save = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setLocked(true);
    setError(null);
    try {
      const input = taskPayload(draft, manager, !task);
      try {
        if (task) await kanban.updateTask(task.id, { ...input, expectedRevision: task.revision || 0 });
        else await kanban.createTask(input as TaskInput);
      } catch (error) {
        if (!(error && typeof error === "object" && "status" in error) || Number(error.status) >= 500) {
          setUncertain(true);
          throw new Error("Chưa xác nhận được kết quả lưu. Quay lại và tải lại danh sách trước khi thao tác tiếp.");
        }
        throw error;
      }
      onSaved();
    } catch (error) {
      setError(messageOf(error));
    } finally {
      lock.current = false;
      setBusy(false);
      setLocked(false);
    }
  };
  const disabled = busy || uncertain;
  const field = (key: keyof typeof draft, label: string, multiline = false) => (
    <Field
      label={label}
      value={draft[key]}
      editable={!disabled}
      multiline={multiline}
      onChangeText={(value) => setDraft((current) => ({ ...current, [key]: value }))}
    />
  );
  const assignees = people.map((person) => ({ value: person.uid, label: `${person.displayName} · ${person.email}` }));
  if (task && !assignees.some((item) => item.value === task.assigneeUid))
    assignees.push({ value: task.assigneeUid, label: task.assignee });
  const projectOptions = [
    { value: "", label: "Không thuộc dự án" },
    ...projects.map((project) => ({ value: project.id, label: project.name })),
  ];
  if (task?.projectId && !projectOptions.some((item) => item.value === task.projectId))
    projectOptions.push({ value: task.projectId, label: "Dự án hiện tại" });
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Page title={task ? "Cập nhật công việc" : "Giao việc mới"}>
        {manager ? (
          <>
            {field("title", "Tên công việc")}
            {loading && <Loading />}
            <ErrorText message={peopleError} />
            {peopleError && (
              <Button title="Tải lại nhân sự" disabled={disabled} onPress={() => setRevision((v) => v + 1)} />
            )}
            <ChoiceField
              label="Người được giao"
              value={draft.assigneeUid}
              choices={[{ value: "", label: "Chọn nhân sự" }, ...assignees]}
              onChange={(value) => setDraft((current) => ({ ...current, assigneeUid: value }))}
              disabled={disabled || loading}
            />
            <ChoiceField
              label="Dự án"
              value={draft.projectId}
              choices={projectOptions}
              onChange={(value) => setDraft((current) => ({ ...current, projectId: value }))}
              disabled={disabled}
            />
            <ChoiceField
              label="Độ ưu tiên"
              value={draft.priority}
              choices={TASK_PRIORITIES}
              onChange={(value) => setDraft((current) => ({ ...current, priority: value }))}
              disabled={disabled}
            />
          </>
        ) : (
          <Text style={styles.heading}>{task?.title}</Text>
        )}
        <ChoiceField
          label="Trạng thái"
          value={draft.status}
          choices={TASK_STATUSES.filter((item) => manager || item.value !== "Archived")}
          onChange={(value) => setDraft((current) => ({ ...current, status: value }))}
          disabled={disabled}
        />
        {field("description", "Mô tả", true)}
        {field("dueDate", "Hạn chót (YYYY-MM-DD HH:mm)")}
        {field("startTime", "Bắt đầu (YYYY-MM-DD HH:mm)")}
        {field("endTime", "Kết thúc (YYYY-MM-DD HH:mm)")}
        {field("estTime", "Số giờ dự tính")}
        {field("actualTime", "Số giờ thực tế")}
        <Button
          title="Tính giờ dự tính từ bắt đầu / kết thúc"
          disabled={disabled}
          onPress={() => {
            try {
              const hours = calculateEstimatedHours(
                parseDateTime(draft.startTime, "Bắt đầu"),
                parseDateTime(draft.endTime, "Kết thúc"),
              );
              if (hours === "") throw new Error("Cần nhập đủ giờ bắt đầu và kết thúc hợp lệ.");
              setDraft((current) => ({ ...current, estTime: String(hours) }));
              setError(null);
            } catch (error) {
              setError(messageOf(error));
            }
          }}
        />
        {field("linkNote", "Ghi chú kết quả", true)}
        <ErrorText message={error} />
        <Button
          title={busy ? "Đang lưu…" : "Lưu công việc"}
          disabled={disabled || (!task && (!draft.assigneeUid || loading))}
          onPress={() => void save()}
        />
        <Button title={uncertain ? "Quay lại danh sách" : "Hủy"} disabled={busy} onPress={onClose} />
      </Page>
    </KeyboardAvoidingView>
  );
}
