import { describe, expect, it, vi } from "vitest";
import { evaluateQuiz, parsePassingScore, passingScoreOf } from "./quiz";
import { createTrainingService } from "../../../../src/services/trainingService";
const quizzes = Array.from({ length: 5 }, (_, index) => ({ question: String(index), options: ["Correct", "Wrong"], correctOptionIndex: 0 }));
const fourCorrect = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 1 };
describe("web-compatible training passing score", () => {
  it("passes 4 of 5 questions at 80 percent and records the wrong question", () => {
    expect(evaluateQuiz(quizzes, fourCorrect, 80)).toMatchObject({ passed: true, score: 80, correctCount: 4, errors: [false, false, false, false, true] });
  });
  it("does not pass below the configured score", () => {
    expect(evaluateQuiz(quizzes, fourCorrect, 81).passed).toBe(false);
  });
  it("keeps legacy courses at 100 percent", () => {
    expect(passingScoreOf()).toBe(100);
    expect(evaluateQuiz(quizzes, fourCorrect).passed).toBe(false);
    expect(evaluateQuiz(quizzes, { ...fourCorrect, 4: 0 }).passed).toBe(true);
  });
  it("preserves a configured zero but still requires all questions answered", () => {
    expect(passingScoreOf(0)).toBe(0);
    expect(evaluateQuiz(quizzes, { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1 }, 0).passed).toBe(true);
    expect(evaluateQuiz(quizzes, {}, 0).passed).toBe(false);
    expect(evaluateQuiz([], {}, 0).passed).toBe(false);
  });
  it("rounds percentages in the same way as the web", () => {
    expect(evaluateQuiz(quizzes.slice(0, 3), { 0: 0, 1: 0, 2: 1 }, 67)).toMatchObject({ score: 67, passed: true });
  });
  it.each([["", 100], ["80", 80], ["0", 0], ["-1", 0], ["120", 100], ["invalid", 100], ["82.5", 82.5]])("normalizes input %s to %s", (input, expected) => {
    expect(parsePassingScore(String(input))).toBe(expected);
  });
  it("round trips passingScore and quizScore through the existing API fields", async () => {
    const fetch = vi.fn(async (_path, init) => new Response(JSON.stringify({ data: { _id: "record", ...JSON.parse(String(init?.body || "{}")) } })));
    const service = createTrainingService({ fetch, getAccessToken: () => null });
    const created = await service.createCourse({ title: "Course", description: "", category: "", duration: "", instructor: "", companyCode: "ACME", passingScore: 80 });
    expect(created.passingScore).toBe(80);
    const updated = await service.updateCourse("record", { passingScore: 0 });
    expect(updated.passingScore).toBe(0);
    const enrollment = await service.updateEnrollment("enrollment", { quizPassed: true, quizScore: 80, progress: 100, status: "completed" });
    expect(enrollment.quizScore).toBe(80);
    expect(JSON.parse(String(fetch.mock.calls[2][1]?.body))).toMatchObject({ quizPassed: true, quizScore: 80, progress: 100, status: "completed" });
  });
});
