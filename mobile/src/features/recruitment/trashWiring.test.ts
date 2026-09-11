import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
it("places applicant creation after the access guard and respects access management", () => {
  const source = readFileSync(new URL("../../../app/(tabs)/applicants.tsx", import.meta.url), "utf8");
  expect(source.indexOf('setEditing("new")')).toBeGreaterThan(
    source.indexOf("Cần quyền đọc tuyển dụng"),
  );
  expect(source).toContain("canManage={access.manage}");
});
