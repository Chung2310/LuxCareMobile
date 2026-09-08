import type { HRTask } from "../../../../src/types/hr";
import type { UserProfile } from "../../../../src/types/common";
import type { TaskInput, TaskUpdate } from "../../../../src/services/kanbanService";
export { calculateEstimatedHours } from "../../../../src/components/hr/kanbanTaskTime";
export const TASK_STATUSES = [
  { value: "Not Started", label: "Chưa bắt đầu" },
  { value: "In Progress", label: "Đang làm" },
  { value: "Review/Testing", label: "Chờ kiểm tra" },
  { value: "Done", label: "Hoàn thành" },
  { value: "Archived", label: "Lưu trữ" },
];
export const TASK_PRIORITIES = [
  { value: "High", label: "Cao" },
  { value: "Medium", label: "Trung bình" },
  { value: "Low", label: "Thấp" },
];
export const normalizeTaskStatus = (value: string) =>
  ({ todo: "Not Started", doing: "In Progress", done: "Done" })[value] || value;
export const normalizePriority = (value: string) =>
  ({ Cao: "High", "Trung bình": "Medium", Thấp: "Low" })[value] || value;
export const isTaskManager = (user: UserProfile | null) =>
  !!user && ["superadmin", "admin", "manager", "branch_owner"].includes(user.role);
export const canUpdateTask = (user: UserProfile | null, task: HRTask) =>
  !!user &&
  (isTaskManager(user) ||
    task.assigneeUid === user.uid ||
    !!task.subtasks?.some((sub) => sub.assigneeUid === user.uid));
export function localDateTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
export function parseDateTime(value: string, label: string) {
  if (!value.trim()) return "";
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(value)) throw new Error(`${label}: dùng định dạng YYYY-MM-DD HH:mm.`);
  const date = new Date(value.replace(" ", "T") + ":00");
  if (!Number.isFinite(date.getTime()) || localDateTime(date.toISOString()) !== value)
    throw new Error(`${label} không hợp lệ.`);
  return date.toISOString();
}
export interface TaskDraft {
  title: string;
  description: string;
  assigneeUid: string;
  projectId: string;
  priority: string;
  status: string;
  dueDate: string;
  startTime: string;
  endTime: string;
  estTime: string;
  actualTime: string;
  linkNote: string;
}
export function draftForTask(task?: HRTask): TaskDraft {
  return {
    title: task?.title || "",
    description: task?.description || "",
    assigneeUid: task?.assigneeUid || "",
    projectId: task?.projectId || "",
    priority: normalizePriority(task?.priority || "Medium"),
    status: normalizeTaskStatus(task?.status || "Not Started"),
    dueDate: localDateTime(task?.dueDate),
    startTime: localDateTime(task?.startTime),
    endTime: localDateTime(task?.endTime),
    estTime: String(task?.estTime || ""),
    actualTime: String(task?.actualTime || ""),
    linkNote: task?.linkNote || "",
  };
}
export function taskPayload(draft: TaskDraft, canManage: boolean, creating: boolean): TaskUpdate | TaskInput {
  const dueDate = parseDateTime(draft.dueDate, "Hạn chót");
  const startTime = parseDateTime(draft.startTime, "Bắt đầu");
  const endTime = parseDateTime(draft.endTime, "Kết thúc");
  if (!dueDate) throw new Error("Vui lòng nhập hạn chót.");
  if (startTime && (dueDate < startTime || (endTime && endTime < startTime)))
    throw new Error("Hạn chót và kết thúc không được trước lúc bắt đầu.");
  const hours = (value: string) => {
    const n = Number(value.replace(",", "."));
    if (!Number.isFinite(n) || n < 0) throw new Error("Số giờ phải là số không âm.");
    return n;
  };
  const estTime = hours(draft.estTime);
  const actualTime = hours(draft.actualTime);
  if (!TASK_STATUSES.some((item) => item.value === draft.status)) throw new Error("Trạng thái không hợp lệ.");
  if (!canManage && draft.status === "Archived") throw new Error("Nhân viên không được lưu trữ công việc.");
  if (
    draft.status === "Done" &&
    (!draft.description.trim() || !startTime || estTime <= 0 || new Date(startTime).getTime() > Date.now())
  )
    throw new Error("Hoàn thành cần mô tả, giờ bắt đầu không nằm trong tương lai và số giờ dự tính lớn hơn 0.");
  const input: TaskUpdate = {
    description: draft.description.trim(),
    dueDate,
    startTime,
    endTime,
    estTime,
    actualTime,
    status: draft.status as HRTask["status"],
    linkNote: draft.linkNote.trim(),
  };
  if (canManage || creating) {
    if (!draft.title.trim() || !draft.assigneeUid) throw new Error("Cần tên công việc và người được giao.");
    if (!TASK_PRIORITIES.some((item) => item.value === draft.priority)) throw new Error("Độ ưu tiên không hợp lệ.");
    Object.assign(input, {
      title: draft.title.trim(),
      assigneeUid: draft.assigneeUid,
      projectId: draft.projectId,
      priority: draft.priority,
    });
  }
  return input;
}
