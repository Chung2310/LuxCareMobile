const { test } = require("node:test");
// Run explicitly with node --test; keep separate from the app's Vitest suite.
const assert = require("node:assert/strict");
const { prepare } = require("./prepare-ios-build.cjs");
const config = require("../eas.json");
const env = {
  BUILD_PROFILE: "preview", EXPO_TOKEN: "test-only-token",
  EXPO_PUBLIC_API_URL: "https://api.example.com",
  EXPO_PUBLIC_EAS_PROJECT_ID: "11111111-2222-3333-4444-555555555555",
  LUXCARE_IOS_BUNDLE_IDENTIFIER: "com.example.luxcare",
};
test("forwards public configuration but not the token; does not mutate source", () => {
  const result = prepare(config, env);
  assert.equal(result.build.preview.env.EXPO_PUBLIC_API_URL, env.EXPO_PUBLIC_API_URL);
  assert.equal(JSON.stringify(result).includes(env.EXPO_TOKEN), false);
  assert.equal(config.build.preview.env, undefined);
  assert.equal(result.build.preview.ios.simulator, false);
  assert.equal(result.build.preview.ios.buildConfiguration, "Release");
});
test("production retains store distribution and automatic build numbers", () => {
  const result = prepare(config, { ...env, BUILD_PROFILE: "production" });
  assert.equal(result.build.production.distribution, "store");
  assert.equal(result.build.production.autoIncrement, true);
  assert.equal(result.build.preview.env, undefined);
});
for (const key of Object.keys(env)) {
  test("rejects missing " + key, () => assert.throws(() => prepare(config, { ...env, [key]: "" })));
}
for (const url of ["http://api.example.com", "https://localhost", "https://user:password@example.com"]) {
  test("rejects invalid backend " + url, () => assert.throws(() => prepare(config, { ...env, EXPO_PUBLIC_API_URL: url })));
}
test("rejects invalid project, bundle ID and profile", () => {
  for (const invalid of [{ EXPO_PUBLIC_EAS_PROJECT_ID: "missing" }, { LUXCARE_IOS_BUNDLE_IDENTIFIER: "bad id" }, { BUILD_PROFILE: "other" }]) {
    assert.throws(() => prepare(config, { ...env, ...invalid }));
  }
});
