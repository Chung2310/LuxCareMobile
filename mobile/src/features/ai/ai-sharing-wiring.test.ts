import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isOnboardingRoute } from "../../../../shared/onboarding";
describe("native AI sharing wiring", () => {
  it("allows only valid consent paths/methods for unaffiliated accounts", () => {
    expect(isOnboardingRoute("GET", "/api/v1/ai/consent/personal")).toBe(true);
    expect(isOnboardingRoute("POST", "/api/v1/ai/consent/personal")).toBe(true);
    expect(isOnboardingRoute("DELETE", "/api/v1/ai/consent/personal")).toBe(false);
    expect(isOnboardingRoute("GET", "/api/v1/ai/consent/other")).toBe(false);
  });
  it("gates both assistants and displays decline/withdraw options", () => {
    const personal = readFileSync("mobile/src/features/ai/PersonalAiPanel.tsx", "utf8");
    const chat = readFileSync("mobile/app/(tabs)/chat.tsx", "utf8");
    const knowledge = readFileSync("mobile/app/(tabs)/knowledge.tsx", "utf8");
    expect(knowledge).toContain("!sharing.accepted");
    const notice = readFileSync("mobile/src/features/ai/AiSharingNotice.tsx", "utf8");
    expect(personal).toContain("!sharing.accepted");
    expect(chat).toContain("activeRoom.isChatbot && !sharing.accepted");
    expect(notice).toContain("Không đồng ý");
    expect(notice).toContain("Thu hồi đồng ý");
    expect(chat).toContain('socketService.on("internal_ai_error"');
    expect(chat).toContain('socketService.off("internal_typing_status"');
  });
  it("stores public HTTPS production settings and avoids developer LAN legal links", () => {
    const eas = JSON.parse(readFileSync("mobile/eas.json", "utf8"));
    const api = new URL(eas.build.production.env.EXPO_PUBLIC_API_URL);
    expect(api.origin).toBe("https://luxcare.igentechnology.net");
    expect(api.pathname).toBe("/");
    expect(api.search).toBe("");
    expect(api.hash).toBe("");
    expect(api.username).toBe("");
    expect(api.password).toBe("");
    const legal = readFileSync("mobile/src/features/legal/legalContent.ts", "utf8");
    expect(legal).not.toContain("6 lượt trong 60 phút");
    expect(legal).toContain("OpenRouter");
    expect(legal).not.toContain("defaultOrigin");
  });
});
