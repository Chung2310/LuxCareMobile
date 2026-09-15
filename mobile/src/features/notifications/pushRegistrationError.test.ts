import { describe, expect, it } from "vitest";
import { pushRegistrationError } from "./pushRegistrationError";
describe("push registration errors", () => {
  it("identifies an APK without initialized Firebase", () => {
    expect(pushRegistrationError(new Error("Default FirebaseApp is not initialized"), "token", "android")).toContain("cài bản mới");
  });
  it("identifies iOS signing without push entitlement", () => {
    expect(pushRegistrationError(new Error("no valid aps-environment entitlement"), "token", "ios")).toContain("được ký");
  });
  it.each([404, 403])("explains backend HTTP %s", status => {
    expect(pushRegistrationError(Object.assign(new Error("failed"), { status }), "server", "android")).toContain("Máy chủ");
  });
  it("keeps transient failures retryable without exposing raw tokens", () => {
    const message = pushRegistrationError(new Error("network failed token=secret"), "token", "android");
    expect(message).toContain("tự thử lại");
    expect(message).not.toContain("secret");
  });
});
