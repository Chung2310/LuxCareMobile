const { test } = require("node:test");
const assert = require("node:assert/strict");
const { prepare } = require("./prepare-ios-build.cjs");
const env = {
  BUILD_PROFILE: "production",
  UPLOAD_TESTFLIGHT: "true",
  EXPO_PUBLIC_API_URL: "https://api.example.com/",
  EXPO_PUBLIC_EAS_PROJECT_ID: "11111111-2222-3333-4444-555555555555",
  LUXCARE_IOS_BUNDLE_IDENTIFIER: "com.example.luxcare",
  APPLE_TEAM_ID: "VP77TD9A77",
  IOS_BUILD_NUMBER_BASE: "1000",
  GITHUB_RUN_NUMBER: "42",
};
test("builds native config without Expo token or modifying EAS configuration", () => {
  assert.deepEqual(prepare(env), {
    EXPO_PUBLIC_API_URL: "https://api.example.com",
    IOS_BUILD_NUMBER: "1042",
    APP_VERSION: "",
  });
});
test("accepts explicit build number when migrating from remote version counter", () => {
  assert.equal(prepare({ ...env, BUILD_NUMBER_INPUT: "5001", APP_VERSION: "1.0.1" }).IOS_BUILD_NUMBER, "5001");
});
test("allows Ad Hoc without TestFlight", () => {
  assert.equal(prepare({ ...env, BUILD_PROFILE: "preview", UPLOAD_TESTFLIGHT: "false" }).IOS_BUILD_NUMBER, "1042");
  assert.throws(() => prepare({ ...env, BUILD_PROFILE: "preview" }), /Only production/);
});
for (const field of [
  "BUILD_PROFILE",
  "EXPO_PUBLIC_API_URL",
  "EXPO_PUBLIC_EAS_PROJECT_ID",
  "LUXCARE_IOS_BUNDLE_IDENTIFIER",
  "APPLE_TEAM_ID",
  "GITHUB_RUN_NUMBER",
  "IOS_BUILD_NUMBER_BASE",
  "UPLOAD_TESTFLIGHT",
]) {
  test(`rejects missing ${field}`, () => assert.throws(() => prepare({ ...env, [field]: "" })));
}
for (const url of [
  "http://api.example.com",
  "https://localhost",
  "https://127.0.0.1",
  "https://10.1.2.3",
  "https://192.168.1.1",
  "https://[::1]",
  "https://a:b@example.com",
  "https://api.example.com/api",
  "https://api.example.com/?q=x",
  "https://api.example.com/#hash",
]) {
  test(`rejects non-public API origin ${url}`, () =>
    assert.throws(() => prepare({ ...env, EXPO_PUBLIC_API_URL: url })));
}
test("rejects injected config, invalid versions and overflowing build numbers", () => {
  for (const input of [
    { BUILD_NUMBER_INPUT: "1\nBAD=value" },
    { BUILD_NUMBER_INPUT: "0" },
    { BUILD_NUMBER_INPUT: "2100000001" },
    { IOS_BUILD_NUMBER_BASE: "2100000000" },
    { LUXCARE_IOS_BUNDLE_IDENTIFIER: "a\nb" },
    { APP_VERSION: "1.0-beta" },
  ]) {
    assert.throws(() => prepare({ ...env, ...input }));
  }
});
