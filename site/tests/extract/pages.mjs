// Regenerates site/src/lib/content/pages.mjs: the static text of the old pages (index.html, cen100/, mth140/, mth141/,
// privacy.html), taken from the HTML in document order. Tags are stripped and entities decoded; words are unchanged.
// Run from anywhere: node site/tests/extract/pages.mjs
import {readFileSync,writeFileSync} from 'node:fs';
const root=new URL('../../../',import.meta.url),out=new URL('../../src/lib/content/pages.mjs',import.meta.url);
const read=f=>readFileSync(new URL(f,root),'utf8');
const decode=s=>s.replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'");
const text=html=>decode(html.replace(/<br\s*\/?>/g,' ').replace(/<[^>]+>/g,'')).replace(/\s+/g,' ').trim();
function between(html,start,end,from=0){const i=html.indexOf(start,from);if(i<0)throw new Error('missing '+start);const j=html.indexOf(end,i+start.length);if(j<0)throw new Error('missing end '+end+' after '+start);return html.slice(i+start.length,j);}
const all=(html,re)=>[...html.matchAll(re)];
const one=(html,re)=>{const m=html.match(re);if(!m)throw new Error('no match '+re);return m;};
const rows=table=>all(table,/<tr><th scope="row">([\s\S]*?)<\/th><td>([\s\S]*?)<\/td><\/tr>/g).map(m=>({label:text(m[1]),weight:text(m[2])}));
const notes=html=>all(html,/<p class="tool-note"[^>]*>([\s\S]*?)<\/p>/g).map(m=>text(m[1]));

// ---- Desk (index.html) ----
const desk=read('index.html');
const DESK={
  title:text(one(desk,/<title>([\s\S]*?)<\/title>/)[1]),
  description:decode(one(desk,/<meta name="description" content="([^"]*)"/)[1]),
  skip:text(one(desk,/<a class="skip-link"[^>]*>([\s\S]*?)<\/a>/)[1]),
  kicker:text(one(desk,/<p class="desk-kicker"><span>([\s\S]*?)<\/span>/)[1]),
  heading:text(one(desk,/<h1 class="desk-title">([\s\S]*?)<span>/)[1]),
  headingTerm:text(one(desk,/<h1 class="desk-title">[\s\S]*?<span>([\s\S]*?)<\/span>/)[1]).replace(/^·\s*/,''),
  lede:text(one(desk,/<p class="desk-lede">([\s\S]*?)<\/p>/)[1]),
  nextHeading:text(one(desk,/id="desk-next-heading">([\s\S]*?)<\/h2>/)[1]),
  nextStatic:text(one(desk,/data-desk-static>([\s\S]*?)<\/p>/)[1]),
  coursesHeading:text(one(desk,/id="desk-courses-heading">([\s\S]*?)<\/h2>/)[1]),
  courses:all(desk,/<a class="desk-course" href="([a-z0-9]+)\/" aria-label="([^"]*)"><span class="desk-index"[^>]*>(\d+)<\/span><span class="desk-code">([^<]*)<\/span><span class="desk-name">([^<]*)<\/span><\/a>\s*<p class="desk-desc">([\s\S]*?)<\/p>/g).map(m=>({id:m[1],ariaLabel:decode(m[2]),index:m[3],code:m[4],name:m[5],summary:text(m[6])})),
  openGuide:text(one(desk,/<p class="desk-open"[^>]*>([\s\S]*?)<span>/)[1]),
  footer:text(one(desk,/<footer class="desk-foot"[^>]*><p>([\s\S]*?)<\/p>/)[1]),
  privacy:'Privacy',
};

