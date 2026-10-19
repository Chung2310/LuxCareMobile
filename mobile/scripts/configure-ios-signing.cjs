const fs = require("node:fs");
const path = require("node:path");
const xcode = require("xcode"); // Installed with the Expo prebuild toolchain.

function configure(project, env) {
  for (const key of [
    "APPLE_TEAM_ID",
    "IOS_PROFILE_UUID",
    "IOS_SIGNING_IDENTITY",
    "IOS_KEYCHAIN_PATH",
    "LUXCARE_IOS_BUNDLE_IDENTIFIER",
  ])
    if (!env[key]) throw new Error(`Missing ${key}`);
  const targets = Object.values(project.pbxNativeTargetSection()).filter(
    (t) => typeof t === "object" && t.productType?.replaceAll('"', "") === "com.apple.product-type.application",
  );
  if (targets.length !== 1) throw new Error("Expected one application target; extensions need separate profiles");
  const list = project.pbxXCConfigurationList()[targets[0].buildConfigurationList];
  const configs = project.pbxXCBuildConfigurationSection();
  for (const entry of list.buildConfigurations) {
    Object.assign(configs[entry.value].buildSettings, {
      CODE_SIGN_STYLE: "Manual",
      DEVELOPMENT_TEAM: env.APPLE_TEAM_ID,
      PRODUCT_BUNDLE_IDENTIFIER: env.LUXCARE_IOS_BUNDLE_IDENTIFIER,
      CODE_SIGN_IDENTITY: env.IOS_SIGNING_IDENTITY,
      PROVISIONING_PROFILE_SPECIFIER: env.IOS_PROFILE_UUID,
      OTHER_CODE_SIGN_FLAGS: `"--keychain ${env.IOS_KEYCHAIN_PATH}"`,
    });
  }
}
if (require.main === module) {
  const projects = fs.readdirSync("ios").filter((name) => name.endsWith(".xcodeproj"));
  if (projects.length !== 1) throw new Error("Expected one app Xcode project");
  const file = path.join("ios", projects[0], "project.pbxproj");
  const project = xcode.project(file);
  project.parseSync();
  configure(project, process.env);
  fs.writeFileSync(file, project.writeSync());
}
module.exports = { configure };
