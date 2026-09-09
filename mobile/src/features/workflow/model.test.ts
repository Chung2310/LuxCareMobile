import { expect, it } from "vitest";
import type { WorkflowStep } from "../../../../src/types/hr";
import { moveWorkflowStep, pruneWorkflowEdges, workflowPayload } from "./model";

const step = (id: string, title = id): WorkflowStep => ({ id, title });

it("normalizes workflow fields and keeps step details", () => {
  const payload = workflowPayload("  Onboarding  ", " HR ", "  Mô tả ", [
    { ...step("one", " Bước một "), subTasks: [{ id: "sub", title: " Việc con " }] },
  ]);

  expect(payload).toMatchObject({ name: "Onboarding", category: "HR", description: "Mô tả" });
  expect(payload.steps[0]).toMatchObject({ id: "one", title: "Bước một", subTasks: [{ title: "Việc con" }] });
});

it("rejects empty workflows and invalid branches", () => {
  expect(() => workflowPayload("", "", "", [step("one")])).toThrow("tên quy trình");
  expect(() => workflowPayload("Test", "", "", [])).toThrow("ít nhất một bước");
  expect(() =>
    workflowPayload("Test", "", "", [step("one"), step("two")], [
      { id: "edge", source: "one", target: "missing", label: "Đi tiếp", outcomeKey: "next" },
    ]),
  ).toThrow("bước khác");
});

it("reorders steps and removes branches pointing to a deleted step", () => {
  const steps = [step("one"), step("two"), step("three")];
  expect(moveWorkflowStep(steps, 1, -1).map((item) => item.id)).toEqual(["two", "one", "three"]);
  expect(moveWorkflowStep(steps, 0, -1)).toBe(steps);
  expect(
    pruneWorkflowEdges(
      [
        { id: "keep", source: "one", target: "two", label: "A", outcomeKey: "a" },
        { id: "drop", source: "two", target: "three", label: "B", outcomeKey: "b" },
      ],
      [step("one"), step("two")],
    ).map((edge) => edge.id),
  ).toEqual(["keep"]);
});
