import { browserTransport, type ServiceTransport } from "./serviceTransport";
import { parseApiErrorResponse } from "./apiClientError";
import type { Workflow, WorkflowEdge, WorkflowStep } from "../types/hr";

export type WorkflowInput = {
  name: string;
  description?: string;
  category?: string;
  steps: WorkflowStep[];
  edges?: WorkflowEdge[];
  autoAdvance?: boolean;
  companyCode?: string;
  branchId?: string;
};

export function createWorkflowService({ fetch, getAccessToken }: ServiceTransport) {
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

  const normalize = (value: any): Workflow => ({
    ...value,
    id: value?.id || value?._id,
    steps: Array.isArray(value?.steps) ? value.steps : [],
    edges: Array.isArray(value?.edges) ? value.edges : [],
  });

  return {
    list: async (companyCode?: string): Promise<Workflow[]> => {
      const query = companyCode ? `?companyCode=${encodeURIComponent(companyCode)}` : "";
      const result = await request<any[]>(`/api/v1/crud/workflows${query}`);
      return (Array.isArray(result) ? result : []).map(normalize);
    },
    create: async (input: WorkflowInput): Promise<Workflow> =>
      normalize(await request<any>("/api/v1/crud/workflows", { method: "POST", body: JSON.stringify(input) })),
    update: async (id: string, input: Partial<WorkflowInput>): Promise<Workflow> =>
      normalize(
        await request<any>(`/api/v1/crud/workflows/${encodeURIComponent(id)}`, {
          method: "PATCH",
          body: JSON.stringify(input),
        }),
      ),
    remove: async (id: string): Promise<void> => {
      await request(`/api/v1/crud/workflows/${encodeURIComponent(id)}`, { method: "DELETE" });
    },
  };
}

export const workflowService = createWorkflowService(browserTransport);
