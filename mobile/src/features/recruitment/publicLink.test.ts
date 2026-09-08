import { expect, it } from "vitest";
import { publicLinkPatch, validatePublicLink } from "./publicLink";
it("preserves storage ownership when the URL is unchanged", () => {
  expect(publicLinkPatch("job", " https://example.com/a ", "https://example.com/a")).toEqual({});
  expect(publicLinkPatch("applicant", "", undefined)).toEqual({});
});
it("clears old public ownership only on explicit replacement or removal", () => {
  expect(publicLinkPatch("applicant", "https://example.com/new", "https://example.com/old")).toEqual({
    cvUrl: "https://example.com/new",
    cvPublicId: "",
  });
  expect(publicLinkPatch("job", "", "https://example.com/old")).toEqual({ jdFileUrl: "", jdFilePublicId: "" });
});
it("rejects executable, local and credential-bearing links", () => {
  for (const url of [
    "javascript:alert(1)",
    "file:///cv.pdf",
    "data:text/html,hi",
    "https://user:secret@example.com/a",
    "not a url",
  ])
    expect(() => validatePublicLink(url)).toThrow();
  expect(validatePublicLink("https://example.com/a?download=1")).toBe("https://example.com/a?download=1");
});
