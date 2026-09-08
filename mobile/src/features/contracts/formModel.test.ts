import { expect, it } from "vitest";
import type { Contract, Employee } from "../../../../src/types/hrContract";
import type { UserProfile } from "../../../../src/types/common";
import { contractDraft, contractPayload, contractChanges } from "./formModel";
import { canManageContracts } from "./model";
const employee = { _id: "a".repeat(24), email: "employee@example.com" } as Employee;
const original = {
  _id: "b".repeat(24),
  employeeId: employee._id,
  employeeName: "An",
  contractType: "Hợp đồng",
  startDate: "2026-01-01T06:00:00.000Z",
  endDate: "2026-12-31T07:00:00.000Z",
  status: "active",
  note: "Ghi chú",
  contractFiles: [{ url: "https://files.example/f", name: "f.pdf" }],
} as Contract;
it("creates only the allowed basic fields using valid calendar dates", () => {
  const draft = { ...contractDraft(), employeeId: employee._id, startDate: "2026-09-08", endDate: "2027-09-08" };
  const payload = contractPayload(draft, [employee]);
  expect(payload).toEqual({
    contractType: "Hợp đồng xác định thời hạn",
    employeeId: employee._id,
    startDate: "2026-09-08T00:00:00.000Z",
    endDate: "2027-09-08T00:00:00.000Z",
    status: "draft",
    note: "",
  });
});
it("preserves original timestamps and avoids resending attachments or unchanged values", () => {
  const payload = contractPayload(contractDraft(original), [], original);
  expect(payload.startDate).toBe(original.startDate);
  expect(contractChanges(payload, original)).toEqual({});
  expect(contractChanges({ ...payload, note: "" }, original)).toEqual({ note: "" });
});
it("allows keeping the existing employee but rejects an unlisted replacement", () => {
  expect(() => contractPayload(contractDraft(original), [], original)).not.toThrow();
  expect(() => contractPayload({ ...contractDraft(original), employeeId: "c".repeat(24) }, [], original)).toThrow(
    "Chọn nhân viên",
  );
});
it("rejects impossible dates, reversed periods and malformed dates", () => {
  for (const startDate of ["2026-02-30", "2025-02-29", "09/08/2026", "2027-01-01"]) {
    expect(() => contractPayload({ ...contractDraft(original), startDate }, [employee], original)).toThrow();
  }
  expect(() =>
    contractPayload({ ...contractDraft(original), startDate: "2024-02-29" }, [employee], original),
  ).not.toThrow();
});
it("validates text lengths, employee ID and status before sending", () => {
  for (const change of [
    { contractType: " " },
    { contractType: "x".repeat(101) },
    { note: "x".repeat(1001) },
    { employeeId: "invalid" },
    { status: "unknown" },
  ]) {
    expect(() =>
      contractPayload(
        { ...contractDraft(original), ...change } as ReturnType<typeof contractDraft>,
        [employee],
        original,
      ),
    ).toThrow();
  }
});
it("requires both read and manage permission within HR", () => {
  const user = {
    uid: "u",
    role: "user",
    companyCode: "COMP",
    enabledModules: ["hr"],
    permissions: ["hr:read"],
  } as UserProfile;
  expect(canManageContracts(user)).toBe(false);
  expect(canManageContracts({ ...user, permissions: ["hr:manage"] })).toBe(false);
  expect(canManageContracts({ ...user, permissions: ["hr:read", "hr:manage"] })).toBe(true);
  expect(canManageContracts({ ...user, permissions: ["*"], enabledModules: ["chat"] })).toBe(false);
});
