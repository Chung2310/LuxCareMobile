import type { HRTask, TaskAttachment, TaskSubtask } from "../../../../src/types/hr";
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

export function parseDateTime(value: string, label: string): string {
  if (!value || !value.trim()) return "";
  const trimmed = value.trim();

  // If already an ISO string
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(trimmed)) {
    const d = new Date(trimmed);
    if (Number.isFinite(d.getTime())) return d.toISOString();
  }

  // Match YYYY-MM-DD HH:mm
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/);
  if (!match) {
    throw new Error(`${label}: dùng định dạng YYYY-MM-DD HH:mm.`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);

  const date = new Date(year, month, day, hour, minute, 0, 0);
  if (
    !Number.isFinite(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute
  ) {
    throw new Error(`${label} không hợp lệ.`);
  }

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
  tags: string[];
  subtasks: TaskSubtask[];
  attachments: TaskAttachment[];
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
    estTime: task?.estTime !== undefined && task.estTime !== null ? String(task.estTime) : "",
    actualTime: task?.actualTime !== undefined && task.actualTime !== null ? String(task.actualTime) : "",
    linkNote: task?.linkNote || "",
    tags: task?.tags ? [...task.tags] : [],
    subtasks: task?.subtasks
      ? task.subtasks.map((s) => ({ ...s, dueDate: localDateTime(s.dueDate) }))
      : [],
    attachments: task?.attachments ? [...task.attachments] : [],
  };
}

