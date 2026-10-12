# Privacy review — October 12, 2026

Scope: current public course pages, colour preview, application source, documentation, artwork metadata and observed GitHub commit metadata. This is a technical privacy review, not a legal compliance certification or a claim about all historical copies on the internet.

Prepared changes:

- Removed the maintainer's full-name page credit and names copied from course-only GA, PM, assistant and instructor listings. Section/group numbers, teaching rooms, dates, assignments and saved progress remain usable. Contacts direct to D2L.
- Removed dormant PostHog integration. Cloudflare beacons remain absent.
- Self-hosted Archivo WOFF2 files with the SIL Open Font License; pages no longer request Google Fonts.
- Added a Content Security Policy that blocks outbound reporting and automatic third-party resources; external links suppress referrers.
- Added a short visitor-facing privacy page explaining local browser storage, local backup files and GitHub's hosting security logs.

Verification: no external script/font/image stylesheet links in the five visitor-facing HTML pages; no tracker SDK in shared navigation; all roster labels anonymized; no credential patterns or personal email addresses in current application source (calendar UID domains and vendor license credits are not personal contact data); QA artwork has no EXIF data. 48 tests and all six course/motion UI workflows pass.

Remaining public exposure: previously published GitHub commits include the account's author name and email. Historical file versions and branches can also contain the old names. Updating current source cannot erase those versions or cached/forked copies. No history rewrite, force push, repository-visibility change or destructive purge has been performed.

GitHub email settings were inspected: “Keep my email addresses private” was initially off. After explicit user approval on October 12, the setting was enabled and GitHub confirmed that the primary email is private and web operations use the account’s no-reply address. The existing “Block command line pushes that expose my email” option is also checked. Prior history remains public. New commit metadata must be checked before publishing.
