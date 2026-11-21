const { test } = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { resolveAppVersion } = require("./prepare-app-version.cjs");

test("uses the configured marketing version independently of the build counter", () => {
  assert.equal(resolveAppVersion({ APP_VERSION: " 2.3.14 ", GITHUB_RUN_NUMBER: "123" }), "2.3.14");
  assert.equal(resolveAppVersion({ APP_VERSION: "2.3.14", GITHUB_RUN_NUMBER: "124" }), "2.3.14");
});

test("rejects missing or invalid repository versions instead of building an old app.json version", () => {
  for (const value of [undefined, "", " ", "1.2", "v1.2.3", "1.2.3-beta", "1.2.3\nOTHER=value"]) {
    assert.throws(() => resolveAppVersion({ APP_VERSION: value }), /repository variable APP_VERSION/);
  }
});

test("passes the repository variable into Expo for both native platforms without editing app.json", () => {
  const mobile = path.resolve(__dirname, "..");
  const appFile = path.join(mobile, "app.json");
  const before = fs.readFileSync(appFile, "utf8");
  const output = execFileSync(process.execPath, ["-e", 'const config=require("./app.config.js")({config:require("./app.json").expo});console.log(JSON.stringify({version:config.version,ios:config.ios.buildNumber,android:config.android.versionCode}));'], {
    cwd: mobile, encoding: "utf8", windowsHide: true,
    env: { ...process.env, BUILD_PROFILE: "", EAS_BUILD_PROFILE: "", APP_VERSION: "2.3.14", IOS_BUILD_NUMBER: "1042", LUXCARE_ANDROID_VERSION_CODE: "1043" },
  });
  assert.deepEqual(JSON.parse(output), { version: "2.3.14", ios: "1042", android: 1043 });
  assert.equal(fs.readFileSync(appFile, "utf8"), before);
});

test("exports a normalized version safely to later workflow steps", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "luxcare-version-"));
  const envFile = path.join(directory, "github-env");
  try {
    execFileSync(process.execPath, [path.join(__dirname, "prepare-app-version.cjs")], {
      encoding: "utf8", windowsHide: true, env: { ...process.env, APP_VERSION: " 1.0.1 ", GITHUB_ENV: envFile },
    });
    assert.equal(fs.readFileSync(envFile, "utf8"), "APP_VERSION=1.0.1\n");
  } finally {
    fs.unlinkSync(envFile);
    fs.rmdirSync(directory);
  }
});
