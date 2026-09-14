import type { QuizQuestion } from "../../../../src/types/hr";

export function passingScoreOf(value?: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.min(100, value) : 100;
}
export function parsePassingScore(value: string): number {
  if (!value.trim()) return 100;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : 100;
}
export function evaluateQuiz(quizzes: QuizQuestion[], answers: Record<number, number>, configuredScore?: number) {
  const answered = quizzes.length > 0 && quizzes.every((quiz, index) =>
    Number.isInteger(answers[index]) && answers[index] >= 0 && answers[index] < quiz.options.length);
  const errors = quizzes.map((quiz, index) => answers[index] !== quiz.correctOptionIndex);
  const correctCount = errors.filter(error => !error).length;
  const score = quizzes.length ? Math.round(correctCount / quizzes.length * 100) : 0;
  const passingScore = passingScoreOf(configuredScore);
  return { answered, errors, correctCount, score, passingScore, passed: answered && score >= passingScore };
}
