const { test } = require("node:test");
const assert = require("node:assert/strict");
const { versionCode, prepare } = require("./prepare-android-release.cjs");
test("new workflow runs increase versionCode; retry retains the same version", () => {
  assert.equal(versionCode("1"), 1001);
  assert.equal(versionCode("42"), 1042);
  assert.equal(versionCode("43"), 1043);
});
test("rejects invalid and overflowing version codes", () => {
  for (const input of ["", "0", "-1", "1.5", "1e3", "2100000000"]) assert.throws(() => versionCode(input));
});
test("never falls back to a debug key or exposes supplied secrets", () => {
  assert.throws(() => prepare({ GITHUB_RUN_NUMBER: "1" }), /ANDROID_KEYSTORE_BASE64/);
  assert.throws(() => prepare({ GITHUB_RUN_NUMBER: "1", ANDROID_KEYSTORE_BASE64: "PRIVATE!VALUE", ANDROID_KEYSTORE_PASSWORD: "SECRET" }), error => !error.message.includes("PRIVATE") && !error.message.includes("SECRET"));
});
