import { expect, it } from "vitest";
import { moveStage, pipelinePayload } from "./pipelineModel";
const stages = [
  { id: "a", name: " A ", color: "#123456", position: 0, isActive: true },
  { id: "b", name: "B", color: "#abcdef", position: 1, isActive: true, terminalOutcome: "hired" as const },
];
it("reorders while preserving ids and normalizes contiguous positions", () => {
  expect(pipelinePayload(moveStage(stages, 1, -1))).toEqual([
    { ...stages[1], position: 0 },
    { ...stages[0], name: "A", position: 1, terminalOutcome: null },
  ]);
  expect(stages[0].id).toBe("a");
});
it("rejects empty or inactive-only pipelines, duplicate ids and invalid colors", () => {
  for (const rows of [
    [],
    stages.map((stage) => ({ ...stage, isActive: false })),
    [stages[0], stages[0]],
    [{ ...stages[0], color: "red" }],
    [{ ...stages[0], name: " " }],
  ])
    expect(() => pipelinePayload(rows)).toThrow();
});
