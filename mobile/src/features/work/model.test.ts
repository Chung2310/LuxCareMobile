import { describe, expect, it } from "vitest";
import type { UserProfile } from "../../../../src/types/common";
import type { HRTask } from "../../../../src/types/hr";
import { canUpdateTask, draftForTask, localDateTime, parseDateTime, taskPayload } from "./model";
const employee = { uid: "u1", role: "staff" } as UserProfile;
const task = { assigneeUid: "u2", subtasks: [{ assigneeUid: "u1" }] } as HRTask;
const draft = () => ({ ...draftForTask(), title: "Task", assigneeUid: "u1", dueDate: "2026-09-10 18:00" });
describe("native task rules", () => {
  it("allows only managers or main/subtask assignees to edit", () => {
    expect(canUpdateTask(employee, task)).toBe(true);
    expect(canUpdateTask({ ...employee, uid: "u3" }, task)).toBe(false);
    expect(canUpdateTask({ ...employee, role: "manager" }, task)).toBe(true);
    expect(canUpdateTask(null, task)).toBe(false);
  });
  it("keeps local times through ISO conversion and rejects impossible dates", () => {
    expect(localDateTime(parseDateTime("2026-09-10 09:30", "Time"))).toBe("2026-09-10 09:30");
    expect(() => parseDateTime("2026-02-30 09:30", "Time")).toThrow();
    expect(() => parseDateTime("10/09/2026", "Time")).toThrow();
  });
  it("omits manager fields from employee updates", () => {
    const payload = taskPayload(draft(), false, false);
    expect(payload).not.toHaveProperty("assigneeUid");
    expect(payload).not.toHaveProperty("title");
    expect(payload).not.toHaveProperty("projectId");
    expect(() => taskPayload({ ...draft(), status: "Archived" }, false, false)).toThrow();
  });
  it("validates completion and hours before mutation", () => {
    expect(() => taskPayload({ ...draft(), status: "Done" }, true, false)).toThrow();
    expect(() => taskPayload({ ...draft(), estTime: "-1" }, true, false)).toThrow();
    expect(
      taskPayload(
        { ...draft(), status: "Done", description: "Finished", startTime: "2020-01-01 09:00", estTime: "1,5" },
        true,
        false,
      ),
    ).toMatchObject({ status: "Done", estTime: 1.5 });
  });
});

it("keeps subtask assignment, notes and local deadlines through task editing", () => {
  const dueDate = "2026-09-10 14:30";
  const payload = taskPayload({ ...draft(), subtasks: [{
    id: "sub", title: " Prepare room ", assigneeUid: "u2", assignee: "Lan", assigneeAvatar: "https://example.com/avatar.png",
    dueDate, note: "Bring the checklist", completed: true, completedAt: "2026-09-10T06:00:00.000Z",
  }] }, true, false);
  expect(payload.subtasks?.[0]).toMatchObject({ title: "Prepare room", assigneeUid: "u2", assignee: "Lan", note: "Bring the checklist", completed: true, completedAt: "2026-09-10T06:00:00.000Z" });
  expect(localDateTime(payload.subtasks?.[0].dueDate)).toBe(dueDate);
  expect(draftForTask({ ...payload, id: "task" } as HRTask).subtasks[0]).toMatchObject({ dueDate, note: "Bring the checklist", assignee: "Lan" });
});