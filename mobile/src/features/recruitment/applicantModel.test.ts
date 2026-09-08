import { expect, it } from "vitest";
import { applicantFilters, stageChoices } from "./applicantModel";
it("uses literal search for the backend regex with paginated job and outcome filters", () => {
  expect(applicantFilters(2, " A+B (test) ", "s1", "active", "j1")).toEqual({
    page: 2,
    limit: 20,
    search: "A\\+B \\(test\\)",
    stageId: "s1",
    outcome: "active",
    jobId: "j1",
  });
  expect(applicantFilters(1, "", "", "")).not.toHaveProperty("jobId");
});
it("offers only active other stages in pipeline order and labels terminal outcomes", () => {
  const stage = { color: "#000000", isActive: true };
  expect(
    stageChoices(
      [
        { ...stage, id: "current", name: "Current", position: 0 },
        { ...stage, id: "off", name: "Off", position: 1, isActive: false },
        { ...stage, id: "hire", name: "Offer", position: 3, terminalOutcome: "hired" },
        { ...stage, id: "screen", name: "Screen", position: 2 },
      ],
      "current",
    ),
  ).toEqual([
    { value: "screen", label: "Screen" },
    { value: "hire", label: "Offer · Đã tuyển" },
  ]);
});
