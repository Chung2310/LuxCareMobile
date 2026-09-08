import { expect, it } from "vitest";
import type { RecruitmentApplicant } from "../../../../src/types/recruitment";
import { applicantDraft, applicantPayload } from "./applicantFormModel";
it("normalizes profile fields while omitting CV, stage, job and recruiter", () => {
  const original = {
    fullName: "Name",
    skills: ["Care"],
    cvUrl: "file",
    jobId: "j",
    stageId: "s",
    recruiterId: "r",
    availableDate: "2026-10-01T12:34:56.000Z",
  } as RecruitmentApplicant;
  const payload = applicantPayload(
    { ...applicantDraft(original), email: " A@EXAMPLE.COM ", skills: " Care, , English " },
    original,
  );
  expect(payload).toMatchObject({
    email: "a@example.com",
    skills: ["Care", "English"],
    availableDate: original.availableDate,
  });
  for (const key of ["cvUrl", "jobId", "stageId", "outcome", "recruiterId", "confirmDuplicate"])
    expect(payload).not.toHaveProperty(key);
});
it("validates dates, names and salaries, and clears optional fields", () => {
  const draft = { ...applicantDraft(), fullName: "Name" };
  for (const patch of [{ fullName: " " }, { email: "invalid" }, { birthDate: "2026-02-30" }, { expectedSalary: "-1" }])
    expect(() => applicantPayload({ ...draft, ...patch })).toThrow();
  expect(applicantPayload(draft)).toMatchObject({ expectedSalary: null, birthDate: null, availableDate: null });
});
