/* eslint-disable react/jsx-props-no-spreading */
import About from '@src/pages/components/about/Index';
import Clients from '@src/pages/components/clients/Index';
import CustomHead from '@src/components/dom/CustomHead';
import { DESK_TEXT } from '@src/lib';
import Home from '@src/pages/components/home/Index';
import Projects from '@src/pages/components/projects/Index';
import Quote from '@src/pages/components/quote/Index';
import useDesk from '@src/pages/components/useDesk';
import { useIsomorphicLayoutEffect } from '@src/hooks/useIsomorphicLayoutEffect';
import { useStore } from '@src/store';
import { withBasePath } from '@src/utils/basePath';

// The Desk (old index.html) on the original Home: masthead (hero), the next item
// across the courses (About), the course directory (Clients), one sentence
// (Quote) and the course cards (Projects).
const seo = {
  title: DESK_TEXT.title,
  description: DESK_TEXT.description,
};

// assets/legacy-route.js: the site root used to be the CEN100 guide, so a root
// URL carrying one of its old hashes forwards once to cen100/ with its query
// and hash. Only on a first load of the Desk (never on in-page navigation).
const LEGACY_HASHES = [
  /^#assignment-[a-z]\d+$/,
  /^#(assignments|course-info|guide-tools|guide-search|workspace-timeline)$/,
  /^#(nextsign|board|course-main)$/,
  /^#(t|p)-(team|you|rules)$/,
  /^#guide-item-[a-z]\d+$/,
];

function useLegacyForward() {
  useIsomorphicLayoutEffect(() => {
    if (useStore.getState().introOut) return;
    const { hash, search } = window.location;
    if (!LEGACY_HASHES.some((pattern) => pattern.test(hash))) return;
    window.location.replace(`${withBasePath('/cen100/')}${search}${hash}`);
  }, []);
}

function Page() {
  useLegacyForward();
  const desk = useDesk();

  return (
    <>
      <CustomHead {...seo} />
      <Home />
      <About desk={desk} />
      <Clients desk={desk} />
      <Quote />
      <Projects desk={desk} />
    </>
  );
}

export default Page;
