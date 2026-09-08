import { expect, it } from "vitest";
import type { Project } from "../../../../src/types/hr";
import { projectDraft, projectPayload } from "./project";
const project = {
  id: "p1",
  name: "Original",
  status: "in_progress",
  priority: "medium",
  progress: { total: 2, completed: 1, percent: 50 },
  startAt: "2026-09-01T02:00:00.000Z",
  dueAt: "2026-09-10T10:00:00.000Z",
} as Project;
it("sends only changed fields and does not overwrite lifecycle or attachments", () => {
  expect(projectPayload({ ...projectDraft(project), name: "Renamed" }, project)).toEqual({ name: "Renamed" });
  expect(projectPayload(projectDraft(project), project)).toEqual({});
});
it("allows clearing dates and rejects inverted dates", () => {
  expect(projectPayload({ ...projectDraft(project), dueAt: "" }, project)).toEqual({ dueAt: "" });
  expect(() => projectPayload({ ...projectDraft(project), dueAt: "2020-01-01 09:00" }, project)).toThrow();
});
it("requires tasks to be complete before completing a project", () => {
  expect(() => projectPayload({ ...projectDraft(project), status: "completed" }, project)).toThrow();
  const done = { ...project, progress: { total: 2, completed: 2, percent: 100 } };
  expect(projectPayload({ ...projectDraft(done), status: "completed" }, done)).toEqual({ status: "completed" });
  expect(() => projectPayload({ ...projectDraft(), name: "New", status: "completed" })).toThrow();
});
