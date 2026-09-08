import { expect, it } from "vitest";
import type { RecruitmentInterview } from "../../../../src/types/recruitment";
import { interviewDraft, interviewPayload } from "./interviewModel";
it("converts Vietnam times including overnight interviews", () => {
  const result = interviewPayload({ ...interviewDraft(), start: "2026-10-01 23:30", end: "2026-10-02 00:30" });
  expect(result).toMatchObject({
    scheduledStart: "2026-10-01T16:30:00.000Z",
    scheduledEnd: "2026-10-01T17:30:00.000Z",
  });
});
it("rejects invalid dates, reversed times and unsafe meeting schemes", () => {
  const draft = { ...interviewDraft(), start: "2026-10-01 10:00", end: "2026-10-01 11:00" };
  for (const patch of [
    { start: "2026-02-30 10:00" },
    { end: "2026-10-01 10:00" },
    { meetingLink: "javascript:alert(1)" },
  ])
    expect(() => interviewPayload({ ...draft, ...patch })).toThrow();
});
it("preserves existing precision and omits identity and interviewer fields on edits", () => {
  const item = {
    scheduledStart: "2026-10-01T03:00:15.000Z",
    scheduledEnd: "2026-10-01T04:00:15.000Z",
    interviewerIds: ["u1"],
    version: 4,
  } as RecruitmentInterview;
  const result = interviewPayload({ ...interviewDraft(item), result: "Passed" }, item);
  expect(result.scheduledStart).toBe(item.scheduledStart);
  expect(result.result).toBe("Passed");
  expect(result).not.toHaveProperty("interviewerIds");
  expect(result).not.toHaveProperty("applicantId");
});
