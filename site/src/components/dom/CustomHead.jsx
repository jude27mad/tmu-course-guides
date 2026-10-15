import NextHead from 'next/head';

// The site's own head. Defaults are the old Desk's (index.html); pages pass
// their own title and description in the old site's pattern
// ("CEN100 | TMU Course Guides", "Privacy | TMU Course Guides").
// No author, no schema, no canonical/og URLs: nothing that names a person or
// points to another host. The CSP, icons and manifest live in _document.
export const SITE_TITLE = 'TMU Course Guides | Fall 2026';
export const SITE_DESCRIPTION = 'TMU Fall 2026 course guides: CEN100 assignment deadlines, requirements and contacts, plus MTH140 and MTH141 assessment and section guides.';

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
