import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
export async function runReviewPreflight({ base, fetchImpl = fetch, log = console.log, errorLog = console.error }) {
  let origin;
  try {
    origin = new URL(base);
    if (origin.protocol !== "https:") throw new Error("App Review requires a public HTTPS API.");
  } catch (error) {
    errorLog(`FAIL API URL: ${error.message}`);
    return false;
  }
  let passed = true;
  const endpoints = [
    ["/api/v1/health", 200],
    ["/api/v1/onboarding/capabilities", 200],
    ["/privacy-policy", 200],
    ["/terms-of-service", 200],
    ["/user-data-deletion", 200],
    // Read-only anonymous probes: registered protected routes must reject authentication.
    // A 404 or the SPA HTML fallback means the API/proxy is not ready.
    ["/api/v1/ai/consent/company", 401],
    ["/api/v1/blogs/blocks", 401],
  ];
  for (const [path, status] of endpoints) {
    try {
      const response = await fetchImpl(new URL(path, origin), {
        signal: AbortSignal.timeout(15000),
        redirect: "manual",
      });
      if (response.status !== status) throw new Error(`HTTP ${response.status}; expected ${status}`);
      if (path.startsWith("/api/")) {
        if (!response.headers.get("content-type")?.toLowerCase().includes("application/json"))
          throw new Error("Expected JSON from the API, received another content type.");
        const data = await response.json();
        if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid API JSON response.");
        if (path.endsWith("/capabilities")) {
          if (data.registrationEnabled !== true) throw new Error("Public registration is disabled.");
        }
      }
      log(`PASS ${path}`);
    } catch (error) {
      passed = false;
      errorLog(`FAIL ${path}: ${error.message}`);
    }
  }
  if (passed)
    log(
      "Public endpoints and protected AI/Blog routes are reachable. Verify rendered legal pages, email delivery, AI permission and account deletion on TestFlight before submission.",
    );
  return passed;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const eas = JSON.parse(readFileSync(new URL("../eas.json", import.meta.url), "utf8"));
  const base = process.env.LUXCARE_REVIEW_API_URL || eas.build.production.env.EXPO_PUBLIC_API_URL;
  if (!(await runReviewPreflight({ base }))) process.exitCode = 1;
}
