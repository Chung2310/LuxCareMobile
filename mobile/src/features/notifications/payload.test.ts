import { describe, expect, it } from "vitest";
import { belongsToUser, parseNoticePayload } from "./payload";
const notice = { _id: "a".repeat(24), recipientUid: "user-1", companyCode: "COMP", action: { tab: "NHÂN SỰ", subTab: "Giao Việc" } };
describe("notification payload boundary", () => {
  it("normalizes socket and remote payloads to the same notification ID", () => {
    expect(parseNoticePayload(notice)).toEqual(parseNoticePayload({ ...notice, _id: undefined, notificationId: notice._id }));
  });
  it("rejects malformed IDs and ignores arbitrary navigation URLs", () => {
    expect(parseNoticePayload({ ...notice, _id: "../../admin" })).toBeNull();
    expect(parseNoticePayload(null)).toBeNull();
    expect(parseNoticePayload({ ...notice, action: { url: "https://evil.example" } })?.action).toBeUndefined();
  });
  it("rejects another account or company, including after logout", () => {
    const payload = parseNoticePayload(notice)!;
    expect(belongsToUser(payload, { uid: "user-1", companyCode: "COMP" })).toBe(true);
    expect(belongsToUser(payload, { uid: "user-2", companyCode: "COMP" })).toBe(false);
    expect(belongsToUser(payload, { uid: "user-1", companyCode: "OTHER" })).toBe(false);
    expect(belongsToUser(payload, null)).toBe(false);
  });
});
