import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
it("places applicant creation after the access guard and disables mutations on deleted records", () => {
  const source = readFileSync(new URL("../../../app/(tabs)/applicants.tsx", import.meta.url), "utf8");
  expect(source.indexOf('title="Thêm ứng viên cho tin này"')).toBeGreaterThan(
    source.indexOf("Cần quyền đọc tuyển dụng"),
  );
  expect(source).toContain("manage={access.manage && !pipelineError && !deleted}");
});
