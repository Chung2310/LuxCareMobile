import { parseApiErrorResponse } from "./apiClientError";
import { browserTransport, type ServiceTransport } from "./serviceTransport";

export interface KnowledgeDocument {
  _id: string;
  title: string;
  category?: string;
  documentType?: "general" | "company_profile" | "policy" | "procedure" | "faq" | "medical" | "guideline" | string;
  visibility?: "company" | "restricted";
  branchIds?: string[];
  departmentIds?: string[];
  indexingStatus?: "queued" | "processing" | "indexed" | "failed";
  indexingError?: string;
  chunksCount?: number;
  sourceType?: "manual" | "resource";
  effectiveFrom?: string;
  effectiveTo?: string;
  status?: "active" | "disabled" | "failed" | "superseded" | "withdrawn";
  createdAt?: string;
  updatedAt?: string;
}

export interface KnowledgeSearchItem {
  text: string;
  score?: number;
  title?: string;
  documentId?: string;
  documentType?: string;
}

export function createAssistantKnowledgeService({ fetch, getAccessToken }: ServiceTransport) {
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

  return {
    async listDocuments(): Promise<KnowledgeDocument[]> {
      const res = await request<{ documents?: KnowledgeDocument[] }>("/api/v1/assistant/knowledge/documents");
      return res.documents || [];
    },
    async getDocument(id: string): Promise<KnowledgeDocument | null> {
      const res = await request<{ document?: KnowledgeDocument }>(
        `/api/v1/assistant/knowledge/documents/${encodeURIComponent(id)}`,
      );
      return res.document || null;
    },
    async search(
      query: string,
      filters: { category?: string; documentType?: string } = {},
    ): Promise<KnowledgeSearchItem[]> {
      const res = await request<{ evidence?: KnowledgeSearchItem[] }>("/api/v1/assistant/knowledge/test-search", {
        method: "POST",
        body: JSON.stringify({ query, ...filters }),
      });
      return res.evidence || [];
    },
    async createDocument(input: {
      title: string;
      text: string;
      documentType?: string;
      category?: string;
    }): Promise<any> {
      return request("/api/v1/assistant/knowledge/documents", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    async deleteDocument(id: string): Promise<any> {
      return request(`/api/v1/assistant/knowledge/documents/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
    },
    async uploadFile(
      file: { uri: string; name: string; type?: string },
      metadata: { documentType?: string; category?: string } = {},
    ): Promise<any> {
      const form = new FormData();
      form.append("files", {
        uri: file.uri,
        name: file.name,
        type: file.type || "application/octet-stream",
      } as unknown as Blob);
      if (metadata.documentType) form.append("documentType", metadata.documentType);
      if (metadata.category) form.append("category", metadata.category);

      const headers = new Headers();
      const token = getAccessToken();
      if (token) headers.set("Authorization", `Bearer ${token}`);

      const response = await fetch("/api/v1/assistant/knowledge/files", {
        method: "POST",
        headers,
        body: form,
      });
      if (!response.ok) throw await parseApiErrorResponse(response);
      const body = await response.json().catch(() => ({}));
      return body.data ?? body;
    },
  };
}

export const assistantKnowledgeService = createAssistantKnowledgeService(browserTransport);
