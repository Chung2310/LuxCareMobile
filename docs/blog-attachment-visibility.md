# Blog attachment visibility

- Mobile composer defaults `attachmentsPublic` to false. The lock action on an existing post updates all its attachments through PATCH `/api/v1/blogs/:id/attachment-visibility`.
- Backend requires the existing Blog editor permission, validates a strict boolean and emits `blog_post_updated` to all readers.
- Legacy posts without the field retain public behavior. Malformed values do not grant access.
- POST `/api/v1/blogs/files` uploads up to 20 MiB to Cloudinary authenticated raw storage, records ownership in BlogFile, and returns an application URL. Post creation verifies ownership of managed files.
- GET `/api/v1/blogs/files/:id/preview` requires login and a non-deleted referencing post. It allows in-app viewing.
- GET `/api/v1/blogs/files/:id` allows external download only while a non-deleted public post references the file. The server proxies bytes without exposing the signed Cloudinary URL. Responses are not cached.
- Export actions recheck `GET /api/v1/blogs/:id/attachments/:attachmentId/access`. Whole-post sharing refreshes the post first and excludes private attachments.
- Deploy backend before mobile. No database backfill is required; the new BlogFile collection holds metadata for managed uploads.

## Limits and rollout verification

Existing attachments already uploaded to public Cloudinary/HTTP URLs remain reachable by anyone who previously obtained those URLs. The switch blocks application actions but does not revoke these historical origin URLs. Those assets need a separate migration with an inventory of shared references before invalidating originals. Do not promise retroactive URL revocation.

Authenticated preview necessarily delivers bytes to a reader's device. It cannot prevent screen capture or deliberate copying by an authorized reader. Previously downloaded copies cannot be revoked.

Verify on Android, iOS and web against staging: create a private image/document, preview it, verify sharing buttons absent; enable public, share and download externally; disable public, verify the previously shared application URL returns 403; verify unauthorized edit returns 403; verify a second device refreshes on the update event. Cloudinary transfers and device sharing require integration testing.

## Mobile document previews

The mobile Blog file card has a separate Preview action, including for private posts. It fetches managed files through the authenticated preview route; historical public URLs use the authenticated media proxy. Export permissions remain separate. HTML/login responses are rejected as errors rather than opened in a viewer.

All supported previews are rendered locally. The app no longer requests `/document-preview.html`, so a missing backend viewer cannot fall back to the login page.

- Excel (.xls/.xlsx): bundled SheetJS with native tables, sheet selection, 50-row pages, at most 10,000 rows and 200 columns per sheet. Cell values are formatted; original layout and charts are not reproduced.
- PDF: bundled PDF.js with its worker, fonts, CMaps and image codecs, one canvas page at a time with Previous/Next controls. Password-protected or invalid PDFs show an error. PDF scripts, forms and link actions are not enabled.
- Word (.docx): bundled Mammoth converts text, tables and embedded images, then DOMPurify sanitizes the result. Links, forms, executable markup and external images are removed. Original page layout is not guaranteed.
- Legacy Word (.doc) must be resaved as .docx. Other unsupported formats show an explicit message.

PDF/DOCX use inline HTML in the native WebView and an opaque sandboxed srcdoc iframe on web. A restrictive content security policy blocks network requests. File bytes are passed as inert JSON after authenticated download, never in a URL or to a third-party viewer. Navigation is restricted to the inline page. Loading failures and timeouts offer Retry; closing destroys the viewer and cancels pending file downloads. Uploads/previews remain capped at 20 MiB.

The viewer source is in `mobile/document-viewer/viewer.js`. Run `npm --prefix mobile run build:document-viewer` after changing the source or pinned viewer dependencies, and commit `mobile/src/features/blog/generated/` including licenses. The generated bundle is included directly in the app; no backend web build is needed for rendering. Backend authenticated file endpoints are still required.

Validation: `npm --prefix mobile run test:document-viewer` runs headless Chromium against PDF/DOCX fixtures, checks PDF drawing/page navigation, DOCX tables/link removal, corrupt-file errors and zero network requests. Install the matching Playwright Chromium before running this check on a new machine. Unit tests cover authenticated download, HTML rejection and unsupported files. Verify real-device PDF pages, DOCX layout/images, private files, 403 errors and closing while loading before release.
