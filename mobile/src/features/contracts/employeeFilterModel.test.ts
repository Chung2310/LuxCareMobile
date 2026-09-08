import { expect, it, vi } from "vitest";
import { ALL_EMPLOYEES, employeeFilterChoices } from "./employeeFilterModel";
import { createHrContractService } from "../../../../src/services/hrContractService";
import { createHrCredentialService } from "../../../../src/services/hrCredentialService";
const employees = [
  { _id: "one", displayName: "Nguyễn An", email: "an@example.com" },
  { _id: "two", displayName: "Bình", email: "binh@example.com" },
];
it("finds employees by name or email without case sensitivity", () => {
  expect(employeeFilterChoices(employees, " NGUYỄN ", ALL_EMPLOYEES).map((item) => item.value)).toEqual(["", "one"]);
  expect(employeeFilterChoices(employees, "BINH@", ALL_EMPLOYEES).map((item) => item.value)).toEqual(["", "two"]);
});
it("retains the selected label during loading or when searching for another person", () => {
  const selected = { value: "one", label: "Nguyễn An" };
  expect(employeeFilterChoices([], "", selected)).toEqual([ALL_EMPLOYEES, selected]);
  expect(employeeFilterChoices(employees, "binh", selected).map((item) => item.value)).toEqual(["", "one", "two"]);
  expect(employeeFilterChoices(employees, "", selected).filter((item) => item.value === "one")).toHaveLength(1);
});
it("always allows clearing a selection even when no employee matches", () => {
  expect(employeeFilterChoices(employees, "missing", ALL_EMPLOYEES)).toEqual([ALL_EMPLOYEES]);
});
it.each(["contracts", "credentials"])(
  "sends employee filter and pagination to %s API, omitting it when reset",
  async (kind) => {
    const fetch = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ data: { total: 0 } })));
    const transport = { fetch, getAccessToken: () => "token" };
    const service = kind === "contracts" ? createHrContractService(transport) : createHrCredentialService(transport);
    await service.list({
      companyCode: "COMP",
      branchId: "branch",
      employeeId: "one",
      search: "scan",
      page: 2,
      limit: 10,
    });
    const first = new URL(fetch.mock.calls[0][0], "https://api.example");
    expect(Object.fromEntries(first.searchParams)).toEqual({
      companyCode: "COMP",
      branchId: "branch",
      employeeId: "one",
      search: "scan",
      page: "2",
      limit: "10",
    });
    await service.list({ companyCode: "COMP", branchId: "branch", employeeId: "", search: "", page: 1, limit: 10 });
    const reset = new URL(fetch.mock.calls[1][0], "https://api.example");
    expect(reset.searchParams.has("employeeId")).toBe(false);
    expect(reset.searchParams.has("search")).toBe(false);
    expect(reset.searchParams.get("branchId")).toBe("branch");
  },
);