// ---- CEN100 (cen100/index.html) ----
const cen=read('cen100/index.html');
const grading=between(cen,'id="course-grading">','</details>');
const tables=all(grading,/<table class="grade-table" aria-label="([^"]*)">([\s\S]*?)<\/table>/g);
const CEN={
  title:text(one(cen,/<title>([\s\S]*?)<\/title>/)[1]),
  description:decode(one(cen,/<meta name="description" content="([^"]*)"/)[1]),
  context:text(one(cen,/id="course-context">([\s\S]*?)<\/p>/)[1]),
  heading:text(one(cen,/<h1>([\s\S]*?)<\/h1>/)[1]),
  profile:{
    summary:text(one(cen,/id="profile-label">([\s\S]*?)<\/span>/)[1]),
    sectionLabel:text(one(cen,/<label for="contact-section">([\s\S]*?)<\/label>/)[1]),
    sectionPlaceholder:text(one(cen,/<select id="contact-section"[^>]*><option value="">([\s\S]*?)<\/option>/)[1]),
    groupLabel:text(one(cen,/<label for="contact-group">([\s\S]*?)<\/label>/)[1]),
    groupPlaceholder:text(one(cen,/<select id="contact-group"[^>]*><option value="">([\s\S]*?)<\/option>/)[1]),
    note:text(one(cen,/id="profile-note">([\s\S]*?)<\/p>/)[1]),
    done:text(one(cen,/id="profile-done"[^>]*>([\s\S]*?)<\/button>/)[1]),
    viewContacts:text(one(cen,/id="profile-contacts"[^>]*>([\s\S]*?)<\/button>/)[1]),
  },
  nextLabel:decode(one(cen,/id="nextsign" aria-label="([^"]*)"/)[1]),
  afterLabel:decode(one(cen,/id="board" aria-label="([^"]*)"/)[1]),
  undo:text(one(cen,/id="undo-complete"[^>]*>([\s\S]*?)<\/button>/)[1]),
  find:{
    label:text(one(cen,/<label for="guide-search">([\s\S]*?)<\/label>/)[1]),
    placeholder:decode(one(cen,/id="guide-search" type="search" placeholder="([^"]*)"/)[1]),
    work:text(one(cen,/id="quick-work"[^>]*>([\s\S]*?)<\/button>/)[1]),
    contacts:text(one(cen,/id="quick-contacts"[^>]*>([\s\S]*?)<\/button>/)[1]),
    d2l:text(one(cen,/<a class="quick-link" href="https:\/\/courses.torontomu.ca\/"[^>]*>([\s\S]*?)<\/a>/)[1]),
    hideCompleted:text(one(cen,/<input type="checkbox" id="hide-completed">([\s\S]*?)<\/label>/)[1]),
  },
  noscriptIntro:text(one(cen,/<noscript>[\s\S]*?<p>([\s\S]*?)<\/p>/)[1]),
  tabs:all(cen,/<button class="tab"[^>]*id="t-([a-z]+)">([\s\S]*?)<\/button>/g).map(m=>({id:m[1],label:text(m[2])})),
  leads:{
    team:text(one(cen,/id="p-team"[\s\S]*?<p class="lead">([\s\S]*?)<\/p>/)[1]),
    you:text(one(cen,/id="p-you"[\s\S]*?<p class="lead">([\s\S]*?)<\/p>/)[1]),
    rules:text(one(cen,/id="p-rules"[\s\S]*?<p class="lead">([\s\S]*?)<\/p>/)[1]),
  },
  rulesHeadings:all(between(cen,'id="p-rules"','</section>'),/<h2 class="sec">([\s\S]*?)<\/h2>/g).map(m=>text(m[1])),
  openLead:text(one(cen,/id="confirmed"><\/ul>[\s\S]*?<p class="lead">([\s\S]*?)<\/p>/)[1]),
  changeProfile:text(one(cen,/id="change-profile"[^>]*>([\s\S]*?)<\/button>/)[1]),
  contactNote:text(one(cen,/<p class="lead contact-note">([\s\S]*?)<\/p>/)[1]),
  tools:{
    summary:text(one(cen,/id="guide-tools">\s*<summary><span>([\s\S]*?)<\/span>/)[1]),
    updated:text(one(cen,/id="guide-tools">\s*<summary><span>[\s\S]*?<\/span><small>([\s\S]*?)<\/small>/)[1]),
    note:text(one(cen,/<p class="tool-note">(Your saved section[\s\S]*?)<\/p>/)[1]),
  },
  grading:{
    summary:text(one(grading,/<summary>([\s\S]*?)<\/summary>/)[1]),
    notes:notes(grading),
    tables:tables.map(m=>({label:decode(m[1]),columns:all(m[2],/<th scope="col">([\s\S]*?)<\/th>/g).map(x=>text(x[1])),rows:rows(m[2].split("<tfoot>")[0]),total:(m[2].match(/<tfoot><tr><th scope="row">([\s\S]*?)<\/th><td>([\s\S]*?)<\/td>/)||[]).slice(1).map(text)})),
  },
  work:(w=>({summary:text(one(w,/<summary>([\s\S]*?)<\/summary>/)[1]),label:text(one(w,/<label for="work-range">([\s\S]*?)<\/label>/)[1]),options:all(w,/<option value="([a-z]+)">([\s\S]*?)<\/option>/g).map(m=>({value:m[1],label:text(m[2])})),notes:notes(w)}))(between(cen,'id="work-tools">','</details>')),
  calendar:(c=>({summary:text(one(c,/<summary>([\s\S]*?)<\/summary>/)[1]),itemLabel:text(one(c,/<label for="calendar-item">([\s\S]*?)<\/label>/)[1]),allOption:text(one(c,/<option value="all">([\s\S]*?)<\/option>/)[1]),upcoming:text(one(c,/id="calendar-upcoming" checked>([\s\S]*?)<\/label>/)[1]),reminderLabel:text(one(c,/<label for="calendar-reminder">([\s\S]*?)<\/label>/)[1]),reminders:all(between(c,'id="calendar-reminder">','</select>'),/<option value="(\d)">([\s\S]*?)<\/option>/g).map(m=>({value:Number(m[1]),label:text(m[2])})),download:text(one(c,/id="calendar-download"[^>]*>([\s\S]*?)<\/button>/)[1]),notes:notes(c)}))(between(cen,'id="calendar-tools">','</details>')),
  backup:(b=>({summary:text(one(b,/<summary>([\s\S]*?)<\/summary>/)[1]),notes:notes(b),export:text(one(b,/id="backup-export"[^>]*>([\s\S]*?)<\/button>/)[1]),importLabel:text(one(b,/<label for="backup-import">([\s\S]*?)<\/label>/)[1])}))(between(cen,'id="backup-tools">','</details>')),
  updatesSummary:text(one(cen,/id="guide-updates">\s*<summary>([\s\S]*?)<span/)[1]),
  updatesBadge:text(one(cen,/id="updates-badge"[^>]*>([\s\S]*?)<\/span>/)[1]),
  footer:{source:text(one(cen,/<footer><span>([\s\S]*?)<\/span>/)[1]),reset:text(one(cen,/id="reset">([\s\S]*?)<\/button>/)[1]),privacy:'Privacy'},
};

