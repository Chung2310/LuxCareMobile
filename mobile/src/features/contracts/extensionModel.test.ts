import { expect, it, vi } from "vitest";
import type { Contract } from "../../../../src/types/hrContract";
import { createHrContractService } from "../../../../src/services/hrContractService";
import { extensionDraft, extensionPayload } from "./extensionModel";
const contract = { _id: "contract", endDate: "2026-09-30T12:00:00.000Z", status: "expired" } as Contract;
const draft = { newEndDate: "2027-09-30", extensionDate: "2026-09-08", reason: " Gia hạn thêm " };
it("sends only extension fields with trimmed reason and ISO dates", () => {
  expect(extensionPayload(draft, contract)).toEqual({
    newEndDate: "2027-09-30T00:00:00.000Z",
    extensionDate: "2026-09-08T00:00:00.000Z",
    reason: "Gia hạn thêm",
  });
  expect(extensionDraft(new Date("2026-09-08T00:00:00Z"))).toEqual({
    newEndDate: "",
    extensionDate: "2026-09-08",
    reason: "",
  });
});
it("requires a strictly later expiry and rejects invalid dates", () => {
  for (const newEndDate of ["2026-09-30", "2026-09-29", "2027-02-29", "2027-02-30", "30/09/2027", ""])
    expect(() => extensionPayload({ ...draft, newEndDate }, contract)).toThrow();
  expect(() => extensionPayload({ ...draft, newEndDate: "2028-02-29" }, contract)).not.toThrow();
  expect(() => extensionPayload({ ...draft, extensionDate: "2026-02-30" }, contract)).toThrow();
});
it("rejects invalid current expiry or excessive reason", () => {
  expect(() => extensionPayload(draft, { ...contract, endDate: "invalid" })).toThrow();
  expect(() => extensionPayload({ ...draft, reason: "x".repeat(1001) }, contract)).toThrow();
});
it("uses the contract extension endpoint and preserves both response records", async () => {
  const data = {
    contract: { ...contract, endDate: draft.newEndDate, status: "active" },
    extension: { _id: "extension" },
  };
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data })));
  const service = createHrContractService({ fetch, getAccessToken: () => "token" });
  const payload = extensionPayload(draft, contract);
  expect(await service.extend({ companyCode: "A&B", branchId: "branch" }, "id/1", payload)).toEqual(data);
  expect(fetch.mock.calls[0][0]).toBe("/api/v1/hr-contracts/id%2F1/extensions?companyCode=A%26B&branchId=branch");
  expect(fetch.mock.calls[0][1]).toMatchObject({
    method: "POST",
    body: JSON.stringify(payload),
    headers: { Authorization: "Bearer token", "Content-Type": "application/json" },
  });
});
it("propagates rejection without retrying a mutation", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ message: "Ngày hết hạn đã thay đổi" }), { status: 400 }));
  const service = createHrContractService({ fetch, getAccessToken: () => "token" });
  await expect(service.extend({ companyCode: "A" }, "id", draft)).rejects.toMatchObject({ status: 400 });
  expect(fetch).toHaveBeenCalledOnce();
});

it.each([
  ["2026-09-11T17:00:00.000Z", "2026-09-12"],
  ["2026-12-31T18:30:00.000Z", "2027-01-01"],
  ["2026-09-11T16:59:59.000Z", "2026-09-11"],
])("defaults extension day to Vietnam time for %s", (timestamp, expected) => {
  expect(extensionDraft(new Date(timestamp)).extensionDate).toBe(expected);
});
