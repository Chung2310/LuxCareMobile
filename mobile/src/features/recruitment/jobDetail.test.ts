import { describe, expect, it } from "vitest";
import type { RecruitmentJob } from "../../../../src/types/recruitment";
import {
  formatDeadline,
  formatMoney,
  formatSalaryRange,
  getJobStatusBadgeInfo,
} from "./recruitmentModel";

describe("JobDetail helpers", () => {
  it("formats money correctly", () => {
    expect(formatMoney(null)).toBe("Thỏa thuận");
    expect(formatMoney(0)).toBe("Thỏa thuận");
    expect(formatMoney(15000000)).toBe("15 Tr");
    expect(formatMoney(15500000)).toBe("15.5 Tr");
    expect(formatMoney(500000)).toBe("500.000 đ");
  });

  it("formats salary range properly", () => {
    const baseJob = {
      _id: "j1",
      code: "JOB01",
      title: "Kỹ sư phần mềm",
      department: "IT",
      headcount: 2,
      description: "Mô tả",
      requirements: "Yêu cầu",
      benefits: "Quyền lợi",
      employmentType: "full_time",
      workplaceType: "onsite",
      location: "Hà Nội",
      status: "open",
      version: 1,
    } as RecruitmentJob;

    expect(formatSalaryRange({ ...baseJob, showSalary: false })).toBe("Lương thỏa thuận (kín)");
    expect(formatSalaryRange({ ...baseJob, showSalary: true, salaryMin: null, salaryMax: null })).toBe("Thỏa thuận");
    expect(
      formatSalaryRange({ ...baseJob, showSalary: true, salaryMin: 10000000, salaryMax: 20000000 }),
    ).toBe("10 Tr - 20 Tr");
    expect(
      formatSalaryRange({ ...baseJob, showSalary: true, salaryMin: 10000000, salaryMax: null }),
    ).toBe("Từ 10 Tr");
    expect(
      formatSalaryRange({ ...baseJob, showSalary: true, salaryMin: null, salaryMax: 25000000 }),
    ).toBe("Đến 25 Tr");
  });

  it("formats deadline correctly", () => {
    expect(formatDeadline(null)).toEqual({
      text: "Không giới hạn",
      isExpired: false,
      isNear: false,
    });

    const past = formatDeadline("2020-01-01");
    expect(past.isExpired).toBe(true);

    const farFuture = formatDeadline("2099-12-31");
    expect(farFuture.isExpired).toBe(false);
    expect(farFuture.isNear).toBe(false);
  });

  it("returns correct status badges", () => {
    expect(getJobStatusBadgeInfo("open", false).label).toBe("Đang tuyển");
    expect(getJobStatusBadgeInfo("draft", false).label).toBe("Bản nháp");
    expect(getJobStatusBadgeInfo("paused", false).label).toBe("Tạm dừng");
    expect(getJobStatusBadgeInfo("closed", false).label).toBe("Đã đóng");
    expect(getJobStatusBadgeInfo("open", true).label).toBe("Đã xóa");
  });
});