// ---- MTH140 / MTH141 ----
function math(id){
  const h=read(id+'/index.html');
  const contact=between(h,'id="contact-card"','</article>'),books=between(h,'<h2>Free textbooks','</article>'),sources=between(h,'<summary style="cursor:pointer;font-weight:800">','</details>');
  const tools=between(h,'id="math-tools">','<p class="tool-note">Your choices');
  const cal=between(tools,'<summary>Add assessments to my calendar</summary>','</details>'),backup=between(tools,'<summary>Move or back up my progress</summary>','</details>');
  return {
    title:text(one(h,/<title>([\s\S]*?)<\/title>/)[1]),
    description:decode(one(h,/<meta name="description" content="([^"]*)"/)[1]),
    skip:{label:text(one(h,/<a class="skip-link"[^>]*>([\s\S]*?)<\/a>/)[1]),target:one(h,/<a class="skip-link" href="#([^"]+)"/)[1]},
    eyebrowTerm:text(one(h,/<p class="eyebrow"><span id="course-code">[^<]*<\/span>([\s\S]*?)<\/p>/)[1]).replace(/^·\s*/,''),
    section:{label:text(one(h,/<label for="section-select">([\s\S]*?)<\/label>/)[1]),placeholder:text(one(h,/<select id="section-select"><option value="">([\s\S]*?)<\/option>/)[1])},
    nextLabel:decode(one(h,/<section class="next-layout" aria-label="([^"]*)"/)[1]),
    afterHeading:text(one(h,/<aside class="after-next"><h2>([\s\S]*?)<\/h2>/)[1]),
    undo:text(one(h,/id="undo-complete"[^>]*>([\s\S]*?)<\/button>/)[1]),
    find:{
      label:text(one(h,/<label for="guide-search">([\s\S]*?)<\/label>/)[1]),
      placeholder:decode(one(h,/id="guide-search" placeholder="([^"]*)"/)[1]),
      work:text(one(h,/id="quick-work"[^>]*>([\s\S]*?)<\/button>/)[1]),
      contacts:text(one(h,/id="quick-contacts"[^>]*>([\s\S]*?)<\/button>/)[1]),
      d2l:text(one(h,/<a class="quick-link" href="https:\/\/courses.torontomu.ca\/"[^>]*>([\s\S]*?)<\/a>/)[1]),
      hideCompleted:text(one(h,/<input type="checkbox" id="hide-completed">([\s\S]*?)<\/label>/)[1]),
    },
    tabs:all(h,/<button type="button" id="tab-([a-z]+)"[^>]*>([\s\S]*?)<\/button>/g).map(m=>({id:m[1],label:text(m[2])})),
    assessmentsIntro:text(one(h,/<div class="panel-intro"><p>([\s\S]*?)<\/p>/)[1]),
    assessmentsEmpty:text(one(h,/id="assessment-empty"[^>]*>([\s\S]*?)<\/p>/)[1]),
    review:{label:text(one(h,/<label for="review-bar"><span>([\s\S]*?)<\/span>/)[1]),note:text(one(h,/<\/progress><p class="muted">([\s\S]*?)<\/p>/)[1])},
    topicsEmpty:text(one(h,/id="topic-empty"[^>]*>([\s\S]*?)<\/p>/)[1]),
    contact:{
      heading:text(one(contact,/<h2>([\s\S]*?)<\/h2>/)[1]),
      coordinator:text(one(contact,/<p>(Course coordinator: )<strong/)[1]),
      note:text(one(contact,/<p class="muted">([\s\S]*?)<\/p>/)[1]),
      links:all(contact,/<a class="button" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g).map(m=>({label:text(m[2]),href:m[1]})),
    },
    textbooks:{heading:text(one(h,/<h2>(Free textbooks[\s\S]*?)<\/h2>/)[1]),note:text(one(books,/<p class="muted">([\s\S]*?)<\/p>/)[1])},
    sources:{heading:text(sources.slice(0,sources.indexOf('</summary>'))),note:text(one(sources,/<p class="muted">([\s\S]*?)<\/p>/)[1])},
    tools:{summary:text(one(h,/id="math-tools">\s*<summary>([\s\S]*?)<\/summary>/)[1]),note:text(one(h,/<p class="tool-note">(Your choices[\s\S]*?)<\/p>/)[1])},
    grading:{summary:text(one(h,/id="course-grading"><summary>([\s\S]*?)<\/summary>/)[1]),heading:text(one(h,/<div class="grading-header"><h2>([\s\S]*?)<\/h2>/)[1]),pass:text(one(h,/<div class="grading-header"><h2>[\s\S]*?<\/h2><span>([\s\S]*?)<\/span>/)[1]),labels:all(between(h,'<div class="grade-labels">','</section>'),/<span>([\s\S]*?)<\/span>/g).map(m=>text(m[1]))},
    work:(w=>({summary:text(one(w,/<summary>([\s\S]*?)<\/summary>/)[1]),label:text(one(w,/<label for="work-range">([\s\S]*?)<\/label>/)[1]),options:all(w,/<option value="([a-z]+)">([\s\S]*?)<\/option>/g).map(m=>({value:m[1],label:text(m[2])})),notes:notes(w)}))(between(h,'id="work-tools">','</details>')),
    calendar:{summary:'Add assessments to my calendar',upcoming:text(one(cal,/id="calendar-upcoming" checked>([\s\S]*?)<\/label>/)[1]),labs:text(one(cal,/id="calendar-labs">([\s\S]*?)<\/label>/)[1]),notes:notes(cal),download:text(one(cal,/id="calendar-download">([\s\S]*?)<\/button>/)[1])},
    backup:{summary:'Move or back up my progress',notes:notes(backup),export:text(one(backup,/id="backup-export">([\s\S]*?)<\/button>/)[1]),importLabel:text(one(backup,/<label for="backup-import">([\s\S]*?)<\/label>/)[1])},
    updatesSummary:text(one(h,/id="guide-updates">\s*<summary>([\s\S]*?)<span/)[1]),
    updatesBadge:text(one(h,/id="updates-badge"[^>]*>([\s\S]*?)<\/span>/)[1]),
    footer:{companion:text(one(h,/<footer class="math-footer"><p>([\s\S]*?)<a/)[1]).replace(/\s*·$/,''),privacy:'Privacy',d2l:text(one(h,/<footer class="math-footer">[\s\S]*?<p><a [^>]*>([\s\S]*?)<\/a><\/p><\/footer>/)[1])},
    noscriptIntro:text(one(h,/<noscript>[\s\S]*?<p>([\s\S]*?)<\/p>/)[1]),
  };
}

