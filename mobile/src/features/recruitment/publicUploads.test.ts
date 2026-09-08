import { expect, it, vi } from "vitest";
import { PublicUploads } from "./publicUploads";
const file = { url: "https://files.example/cv.pdf", publicId: "new-file", originalName: "cv.pdf", size: 20 };
it("only attaches ownership for a file uploaded by this form with the same URL", () => {
  const uploads = new PublicUploads();
  uploads.add(file);
  expect(uploads.patch("job", file.url)).toEqual({ jdFileUrl: file.url, jdFilePublicId: file.publicId });
  expect(uploads.patch("applicant", ` ${file.url} `)).toEqual({ cvUrl: file.url, cvPublicId: file.publicId });
  expect(uploads.patch("job", "https://other.example/a.pdf")).toEqual({});
});
it("cleans unused uploads once without touching files submitted to the server", async () => {
  const uploads = new PublicUploads(),
    remove = vi.fn().mockResolvedValue(undefined);
  uploads.add(file);
  uploads.add({ ...file, url: "https://files.example/unused.pdf", publicId: "unused" });
  uploads.dispatched(file.url);
  await uploads.cleanup(remove);
  await uploads.cleanup(remove);
  expect(remove.mock.calls).toEqual([["unused"]]);
});
it("retains a duplicate candidate for confirmation, then protects it on resubmit", async () => {
  const uploads = new PublicUploads(),
    remove = vi.fn();
  uploads.add(file);
  uploads.dispatched(file.url);
  uploads.duplicate(file.url);
  expect(uploads.patch("applicant", file.url)).toHaveProperty("cvPublicId", file.publicId);
  uploads.dispatched(file.url);
  await uploads.cleanup(remove);
  expect(remove).not.toHaveBeenCalled();
});
it("cleans a cancelled duplicate candidate and tolerates cleanup failure", async () => {
  const uploads = new PublicUploads(),
    remove = vi.fn().mockRejectedValue(new Error("offline"));
  uploads.add(file);
  uploads.dispatched(file.url);
  uploads.duplicate(file.url);
  await expect(uploads.cleanup(remove)).resolves.toBeUndefined();
  expect(remove).toHaveBeenCalledWith(file.publicId);
});
