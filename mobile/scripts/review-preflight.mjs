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
    ["/api/v1/ai/status", 401],
    // Disabled Credit routes must reject old clients before authentication.
    ["/api/v1/wallet/balance", 410],
    ["/api/v1/company-wallet/status", 410],
  ];
  for (const [path, status] of endpoints) {
    try {
      const response = await fetchImpl(new URL(path, origin), {
        method: "GET",
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
          if (data.registrationEnabled !== false) throw new Error("Standalone public registration must be disabled.");
          if (data.invitationRegistrationEnabled !== false)
            throw new Error("Invitation self-registration must be disabled; administrators provision accounts.");
          if (data.accessModel !== "organization_only") throw new Error("Organization-only access is not deployed.");
          if (data.companyWalletEnabled !== false)
            throw new Error("Credit access is enabled or not explicitly disabled.");
          if (data.aiQuotaEnabled !== true) throw new Error("Shared free AI quota is disabled or not deployed.");
        }
        if (status === 410 && data.code !== "FEATURE_DISABLED")
          throw new Error("Credit endpoint did not confirm FEATURE_DISABLED.");
      }
      log(`PASS ${path}`);
    } catch (error) {
      passed = false;
      errorLog(`FAIL ${path}: ${error.message}`);
    }
  }
  if (passed)
    log(
      "Public endpoints, organization-only capabilities and disabled Credit routes passed. Verify administrator-provisioned login, denial of self-registration, legal pages, organization permissions, AI consent/quota and account deletion on TestFlight before submission.",
    );
  return passed;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const eas = JSON.parse(readFileSync(new URL("../eas.json", import.meta.url), "utf8"));
  const base = process.env.LUXCARE_REVIEW_API_URL || eas.build.production.env.EXPO_PUBLIC_API_URL;
  if (!(await runReviewPreflight({ base }))) process.exitCode = 1;
}
