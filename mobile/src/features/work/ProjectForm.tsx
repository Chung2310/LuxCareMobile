import { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform } from "react-native";
import type { Project } from "../../../../src/types/hr";
import type { ProjectInput } from "../../../../src/services/kanbanService";
import { kanban } from "../../api/services";
import { messageOf } from "../../auth/SessionProvider";
import { Button, ErrorText, Field, Page } from "../../ui";
import { ChoiceField } from "../leave/ChoiceField";
import { projectDraft, projectPayload, PROJECT_STATUSES, PROJECT_PRIORITIES } from "./project";
export function ProjectForm({
  project,
  onClose,
  onSaved,
  setLocked,
}: {
  project?: Project;
  onClose: () => void;
  onSaved: () => void;
  setLocked: (value: boolean) => void;
}) {
  const [draft, setDraft] = useState(() => projectDraft(project));
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const save = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setLocked(true);
    setError(null);
    try {
      const input = projectPayload(draft, project);
      try {
        if (project) {
          if (Object.keys(input).length) await kanban.updateProject(project.id, input);
        } else await kanban.createProject(input as ProjectInput);
      } catch (error) {
        if (!(error && typeof error === "object" && "status" in error) || Number(error.status) >= 500) {
          setUncertain(true);
          throw new Error(
            "Chưa xác nhận được kết quả lưu. Quay lại tải danh sách để kiểm tra trước khi thao tác tiếp.",
          );
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
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Page title={project ? "Sửa dự án" : "Tạo dự án"}>
        <Field
          label="Tên dự án"
          value={draft.name}
          editable={!disabled}
          onChangeText={(name) => setDraft((value) => ({ ...value, name }))}
        />
        <ChoiceField
          label="Trạng thái"
          value={draft.status}
          choices={PROJECT_STATUSES.filter((item) => !!project || item.value !== "completed")}
          disabled={disabled}
          onChange={(status) => setDraft((value) => ({ ...value, status: status as Project["status"] }))}
        />
        <ChoiceField
          label="Độ ưu tiên"
          value={draft.priority}
          choices={PROJECT_PRIORITIES}
          disabled={disabled}
          onChange={(priority) => setDraft((value) => ({ ...value, priority: priority as Project["priority"] }))}
        />
        <Field
          label="Bắt đầu (YYYY-MM-DD HH:mm, có thể để trống)"
          value={draft.startAt}
          editable={!disabled}
          onChangeText={(startAt) => setDraft((value) => ({ ...value, startAt }))}
        />
        <Field
          label="Hạn cuối (YYYY-MM-DD HH:mm, có thể để trống)"
          value={draft.dueAt}
          editable={!disabled}
          onChangeText={(dueAt) => setDraft((value) => ({ ...value, dueAt }))}
        />
        <ErrorText message={error} />
        <Button title={busy ? "Đang lưu…" : "Lưu dự án"} disabled={disabled} onPress={() => void save()} />
        <Button title={uncertain ? "Quay lại danh sách" : "Hủy"} disabled={busy} onPress={onClose} />
      </Page>
    </KeyboardAvoidingView>
  );
}