// ---- Privacy (privacy.html) ----
const privacy=read('privacy.html');
const PRIVACY={
  back:text(one(privacy,/<a href="\.\/">([\s\S]*?)<\/a>/)[1]),
  heading:text(one(privacy,/<h1>([\s\S]*?)<\/h1>/)[1]),
  paragraphs:all(privacy,/<p>([\s\S]*?)<\/p>/g).map(m=>{const link=m[1].match(/<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);if(!link)return {text:text(m[1])};const [before,after]=m[1].split(link[0]);return {text:text(before),link:{label:text(link[2]),href:decode(link[1])},after:text(after)};}),
  updated:text(one(privacy,/<small>([\s\S]*?)<\/small>/)[1]),
};

const banner=`/* Static text of the old pages, generated from their HTML in document order (tags stripped, entities decoded,
   words unchanged): index.html (DESK), cen100/index.html (CEN), mth140/ and mth141/index.html (MATH),
   privacy.html (PRIVACY). Regenerate with site/tests/extract/pages.mjs rather than editing. The "What's changed?"
   entries live in content/updates.mjs. */\n`;
const lit=v=>JSON.stringify(v,null,1);
writeFileSync(out,banner+`export const DESK=${lit(DESK)};\n\nexport const CEN=${lit(CEN)};\n\nexport const MATH={mth140:${lit(math('mth140'))},\nmth141:${lit(math('mth141'))}};\n\nexport const PRIVACY=${lit(PRIVACY)};\n`);
