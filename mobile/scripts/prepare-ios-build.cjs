const fs = require("node:fs");
const path = require("node:path");

function prepare(config, env) {
  if (!env.EXPO_TOKEN?.trim()) throw new Error("Missing GitHub secret: EXPO_TOKEN");
  if (!["preview", "production"].includes(env.BUILD_PROFILE)) throw new Error("Invalid BUILD_PROFILE");
  const keys = ["EXPO_PUBLIC_API_URL", "EXPO_PUBLIC_EAS_PROJECT_ID", "LUXCARE_IOS_BUNDLE_IDENTIFIER"];
  for (const key of keys) if (!env[key]?.trim()) throw new Error("Missing GitHub variable: " + key);
  const api = new URL(env.EXPO_PUBLIC_API_URL);
  if (api.protocol !== "https:" || api.username || api.password ||
      ["localhost", "127.0.0.1", "[::1]"].includes(api.hostname)) {
    throw new Error("EXPO_PUBLIC_API_URL must be an HTTPS backend reachable from the iPhone, without credentials");
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(env.EXPO_PUBLIC_EAS_PROJECT_ID)) {
    throw new Error("EXPO_PUBLIC_EAS_PROJECT_ID must be the UUID of an existing EAS project");
  }
  if (!/^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/.test(env.LUXCARE_IOS_BUNDLE_IDENTIFIER)) {
    throw new Error("Invalid LUXCARE_IOS_BUNDLE_IDENTIFIER");
  }
  const next = JSON.parse(JSON.stringify(config));
  const profile = next.build?.[env.BUILD_PROFILE];
  if (!profile) throw new Error("Build profile missing from eas.json");
  // GitHub environment variables are not automatically forwarded to the remote builder.
  // Only public app settings go into the uploaded eas.json, never EXPO_TOKEN.
  profile.env = { ...profile.env, ...Object.fromEntries(keys.map(key => [key, env[key]])) };
  return next;
}

if (require.main === module) {
  const file = path.resolve(__dirname, "../eas.json");
  const config = JSON.parse(fs.readFileSync(file, "utf8"));
  fs.writeFileSync(file, JSON.stringify(prepare(config, process.env), null, 2) + "\n");
}
module.exports = { prepare };
