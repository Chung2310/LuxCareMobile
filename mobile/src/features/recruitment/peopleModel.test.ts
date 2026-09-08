import { expect, it } from "vitest";
import type { UserProfile } from "../../../../src/types/common";
import { recruitmentPeople, recruiterPatch, interviewerPatch } from "./peopleModel";
it("offers only active people from the exact company and branch", () => {
  const base = {
    uid: "u1",
    displayName: "Name",
    email: "a@example.com",
    companyCode: "C",
    branchId: "B",
    isActive: true,
  };
  const rows = [
    base,
    { ...base, uid: "u2", branchId: "OTHER" },
    { ...base, uid: "u3", companyCode: "OTHER" },
    { ...base, uid: "u4", isActive: false },
    { ...base, uid: "u5", isActive: undefined },
  ] as unknown as UserProfile[];
  expect(recruitmentPeople(rows, "C", "B")).toEqual([{ value: "u1", label: "Name · a@example.com" }]);
  expect(recruitmentPeople(rows, "C", "")).toEqual([]);
});
it("does not overwrite assignments that were not changed even if absent from the roster", () => {
  expect(recruiterPatch("old", ["old"])).toEqual({});
  expect(interviewerPatch(["old", "u2"], ["u2", "old"])).toEqual({});
});
it("sends explicit removal and deduplicates multiple selections", () => {
  expect(recruiterPatch("old", [])).toEqual({ recruiterId: null });
  expect(recruiterPatch(null, ["u1"])).toEqual({ recruiterId: "u1" });
  expect(interviewerPatch(["old"], [])).toEqual({ interviewerIds: [] });
  expect(interviewerPatch([], ["u1", "u1"])).toEqual({ interviewerIds: ["u1"] });
});
