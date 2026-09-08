import { expect, it, vi } from "vitest";
import { createHrCredentialService } from "../../../../src/services/hrCredentialService";

it("deletes the selected record with tenant and authentication, accepting success without data", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "success" })));
  const service = createHrCredentialService({ fetch, getAccessToken: () => "token" });
  await expect(service.remove("A&B", "id/part")).resolves.toBeUndefined();
  expect(fetch).toHaveBeenCalledExactlyOnceWith("/api/v1/hr-credentials/id%2Fpart?companyCode=A%26B", {
    method: "DELETE",
    headers: { Authorization: "Bearer token" },
  });
});

it.each([403, 404, 500])("preserves API error %s and does not retry deletion", async (status) => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "Delete failed" }), { status }));
  const service = createHrCredentialService({ fetch, getAccessToken: () => "token" });
  await expect(service.remove("A", "id")).rejects.toMatchObject({ status, message: "Delete failed" });
  expect(fetch).toHaveBeenCalledTimes(1);
});

it("does not report success when the server outcome is unconfirmed", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({})));
  const service = createHrCredentialService({ fetch, getAccessToken: () => "token" });
  await expect(service.remove("A", "id")).rejects.toThrow("Chưa xác nhận");
  expect(fetch).toHaveBeenCalledTimes(1);
});

it("does not retry after a connection failure", async () => {
  const fetch = vi.fn().mockRejectedValue(new TypeError("Network failed"));
  const service = createHrCredentialService({ fetch, getAccessToken: () => "token" });
  await expect(service.remove("A", "id")).rejects.toThrow("Network failed");
  expect(fetch).toHaveBeenCalledTimes(1);
});
