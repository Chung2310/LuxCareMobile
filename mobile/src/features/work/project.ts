import type { Project } from "../../../../src/types/hr";
import type { ProjectInput } from "../../../../src/services/kanbanService";
import { localDateTime, parseDateTime } from "./model";
export const PROJECT_STATUSES = [
  { value: "not_started", label: "Chưa bắt đầu" },
  { value: "in_progress", label: "Đang thực hiện" },
  { value: "paused", label: "Tạm dừng" },
  { value: "completed", label: "Hoàn thành" },
  { value: "cancelled", label: "Đã hủy" },
];
export const PROJECT_PRIORITIES = [
  { value: "low", label: "Thấp" },
  { value: "medium", label: "Trung bình" },
  { value: "high", label: "Cao" },
  { value: "urgent", label: "Khẩn cấp" },
];
export function projectDraft(project?: Project) {
  return {
    name: project?.name || "",
    status: project?.status || "not_started",
    priority: project?.priority || "medium",
    startAt: localDateTime(project?.startAt),
    dueAt: localDateTime(project?.dueAt),
    attachments: (project?.attachments || []).map((att) => ({ ...att })),
  };
}
export function projectPayload(draft: ReturnType<typeof projectDraft>, original?: Project): Partial<ProjectInput> {
  const name = draft.name.trim();
  if (!name) throw new Error("Vui lòng nhập tên dự án.");
  const startAt = parseDateTime(draft.startAt, "Bắt đầu");
  const dueAt = parseDateTime(draft.dueAt, "Hạn cuối");
  if (startAt && dueAt && dueAt < startAt) throw new Error("Hạn cuối không được trước thời gian bắt đầu.");
  if (
    !PROJECT_STATUSES.some((item) => item.value === draft.status) ||
    !PROJECT_PRIORITIES.some((item) => item.value === draft.priority)
  )
    throw new Error("Trạng thái hoặc độ ưu tiên không hợp lệ.");
  if (
    draft.status === "completed" &&
    original?.status !== draft.status &&
    (!original?.progress?.total || original.progress.completed !== original.progress.total)
  )
    throw new Error("Cần hoàn thành tất cả công việc trước khi hoàn thành dự án.");
  const input: ProjectInput = {
    name,
    status: draft.status,
    priority: draft.priority,
    startAt,
    dueAt,
    attachments: draft.attachments,
  };
  if (!original) return input;
  // Send only changed fields so a name edit does not overwrite a newer lifecycle state.
  const before = projectDraft(original);
  const update: Partial<ProjectInput> = {};
  for (const key of Object.keys(input) as (keyof ProjectInput)[]) {
    if (key === "attachments") {
      if (JSON.stringify(draft.attachments) !== JSON.stringify(before.attachments)) {
        update.attachments = draft.attachments;
      }
    } else if (draft[key] !== before[key]) {
      Object.assign(update, { [key]: input[key] });
    }
  }
  return update;
}
