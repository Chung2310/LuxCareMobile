import { expect, it, vi } from "vitest";
import { createWorkflowService } from "../../../../src/services/workflowService";

it("uses the workflow CRUD endpoints and normalizes Mongo ids", async () => {
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === "POST")
      return new Response(JSON.stringify({ data: { _id: "created", name: "New", steps: [] } }), { status: 201 });
    return new Response(JSON.stringify({ data: [{ _id: "listed", name: "Existing" }] }), { status: 200 });
  });
  const service = createWorkflowService({ fetch, getAccessToken: () => "token" });

  await expect(service.list("A&B")).resolves.toMatchObject([{ id: "listed" }]);
  await expect(service.create({ name: "New", steps: [] })).resolves.toMatchObject({ id: "created" });
  expect(fetch.mock.calls[0][0]).toBe("/api/v1/crud/workflows?companyCode=A%26B");
  expect((fetch.mock.calls[0][1]?.headers as Headers).get("Authorization")).toBe("Bearer token");
});
