const fs = require("node:fs");

function resolveAppVersion(env) {
  const version = (env.APP_VERSION || "").trim();
  if (!/^\d+\.\d+\.\d+$/.test(version))
    throw new Error("Set repository variable APP_VERSION to major.minor.patch (for example, 1.0.1).");
  return version;
}

if (require.main === module) {
  const version = resolveAppVersion(process.env);
  if (!process.env.GITHUB_ENV) throw new Error("Run this helper in GitHub Actions.");
  fs.appendFileSync(process.env.GITHUB_ENV, `APP_VERSION=${version}\n`);
  console.log(`App version (APP_VERSION variable): ${version}`);
}
module.exports = { resolveAppVersion };
