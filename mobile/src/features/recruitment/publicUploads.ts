import type { RecruitmentPublicFile } from "../../../../src/types/recruitment";

// Only files uploaded by this form are eligible for temporary cleanup.
export class PublicUploads {
  private files = new Map<string, RecruitmentPublicFile>();
  private protected = new Set<string>();
  add(file: RecruitmentPublicFile) {
    this.files.set(file.url, file);
  }
  patch(kind: "job" | "applicant", url: string) {
    const file = this.files.get(url.trim());
    if (!file) return {};
    return kind === "job"
      ? { jdFileUrl: file.url, jdFilePublicId: file.publicId }
      : { cvUrl: file.url, cvPublicId: file.publicId };
  }
  dispatched(url: string) {
    this.protected.add(url.trim());
  }
  duplicate(url: string) {
    this.protected.delete(url.trim());
  }
  async cleanup(remove: (id: string) => Promise<unknown>) {
    const unused = [...this.files.values()].filter((file) => !this.protected.has(file.url));
    for (const file of unused) this.files.delete(file.url);
    await Promise.allSettled(unused.map((file) => remove(file.publicId)));
  }
}
