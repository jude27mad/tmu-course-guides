(() => {
  const script=document.currentScript,base=new URL('../',script.src),course=document.body.dataset.course||'cen100';
  const courses=[['cen100','CEN100','Engineering'],['mth140','MTH140','Calculus I'],['mth141','MTH141','Linear Algebra']];
  const root=document.createElement('div');root.className='hub-shell';
  root.innerHTML=`<div class="hub-top"><a class="hub-brand" href="${base.href}"><span class="hub-mark" aria-hidden="true"><img src="${new URL('assets/guide-mark.svg',base).href}" width="34" height="34" alt=""></span><span>TMU Course Guides<small>Fall 2026</small></span></a><button class="hub-theme" type="button" aria-label="Appearance: automatic">Auto theme</button></div><nav class="course-switch" aria-label="Choose a course">${courses.map(([id,code,name])=>`<a class="course-link" data-course-link="${id}" href="${new URL(id==='cen100'?'./':id+'/',base).href}" ${course===id?'aria-current="page"':''}><span class="course-code">${code}</span><span class="course-name">${name}</span><span class="course-saved" data-saved-course="${id}"></span></a>`).join('')}</nav>`;
  document.body.prepend(root);
  let mode='auto';try{const saved=localStorage.getItem('tmu-guide-theme-v1');if(['auto','light','dark'].includes(saved))mode=saved;}catch{}
  const button=root.querySelector('.hub-theme');
  function applyTheme(){if(mode==='auto')delete document.documentElement.dataset.theme;else document.documentElement.dataset.theme=mode;button.textContent=mode==='auto'?'Auto theme':mode==='dark'?'Dark theme':'Light theme';button.setAttribute('aria-label',`Appearance: ${mode==='auto'?'automatic':mode}. Change appearance.`);}
  applyTheme();button.addEventListener('click',()=>{mode=['auto','dark','light'][(['auto','dark','light'].indexOf(mode)+1)%3];applyTheme();try{localStorage.setItem('tmu-guide-theme-v1',mode)}catch{}});
  function refreshProfiles(){for(const [id] of courses){let profile;try{profile=JSON.parse(localStorage.getItem(id==='cen100'?'cen100-contact-choice-v1':id+'-section-v1')||'null')}catch{}const section=Number(id==='cen100'?profile?.section:profile);const target=root.querySelector(`[data-saved-course="${id}"]`);target.textContent=Number.isInteger(section)&&section>=1&&section<=(id==='cen100'?39:34)?`Section ${section}`:'';}}
  refreshProfiles();document.addEventListener('change',refreshProfiles);window.addEventListener('storage',refreshProfiles);
})();

// PostHog is prepared but paused, matching the existing analytics pause.
// Resume only after an explicit request by changing enabled to true.
(() => {
  const enabled = false;
  if (!enabled || location.hostname !== 'jude27mad.github.io' ||
      !location.pathname.startsWith('/tmu-course-guides/')) return;
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://us-assets.i.posthog.com/static/array.js';
  script.onload = () => {
    const analytics = window.posthog;
    if (!analytics || typeof analytics.init !== 'function') return;
    analytics.init('phc_ymRu5XLLu9zDNh7onBHmojT5aaDXqMaBa2KfS8xUrm93', {
      api_host: 'https://us.i.posthog.com',
      ui_host: 'https://us.posthog.com',
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      capture_exceptions: false,
      capture_dead_clicks: false,
      capture_performance: false,
      disable_session_recording: true,
      disable_surveys: true,
      advanced_disable_flags: true,
      person_profiles: 'never',
      loaded: instance => {
        const course = document.body.dataset.course || 'cen100';
        instance.capture('$pageview', {
          course,
          $current_url: location.origin + location.pathname,
          $pathname: location.pathname,
          $referrer: (() => {
            try {
              const ref = new URL(document.referrer);
              return ref.origin + ref.pathname;
            } catch { return ''; }
          })()
        });
      }
    });
  };
  // A blocked SDK must never interfere with the course guide.
  script.onerror = () => {};
  document.head.appendChild(script);
})();
