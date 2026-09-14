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
