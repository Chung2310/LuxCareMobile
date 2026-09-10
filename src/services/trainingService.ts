import { parseApiErrorResponse } from "./apiClientError";
import { browserTransport, type ServiceTransport } from "./serviceTransport";
import type { TrainingCourse, TrainingEnrollment } from "../types/hr";

export type TrainingCourseInput = Pick<TrainingCourse, "title" | "description" | "category" | "duration" | "instructor" | "companyCode"> &
  Partial<Pick<TrainingCourse, "tags" | "isRequired" | "icon" | "imageUrl" | "autoAssignOnboarding" | "lessons" | "quizzes">>;
export type TrainingCourseUpdate = Partial<TrainingCourseInput> &
  Partial<Pick<TrainingCourse, "enrolledCount" | "companyProgress">>;
export type TrainingEnrollmentInput = Pick<TrainingEnrollment, "courseId" | "courseTitle" | "uid" | "userName" | "companyCode"> &
  Partial<Pick<TrainingEnrollment, "progress" | "status" | "startedAt" | "completedAt" | "completedLessons" | "quizPassed">>;
export type TrainingEnrollmentUpdate = Partial<Pick<TrainingEnrollment, "progress" | "status" | "startedAt" | "completedAt" | "completedLessons" | "quizPassed">>;

function idOf(item: { _id?: string; id?: string }) { return item._id || item.id || ""; }

export function createTrainingService({ fetch, getAccessToken }: ServiceTransport) {
  async function request(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    const token = getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    if (init.body) headers.set("Content-Type", "application/json");
    const response = await fetch(path, { ...init, headers });
    if (!response.ok) throw await parseApiErrorResponse(response);
    return response.json().catch(() => ({}));
  }
  const normalizeCourse = (item: TrainingCourse & { _id?: string }): TrainingCourse => ({
    ...item, id: idOf(item), lessons: item.lessons || [], quizzes: item.quizzes || [], tags: item.tags || [],
    enrolledCount: item.enrolledCount || 0, companyProgress: item.companyProgress || 0,
    isRequired: !!item.isRequired, autoAssignOnboarding: !!item.autoAssignOnboarding,
  });
  const normalizeEnrollment = (item: TrainingEnrollment & { _id?: string }): TrainingEnrollment => ({
    ...item, id: idOf(item), progress: Number(item.progress || 0), status: item.status || "not_started",
    completedLessons: item.completedLessons || [], quizPassed: !!item.quizPassed,
  });
  return {
    async listCourses(companyCode: string): Promise<TrainingCourse[]> {
      if (!companyCode.trim()) throw new Error("Mã công ty là bắt buộc.");
      const body = await request(`/api/v1/crud/training-courses?companyCode=${encodeURIComponent(companyCode)}`);
      return (body.data || []).map(normalizeCourse);
    },
    async createCourse(input: TrainingCourseInput): Promise<TrainingCourse> {
      const body = await request("/api/v1/crud/training-courses", { method: "POST", body: JSON.stringify(input) });
      return normalizeCourse(body.data);
    },
    async updateCourse(id: string, input: TrainingCourseUpdate): Promise<TrainingCourse> {
      const body = await request(`/api/v1/crud/training-courses/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(input) });
      return normalizeCourse(body.data);
    },
    async removeCourse(id: string): Promise<void> { await request(`/api/v1/crud/training-courses/${encodeURIComponent(id)}`, { method: "DELETE" }); },
    async listEnrollments(options: { companyCode: string; uid?: string; courseId?: string }): Promise<TrainingEnrollment[]> {
      if (!options.companyCode.trim()) throw new Error("Mã công ty là bắt buộc.");
      const query = new URLSearchParams({ companyCode: options.companyCode });
      if (options.uid) query.set("uid", options.uid);
      if (options.courseId) query.set("courseId", options.courseId);
      const body = await request(`/api/v1/crud/training-enrollments?${query.toString()}`);
      return (body.data || []).map(normalizeEnrollment);
    },
    async enroll(input: TrainingEnrollmentInput): Promise<TrainingEnrollment> {
      const body = await request("/api/v1/crud/training-enrollments", { method: "POST", body: JSON.stringify(input) });
      return normalizeEnrollment(body.data);
    },
    async updateEnrollment(id: string, input: TrainingEnrollmentUpdate): Promise<TrainingEnrollment> {
      const body = await request(`/api/v1/crud/training-enrollments/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(input) });
      return normalizeEnrollment(body.data);
    },
    async removeEnrollment(id: string): Promise<void> { await request(`/api/v1/crud/training-enrollments/${encodeURIComponent(id)}`, { method: "DELETE" }); },
  };
}

export const trainingService = createTrainingService(browserTransport);
