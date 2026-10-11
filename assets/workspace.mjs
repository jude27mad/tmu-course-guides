/* Navigation and placement only: existing guide nodes keep their data and listeners. */
const $ = selector => document.querySelector(selector);
const course = document.body.dataset.course;
const isMath = course === 'mth140' || course === 'mth141';

function mountWorkspace() {
  const main = $('.math-wrap,.wrap'), hub = $('.hub-shell');
  if (!main || !hub || document.body.classList.contains('workspace')) return;
  const heading = $('.course-heading,.circuit-head');
  const tools = $('#math-tools,#guide-tools');
  const search = $('.quick-find');
  const oldTabs = $('.math-tabs,.tabs');
  const lab = $('#math-lab');
  if (!heading || !tools || !search || !oldTabs || (isMath && !lab)) return;

  const shell = document.createElement('div');
  shell.className = 'course-workspace';
  hub.before(shell);
  shell.append(hub, main);
  document.body.classList.add('workspace');
  if (!main.id) main.id = 'course-main';
  main.setAttribute('role', 'main');
  main.setAttribute('tabindex', '-1');
  if (!$('.skip-link')) {
    const skip = document.createElement('a');
    skip.className = 'skip-link'; skip.href = '#'+main.id; skip.textContent = 'Skip to course content';
    document.body.prepend(skip);
  }

  const nav = document.createElement('nav');
  nav.className = 'workspace-nav'; nav.setAttribute('aria-label', 'Course sections');
  const labels = [['assignments','Assignments'], ...(isMath ? [['study','Study']] : []), ['info','Course info']];
  nav.innerHTML = labels.map(([view,label])=>`<a href="#${view==='info'?'course-info':view}" data-workspace-view="${view}" aria-controls="workspace-${view}">${label}</a>`).join('');
  hub.append(nav);
  const utilities = document.createElement('div'); utilities.className = 'workspace-utilities';
  utilities.append($('.hub-theme'));
  const d2l = $('.quick-links a'); if (d2l) utilities.append(d2l);
  hub.append(utilities);
  oldTabs.hidden = true;
  $('.guide-dock')?.remove();
  heading.querySelectorAll('.hero-caption,.hero-actions').forEach(node=>node.remove());

  const actions = document.createElement('div'); actions.className = 'workspace-actions';
  const searchButton = document.createElement('button'); searchButton.type = 'button'; searchButton.className = 'workspace-search';
  searchButton.textContent = 'Search'; searchButton.setAttribute('aria-expanded','false'); searchButton.setAttribute('aria-controls','workspace-search');
  const sectionButton = document.createElement('button'); sectionButton.type = 'button'; sectionButton.className = 'workspace-section';
  actions.append(sectionButton,searchButton); heading.append(actions);
  search.id = 'workspace-search'; search.hidden = true; heading.after(search);

  const panels = {};
  for (const [view,label] of labels) {
    const panel = document.createElement('section'); panel.id = 'workspace-'+view;
    panel.className = 'workspace-panel'; panel.setAttribute('aria-label',label);
    panels[view] = panel; main.append(panel);
  }
  const title = document.createElement('h2'); title.className = 'workspace-page-title'; title.textContent = 'Assignments';
  panels.assignments.append(title);
  const next = $('.next-layout,.cen-next-layout');
  const after = $('.after-next,#board');
  if (after) {
    const upcoming = document.createElement('details'); upcoming.className = 'workspace-disclosure';
    upcoming.innerHTML = '<summary>More upcoming deadlines</summary>';
    upcoming.append(after); panels.info.append(upcoming);
  }
  if (next) panels.assignments.append(next);
  const confirmation = $('#quick-confirm'); if (confirmation) panels.assignments.append(confirmation);

  const filters = document.createElement('div'); filters.className = 'workspace-filters';
  const hideCompleted = $('#hide-completed')?.closest('label'); if (hideCompleted) filters.append(hideCompleted);
  panels.assignments.append(filters);
  if (isMath) {
    panels.assignments.append($('#panel-assessments'));
    const studyTitle = document.createElement('h2'); studyTitle.className = 'workspace-page-title'; studyTitle.textContent = 'Study';
    panels.study.append(studyTitle,lab,$('#panel-topics'));
    lab.querySelector('.workbench-title h2').textContent = 'Explore the maths';
    lab.querySelector('.workbench-kicker').remove();
    lab.querySelector('.lab-subtitle').remove();
    const topicsTitle = document.createElement('h3'); topicsTitle.className = 'workspace-topic-title'; topicsTitle.textContent = 'Topics & practice';
    $('#panel-topics').prepend(topicsTitle);
    const illustration = $('#course-figure');
    const pictureDetails = document.createElement('details'); pictureDetails.className = 'workspace-disclosure course-illustration';
    pictureDetails.innerHTML = '<summary>Course illustration</summary>'; pictureDetails.append(illustration); panels.study.append(pictureDetails);
    const organization = $('#course-organization');
    const infoTitle = document.createElement('h2'); infoTitle.className = 'workspace-page-title'; infoTitle.textContent = 'Course info';
    panels.info.prepend(infoTitle, organization, $('.section-panel'));
    panels.info.append($('#panel-help'));
  } else {
    const category = document.createElement('div'); category.className = 'workspace-categories'; category.setAttribute('role','group'); category.setAttribute('aria-label','Assignment category');
    category.innerHTML = '<button type="button" data-cen-filter="all" aria-pressed="true">All</button><button type="button" data-cen-filter="team" aria-pressed="false">Team</button><button type="button" data-cen-filter="you" aria-pressed="false">Individual + pairs</button>';
    filters.prepend(category);
    for (const id of ['p-team','p-you']) {
      const panel = $('#'+id); panel.removeAttribute('role'); panel.removeAttribute('aria-labelledby');
      panels.assignments.append(panel);
    }
    const infoTitle = document.createElement('h2'); infoTitle.className = 'workspace-page-title'; infoTitle.textContent = 'Course info';
    const picker = $('#profile-picker'); picker.open = false;
    panels.info.prepend(infoTitle,picker);
    const rules = $('#p-rules'); rules.removeAttribute('role'); rules.removeAttribute('aria-labelledby'); panels.info.append(rules);
    heading.querySelector('h1').textContent = 'Intro to Engineering';
  }

  const pastLabel = document.createElement('label'); pastLabel.className = 'workspace-past-toggle';
  pastLabel.innerHTML = '<input type="checkbox" id="workspace-show-past"> Show past assignments';
  panels.assignments.append(pastLabel);
  pastLabel.querySelector('input').addEventListener('change', e=>document.body.classList.toggle('workspace-show-past',e.target.checked));
  const filterStatus = $('#filter-status'); if (filterStatus) filters.append(filterStatus);
  const rail = $('.semester-rail');
  if (rail) {
    const timeline = document.createElement('details'); timeline.id = 'workspace-timeline'; timeline.className = 'workspace-disclosure';
    timeline.innerHTML = '<summary>Semester timeline</summary>'; timeline.append(rail); panels.info.append(timeline);
    rail.querySelector('.section-kicker')?.remove();
  }
  tools.classList.remove('top-toolkit'); tools.open = false;
  tools.querySelector(':scope > summary').hidden = false;
  tools.querySelector(':scope > summary').textContent = 'Guide tools';
  const calendar = $('#calendar-tools') || $('#calendar-download')?.closest('details');
  if (calendar) calendar.querySelector('summary').textContent = 'Export deadlines';
  panels.info.insertBefore(tools, isMath ? $('#panel-help') : $('#p-rules'));
  const updates = $('#guide-updates'); if (updates) panels.info.append(updates);
  const footer = $('.math-footer,footer'); if (footer) main.append(footer);

  let active = 'assignments', category = 'all', changing = false;
  function syncPanels(view) {
    active = view;
    for (const [name,panel] of Object.entries(panels)) panel.hidden = name !== view;
    for (const link of nav.querySelectorAll('a')) {
      if (link.dataset.workspaceView===view) link.setAttribute('aria-current','page'); else link.removeAttribute('aria-current');
    }
    if (isMath) {
      $('#panel-assessments').hidden = view !== 'assignments';
      $('#panel-topics').hidden = view !== 'study';
      $('#panel-help').hidden = view !== 'info';
    } else {
      $('#p-team').hidden = view !== 'assignments' || category === 'you';
      $('#p-you').hidden = view !== 'assignments' || category === 'team';
      $('#p-rules').hidden = view !== 'info';
    }
    document.body.dataset.workspaceView = view;
    refresh();
  }
  function show(view, push = false) {
    if (!panels[view]) view = 'assignments';
    changing = true;
    if (isMath) $('#tab-'+({assignments:'assessments',study:'topics',info:'help'}[view])).click();
    syncPanels(view); changing = false;
    if (push) {
      history.pushState(null,'','#'+(view==='info'?'course-info':view));
      main.scrollIntoView({block:'start',behavior:'instant'});
    }
  }
  function setCenFilter(id) {
    if (id==='t-rules') {show('info');return;}
    category = id==='t-team'?'team':id==='t-you'?'you':'all';
    for (const button of document.querySelectorAll('[data-cen-filter]')) button.setAttribute('aria-pressed',String(button.dataset.cenFilter===category));
    syncPanels('assignments');
  }
  function refresh() {
    for (const list of document.querySelectorAll('#teamlist,#youlist,#assessment-list')) {
      const nodes = [...list.children].filter(el=>el.matches('.tile,li[data-sort-date]'));
      const ordered = nodes.slice().sort((a,b)=>Number(a.classList.contains('past'))-Number(b.classList.contains('past')) || (a.dataset.sortDate||'9999').localeCompare(b.dataset.sortDate||'9999'));
      if (ordered.some((el,i)=>el!==nodes[i])) for (const el of ordered) list.append(el);
    }
    const section = $(isMath?'#section-select':'#contact-section')?.value;
    const group = !isMath && $('#contact-group')?.value;
    sectionButton.textContent = section ? `Section ${section}${group?' · Group '+group:''}` : 'Choose section';
    sectionButton.setAttribute('aria-label',section ? 'Change '+sectionButton.textContent.toLowerCase() : 'Choose your course section');
  }
  window.CourseWorkspace = {show,setCenFilter,refresh};
  nav.addEventListener('click', e=>{const a=e.target.closest('[data-workspace-view]');if(a){e.preventDefault();show(a.dataset.workspaceView,true);}});
  document.addEventListener('course-view-change', e=>{if(!changing) syncPanels({assessments:'assignments',topics:'study',help:'info'}[e.detail]||'assignments');});
  document.addEventListener('click', e=>{
    const categoryButton = e.target.closest('[data-cen-filter]');
    if (categoryButton) setCenFilter('t-'+categoryButton.dataset.cenFilter);
  });
  // Reveal destinations before legacy listeners focus or scroll to them.
  document.addEventListener('click', e=>{
    if (e.target.closest('#quick-work,#quick-contacts,#change-profile,#profile-contacts,[data-calendar]')) show('info');
  },true);
  const toolObserver = new MutationObserver(()=>{if(tools.open && active!=='info') show('info');});
  toolObserver.observe(tools,{attributes:true,attributeFilter:['open']});
  sectionButton.addEventListener('click',()=>{
    show('info',true);
    if (!isMath) $('#profile-picker').open = true;
    $(isMath?'#section-select':'#contact-section').focus({preventScroll:true});
  });
  searchButton.addEventListener('click',()=>{
    search.hidden = !search.hidden; searchButton.setAttribute('aria-expanded',String(!search.hidden));
    if(!search.hidden) $('#guide-search').focus({preventScroll:true});
    else {$('#guide-search').value='';$('#guide-search').dispatchEvent(new Event('input',{bubbles:true}));}
  });
  search.addEventListener('keydown',e=>{if(e.key==='Escape'){searchButton.click();searchButton.focus();}});
  document.addEventListener('change',()=>queueMicrotask(refresh));
  function route() {
    const hash=location.hash;
    if(hash==='#math-lab'||hash==='#study'||hash.startsWith('#topic-')) show('study');
    else if(hash==='#course-info'||hash==='#guide-tools'||hash==='#math-tools'||hash==='#workspace-timeline') show('info');
    else if(hash==='#guide-search') {search.hidden=false;searchButton.setAttribute('aria-expanded','true');$('#guide-search').focus();}
    else if(hash==='#assignments'||hash.startsWith('#assignment-')||hash.startsWith('#assessment-')||!hash) show('assignments');
  }
  window.addEventListener('hashchange',route); window.addEventListener('popstate',route);
  // Start with work; specific existing links still open their original destination.
  syncPanels('assignments'); route();
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mountWorkspace,{once:true});
else mountWorkspace();
