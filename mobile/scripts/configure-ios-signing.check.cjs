const { test } = require("node:test");
const assert = require("node:assert/strict");
const xcode = require("xcode");
const parser = require("xcode/lib/parser/pbxproj");
const { configure } = require("./configure-ios-signing.cjs");
function fixture() {
  const project = xcode.project("test.pbxproj");
  project.hash = {
    project: {
      archiveVersion: 1,
      classes: {},
      objectVersion: 54,
      objects: {
        PBXNativeTarget: {
          APP: {
            isa: "PBXNativeTarget",
            productType: '"com.apple.product-type.application"',
            buildConfigurationList: "LIST",
          },
        },
        XCConfigurationList: {
          LIST: { isa: "XCConfigurationList", buildConfigurations: [{ value: "REL", comment: "Release" }] },
        },
        XCBuildConfiguration: {
          REL: {
            isa: "XCBuildConfiguration",
            buildSettings: { CODE_SIGN_ENTITLEMENTS: "LuxCare/LuxCare.entitlements" },
          },
          POD: { isa: "XCBuildConfiguration", buildSettings: { CODE_SIGNING_ALLOWED: "NO" } },
        },
      },
    },
  };
  return project;
}
const env = {
  APPLE_TEAM_ID: "VP77TD9A77",
  IOS_PROFILE_UUID: "11111111-2222-3333-4444-555555555555",
  IOS_SIGNING_IDENTITY: "A".repeat(40),
  IOS_KEYCHAIN_PATH: "/tmp/signing/build.keychain-db",
  LUXCARE_IOS_BUNDLE_IDENTIFIER: "com.luxcare.mobile",
};
test("signs app target, preserves entitlements and leaves Pods alone; project serializes", () => {
  const project = fixture();
  configure(project, env);
  const settings = project.pbxXCBuildConfigurationSection();
  assert.equal(settings.REL.buildSettings.DEVELOPMENT_TEAM, env.APPLE_TEAM_ID);
  assert.equal(settings.REL.buildSettings.PROVISIONING_PROFILE_SPECIFIER, env.IOS_PROFILE_UUID);
  assert.equal(settings.REL.buildSettings.CODE_SIGN_ENTITLEMENTS, "LuxCare/LuxCare.entitlements");
  assert.deepEqual(settings.POD.buildSettings, { CODE_SIGNING_ALLOWED: "NO" });
  assert.doesNotThrow(() => parser.parse(project.writeSync()));
});
test("fails closed when app target or signing settings are missing", () => {
  assert.throws(() => configure(fixture(), { ...env, IOS_PROFILE_UUID: "" }));
  const project = fixture();
  project.hash.project.objects.PBXNativeTarget = {};
  assert.throws(() => configure(project, env), /Expected one/);
});