export function taskPayload(draft: TaskDraft, canManage: boolean, creating: boolean): TaskUpdate | TaskInput {
  const dueDate = parseDateTime(draft.dueDate, "Hạn chót");
  const startTime = parseDateTime(draft.startTime, "Bắt đầu");
  const endTime = parseDateTime(draft.endTime, "Kết thúc");

  if (!dueDate) throw new Error("Vui lòng nhập hạn chót.");
  if (startTime && dueDate && dueDate < startTime)
    throw new Error("Hạn chót không được trước lúc bắt đầu.");
  if (startTime && endTime && endTime < startTime)
    throw new Error("Thời gian kết thúc không được trước lúc bắt đầu.");

  const parseHours = (value?: string | number) => {
    if (value === undefined || value === null || value === "") return 0;
    const n = typeof value === "number" ? value : Number(String(value).trim().replace(",", "."));
    if (!Number.isFinite(n) || n < 0) throw new Error("Số giờ phải là số không âm.");
    return n;
  };

  const estTime = parseHours(draft.estTime);
  const actualTime = parseHours(draft.actualTime);

  if (!TASK_STATUSES.some((item) => item.value === draft.status)) throw new Error("Trạng thái không hợp lệ.");
  if (!canManage && draft.status === "Archived") throw new Error("Nhân viên không được lưu trữ công việc.");
  if (
    draft.status === "Done" &&
    (!draft.description.trim() || !startTime || estTime <= 0 || new Date(startTime).getTime() > Date.now())
  )
    throw new Error("Hoàn thành cần mô tả, giờ bắt đầu không nằm trong tương lai và số giờ dự tính lớn hơn 0.");

  const parsedSubtasks = (draft.subtasks || []).map((s) => {
    const title = s.title.trim();
    if (!title) throw new Error("Mỗi việc nhỏ cần có tiêu đề.");
    return {
      ...s,
      title,
      assigneeUid: s.assigneeUid?.trim() || undefined,
      dueDate: s.dueDate ? parseDateTime(s.dueDate, "Hạn việc nhỏ") || undefined : undefined,
    };
  });

  const cleanedTags = (draft.tags || [])
    .map((t) => t.trim().replace(/^#+/, ""))
    .filter(Boolean);

  const input: TaskUpdate = {
    description: draft.description.trim(),
    dueDate,
    startTime: startTime || undefined,
    endTime: endTime || undefined,
    estTime: estTime || 0,
    actualTime: actualTime || 0,
    status: draft.status as HRTask["status"],
    linkNote: draft.linkNote.trim() || undefined,
    tags: cleanedTags,
    subtasks: parsedSubtasks,
    attachments: draft.attachments || [],
  };

  if (canManage || creating) {
    if (!draft.title.trim() || !draft.assigneeUid) throw new Error("Cần tên công việc và người được giao.");
    if (!TASK_PRIORITIES.some((item) => item.value === draft.priority)) throw new Error("Độ ưu tiên không hợp lệ.");
    Object.assign(input, {
      title: draft.title.trim(),
      assigneeUid: draft.assigneeUid,
      projectId: draft.projectId ? draft.projectId : undefined,
      priority: draft.priority,
    });
  }

  return input;
}

export interface TaskKpiInfo {
  status: "ontime" | "overdue" | "ahead" | "pending";
  label: string;
  detail: string;
  color: string;
  bg: string;
  borderColor: string;
  icon: string;
}

export function evaluateTaskKpi(
  estTime?: string | number,
  actualTime?: string | number,
  endTime?: string,
  dueDate?: string,
): TaskKpiInfo | null {
  const est = estTime ? Number(String(estTime).trim().replace(",", ".")) : 0;
  const act = actualTime ? Number(String(actualTime).trim().replace(",", ".")) : 0;

  // 1. So sánh số giờ thực tế vs giờ dự tính
  if (est > 0 && act > 0) {
    const diff = Math.round((act - est) * 10) / 10;
    if (diff > 0) {
      return {
        status: "overdue",
        label: "KPI: Trễ hạn (Vượt giờ)",
        detail: `Thực tế (${act}h) vượt dự tính (${est}h) là +${diff}h`,
        color: "#b91c1c",
        bg: "#fef2f2",
        borderColor: "#fca5a5",
        icon: "alert-triangle" as const,
      };
    }
    if (diff < 0) {
      return {
        status: "ahead",
        label: "KPI: Xuất sắc (Sớm tiến độ)",
        detail: `Tiết kiệm được ${Math.abs(diff)}h so với dự tính (${est}h)`,
        color: "#047857",
        bg: "#ecfdf5",
        borderColor: "#a7f3d0",
        icon: "star" as const,
      };
    }
    return {
      status: "ontime",
      label: "KPI: Đúng hạn (Chuẩn tiến độ)",
      detail: `Hoàn thành đúng bằng số giờ dự tính (${est}h)`,
      color: "#059669",
      bg: "#ecfdf5",
      borderColor: "#6ee7b7",
      icon: "target" as const,
    };
  }

  // 2. So sánh theo mốc thời gian hoàn thành (endTime vs dueDate)
  if (endTime && dueDate) {
    const parseTime = (str: string): number => {
      const match = str.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
      if (match) {
        return new Date(
          parseInt(match[1], 10),
          parseInt(match[2], 10) - 1,
          parseInt(match[3], 10),
          parseInt(match[4], 10),
          parseInt(match[5], 10),
        ).getTime();
      }
      const t = new Date(str).getTime();
      return Number.isFinite(t) ? t : 0;
    };

    const endT = parseTime(endTime);
    const dueT = parseTime(dueDate);
    if (endT > 0 && dueT > 0) {
      if (endT > dueT) {
        const diffH = Math.round(((endT - dueT) / (1000 * 60 * 60)) * 10) / 10;
        return {
          status: "overdue",
          label: "KPI: Trễ hạn (Quá deadline)",
          detail: `Hoàn thành sau deadline +${diffH}h`,
          color: "#b91c1c",
          bg: "#fef2f2",
          borderColor: "#fca5a5",
          icon: "alert-triangle" as const,
        };
      }
      return {
        status: "ontime",
        label: "KPI: Đúng hạn",
        detail: "Hoàn thành trước hoặc đúng thời hạn deadline",
        color: "#059669",
        bg: "#ecfdf5",
        borderColor: "#a7f3d0",
        icon: "target" as const,
      };
    }
  }

  // 3. Nếu mới có giờ dự tính (chưa có giờ thực tế)
  if (est > 0) {
    return {
      status: "pending",
      label: "KPI: Kế hoạch chuẩn",
      detail: `Kế hoạch ${est}h để đạt KPI hoàn thành đúng hạn`,
      color: "#1d4ed8",
      bg: "#eff6ff",
      borderColor: "#bfdbfe",
      icon: "clock" as const,
    };
  }

  return null;
}
