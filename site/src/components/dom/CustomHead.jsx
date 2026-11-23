import NextHead from 'next/head';

// The site's own head. Defaults are the old Desk's (index.html); pages pass
// their own title and description in the old site's pattern
// ("CEN100 | TMU Course Guides", "Privacy | TMU Course Guides").
// No author, no schema, no canonical/og URLs: nothing that names a person or
// points to another host. The CSP, icons and manifest live in _document.
export const SITE_TITLE = 'TMU Course Guides | Fall 2026';
export const SITE_DESCRIPTION = 'Fall 2026 guides for CEN100, MTH140, MTH141, CHY102 and PCS211 at TMU. Find deadlines, grading, assignment requirements and study topics.';

// `keywords` is accepted for compatibility and not rendered.
// eslint-disable-next-line no-unused-vars
function CustomHead({ title = SITE_TITLE, description = SITE_DESCRIPTION, keywords }) {
  return (
    <NextHead>
      <title>{title || SITE_TITLE}</title>
      <meta key="description" name="description" content={description || SITE_DESCRIPTION} />
    </NextHead>
  );
}

export default CustomHead;
