const fs = require("node:fs");
const path = require("node:path");

function validate(env) {
  const packageName = env.LUXCARE_ANDROID_PACKAGE?.trim();
  if (!/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/.test(packageName || "")) {
    throw new Error("Set LUXCARE_ANDROID_PACKAGE to the Android app registered in Firebase.");
  }
  if (!env.GOOGLE_SERVICES_JSON_CONTENT?.trim()) {
    throw new Error("Missing GitHub secret GOOGLE_SERVICES_JSON: paste the Firebase Android google-services.json content, not a service account key.");
  }
  let config;
  try { config = JSON.parse(env.GOOGLE_SERVICES_JSON_CONTENT); }
  catch { throw new Error("GOOGLE_SERVICES_JSON must contain valid JSON from Firebase Android app settings."); }
  if (config?.type === "service_account" || config?.private_key) {
    throw new Error("Do not bundle a service account key. GOOGLE_SERVICES_JSON must be the Android client configuration; configure FCM V1 service credentials on the backend only.");
  }
  if (!config?.project_info?.project_id || !/^\d+$/.test(String(config?.project_info?.project_number || ""))) {
    throw new Error("google-services.json is missing Firebase project information.");
  }
  const client = Array.isArray(config.client) && config.client.find(item => item.client_info?.android_client_info?.package_name === packageName);
  if (!client) throw new Error("Firebase google-services.json does not match LUXCARE_ANDROID_PACKAGE.");
  if (!client.client_info?.mobilesdk_app_id || !client.api_key?.some(item => typeof item.current_key === "string" && item.current_key)) {
    throw new Error("Firebase Android client configuration is incomplete.");
  }
  return config;
}

function prepare(env) {
  const config = validate(env);
  if (!env.RUNNER_TEMP || !env.GITHUB_ENV) throw new Error("GitHub runner paths are required.");
  const file = path.join(env.RUNNER_TEMP, "luxcare-google-services.json");
  if (/[\r\n]/.test(file)) throw new Error("Invalid runner temp path.");
  fs.writeFileSync(file, JSON.stringify(config), { mode: 0o600 });
  fs.appendFileSync(env.GITHUB_ENV, "GOOGLE_SERVICES_JSON=" + file + "\n");
}
if (require.main === module) {
  try { prepare(process.env); console.log("Android Firebase configuration validated and supplied to Expo prebuild."); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { validate, prepare };
