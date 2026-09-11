import type { UserProfile } from "../../../../src/types/common";

export type NoticePayload = {
  notificationId: string;
  recipientUid: string;
  companyCode: string;
  action?: { tab: string; subTab?: string };
};
export function parseNoticePayload(data: unknown): NoticePayload | null {
  if (!data || typeof data !== "object") return null;
  const value = data as Record<string, unknown>;
  const id = value.notificationId ?? value._id;
  if (typeof id !== "string" || !/^[a-f0-9]{24}$/i.test(id) ||
      typeof value.recipientUid !== "string" || typeof value.companyCode !== "string") return null;
  const action = value.action as Record<string, unknown> | undefined;
  return { notificationId: id, recipientUid: value.recipientUid, companyCode: value.companyCode,
    ...(action && typeof action.tab === "string" ? { action: { tab: action.tab,
      ...(typeof action.subTab === "string" ? { subTab: action.subTab } : {}) } } : {}) };
}
export function belongsToUser(data: NoticePayload, user: Pick<UserProfile, "uid" | "companyCode"> | null) {
  return !!user && data.recipientUid === user.uid && data.companyCode === (user.companyCode || "SYSTEM");
}
