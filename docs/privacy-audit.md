# Privacy review — October 12, 2026

Scope: current public course pages, colour preview, application source, documentation, artwork metadata. This is a technical privacy review, not a legal compliance certification.

Published changes:

- Removed the maintainer's full-name page credit and names copied from course-only GA, PM, assistant and instructor listings. Section/group numbers, teaching rooms, dates, assignments and saved progress remain usable. Contacts direct to D2L.
- Removed dormant PostHog integration. Cloudflare beacons remain absent.
- Self-hosted Archivo WOFF2 files with the SIL Open Font License; pages no longer request Google Fonts.
- Added a Content Security Policy that blocks outbound reporting and automatic third-party resources; external links suppress referrers.
- Added a short visitor-facing privacy page explaining local browser storage, local backup files and GitHub's hosting security logs.

Verification: no external script/font/image stylesheet links in the five visitor-facing HTML pages; no tracker SDK in shared navigation; all roster labels anonymized; no credential patterns or personal email addresses in current application source (calendar UID domains and vendor license credits are not personal contact data); QA artwork has no EXIF data. 48 tests and all six course/motion UI workflows pass.

Publication: privacy implementation committed as `3fb8734`. Author and committer metadata were checked before publication and both use GitHub no-reply addresses. Account email privacy is enabled. Repository history was not rewritten.
