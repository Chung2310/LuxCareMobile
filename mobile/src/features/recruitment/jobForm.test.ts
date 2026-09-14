import { expect, it } from "vitest";
import type { RecruitmentJob } from "../../../../src/types/recruitment";
import { deadlineText, jobDraft, jobPayload } from "./jobModel";
it("creates drafts with an allowlisted payload without tenant or file fields", () => {
  const payload = jobPayload({ ...jobDraft(), code: " dev ", title: "Developer", deadline: "2026-10-01" });
  expect(payload).toMatchObject({
    code: "DEV",
    status: "draft",
    salaryMin: null,
    applicationDeadline: "2026-10-01",
  });
  expect(payload).not.toHaveProperty("jdFileUrl");
  expect(payload).not.toHaveProperty("companyCode");
});
it("retains deadline precision when another field changes", () => {
  const job = {
    code: "DEV",
    title: "Developer",
    headcount: 1,
    status: "paused",
    applicationDeadline: "2026-10-01T16:59:32.123Z",
    jdFileUrl: "existing",
  } as RecruitmentJob;
  expect(deadlineText(job.applicationDeadline)).toBe("2026-10-01");
  expect(jobPayload({ ...jobDraft(job), title: "New" }, job)).toMatchObject({
    applicationDeadline: job.applicationDeadline,
    status: "paused",
  });
  expect(jobPayload({ ...jobDraft(job), deadline: "" }, job).applicationDeadline).toBeNull();
});
it("rejects invalid counts, salary ranges, dates and incomplete open jobs", () => {
  const draft = { ...jobDraft(), code: "DEV", title: "Developer" };
  for (const patch of [
    { headcount: "1.5" },
    { salaryMin: "-1" },
    { salaryMin: "20", salaryMax: "10" },
    { deadline: "2026-02-30" },
    { deadline: "2026-10-01 24:00" },
  ])
    expect(() => jobPayload({ ...draft, ...patch })).toThrow();
  expect(() => jobPayload(draft, { status: "open" } as RecruitmentJob)).toThrow("Tin đang tuyển");
});

it("preserves hidden web fields and the immutable code when editing", () => {
  const job = { code: "DEV", title: "Developer", headcount: 2, status: "draft",
    salaryMin: 100, salaryMax: 200, showSalary: true, employmentType: "contract" } as RecruitmentJob;
  expect(jobPayload({ ...jobDraft(job), code: "CHANGED", department: "HR" }, job)).toMatchObject({
    code: "DEV", salaryMin: 100, salaryMax: 200, showSalary: true, employmentType: "contract", department: "HR",
  });
});
it("requires the same basic fields as the web create form", () => {
  expect(() => jobPayload({ ...jobDraft(), code: "DEV" })).toThrow();
  expect(() => jobPayload({ ...jobDraft(), title: "Developer" })).toThrow();
  expect(jobPayload({ ...jobDraft(), code: "DEV", title: "Developer" })).toMatchObject({
    headcount: 1, workplaceType: "onsite", employmentType: "full_time", status: "draft", applicationDeadline: null,
  });
});
