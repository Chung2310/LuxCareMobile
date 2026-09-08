import { expect, it } from "vitest";
import type { RecruitmentJob } from "../../../../src/types/recruitment";
import { deadlineText, jobDraft, jobPayload } from "./jobModel";
it("creates drafts with an allowlisted payload without tenant or file fields", () => {
  const payload = jobPayload({ ...jobDraft(), code: " dev ", title: "Developer", deadline: "2026-10-01 23:59" });
  expect(payload).toMatchObject({
    code: "DEV",
    status: "draft",
    salaryMin: null,
    applicationDeadline: "2026-10-01T16:59:00.000Z",
  });
  expect(payload).not.toHaveProperty("jdFileUrl");
  expect(payload).not.toHaveProperty("companyCode");
});
it("retains deadline precision when another field changes", () => {
  const job = {
    code: "DEV",
    headcount: 1,
    status: "paused",
    applicationDeadline: "2026-10-01T16:59:32.123Z",
    jdFileUrl: "existing",
  } as RecruitmentJob;
  expect(deadlineText(job.applicationDeadline)).toBe("2026-10-01 23:59");
  expect(jobPayload({ ...jobDraft(job), title: "New" }, job)).toMatchObject({
    applicationDeadline: job.applicationDeadline,
    status: "paused",
  });
  expect(jobPayload({ ...jobDraft(job), deadline: "" }, job).applicationDeadline).toBeNull();
});
it("rejects invalid counts, salary ranges, dates and incomplete open jobs", () => {
  const draft = { ...jobDraft(), code: "DEV" };
  for (const patch of [
    { headcount: "1.5" },
    { salaryMin: "-1" },
    { salaryMin: "20", salaryMax: "10" },
    { deadline: "2026-02-30 12:00" },
    { deadline: "2026-10-01 24:00" },
  ])
    expect(() => jobPayload({ ...draft, ...patch })).toThrow();
  expect(() => jobPayload(draft, { status: "open" } as RecruitmentJob)).toThrow("Tin đang tuyển");
});
