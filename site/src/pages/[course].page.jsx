import { COURSE_IDS, getCourse } from '@src/lib';
import { CourseContext, useCourseState, useScrollRefresh } from '@src/pages/course/hooks/useCourseState';
import CustomHead from '@src/components/dom/CustomHead';
import CourseWorkspace from '@src/pages/course/components/workspace/CourseWorkspace';
import { usePalette } from '@src/utils/theme';

function Page({ id }) {
  const state = useCourseState(id);
  const { course, info } = state;
  usePalette(course.palette);
  useScrollRefresh();
  const title = (id === 'cen100' ? info.profile?.value && info.profile?.title : info.section?.value && info.section?.title) || info.page?.title;
  return (
    <CourseContext.Provider value={state}>
      <CustomHead title={title} description={course.description} />
      <CourseWorkspace key={id} />
    </CourseContext.Provider>
  );
}

export async function getStaticPaths() {
  return {
    paths: COURSE_IDS.map((course) => ({ params: { course } })),
    fallback: false,
  };
}

export async function getStaticProps({ params }) {
  if (!getCourse(params.course)) return { notFound: true };
  return { props: { id: params.course } };
}

export default Page;
