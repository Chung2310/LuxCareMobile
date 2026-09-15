const fs = require("node:fs");
const path = require("node:path");

function versionCode(runNumber) {
  if (!/^[1-9]\d*$/.test(String(runNumber || ""))) throw new Error("Missing or invalid GitHub run number");
  const code = 1000 + Number(runNumber);
  if (!Number.isSafeInteger(code) || code > 2100000000) throw new Error("Android versionCode exceeds its limit");
  return code;
}
function prepare(env) {
  const code = versionCode(env.GITHUB_RUN_NUMBER);
  const encoded = env.ANDROID_KEYSTORE_BASE64?.trim();
  if (!encoded || !env.ANDROID_KEYSTORE_PASSWORD) throw new Error("Set ANDROID_KEYSTORE_BASE64 and ANDROID_KEYSTORE_PASSWORD in repository secrets before building a customer APK");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || encoded.length % 4 !== 0) throw new Error("ANDROID_KEYSTORE_BASE64 must contain a single base64 string");
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.length < 100 || bytes.toString("base64") !== encoded) throw new Error("Invalid keystore encoding");
  if (!env.RUNNER_TEMP || !env.GITHUB_ENV) throw new Error("Missing runner paths");
  const file = path.join(env.RUNNER_TEMP, "luxcare-release.p12");
  if (/[\r\n]/.test(file)) throw new Error("Invalid runner path");
  fs.writeFileSync(file, bytes, { mode: 0o600 });
  fs.appendFileSync(env.GITHUB_ENV, "LUXCARE_ANDROID_KEYSTORE=" + file + "\nLUXCARE_ANDROID_VERSION_CODE=" + code + "\n");
}
if (require.main === module) {
  try { prepare(process.env); console.log("Release signing file prepared; Android versionCode=" + versionCode(process.env.GITHUB_RUN_NUMBER)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { versionCode, prepare };
