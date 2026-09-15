const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { validate, prepare } = require("./prepare-android-push.cjs");
const config = {
  project_info: { project_id: "test-project", project_number: "123456789" },
  client: [{ client_info: { mobilesdk_app_id: "1:123456789:android:abc", android_client_info: { package_name: "com.example.luxcare" } }, api_key: [{ current_key: "test-only-key" }] }],
};
const env = {
  EXPO_PUBLIC_EAS_PROJECT_ID: "11111111-2222-3333-4444-555555555555",
  LUXCARE_ANDROID_PACKAGE: "com.example.luxcare",
  GOOGLE_SERVICES_JSON_CONTENT: JSON.stringify(config),
};
test("validates the matching Firebase app", () => assert.deepEqual(validate(env), config));
for (const name of Object.keys(env)) {
  test("rejects missing " + name, () => assert.throws(() => validate({ ...env, [name]: "" })));
}
test("rejects mismatched package and missing Firebase fields", () => {
  assert.throws(() => validate({ ...env, LUXCARE_ANDROID_PACKAGE: "com.example.other" }), /does not match/);
  assert.throws(() => validate({ ...env, GOOGLE_SERVICES_JSON_CONTENT: "{}" }), /project information/);
});
test("rejects secret service account keys without printing their contents", () => {
  assert.throws(() => validate({ ...env, GOOGLE_SERVICES_JSON_CONTENT: JSON.stringify({ type: "service_account", private_key: "NEVER_PRINT" }) }),
    error => /Do not bundle/.test(error.message) && !error.message.includes("NEVER_PRINT"));
});
test("does not reveal malformed JSON input", () => {
  assert.throws(() => validate({ ...env, GOOGLE_SERVICES_JSON_CONTENT: "NEVER_PRINT{" }),
    error => !error.message.includes("NEVER_PRINT"));
});
test("writes only the client config and exports its path to prebuild", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "luxcare-push-test-"));
  const githubEnv = path.join(dir, "github-env");
  const file = path.join(dir, "luxcare-google-services.json");
  try {
    prepare({ ...env, RUNNER_TEMP: dir, GITHUB_ENV: githubEnv });
    assert.deepEqual(JSON.parse(fs.readFileSync(file, "utf8")), config);
    assert.equal(fs.readFileSync(githubEnv, "utf8"), "GOOGLE_SERVICES_JSON=" + file + "\n");
  } finally {
    if (fs.existsSync(file)) fs.unlinkSync(file);
    if (fs.existsSync(githubEnv)) fs.unlinkSync(githubEnv);
    fs.rmdirSync(dir);
  }
});
