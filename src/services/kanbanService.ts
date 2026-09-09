import type { ServiceTransport } from "./serviceTransport";
import { parseApiErrorResponse } from "./apiClientError";
import type { HRTask, Project } from "../types/hr";
export type TaskInput = Pick<HRTask, "title" | "assigneeUid" | "dueDate"> &
  Partial<
    Pick<
      HRTask,
      | "description"
      | "priority"
      | "status"
      | "projectId"
      | "startTime"
      | "endTime"
      | "estTime"
      | "actualTime"
      | "linkNote"
      | "tags"
      | "subtasks"
      | "attachments"
    >
  >;
export type TaskUpdate = Partial<TaskInput> & {
  expectedRevision?: number;
  subtasks?: HRTask["subtasks"];
  attachments?: HRTask["attachments"];
  tags?: HRTask["tags"];
};
export type ProjectInput = Pick<Project, "name" | "status" | "priority"> & Partial<Pick<Project, "startAt" | "dueAt">>;
export function createKanbanService({ fetch, getAccessToken }: ServiceTransport) {
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    const token = getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    if (init.body) headers.set("Content-Type", "application/json");
    const response = await fetch(path, { ...init, headers });
    if (!response.ok) throw await parseApiErrorResponse(response);
    const body = await response.json().catch(() => ({}));
    return (body.data ?? body) as T;
  }
  const unwrap = (res: any): any => {
    if (!res) return res;
    if (res.task && typeof res.task === "object") return res.task;
    if (res.project && typeof res.project === "object") return res.project;
    if (res.data && typeof res.data === "object" && !Array.isArray(res.data)) return res.data;
    if (res.item && typeof res.item === "object") return res.item;
    return res;
  };
  const normalize = <T extends { id: string }>(record: any): T => {
    const r = unwrap(record);
    if (!r || typeof r !== "object") return r as T;
    return {
      ...r,
      id: r._id || r.id,
    };
  };
  const suffix = (branchId?: string) => (branchId ? `?branchId=${encodeURIComponent(branchId)}` : "");
  return {
    listTasks: async (branchId?: string): Promise<HRTask[]> => {
      const res = await request<any>(`/api/v1/kanban/tasks${suffix(branchId)}`);
      const list = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res?.tasks)
        ? res.tasks
        : Array.isArray(res?.items)
        ? res.items
        : [];
      return list.map(normalize);
    },
    listProjects: async (branchId?: string): Promise<Project[]> => {
      const res = await request<any>(`/api/v1/kanban/projects${suffix(branchId)}`, {
        cache: "no-store",
      });
      const list = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res?.projects)
        ? res.projects
        : Array.isArray(res?.items)
        ? res.items
        : [];
      return list.map(normalize);
    },
    createTask: async (input: TaskInput): Promise<HRTask> =>
      normalize(await request<HRTask>("/api/v1/kanban/tasks", { method: "POST", body: JSON.stringify(input) })),
    updateTask: async (id: string, input: TaskUpdate): Promise<HRTask> =>
      normalize(
        await request<HRTask>(`/api/v1/kanban/tasks/${encodeURIComponent(id)}`, {
          method: "PATCH",
          body: JSON.stringify(input),
        }),
      ),
    removeTask: async (id: string) => {
      await request(`/api/v1/kanban/tasks/${encodeURIComponent(id)}`, { method: "DELETE" });
    },
    createProject: async (input: ProjectInput): Promise<Project> =>
      normalize(await request<Project>("/api/v1/kanban/projects", { method: "POST", body: JSON.stringify(input) })),
    updateProject: async (
      id: string,
      input: Partial<ProjectInput> & { attachments?: Project["attachments"] },
    ): Promise<Project> =>
      normalize(
        await request<Project>(`/api/v1/kanban/projects/${encodeURIComponent(id)}`, {
          method: "PATCH",
          body: JSON.stringify(input),
        }),
      ),
    removeProject: async (id: string): Promise<void> => {
      await request(`/api/v1/kanban/projects/${encodeURIComponent(id)}`, { method: "DELETE" });
    },
  };
}
