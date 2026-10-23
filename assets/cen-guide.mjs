import {SCHEDULE} from './cen-schedule.mjs?v=20261013-shift1';

// The router mounts this before workspace, editorial, header and Night Shift views.
// All state belongs to one mount; importing this module only defines its contract.
let dispose=null;
export function unmount(){
  const cleanup=dispose;dispose=null;cleanup?.();
}
export function mount(ctx){
  unmount();
  const root=ctx?.root;
  if(!root||ctx.route!=='cen100'||ctx.signal?.aborted)return;
  const document=root.ownerDocument,window=document.defaultView;
  const {navigator,location,URL,Blob,Event}=window;
  // Access storage inside the existing read/write try blocks, including browsers that deny its getter.
  const localStorage={getItem:key=>window.localStorage.getItem(key),setItem:(key,value)=>window.localStorage.setItem(key,value)};
  const controller=new window.AbortController(),signal=controller.signal;
  const originalHTML=root.innerHTML,originalTitle=document.title;
  const ownedTiles=new Set(),observers=new Set(),intervals=new Set(),timeouts=new Set(),objectURLs=new Set();
  const owns=node=>!!node&&(root.contains(node)||[...ownedTiles].some(tile=>tile===node||tile.contains(node)));
  const get=id=>root.querySelector('#'+id)||[...ownedTiles].map(tile=>tile.id===id?tile:tile.querySelector('#'+id)).find(Boolean)||null;
  const all=selector=>[...root.querySelectorAll(selector),...[...ownedTiles].filter(tile=>!root.contains(tile)).flatMap(tile=>[...(tile.matches(selector)?[tile]:[]),...tile.querySelectorAll(selector)])];
  const one=selector=>all(selector)[0]||null;
  const listen=(target,type,handler,options={})=>{
    const scoped=target===document&&(type==='click'||type==='change')?event=>{if(owns(event.target))handler(event)}:handler;
    target.addEventListener(type,scoped,{...options,signal});
  };
  const repeat=(callback,ms)=>{const id=window.setInterval(()=>{if(!signal.aborted)callback()},ms);intervals.add(id);return id};
  const delay=(callback,ms)=>{const id=window.setTimeout(()=>{timeouts.delete(id);if(!signal.aborted)callback()},ms);timeouts.add(id);return id};
  const onAbort=()=>unmount();
  ctx.signal?.addEventListener('abort',onAbort,{once:true});
  dispose=()=>{
    controller.abort();ctx.signal?.removeEventListener('abort',onAbort);
    for(const observer of observers)observer.disconnect();
    for(const id of intervals)window.clearInterval(id);
    for(const id of timeouts)window.clearTimeout(id);
    for(const url of objectURLs)URL.revokeObjectURL(url);
    // The details sheet belongs to visuals; restore its original CEN row before resetting this region.
    if([...ownedTiles].some(tile=>!root.contains(tile)))window.CourseVisuals?.close(true);
    if(window.CEN_SCHEDULE===SCHEDULE)delete window.CEN_SCHEDULE;
    root.innerHTML=originalHTML;document.title=originalTitle;
    ownedTiles.clear();observers.clear();intervals.clear();timeouts.clear();objectURLs.clear();
  };
  window.CEN_SCHEDULE=SCHEDULE;
  try{
const I={
 team:'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17.5" cy="9" r="2.6"/><path d="M16 14.2c3 .3 5 2.7 5 5.8"/></svg>',
 sub:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><circle cx="7" cy="8" r="3"/><circle cx="17" cy="8" r="3"/><path d="M2 20c0-3 2.2-5 5-5s5 2 5 5M12 20c0-3 2.2-5 5-5s5 2 5 5"/></svg>',
 you:'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="8" r="3.8"/><path d="M4.5 21c0-4.1 3.4-7.5 7.5-7.5s7.5 3.4 7.5 7.5"/></svg>',
 flag:'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4"/><path d="M5 4h12l-2.5 4L17 12H5"/></svg>',
 cal:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
 up:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V4M7.5 8.5 12 4l4.5 4.5"/><path d="M4 15v4a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19v-4"/></svg>',
 pin:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"><path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/></svg>',
 check:'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12.5l5 5L19.5 7"/></svg>',
 warn:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"><path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4.5M12 17.2v.1"/></svg>',
 x:'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
 clock:'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
 doc:'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linejoin="round" stroke-linecap="round"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/></svg>',
 book:'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linejoin="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/></svg>',
 eye:'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
 loop:'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 0 1-13.7 5.6M4 12a8 8 0 0 1 13.7-5.6"/><path d="M18 2.5v4h-4M6 21.5v-4h4"/></svg>',
 mail:'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 7 8.5-7"/></svg>',
 question:'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M9.3 9.3a2.8 2.8 0 1 1 3.7 2.6c-.7.3-1 .9-1 1.6v.5M12 17v.1"/></svg>',
 chat:'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4z"/></svg>',
 down:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
 forward:'<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>'
};
const WHO={team:["team","Full team"],sub:["sub","Sub-teams"],you:["you","Individual"],pair:["you","Pairs"]};

const TEAM = [
 {id:"m1", date:"2026-09-23", name:"Team Contract + Task Outline", who:"team", pct:"2%",
  preview:"One team upload to D2L. Keep the task outline updated.",
  what:"How we work together, and the list of what needs doing and when.",
  facts:[["up","D2L, one upload"]],
  groups:[["",["Keep a copy of the contract in the notebook","Keep the Task Outline updated all semester"]]], traps:[]},
 {id:"m2", date:"2026-10-02", name:"Project Outline + User Research", who:"team", pct:"4%",
  preview:"2–3 pages, with research from at least 5 real people.",
  what:"Say who has the problem, talk to real people about it, then break the need into small pieces you can test. 2 to 3 pages, one connected story.",
  facts:[["cal","Friday Oct 2, end of day"],["up","D2L, one upload"],["doc","5 parts, 4 points each"]],
  groups:[
   ["Problem statement",["Names every group affected, not just the obvious one","Lists real limits: cost, time, materials, safety, rules","Uses \u201c[Who] often [problem], leading to [impact], especially [when/where]\u201d, then in our own words"]],
   ["User research",["3 to 5 research questions","At least 5 real people","Each person logged by role, method, and a key quote","Told everyone it's CEN100 and voluntary","Notes written during the talk","Patterns and surprises, plus a revised problem statement"]],
   ["Needs tree",["Big need broken into small, testable needs","No need names a solution"]],
   ["Early direction",["2 to 4 truly different ideas","Each says what's promising and what's uncertain","No idea presented as already chosen"]],
   ["Work division",["Every member has named tasks, not just the leaders","Matches the Task Outline","At least one internal deadline before Nov 4"]],
   ["Before uploading",["CEWIL box ticked Yes or No","Header with team number and section"]]
  ],
  traps:["Fewer than 5 people","Made-up or AI-written participants: zero, plus an integrity case","One idea presented as decided: zero for that part","Work division that only names 2 or 3 people"]},
 {id:"m3", date:"2026-10-21", name:"Failure Analysis Labs", who:"team", pct:"6%",
  preview:"Part 1: historical review (Oct 21). Part 2: FMEA + design insight (Oct 28).",
  what:"Part 1 (2%): review a documented engineering failure in a sub-team of 4–5. Part 2 (4%): the full team predicts risks in its own project. The Oct 13 course-team update keeps Part 1 on Oct 21 and moves Part 2 to Oct 28; check D2L for your section and exact submission time.",
  facts:[["cal","Part 1: Oct 21; Part 2/FMEA: Oct 28"],["pin","Part 1 worked on in the Oct 14 lab"],["up","D2L"]],
  groups:[
   ["Part 1 (2%), sub-teams of 4 to 5",["A real, documented engineering failure from any field","1 to 2 pages answering only 4 questions: what happened, why it failed, lessons learned, how to prevent it","Include the fishbone required by the handout; the lecture calls it optional, so confirm with your GA before omitting it","2 to 3 credible technical or peer-reviewed sources, cited in the review"]],
   ["Part 2 (4%), full team",["At least 10 failure modes across technical, human, environmental, ethical and business categories","Every failure mode is specific to our project","Replace the example battery-overheating row with our own project risk; keep the formulas","Likelihood, severity and detectability each scored 1 to 5; risk score = L × S × D","Detectability: 1 = easy to spot, 5 = hard","Enter yellow cells only; leave Risk Score and Ranking Key formulas intact","A specific mitigation for each top-five risk, labelled Change, Test, Verify or Monitor","Top five risks reviewed on the automatically ranked summary; high severity still needs action"]],
   ["Design insight",["One short paragraph on the top 2 to 3 risks and what we will change, test, verify or monitor","Presented briefly in the lab, no full presentation","Explain why those risks rank highest; carry the insight into the notebook and Midterm Design Review","Several people speak, inside the time limit","Everyone ready for GA questions"]]
  ],
  traps:["Failure modes that could fit any project","Detectability scored backwards","Overwriting automatic formulas or leaving the template example in the submission","One or two people doing all the talking"]},
 {id:"m4", date:"2026-11-04", name:"Midterm Design Review", who:"team", pct:"8%",
  preview:"Live in your lab: suggested 5-minute presentation + 3-minute Q&A; GA confirms slots.",
  what:"A live design review of how the team framed the problem and chose its concept. Suggested format: 5-minute presentation + 3-minute panel Q&A; your GA confirms exact slots. Bring all five design artifacts and the notebook.",
  facts:[["pin","Live, Week 9 lab"],["clock","Suggested 5 min talk + 3 min Q&A; confirm with GA"],["doc","5 parts, 20 points each"]],
  groups:[
   ["Bring all five",["Needs tree","Problem statement + boundary diagram","Decision matrix, weights add to 100%","Assumption log: top 2 to 3 guesses","FMEA top risks + what we changed"]],
   ["The five minutes",["Min 1: problem and who has it","Min 2: boundary diagram","Min 3: why this concept won","Min 4: top risks and what we changed","Min 5: prototype plan","Speakers and a timekeeper assigned","Practised out loud as a full team"]],
   ["Every member",["Can explain the problem and the concept","Has a dated notebook entry and can talk about it","Notebook open on a device","Dressed professionally"]]
  ],
  traps:["Quietly skipping an unfinished piece: say it and give the plan","Starting with the solution instead of the problem","Running over time","Notebook and individual accountability form one 20-point rubric criterion; every member should be ready"]},
 {id:"y6", date:"2026-11-04", date2:"Dec 2", name:"Team design notebook", who:"team", pct:"4%",
  preview:"PDF at both checkpoints. Every member needs a dated entry.",
  what:"One shared notebook maintained during or immediately after project work. Every member needs substantive, dated entries with their name or initials at both checkpoints. Missing contributions prevent full checkpoint marks, even if the rest of the notebook is strong.",
  facts:[["cal","PDF export due Nov 4 and Dec 2, 3:00 PM"]],
  groups:[["",["My entry before Nov 4","I can talk about my entry","My entry before Dec 2"]]],
  traps:["Writing everything at the end instead of as you go"]},
 {id:"m5", date:"2026-11-25", date2:"Dec 2", name:"Low-Fidelity Prototype", who:"team", pct:"4%",
  preview:"Build and test the core idea. Record your test results.",
  what:"A rough physical or digital prototype that tests the core idea. Graded once for 4% alongside the Nov 25 / Dec 2 presentations, with build and test evidence included in the Final Report. Planning and building are not separate graded submissions.",
  facts:[["cal","Nov 25 / Dec 2 presentation window; confirm your team’s slot with the GA"],["pin","Plan Nov 11 lab, build Nov 18 lab"],["warn","WHMIS needed for the makerspace"]],
  groups:[
   ["The plan",["Concept in 1 to 2 sentences, tied to panel feedback","Materials and rough cost","Build steps, roles, timeline","Success criteria you can check (never \u201cit works\u201d)"]],
   ["While building",["Photos at every stage","Changes from the plan, with the reason","Every member has a notebook entry"]],
   ["Testing",["Tested against every success criterion","Result recorded: pass, partial or fail"]],
   ["On the day",["Ready and tested right before presenting"]]
  ],
  traps:["\u201cIt works\u201d as a success criterion","Only photos of the finished product","No test at all: an honest failed test scores higher"]},
 {id:"m6", date:"2026-11-25", date2:"Dec 2", name:"Final Presentations", who:"team", pct:"6%",
  preview:"Live pitch and prototype demo: 5 minutes + 2-minute Q&A; check your GA’s schedule.",
  what:"Pitch the project and demo the prototype live. Your GA assigns tutorial presentation slots across Nov 25 and Dec 2. Teams selected for the Dec 2 Showcase Competition give their tutorial presentation on Nov 25. Confirm which sessions apply to your team.",
  facts:[["clock","5 min + 2 min Q&A, each time"],["cal","Nov 25 and Dec 2"],["warn","Competition sign-up two weeks before Dec 2"]],
  groups:[
   ["The five minutes",["Min 1: problem and key need","Min 2\u20133: what we built and why","Min 4: live demo against our criteria","Min 5: what worked, what we'd change"]],
   ["Delivery",["Several members speak","Everyone can explain the project","Talk to the room, don't read slides","Slides show diagrams, photos, results","Practised with someone outside the team"]],
   ["Bring",["Prototype, tested right before","Slides + a backup copy","The notebook","Slides uploaded to D2L"]]
  ],
  traps:["One or two speakers carrying it","Hiding a failed demo: explain it instead","Missing the competition sign-up"]},
 {id:"m7", date:"2026-12-02", name:"Final Report", who:"team", pct:"8%",
  preview:"8–12 pages connecting the project, including MATLAB analysis.",
  what:"One coherent report of approximately 8–12 pages, excluding references and appendices. Revise and connect earlier milestones. At least two MATLAB analyses must inform design decisions; this is assessed within the report’s 8%, separately from the 10% MATLAB assignments.",
  facts:[["cal","Dec 2, 11:59 PM"],["up","D2L, one upload"],["doc","MATLAB 20 pts, writing 20 pts"]],
  groups:[
   ["The ten sections",["1 Executive summary","2 Problem, stakeholders, needs tree","3 User research","4 Existing product comparison","5 Boundary diagram, matrix, why this concept","6 MATLAB analysis","7 Failure Analysis & Risk Analysis (clearly labelled)","8 Prototype and test results","9 Reflection","10 References"]],
   ["MATLAB",["2+ analyses that each changed a decision","Only skills taught in CEN100","Figures in Section 6, referenced from 5 and 8","Working .mlx or .m files submitted alongside the report with a short README"]],
   ["Finishing",["Figures inside the sections","Consistent citations throughout; confirm IEEE or APA with your GA","Name the tool behind each decision","Header with team number and section"]]
  ],
  traps:["MATLAB plots that don't decide anything","Code that doesn't run","\u201cOurs is better\u201d with no comparison","Hiding failed tests"]}
];

const YOU = [
 {id:"y1", date:"2026-09-23", big:"SEP", small:"Orientation", name:"September items", who:"you", pct:"6%",
  preview:"Introduction, entry survey, syllabus quiz and professional email.",
  what:"Personal Introduction (1%), entry survey (1%), Course Syllabus Quiz (2%) and Professional Email Assignment (2%): 6% in total. All were due in September.",
  facts:[["cal","Introduction: Sept 16, 3 PM; professional email: Sept 23, 3 PM"],["up","Introduction and syllabus quiz: D2L; entry survey: Google Form; professional email: email your PM"],["doc","Professional email: send the draft, choice paragraph and reflection from your TMU account; one revision allowed after an on-time first attempt"]],
  groups:[["",["Personal introduction","Entry survey","Syllabus quiz","Email assignment"]]], traps:[]},
 {id:"y2", date:"2026-10-07", date2:"Nov 4", name:"MATLAB assignments", who:"pair", pct:"10%",
  preview:"Two lab assignments, normally completed in pairs.",
  what:"Two assignments from the MATLAB labs. Normally completed in pairs; if the class has an odd number of students, the unpaired student may work solo or join a group of 3.",
  facts:[["cal","Assignment 1: Oct 7, 3 PM; Assignment 2: Nov 4, time on D2L"],["doc","Assignment 1: one .m script showing both students’ names, IDs and section; follow the separate instructions for Assignment 2"],["warn","If the class size is odd, the unpaired student may work solo or join a group of 3."]],
  groups:[["",["Working arrangement confirmed","Assignment 1 submitted","Assignment 2 submitted"]]], traps:[]},
 {id:"y3", date:"2026-10-14", name:"WHMIS certification", who:"you", pct:"2%",
  preview:"80%+ on all 3 quizzes, then generate and save your certificate.",
  what:"Safety certificate. Required for the makerspace.",
  facts:[["cal","Due Wed Oct 14"],["warn","Missing it can make your whole course INCOMPLETE"]],
  groups:[["",["80%+ on all 3 module quizzes (5 attempts each)","Certificate generated from Awards in the WHMIS D2L course","Certificate saved"]]], traps:[]},
 {id:"y4", date:"2026-10-14", name:"Academic Integrity Quiz", who:"you", pct:"2%",
  preview:"Mandatory D2L quiz. Up to 10 attempts; due at 3:00 PM.",
  what:"Mandatory quiz, 10 attempts.",
  facts:[["cal","Due Oct 14, 3:00 PM"],["warn","Missing it can make your whole course INCOMPLETE"]],
  groups:[["",["Completed"]]], traps:[]},
 {id:"y5", date:"2026-10-28", date2:"Dec 2", name:"Personal Reflections", who:"you", pct:"4%",
  preview:"Two individual reflections, emailed to your Project Manager.",
  what:"Your own writing about the project, two pieces. Email each Personal Reflection directly to your assigned Project Manager.",
  facts:[["cal","Oct 28 and Dec 2"],["warn","Email directly to your Project Manager — no D2L submission box"]],
  groups:[["",["Project Manager confirmed","Reflection 1 emailed to PM","Reflection 2 emailed to PM"]]], traps:[]},
 {id:"y7", date:"2026-12-02", big:"LAB", small:"Weekly", name:"Tutorial attendance quizzes", who:"you", pct:"5%",
  preview:"In-person quiz during your assigned tutorial. Check D2L for timing.",
  what:"Attendance quizzes take place during your assigned tutorial. Section 29: Wednesday, 5:45 to 6:00 PM, one attempt. Other sections: check D2L for your assigned tutorial schedule.",
  facts:[["pin","Section 29: Wednesday, 5:45 to 6:00 PM; other sections: check D2L"]],
  groups:[["",["I attend my assigned tutorial in person"]]],
  traps:["Answering for another student, or having someone answer for you while you are absent, violates TMU Senate Policy 60: Academic Integrity. Zero for the entire 5% participation component; further penalties may apply.","Taking a quiz while absent from your assigned tutorial earns no credit for that quiz and may raise an academic integrity concern."]},
 {id:"y8", date:"2026-12-02", name:"Exit survey", who:"you", pct:"2%",
  preview:"Short Google Form in Week 13.",
  what:"A short Google Form in Week 13.", facts:[], groups:[["",["Submitted"]]], traps:[]},
 {id:"m8", date:"2026-12-02", name:"Peer Evaluation", who:"you", pct:"3%",
  preview:"Private D2L submission. Rate every member, including yourself.",
  what:"Everyone individually rates every member, including themselves. Submit privately to the teaching team through D2L.",
  facts:[["up","D2L, private"]],
  groups:[
   ["You're rated on",["Attending meetings on time","Contributing to discussions","Finishing assigned tasks on time","Quality of work","Being cooperative","Contributing to the result"]],
   ["To submit",["Score everyone 0 to 100 on all six","Work out the averages","Answer the 3 written questions","List your contributions, pointing to notebook entries","Sign and date"]]
  ],
  traps:["A vague list of contributions"]},
 {id:"y9", date:"2026-12-09", big:"DEC", small:"Exam period", name:"Final exam", who:"you", pct:"24%",
  preview:"2-hour in-person exam. Exact schedule awaits the Registrar.",
  what:"24% of the course grade; 2 hours, in person. TMU confirms the exam period is Dec 9–20, including weekends. The CEN100 date, room and detailed coverage still need the Registrar schedule and D2L announcement.",
  facts:[["clock","2 hours, in person"]],
  groups:[["",["Exam date noted when it's released"]]],
  traps:["Booking travel before the exam schedule is out"]}
];

const RULES=[
 ["red","doc","Identify each team submission","Include team number/name and section. Follow the assignment cover-page and signature instructions; the Team Contract itself must be signed."],
 ["red","x","Late means zero","No late work without valid documentation. Use the submission method listed for each assignment."],
 ["red","book","One missing notebook entry costs the team","Every member needs a dated entry before each checkpoint."],
 ["","book","Write in the notebook as you go","Date it and put your name on it. It's your proof for the peer evaluation."],
 ["","eye","Real people, real data","Log people by role, never by name. AI can't make data or decisions for us."],
 ["","clock","Plan time for a teammate review","Agree an internal review deadline in your team contract. A 48-hour buffer is a planning suggestion, not a course-wide deadline."],
 ["","loop","Everything gets graded again","The needs tree, FMEA, photos and test results come back at the review and in the report."],
 ["","team","New roles each phase","Phase 2 starts Sept 28, Phase 3 Nov 2, Phase 4 Nov 23."],
 ["","mail","Emailing the GA or instructor","TMU email, F2026CEN100 in the subject, your name and student number."]
];
const CONFIRMED=[
 ["Notebook checkpoints","Two. Whole notebook as a PDF, Nov 4 and Dec 2, 3:00 PM."],
 ["Failure Analysis","Oct 13 course-team update: Part 1 (2%) due Oct 21; Part 2/FMEA (4%) due Oct 28. Exact times: check D2L. The handout requires a fishbone, while the Oct 13 lecture calls it optional; confirm with your GA before omitting it."],
 ["Headers and signatures","Team and section on team submissions. Follow each assignment’s cover-page instructions; sign the Team Contract. The project guide allows a cover page or clear header; confirm assignment-specific signature requirements with your GA."],
 ["Citations","Use a consistent style. The Final Report requirements allow IEEE or APA; confirm your GA’s preference."],
 ["WHMIS","Due Oct 14. 80%+ on all 3 quizzes, then generate the certificate."],
 ["Academic Integrity Quiz","Due Oct 14, 3:00 PM."],
 ["Attendance quizzes","Section 29: Wednesday, 5:45 to 6:00 PM, one attempt. Other sections: check your assigned tutorial on D2L."],
 ["Personal Reflections","No D2L submission box. Email directly to your assigned Project Manager."],
 ["MATLAB assignments","Normally pairs. If the class size is odd, the unpaired student may work solo or join a group of 3."], ["FMEA environmental category","The Oct 13 lecture, p. 18, defines real-world conditions such as heat, moisture, loads and contamination. The template requires at least 10 failure modes and action on the top five risks."], ["Upcoming labs","Oct 28: MATLAB 4 begins; Nov 4: Midterm Design Review; Nov 11/18: prototype planning/build; Nov 25/Dec 2: presentations/showcase. Outline schedule is tentative; follow D2L changes."], ["Course materials","Two lecture hours and one lab hour per week; no required textbook. Use D2L lecture notes and MATLAB. The supplied files cover teamwork, innovation, engineering design, logic/combinatorics, MATLAB, safety, aerospace, research and failure analysis."], ["GenAI in CEN100","Use only where permitted and disclose it when required. Verify outputs; AI cannot replace real user research, engineering analysis, design decisions or prototype testing (outline p. 6)."]
];
const OPEN=[
 ["Final exam details","The Dec 9–20 period is confirmed; the CEN100 date, time, room and detailed coverage are still pending. Check the Registrar and D2L."], ["Assignment-specific instructions","Use D2L for unposted times and GA-assigned presentation slots. The Part 1 handout requires a fishbone but the Oct 13 lecture calls it optional; confirm with your GA before omitting it."]
];

const KEY="cen100-g9-ticks";
let ticks={};try{ticks=JSON.parse(localStorage.getItem(KEY)||"{}")||{}}catch(e){ticks={}}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(ticks))}catch(e){}};
const D=s=>new Date(s+"T12:00:00Z");
const days=(s,reference=torontoToday())=>Math.round((D(s)-D(reference))/864e5);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const mon=s=>D(s).toLocaleDateString("en-CA",{month:"short",timeZone:"UTC"}).replace(".","");
const wk=s=>D(s).toLocaleDateString("en-CA",{weekday:"short",timeZone:"UTC"}).replace(".","");
const chip=w=>{const [c,l]=WHO[w];return `<span class="chip ${c}">${l}</span>`};
const cd=n=>n===0?"Today":n===1?"1 day":n+" days";

all("[data-i]").forEach(el=>el.innerHTML=I[el.dataset.i]);

function torontoToday(now=new Date()){
  const p=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:"America/Toronto",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now).map(x=>[x.type,x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
function torontoTimestamp(date,time){
  const [year,month,day]=date.split("-").map(Number),[hour,minute]=time.split(":").map(Number);
  const target=Date.UTC(year,month-1,day,hour,minute);let value=target;
  const fmt=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Toronto",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"});
  for(let i=0;i<2;i++){const p=Object.fromEntries(fmt.formatToParts(new Date(value)).map(x=>[x.type,x.value]));value+=target-Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second)}
  return value;
}
function torontoUTC(date,time){return new Date(torontoTimestamp(date,time)).toISOString().replace(/[-:]/g,"").replace(/\.\d{3}/,"")}
function eventPassed(event,now=new Date()){return event.time?torontoTimestamp(event.date,event.time)<now.getTime():event.date<torontoToday(now)}
function sortEvents(a,b){return (a.date+(a.time||"23:59")).localeCompare(b.date+(b.time||"23:59"))||a.id.localeCompare(b.id)}
function itemDeadlines(id){return SCHEDULE.filter(e=>e.item===id&&e.calendar!==false).slice().sort(sortEvents)}
function clockLabel(time){const [h,m]=time.split(":").map(Number);return `${h%12||12}:${String(m).padStart(2,"0")} ${h<12?"AM":"PM"}`}
function eventLabel(event){return event.title+(event.time?`, ${clockLabel(event.time)} Toronto time`:"")}
function itemTiming(item,now=new Date()){
  const events=itemDeadlines(item.id),pending=events.filter(e=>!eventPassed(e,now));
  const current=pending[0]||events.at(-1),next=pending.find(e=>e.date!==current?.date);
  return {past:events.length>0&&!pending.length,date:current?.date||item.date,next:next?.date||null,upcoming:pending.length>0};
}
function dateMarkup(item,timing){
  if(item.big)return `<span class="dd" style="font-size:min(1.7rem,8.5vw)">${esc(item.big)}</span><span class="x">${esc(item.small||"")}</span>`;
  return `<span class="m">${mon(timing.date)}</span><span class="dd">${D(timing.date).getUTCDate()}</span>${timing.next?`<span class="x">+ ${mon(timing.next)} ${D(timing.next).getUTCDate()}</span>`:""}`;
}
function deadlineBadge(item,timing){return timing.past?'<span class="donecheck">Date passed</span>':chip(item.who)}
function upcomingSchedule(completed={},selected=0,now=new Date()){
  return SCHEDULE.filter(e=>{
    if(eventPassed(e,now)||(e.section&&e.section!==selected)||completed[e.id])return false;
    if(e.calendar===false){const records=itemDeadlines(e.item);if(records.length&&records.every(record=>completed[record.id]))return false}
    return true;
  }).slice().sort(sortEvents);
}
function headUrgency(n){return n<=2?"close":n<=6?"soon":"calm"}
function updateCircuitHead(up){
  const head=get("circuit-head"),label=get("head-next");
  if(!head||!label)return;
  if(!up.length){head.dataset.urgency="calm";label.textContent="No upcoming deadlines";label.hidden=false;return}
  const n=Math.max(0,days(up[0].date));
  head.dataset.urgency=headUrgency(n);
  label.textContent=`Next deadline · ${cd(n)}`;label.hidden=false;
}
(function pauseCircuitOffscreen(){
  const head=get("circuit-head");
  if(!head||!("IntersectionObserver" in window))return;
  const observer=new window.IntersectionObserver(([entry])=>{if(!signal.aborted)head.classList.toggle("paused",!entry.isIntersecting)});
  observers.add(observer);observer.observe(head);
})();
function renderTop(completed={}){
  const selected=Number(get("contact-section").value);
  const up=upcomingSchedule(completed,selected);
  updateCircuitHead(up);
  window.CourseVisuals?.update(SCHEDULE.filter(e=>!e.section||selected===e.section).map(e=>({date:e.date,title:e.title,target:e.item,completed:!!completed[e.id],note:e.calendar===false?'Reminder · confirm on D2L':e.time?clockLabel(e.time)+' Toronto time':'Check D2L for submission time'})));
  const ns=get("nextsign"),bd=get("board");
  const signature=up.slice(0,4).map(e=>e.id+":"+days(e.date)).join("|");
  if(ns.dataset.schedule===signature)return;ns.dataset.schedule=signature;
  if(!up.length){ns.innerHTML="";bd.hidden=true;return}
  bd.hidden=false;
  const event=up[0],d=event.date,item=[...TEAM,...YOU].find(s=>s.id===event.item),n=days(d);
  ns.innerHTML=`<div class="next"><a class="next-open deadline-link" href="#assignment-${event.item}" data-assignment="${event.item}" aria-label="Open ${esc(eventLabel(event))}"><span class="lbl">${I.clock.replace('width="24" height="24"','width="18" height="18"')}Next up</span>
   <div class="t">${esc(eventLabel(event))}</div>
   <div class="row"><div class="big">${cd(n)}</div><div class="when">${wk(d)} ${mon(d)} ${D(d).getUTCDate()}</div></div>
   <div class="chips">${chip(event.who||item.who)}<span class="deadline-action">View requirements ${I.forward}</span></div></a>${itemDeadlines(event.item).some(record=>record.id===event.id)?`<div class="next-quick-actions"><button class="quick-mark" type="button" data-quick-complete="${event.id}" aria-label="Mark ${esc(eventLabel(event))} done">Mark done</button><small>For your own records</small></div>`:""}</div>`;
  bd.innerHTML=up.slice(1,4).map(e=>`<a class="dep deadline-link" href="#assignment-${e.item}" data-assignment="${e.item}" aria-label="Open ${esc(eventLabel(e))}"><span class="d">${mon(e.date)} ${D(e.date).getUTCDate()}</span><span class="n">${esc(eventLabel(e))}</span><span class="c">${cd(days(e.date))}${I.forward}</span></a>`).join("");
}
function refreshDateDisplays(completed={}){
  renderTop(completed);
  for(const list of [TEAM,YOU]){
    let found=false;
    for(const item of list){
      const timing=itemTiming(item),tile=get("b-"+item.id).closest(".tile");
      const highlight=!found&&timing.upcoming;if(highlight)found=true;
      tile.dataset.sortDate=timing.date||"9999";tile.classList.toggle("past",timing.past);tile.classList.toggle("now",highlight);
      tile.querySelector(".date").innerHTML=dateMarkup(item,timing);
      tile.querySelector(".deadline-state").innerHTML=deadlineBadge(item,timing);
    }
  }
}

function renderList(list,elId){
  let found=false;
  get(elId).innerHTML=list.map(s=>{
    const timing=itemTiming(s);let st="";
    if(timing.past)st="past";else if(!found&&timing.upcoming){st="now";found=true}
    const dateHTML=dateMarkup(s,timing);
    const facts=s.facts.length?`<div class="facts">${s.facts.map(f=>`<div class="fact">${I[f[0]]}<span>${esc(f[1])}</span></div>`).join("")}</div>`:"";
    const groups=s.groups.map((g,gi)=>`${g[0]?`<div class="grp">${esc(g[0])}</div>`:""}<ul class="checks">${g[1].map((t,i)=>{const k=`${s.id}-${gi}-${i}`;return `<li><label><input type="checkbox" data-k="${k}" data-s="${s.id}"${ticks[k]?" checked":""}><span>${esc(t)}</span></label></li>`}).join("")}</ul>`).join("");
    const traps=s.traps.length?`<div class="bar bad">${I.warn}Lose marks</div><ul class="traps">${s.traps.map(t=>`<li>${I.warn}<span>${esc(t)}</span></li>`).join("")}</ul>`:"";
    return `<li class="tile ${st}" data-sort-date="${esc(timing.date||"9999")}">
     <button class="head" aria-expanded="false" aria-controls="b-${s.id}">
      <span class="date">${dateHTML}</span>
      <span class="info"><span class="title">${esc(s.name)}</span>
       <span class="card-preview">${esc(s.preview||s.what)}</span>
       <span class="badges"><span class="deadline-state">${deadlineBadge(s,timing)}</span><span class="chip pct">${s.pct}</span><span class="prog" data-p="${s.id}"></span><span class="record-status" id="recorded-${s.id}" hidden></span></span></span>
      <span class="arrow" aria-hidden="true">${I.down}</span>
     </button>
     <div class="body" id="b-${s.id}" hidden>
      <p class="what">${esc(s.what)}</p>${facts}
      <div class="bar good">${I.check}Full marks</div>${groups}${traps}
     </div></li>`;
  }).join("");
  for(const tile of get(elId).children)ownedTiles.add(tile);
}

function sign(arr,cls,icon){return arr.map(r=>`<li class="s ${cls||r[0]}"><span class="ic">${I[icon||r[1]]}</span><span class="tx"><b>${esc(cls?r[0]:r[2])}</b><span>${esc(cls?r[1]:r[3])}</span></span></li>`).join("")}

function counts(){
  [...TEAM,...YOU].forEach(s=>{
    const b=[...all(`input[data-s="${s.id}"]`)], d=b.filter(x=>x.checked).length, el=one(`[data-p="${s.id}"]`);
    if(!el)return; el.textContent=d?`${d}/${b.length}`:""; el.classList.toggle("full",d===b.length&&b.length>0);
    if(d===b.length&&b.length>0) el.textContent="\u2713 "+el.textContent;
  });
}

renderTop();renderList(TEAM,"teamlist");renderList(YOU,"youlist");
get("rules").innerHTML=sign(RULES);
get("confirmed").innerHTML=sign(CONFIRMED,"green","check");
get("open").innerHTML=sign(OPEN,"amber","question");
counts();

listen(document,"click",e=>{
  const h=e.target.closest(".head");
  if(h){const b=get(h.getAttribute("aria-controls")),o=h.getAttribute("aria-expanded")==="true";h.setAttribute("aria-expanded",!o);b.hidden=o;return}
  const t=e.target.closest(".tab");
  if(t&&window.CourseWorkspace){window.CourseWorkspace.setCenFilter(t.id);return}
  if(t)all(".tab").forEach(x=>{const on=x===t;x.setAttribute("aria-selected",on);get(x.getAttribute("aria-controls")).hidden=!on});
});
listen(document,"change",e=>{if(e.target.matches("input[data-k]")){const k=e.target.dataset.k;e.target.checked?ticks[k]=1:delete ticks[k];save();counts()}});
listen(get("reset"),"click",()=>{if(!confirm("Clear all checklist ticks on this device? Your completion records, notes and target dates will stay saved."))return;ticks={};save();all("input[data-k]").forEach(b=>b.checked=false);counts()});

const STAFFING=[
 {"sections":[1,14,27],"ga":"See your section’s staff list on D2L","location":"KHE321B","groups":[[1,"See your group’s Project Manager on D2L"],[2,"See your group’s Project Manager on D2L"],[3,"See your group’s Project Manager on D2L"],[4,"See your group’s Project Manager on D2L"]]},
 {"sections":[2,15,28],"ga":"See your section’s staff list on D2L","location":"KHE323","groups":[[5,"See your group’s Project Manager on D2L"],[6,"See your group’s Project Manager on D2L"],[7,"See your group’s Project Manager on D2L"],[8,"See your group’s Project Manager on D2L"]]},
 {"sections":[3,17,29],"ga":"See your section’s staff list on D2L","location":"KHS134","groups":[[9,"See your group’s Project Manager on D2L"],[10,"See your group’s Project Manager on D2L"],[11,"See your group’s Project Manager on D2L"],[12,"See your group’s Project Manager on D2L"]]},
 {"sections":[4,16,30],"ga":"See your section’s staff list on D2L","location":"VIC110","groups":[[13,"See your group’s Project Manager on D2L"],[14,"See your group’s Project Manager on D2L"],[15,"See your group’s Project Manager on D2L"],[16,"See your group’s Project Manager on D2L"]]},
 {"sections":[5,18,31],"ga":"See your section’s staff list on D2L","location":"VIC206","groups":[[17,"See your group’s Project Manager on D2L"],[18,"See your group’s Project Manager on D2L"],[19,"See your group’s Project Manager on D2L"],[20,"See your group’s Project Manager on D2L"]]},
 {"sections":[6,19,32],"ga":"See your section’s staff list on D2L","location":"VIC210","groups":[[21,"See your group’s Project Manager on D2L"],[22,"See your group’s Project Manager on D2L"],[23,"See your group’s Project Manager on D2L"],[24,"See your group’s Project Manager on D2L"]]},
 {"sections":[7,20,33],"ga":"See your section’s staff list on D2L","location":"VIC300","groups":[[25,"See your group’s Project Manager on D2L"],[26,"See your group’s Project Manager on D2L"],[27,"See your group’s Project Manager on D2L"],[28,"See your group’s Project Manager on D2L"]]},
 {"sections":[8,21,34],"ga":"See your section’s staff list on D2L","location":"VIC306","groups":[[29,"See your group’s Project Manager on D2L"],[30,"See your group’s Project Manager on D2L"],[31,"See your group’s Project Manager on D2L"],[32,"See your group’s Project Manager on D2L"]]},
 {"sections":[9,22,35],"ga":"See your section’s staff list on D2L","location":"VIC503","groups":[[33,"See your group’s Project Manager on D2L"],[34,"See your group’s Project Manager on D2L"],[35,"See your group’s Project Manager on D2L"],[36,"See your group’s Project Manager on D2L"]]},
 {"sections":[10,23,36],"ga":"See your section’s staff list on D2L","location":"ILC100","groups":[[37,"See your group’s Project Manager on D2L"],[38,"See your group’s Project Manager on D2L"],[39,"See your group’s Project Manager on D2L"],[40,"See your group’s Project Manager on D2L"]]},
 {"sections":[11,24,37],"ga":"See your section’s staff list on D2L","location":"ILC102","groups":[[41,"See your group’s Project Manager on D2L"],[42,"See your group’s Project Manager on D2L"],[43,"See your group’s Project Manager on D2L"],[44,"See your group’s Project Manager on D2L"]]},
 {"sections":[12,25,38],"ga":"See your section’s staff list on D2L","location":"VIC106","groups":[[45,"See your group’s Project Manager on D2L"],[46,"See your group’s Project Manager on D2L"],[47,"See your group’s Project Manager on D2L"],[48,"See your group’s Project Manager on D2L"]]},
 {"sections":[13,26,39],"ga":"See your section’s staff list on D2L","location":"VIC200","groups":[[49,"See your group’s Project Manager on D2L"],[50,"See your group’s Project Manager on D2L"],[51,"See your group’s Project Manager on D2L"],[52,"See your group’s Project Manager on D2L"]]}
];
function setupContactLookup(){
  const section=get("contact-section"), group=get("contact-group");
  const gaResult=get("ga-result"), pmResult=get("pm-result");
  const selectedStaff=()=>STAFFING.find(s=>s.sections.includes(Number(section.value)));
  const option=(value,label)=>{const el=document.createElement("option");el.value=value;el.textContent=label;return el};
  const prompt=(el,text)=>{const span=document.createElement("span");span.textContent=text;el.replaceChildren(span)};
  const result=(el,name,role,location)=>{
    const b=document.createElement("b"), em=document.createElement("em");b.textContent=name;em.textContent=role;el.replaceChildren(b,em);
    if(location){const span=document.createElement("span");span.textContent="Lab/location: "+location;el.append(span)}
  };
  STAFFING.flatMap(s=>s.sections).sort((a,b)=>a-b).forEach(n=>section.append(option(n,"Section "+n)));
  listen(section,"change",()=>{
    const staff=selectedStaff();
    group.replaceChildren(option("",staff?"Choose your group":"Choose your section first"));group.disabled=!staff;
    prompt(pmResult,"Choose your group to see your Project Manager.");
    if(!staff){prompt(gaResult,"Choose your section to see your GA and lab/location.");return}
    result(gaResult,staff.ga,"Graduate Assistant (GA)",staff.location);
    staff.groups.forEach(([number])=>group.append(option(number,"Group "+number)));
  });
  listen(group,"change",()=>{
    const pm=selectedStaff()?.groups.find(([number])=>number===Number(group.value));
    if(pm)result(pmResult,pm[1],"Project Manager");else prompt(pmResult,"Choose your group to see your Project Manager.");
  });
}
setupContactLookup();

(() => {
  const PROFILE_KEY="cen100-contact-choice-v1", FILTER_KEY="cen100-hide-completed-v1";
  const allItems=[...TEAM,...YOU];
  const byId=new Map(allItems.map(item=>[item.id,item]));
  const CALENDAR_DATES=SCHEDULE.filter(event=>event.calendar!==false);
  const SOURCE_INFO={
    y1:["Outline + assignment sheets","Course outline, p. 9; Personal Introduction assignment, pp. 1–2 (Sept 16, 3 PM); Professional Email Assignment F26 (Sept 23, 3 PM, three components emailed to the PM)."],
    y2:["Outline + assignment clarification","Course outline, pp. 9–10: 10% total, Oct 7/Nov 4, pairs. Oct 2–6 assignment discussion: Assignment 1 .m script and 3 PM deadline. Confirmed odd-class-size exception: the unpaired student may work solo or join a group of 3. Do not assume the same file requirements or time for Assignment 2."],
    y3:["Outline + clarification","Course outline, p. 9: weight, Oct 14 date and mandatory completion. Quiz requirements and certificate steps: course-team clarification recorded in this guide."],
    y4:["Outline + clarification","Course outline, p. 9: weight, Oct 14 date and mandatory completion. The 3 PM deadline and attempt limit: course-team clarification recorded in this guide."],
    y5:["Outline + clarification","Course outline, p. 9: weight and dates. Confirmed course-team clarification: email your assigned Project Manager; there is no D2L submission box."],
    y6:["Outline + guide summary","Course outline, pp. 9–11: weight, checkpoint dates and shared notebook requirements. The PDF format and 3 PM deadline are recorded in the guide's Confirmed section."],
    y7:["Outline + clarification","Course outline, pp. 9–10: participation weight and in-person attendance. The Wednesday 5:45–6 PM quiz window and one attempt are confirmed for Section 29 only. Check D2L for other sections."],
    y9:["Outline + Registrar","Course outline, pp. 9 and 12: 24%, two hours in person. TMU Current Students / Exams, checked Oct 23, confirms Dec 9–20 and resolves the conflicting Dec 8–19 line on outline p. 8. Exact CEN100 schedule and scope remain pending."],
    m3:["Course update + lecture + FMEA template","Oct 13 course-team deadline update: Part 1 Oct 21, Part 2 Oct 28 (supersedes outline p. 9). Research Methods & Failure Analysis, pp. 13 and 16–20: optional fishbone, four questions, 1–2 pages, scoring and environmental conditions. Predictive FMEA Template F26: at least 10 modes, top five risks, action types and design insight."],
    m6:["Outline + presentation rubric","Final Project Presentation Rubric F26, pp. 1–3: 6% total, 5+2-minute structure, GA-assigned tutorial dates, selected showcase teams present in tutorial Nov 25, slides on D2L. The prototype is the separate 4% M5 category."], m4:["Design Review rubric","Midterm Design Review Requirements & Rubric F26, pp. 1–3: Nov 4 live review, suggested 5+3 minutes subject to GA slots, five artifacts, five 20-point criteria."], m7:["Final Report requirements","Final Report Requirements & Template F26, pp. 1–4: Dec 2 at 11:59 PM, 8–12 pages excluding references/appendices, ten sections, consistent IEEE or APA citations, and .mlx/.m plus README. MATLAB analysis is 20 of 100 report rubric points, separate from the 10% MATLAB assignments."],
    m5:["Outline + prototype rubric","Low-Fidelity Prototype Requirements & Rubric F26, pp. 1–2: graded once (4%) alongside Nov 25/Dec 2 presentations, not a separate plan-and-build submission; no 3 PM deadline stated. Outline p. 9 retains WHMIS Oct 14 and notebook checkpoints Nov 4/Dec 2, superseding the stale Oct 9 / Nov 25 references in the prototype handout."]
  };
  const sourceFor=item=>SOURCE_INFO[item.id]||["Outline + guide summary","Course outline, p. 9: assessment weight and date. Detailed checklist: this guide's summary of assignment requirements; check the assignment instructions on D2L."];
  const $=id=>get(id);
  function readSaved(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback}catch(e){return fallback}}
  function writeSaved(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true}catch(e){$("tools-status").textContent="Your browser is blocking local saving. You can still export your ticks.";return false}}
  function validProfile(value){
    if(!value||typeof value!=="object")return null;
    const section=Number(value.section),staff=STAFFING.find(s=>s.sections.includes(section));
    if(!staff)return null;
    const group=Number(value.group);
    return {section,group:staff.groups.some(g=>g[0]===group)?group:null};
  }
  function updatePickerAction(){
    $("profile-action").textContent=$("profile-picker").open?"Hide":$("contact-section").value?"Change":"Choose";
  }
  function updateCourseContext(profile){
    const staff=profile?STAFFING.find(s=>s.sections.includes(profile.section)):null;
    const label=profile?`CEN100 Section ${profile.section}${profile.group?`, Group ${profile.group}`:""}`:"CEN100 · Fall 2026";
    $("course-context").textContent=label;
    document.title=(profile?label:"CEN100")+" | TMU Course Guides";
    $("profile-label").textContent=profile?`Section ${profile.section}${profile.group?` · Group ${profile.group}`:" · Choose your group"}${staff?` · Lab: ${staff.location}`:""}`:"Choose your section & group";
    updatePickerAction();updateSectionContent(profile);
  }
  let syncingProfile=false;
  function rememberProfile(){
    if(syncingProfile)return; // Remote changes refresh native controls without echoing another storage write.
    const profile=validProfile({section:$("contact-section").value,group:$("contact-group").value});
    updateCourseContext(profile);writeSaved(PROFILE_KEY,profile);
  }
  function setupRememberedContacts(){
    const saved=validProfile(readSaved(PROFILE_KEY,null));
    if(saved){
      $("contact-section").value=String(saved.section);$("contact-section").dispatchEvent(new Event("change",{bubbles:true}));
      if(saved.group){$("contact-group").value=String(saved.group);$("contact-group").dispatchEvent(new Event("change",{bubbles:true}))}
    }
    listen($("contact-section"),"change",rememberProfile);
    listen($("contact-group"),"change",rememberProfile);
    const picker=$("profile-picker");
    picker.open=!saved?.group;
    listen(picker,"toggle",updatePickerAction);
    listen($("profile-done"),"click",()=>{
      picker.open=false;updatePickerAction();$("profile-summary").focus({preventScroll:true});$("profile-summary").scrollIntoView({block:"nearest",behavior:"auto"});
    });
    listen($("change-profile"),"click",()=>{
      picker.open=true;updatePickerAction();$("contact-section").focus({preventScroll:true});picker.scrollIntoView({block:"start",behavior:"auto"});
    });
    listen($("profile-contacts"),"click",()=>{
      picker.open=false;updatePickerAction();$("t-rules").click();
      const contacts=$("contactlookup");contacts.tabIndex=-1;contacts.focus({preventScroll:true});contacts.scrollIntoView({block:"start",behavior:"auto"});
    });
    updateCourseContext(saved);
  }
  function applyCompletedFilter(){
    let hiddenCount=0;
    for(const item of allItems){
      const body=$("b-"+item.id),tile=body.closest(".tile"),boxes=[...body.querySelectorAll("input[data-k]")];
      const hide=$("hide-completed").checked&&boxes.length>0&&boxes.every(box=>box.checked);
      tile.hidden=hide;if(hide)hiddenCount++;
    }
    for(const listId of ["teamlist","youlist"]){
      const empty=$(listId+"-empty");empty.hidden=[...$(listId).children].some(tile=>!tile.hidden);
    }
    $("filter-status").textContent=$("hide-completed").checked?`${hiddenCount} fully checked ${hiddenCount===1?"item":"items"} hidden. Uncheck the filter to show everything.`:"";
  }
  function setupCompletedFilter(){
    for(const listId of ["teamlist","youlist"]){
      const note=document.createElement("p");note.id=listId+"-empty";note.className="guide-empty";note.hidden=true;
      note.textContent="All items in this tab are fully checked. Turn off ‘Hide fully checked items’ to see them.";
      $(listId).after(note);
    }
    $("hide-completed").checked=readSaved(FILTER_KEY,false)===true;
    listen($("hide-completed"),"change",()=>{writeSaved(FILTER_KEY,$("hide-completed").checked);applyCompletedFilter()});
    listen(document,"change",e=>{if(e.target.matches("input[data-k]"))applyCompletedFilter()});
    listen($("reset"),"click",applyCompletedFilter);
    applyCompletedFilter();
  }
  const normalise=text=>String(text).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  function findMatches(entries,query){const words=normalise(query).trim().split(/\s+/).filter(Boolean);return words.length?entries.filter(entry=>words.every(word=>normalise(entry.text).includes(word))):[]}
  function setupSearch(){
    const entries=allItems.map(item=>({title:item.name,tab:TEAM.includes(item)?"team":"you",target:"guide-item-"+item.id,item:item.id,text:[item.name,item.preview,item.what,JSON.stringify(item.facts),JSON.stringify(item.groups),JSON.stringify(item.traps),...sourceFor(item)].join(" ")}));
    for(const [listId,rows,offset] of [["rules",RULES,2],["confirmed",CONFIRMED,0],["open",OPEN,0]]){
      [...$(listId).children].forEach((node,index)=>{
        node.id=`guide-${listId}-${index}`;node.classList.add("guide-jump");
        entries.push({title:rows[index][offset],tab:"rules",target:node.id,text:rows[index].slice(offset).join(" ")});
      });
    }
    entries.push({title:"Who to ask: section and group lookup",tab:"rules",target:"contactlookup",text:"Who to ask contacts section group GA Graduate Assistant Project Manager lab room location "+STAFFING.map(s=>[s.ga,s.location,...s.groups.map(g=>g[1])].join(" ")).join(" ")});
    $("contactlookup").classList.add("guide-jump");
    const titles={team:"Team",you:"Individual + pairs",rules:"Rules"};
    listen($("guide-search"),"input",()=>{
      const query=$("guide-search").value.trim(),matches=findMatches(entries,query),list=$("guide-search-results");
      list.replaceChildren();list.hidden=!query;
      $("search-status").textContent=!query?"":matches.length?`${matches.length} ${matches.length===1?"result":"results"}${matches.length>12?"; showing the first 12. Refine your search for more.":"."}`:"No matches. Try a shorter term.";
      for(const entry of matches.slice(0,12)){
        const li=document.createElement("li"),button=document.createElement("button"),path=document.createElement("small");
        button.type="button";button.className="tool-btn";button.textContent=entry.title;path.textContent=titles[entry.tab];button.append(path);
        listen(button,"click",()=>{
          if(entry.item&&$(entry.target).hidden){$("hide-completed").checked=false;writeSaved(FILTER_KEY,false);applyCompletedFilter()}
          $("t-"+entry.tab).click();
          const target=$(entry.target);
          if(entry.item){const head=target.querySelector(".head");if(head.getAttribute("aria-expanded")!=="true")head.click();head.focus({preventScroll:true})}
          else{target.tabIndex=-1;target.focus({preventScroll:true})}
          target.scrollIntoView({block:"start",behavior:"auto"});
        });
        li.append(button);list.append(li);
      }
    });
  }
  function calendarDay(date){return date.replaceAll("-","")}
  function shiftDay(date,days){const value=new Date(date+"T12:00:00Z");value.setUTCDate(value.getUTCDate()+days);return value.toISOString().slice(0,10)}
  const icsEscape=text=>String(text).replace(/\\/g,"\\\\").replace(/\r?\n/g,"\\n").replace(/;/g,"\\;").replace(/,/g,"\\,");
  function foldLine(text){let line="",count=0,out=[];const encoder=new TextEncoder();for(const char of text){const size=encoder.encode(char).length;if(count+size>75){out.push(line);line=" ";count=1}line+=char;count+=size}out.push(line);return out.join("\r\n")}
  function buildCalendar(events,reminderDays,stamp=new Date().toISOString().replace(/[-:]/g,"").replace(/\.\d{3}/,"")){
    const lines=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//CEN100 Guide//Fall 2026//EN","CALSCALE:GREGORIAN","METHOD:PUBLISH","X-WR-CALNAME:CEN100 Fall 2026","X-WR-TIMEZONE:America/Toronto"];
    for(const event of events){
      const item=byId.get(event.item),description=[event.note||"",event.time?"Deadline time is Toronto time.":"Date confirmed; exact time is not specified in this calendar. Check D2L.","Use the submission method listed for this assignment.","Source: CEN100 Fall 2026 course outline and the guide's assignment summaries / confirmed course-team clarifications.","Calendar copies do not update automatically. Check D2L for changes."].filter(Boolean).join("\n");
      lines.push("BEGIN:VEVENT",`UID:cen100-f26-${event.id}-jude27mad-github-io`,`DTSTAMP:${stamp}`,`SUMMARY:${icsEscape("CEN100: "+event.title)}`);
      if(event.time)lines.push(`DTSTART:${torontoUTC(event.date,event.time)}`);
      else lines.push(`DTSTART;VALUE=DATE:${calendarDay(event.date)}`,`DTEND;VALUE=DATE:${calendarDay(shiftDay(event.date,1))}`);
      lines.push(`DESCRIPTION:${icsEscape(description)}`,"URL:https://jude27mad.github.io/tmu-course-guides/cen100/","TRANSP:TRANSPARENT");
      if(reminderDays>0){
        lines.push("BEGIN:VALARM","ACTION:DISPLAY",`DESCRIPTION:${icsEscape("CEN100: "+event.title)}`);
        lines.push(event.time?`TRIGGER:-P${reminderDays}D`:`TRIGGER;VALUE=DATE-TIME:${torontoUTC(shiftDay(event.date,-reminderDays),"09:00")}`);
        lines.push("END:VALARM");
      }
      lines.push("END:VEVENT");
    }
    lines.push("END:VCALENDAR");return lines.map(foldLine).join("\r\n")+"\r\n";
  }
  function downloadFile(name,type,text){
    const blob=new Blob([text],{type}),url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download=name;document.body.append(link);link.click();link.remove();objectURLs.add(url);delay(()=>{URL.revokeObjectURL(url);objectURLs.delete(url)},60000);
  }
  function openCalendar(itemId){window.CourseVisuals?.close();window.CourseWorkspace?.show("info");$("guide-tools").open=true;$("calendar-tools").open=true;$("calendar-item").value=itemId;$("calendar-status").textContent="";$("calendar-item").focus({preventScroll:true});$("calendar-tools").scrollIntoView({block:"start",behavior:"auto"})}
  function setupCalendar(){
    for(const item of allItems.filter(item=>CALENDAR_DATES.some(event=>event.item===item.id))){const option=document.createElement("option");option.value=item.id;option.textContent=item.name;$("calendar-item").append(option)}
    listen($("calendar-download"),"click",()=>{
      const id=$("calendar-item").value,upcoming=$("calendar-upcoming").checked;
      const events=CALENDAR_DATES.filter(event=>(id==="all"||event.item===id)&&(!upcoming||!eventPassed(event))).slice().sort(sortEvents);
      if(!events.length){$("calendar-status").textContent="No upcoming dates in this selection. Uncheck ‘Upcoming dates only’ to include past deadlines.";return}
      downloadFile(`cen100-${id==="all"?"deadlines":id}-2026.ics`,"text/calendar;charset=utf-8",buildCalendar(events,Number($("calendar-reminder").value)));
      $("calendar-status").textContent=`Calendar file ready with ${events.length} ${events.length===1?"entry":"entries"}. Open or save the download, then add it to your calendar. Import once to avoid duplicates.`;
    });
  }
  function setupSources(){
    for(const item of allItems){
      const body=$("b-"+item.id),tile=body.closest(".tile"),extras=document.createElement("div"),source=document.createElement("details"),summary=document.createElement("summary"),text=document.createElement("p");
      tile.id="guide-item-"+item.id;tile.classList.add("guide-jump");extras.className="tile-extras";source.className="source-note";
      const [label,note]=sourceFor(item);summary.textContent="Sources: "+label;text.textContent=note;source.append(summary,text);extras.append(source);
      if(CALENDAR_DATES.some(event=>event.item===item.id)){const button=document.createElement("button");button.type="button";button.className="tool-btn";button.textContent="Add to calendar";listen(button,"click",()=>openCalendar(item.id));extras.append(button)}
      body.append(extras);
    }
  }
  function parseBackup(raw,validKeys){
    if(typeof raw!=="string"||raw.length>250000)throw new Error("Choose a CEN100 backup smaller than 250 KB.");
    let data;try{data=JSON.parse(raw)}catch(e){throw new Error("This file is not valid JSON. Choose an exported CEN100 backup.")}
    if(!data||data.format!=="cen100-guide-backup"||![1,2].includes(data.version)||!data.ticks||typeof data.ticks!=="object"||Array.isArray(data.ticks))throw new Error("This is not a supported CEN100 backup.");
    const checked={},entries=Object.entries(data.ticks);let skipped=0;
    for(const [key,value] of entries){
      if(!validKeys.has(key)){skipped++;continue}
      if(value!==true&&value!==false&&value!==1&&value!==0)throw new Error("The backup contains invalid checklist values.");
      if(value===true||value===1)checked[key]=1;
    }
    const plan=data.version===2?cleanPlan(data.personal,true):cleanPlan({});
    if(entries.length&&skipped===entries.length&&!Object.values(plan).some(v=>Object.keys(v).length))throw new Error("This backup has no items matching the current guide.");
    return {checked,skipped,plan};
  }
  function setupBackups(){
    const boxes=[...all("input[data-k]")],validKeys=new Set(boxes.map(box=>box.dataset.k));
    listen($("backup-export"),"click",()=>{
      const checked=Object.fromEntries(boxes.filter(box=>box.checked).map(box=>[box.dataset.k,1]));
      const data={format:"cen100-guide-backup",version:2,exportedAt:new Date().toISOString(),ticks:checked,personal};
      downloadFile(`cen100-progress-${torontoToday()}.json`,"application/json",JSON.stringify(data,null,2)+"\n");
      $("backup-status").textContent="Backup ready. It includes your checklist ticks, completion records, private notes and personal target dates.";
    });
    listen($("backup-import"),"change",async e=>{
      const file=e.target.files?.[0];if(!file)return;
      try{
        if(file.size>250000)throw Error("Choose a CEN100 backup smaller than 250 KB.");
        const raw=await file.text();if(signal.aborted)return;
        const {checked,skipped,plan}=parseBackup(raw,validKeys);let added=0,records=0,filled=0,kept=0;
        for(const box of boxes)if(checked[box.dataset.k]){if(!box.checked)added++;box.checked=true;ticks[box.dataset.k]=1}
        for(const key of Object.keys(plan.completed))if(!personal.completed[key]){personal.completed[key]=1;records++}
        for(const field of ["notes","targets"])for(const [id,value] of Object.entries(plan[field])){
          if(!personal[field][id]){personal[field][id]=value;filled++}
          else if(personal[field][id]!==value)kept++;
        }
        all("input[data-completion]").forEach(box=>box.checked=!!personal.completed[box.dataset.completion]);
        for(const item of allItems){$("note-"+item.id).value=personal.notes[item.id]||"";$("target-"+item.id).value=personal.targets[item.id]||""}
        save();writeSaved(PLAN_KEY,personal);counts();syncCompletionCounts();applyCompletedFilter();renderWork();
        $("backup-status").textContent=`Imported ${added} new checklist ticks, ${records} completion records and ${filled} notes/target dates. Existing progress kept.${kept?` ${kept} conflicting notes/target dates kept as they were on this device.`:""}${skipped?` ${skipped} unrecognised checklist items skipped.`:""}`;
      }catch(error){if(signal.aborted)return;$("backup-status").textContent=error.message}
      e.target.value="";
    });
  }

  const PLAN_KEY="cen100-personal-plan-v1", SEEN_KEY="cen100-last-seen-update-v1", GUIDE_VERSION="2026-10-12-subject-privacy";
  function recordsFor(item){const dates=itemDeadlines(item.id);return dates.length?dates:[{id:"item:"+item.id,item:item.id,title:item.name}]}
  const completionKeys=new Set(allItems.flatMap(item=>recordsFor(item).map(e=>e.id)));
  function validDate(value){return typeof value==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value+"T12:00:00Z"))&&new Date(value+"T12:00:00Z").toISOString().slice(0,10)===value}
  function cleanPlan(value,strict=false){
    const out={completed:{},notes:{},targets:{}};
    if(!value||typeof value!=="object"||Array.isArray(value)){if(strict)throw Error("Invalid personal planning data.");return out}
    for(const field of ["completed","notes","targets"]){
      const entries=value[field];
      if(entries===undefined)continue;
      if(!entries||typeof entries!=="object"||Array.isArray(entries)){if(strict)throw Error("Invalid personal planning data.");continue}
      for(const [key,v] of Object.entries(entries)){
        if(field==="completed"){
          if(!completionKeys.has(key))continue;
          if(v===1||v===true)out.completed[key]=1;
          else if(v!==0&&v!==false&&strict)throw Error("Invalid completion record in backup.");
        }else{
          if(!byId.has(key))continue;
          if(typeof v!=="string"||(field==="notes"?v.length>2000:v!==""&&!validDate(v))){if(strict)throw Error("Invalid note or target date in backup.");continue}
          if(v)out[field][key]=v;
        }
      }
    }
    return out;
  }
  let personal=cleanPlan(readSaved(PLAN_KEY,{}));
  const fullyRecorded=item=>recordsFor(item).every(e=>personal.completed[e.id]);
  function completionVerb(event){return (event.id==="email"||event.id.startsWith("reflection-"))?"Emailed":/^(intro|email|contract|outline|matlab-1|matlab-2|failure|failure-2|notebook-1|notebook-2|report|peer|exit)$/.test(event.id)?"Submitted":"Completed"}
  function completionText(event){
    const name=event.title.replace(/ due$/,""),verb=completionVerb(event);
    return `${verb}: ${name}${event.date?` (${mon(event.date)} ${D(event.date).getUTCDate()}${event.time?`, ${clockLabel(event.time)} Toronto`:""})`:""}`;
  }
  function completionSummary(item){
    const records=recordsFor(item),done=records.filter(e=>personal.completed[e.id]).length,total=records.length;
    const verbs=new Set(records.map(completionVerb));
    return {done,total,label:!done?"":done<total?`${done} of ${total} recorded`:verbs.size===1?[...verbs][0]:"Completed"};
  }
  let lastQuickCompletion=null;
  function setCompletion(id,done){
    if(!completionKeys.has(id))return;
    if(done)personal.completed[id]=1;else delete personal.completed[id];
    const saved=writeSaved(PLAN_KEY,personal);syncCompletionCounts();renderWork();return saved;
  }
  function syncCompletionCounts(){
    all("input[data-completion]").forEach(input=>input.checked=!!personal.completed[input.dataset.completion]);
    for(const item of allItems){
      const {done,total,label}=completionSummary(item),node=$("completion-"+item.id),badge=$("recorded-"+item.id);
      if(node)node.textContent=done?`${done}/${total} submission/completion records marked by you.`:"No submission/completion recorded yet.";
      if(badge){
        badge.hidden=!done;badge.textContent=label;badge.classList.toggle("full",done===total);
        badge.title=done?`${done}/${total} submission/completion records marked by you; separate from checklist progress.`:"";
        badge.setAttribute("aria-label",done?`${label}, marked by you`:"");
      }
    }
    renderTop(personal.completed);
  }
  function openAssignment(id){
    const item=byId.get(id);if(!item)return;
    const tile=$("guide-item-"+id);
    if(tile.hidden){$("hide-completed").checked=false;writeSaved(FILTER_KEY,false);applyCompletedFilter()}
    $(TEAM.includes(item)?"t-team":"t-you").click();
    if(window.CourseVisuals?.open(tile,document.activeElement))return;
    const head=tile.querySelector(".head");if(head.getAttribute("aria-expanded")!=="true")head.click();
    head.focus({preventScroll:true});tile.scrollIntoView({block:"start",behavior:"auto"});
  }
  function readAssignmentLink(){const match=location.hash.match(/^#assignment-([a-z]\d+)$/);if(match&&byId.has(match[1]))openAssignment(match[1])}
  function setupPersonalTools(){
    for(const item of allItems){
      const body=$("b-"+item.id),extras=body.querySelector(".tile-extras"),share=document.createElement("button"),shareStatus=document.createElement("p"),fallback=document.createElement("input");
      share.type="button";share.className="tool-btn";share.textContent="Copy assignment link";
      shareStatus.className="tool-status";shareStatus.setAttribute("role","status");
      fallback.type="text";fallback.className="share-fallback";fallback.readOnly=true;fallback.hidden=true;fallback.setAttribute("aria-label","Assignment link to copy");
      listen(share,"click",async()=>{
        const url=new URL(location.href);url.search="";url.hash="assignment-"+item.id;
        try{if(!navigator.clipboard?.writeText)throw Error("Clipboard unavailable");await navigator.clipboard.writeText(url.href);if(signal.aborted)return;fallback.hidden=true;shareStatus.textContent="Assignment link copied. Your progress and notes are not included."}
        catch(e){if(signal.aborted)return;fallback.value=url.href;fallback.hidden=false;fallback.focus();fallback.select();shareStatus.textContent="Select and copy this link. Your progress and notes are not included."}
      });
      extras.append(share);body.append(shareStatus,fallback);
      const details=document.createElement("details"),summary=document.createElement("summary"),fieldset=document.createElement("fieldset"),legend=document.createElement("legend"),hint=document.createElement("p");
      details.className="personal-tools";details.id="personal-"+item.id;summary.textContent="My plan & completion";legend.textContent="My submission / completion record";
      hint.className="tool-note";hint.textContent="Mark these yourself after submitting or completing the work. Checklist ticks are separate. This guide does not submit work or verify D2L.";
      fieldset.append(legend);
      for(const event of recordsFor(item)){
        const label=document.createElement("label"),input=document.createElement("input"),text=document.createElement("span");
        label.className="tool-check";input.type="checkbox";input.dataset.completion=event.id;input.checked=!!personal.completed[event.id];text.textContent=completionText(event);label.append(input,text);fieldset.append(label);
        listen(input,"change",()=>{
          lastQuickCompletion=null;$("quick-confirm").hidden=true;setCompletion(event.id,input.checked);
        });
      }
      const progress=document.createElement("p");progress.id="completion-"+item.id;progress.className="completion-count";
      const noteLabel=document.createElement("label"),note=document.createElement("textarea"),targetLabel=document.createElement("label"),target=document.createElement("input"),noteInfo=document.createElement("p");
      note.id="note-"+item.id;noteLabel.htmlFor=note.id;noteLabel.textContent="My notes / responsibilities";note.maxLength=2000;note.rows=3;note.value=personal.notes[item.id]||"";
      target.id="target-"+item.id;targetLabel.htmlFor=target.id;targetLabel.textContent="My target date (optional)";target.type="date";target.value=personal.targets[item.id]||"";
      noteInfo.className="tool-note";noteInfo.textContent="Saved on this device and included in your exported backup. These notes are not shared with your team. Your target does not change the official deadline.";
      listen(note,"input",()=>{note.value?personal.notes[item.id]=note.value:delete personal.notes[item.id];writeSaved(PLAN_KEY,personal)});
      listen(target,"change",()=>{if(target.value&&!validDate(target.value))return;target.value?personal.targets[item.id]=target.value:delete personal.targets[item.id];writeSaved(PLAN_KEY,personal);renderWork()});
      details.append(summary,hint,fieldset,progress,noteLabel,note,targetLabel,target,noteInfo);body.append(details);
    }
    syncCompletionCounts();listen(window,"hashchange",readAssignmentLink);
  }
  function workEntries(range,now=new Date()){
    const today=torontoToday(now),entries=[];
    for(const item of allItems){
      if(fullyRecorded(item))continue;
      const pending=recordsFor(item).filter(e=>!personal.completed[e.id]);
      const within=date=>{const n=days(date,today);return n>=0&&n<7};
      const target=personal.targets[item.id],dated=pending.filter(e=>e.date);
      const visible=range==="week"?dated.filter(e=>!eventPassed(e,now)&&within(e.date)):dated;
      if(range==="week"&&!visible.length&&!(target&&within(target)))continue;
      const sortDate=[...visible.map(e=>e.date),...(target&&(range!=="week"||within(target))?[target]:[])].sort()[0]||"9999-12-31";
      entries.push({item,pending,visible,target,sortDate});
    }
    return entries.sort((a,b)=>a.sortDate.localeCompare(b.sortDate)||a.item.name.localeCompare(b.item.name));
  }
  function renderWork(){
    const entries=workEntries($("work-range").value),list=$("work-list");
    const signature=JSON.stringify([$("work-range").value,entries.map(e=>[e.item.id,e.pending.map(x=>x.id),e.visible.map(x=>[x.id,eventPassed(x)]),e.target,[...$("b-"+e.item.id).querySelectorAll("input[data-k]")].filter(b=>b.checked).length])]);
    if(list.dataset.workSignature===signature)return;list.dataset.workSignature=signature;list.replaceChildren();
    $("work-status").textContent=entries.length?`${entries.length} ${entries.length===1?"item":"items"} with completion still unrecorded.`:$("work-range").value==="week"?"Nothing unrecorded in the next 7 days. Choose All unfinished to review other work.":"All items are marked submitted/completed in your records.";
    for(const entry of entries){
      const {item,pending,visible,target}=entry,li=document.createElement("li"),button=document.createElement("button"),dates=document.createElement("p"),progress=document.createElement("p");
      button.type="button";button.className="tool-btn";button.textContent=item.name;listen(button,"click",()=>openAssignment(item.id));
      dates.textContent=visible.length?visible.map(e=>`${eventPassed(e)?"Date passed: ":""}${mon(e.date)} ${D(e.date).getUTCDate()}${e.time?` at ${clockLabel(e.time)} Toronto`:""} — ${e.title}`).join("; "):item.id==="y7"?"During your assigned tutorial; confirm your section's schedule on D2L.":target?"No official deadline in this view.":"Official date pending. Check D2L.";
      const boxes=[...$("b-"+item.id).querySelectorAll("input[data-k]")],remaining=boxes.filter(b=>!b.checked).length;
      progress.textContent=`${remaining}/${boxes.length} checklist items still unchecked · ${pending.length} completion ${pending.length===1?"record":"records"} unmarked.`;
      li.append(button,dates,progress);
      if(target){const p=document.createElement("p");p.textContent="My target: "+target+" (personal plan)";li.append(p)}
      list.append(li);
    }
  }
  function updateSectionContent(profile){
    const attendance=$("b-y7"),section=profile?.section;
    attendance.querySelector(".what").textContent=section===29?"Section 29: a D2L quiz opens 5:45 to 6:00 PM in every Wednesday tutorial. One attempt, and you have to be in the room.":section?`Attend your assigned Section ${section} tutorial in person. Check D2L for your section's quiz day, time and attempt rules.`:"Attendance quizzes take place during your assigned tutorial. Select your section above. The confirmed Section 29 window is Wednesday, 5:45 to 6:00 PM; other sections should check D2L.";
    attendance.querySelector(".fact span").textContent=section===29?"Section 29: Wednesday, 5:45 to 6:00 PM":"Check your assigned tutorial's quiz schedule on D2L";
    const staff=STAFFING.find(s=>s.sections.includes(section)),pm=staff?.groups.find(g=>g[0]===profile?.group);
    $("b-y5").querySelector(".what").textContent=pm?`Your own writing about the project, two pieces. Email each Personal Reflection directly to your assigned Project Manager for Group ${pm[0]}; find their current contact details on D2L. There is no D2L submission box.`:byId.get("y5").what;
    refreshDateDisplays(personal.completed);
  }
  function setupWorkAndUpdates(){
    listen($("nextsign"),"click",e=>{
      const button=e.target.closest("[data-quick-complete]");if(!button)return;
      const id=button.dataset.quickComplete,event=SCHEDULE.find(event=>event.id===id);
      if(!event||!completionKeys.has(id)||personal.completed[id])return;
      const saved=setCompletion(id,true);lastQuickCompletion=id;
      $("quick-message").textContent="Marked done: "+eventLabel(event)+(saved?". Saved on this device.":". Local saving is blocked; export a backup to keep it.");
      $("quick-confirm").hidden=false;$("undo-complete").focus({preventScroll:true});
    });
    listen($("undo-complete"),"click",()=>{
      const id=lastQuickCompletion;if(!id)return;lastQuickCompletion=null;
      setCompletion(id,false);$("quick-confirm").hidden=true;
      $("nextsign").querySelector("[data-quick-complete]")?.focus({preventScroll:true});
    });
    listen($("quick-contacts"),"click",()=>$("profile-contacts").click());
    listen($("quick-work"),"click",()=>{
      $("work-range").value="week";renderWork();$("guide-tools").open=true;$("work-tools").open=true;
      $("work-range").focus({preventScroll:true});$("work-tools").scrollIntoView({block:"start",behavior:"auto"});
    });
    for(const id of ["nextsign","board"])listen($(id),"click",e=>{
      const link=e.target.closest("a[data-assignment]");
      if(!link||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
      e.preventDefault();openAssignment(link.dataset.assignment);
    });
    listen($("work-range"),"change",renderWork);
    listen(document,"change",e=>{if(e.target.matches("input[data-k]"))renderWork()});
    listen($("reset"),"click",renderWork);
    const badge=$("updates-badge"),history=$("guide-updates");badge.hidden=readSaved(SEEN_KEY,"")===GUIDE_VERSION;
    listen(history,"toggle",()=>{if(history.open){badge.hidden=true;writeSaved(SEEN_KEY,GUIDE_VERSION)}});
    const refresh=()=>{refreshDateDisplays(personal.completed);renderWork()};
    listen(document,"visibilitychange",()=>{if(!document.hidden)refresh()});
    listen(window,"pageshow",e=>{if(e.persisted)refresh()});
    listen(window,"focus",refresh);repeat(()=>{if(!document.hidden)refresh()},60000);
    renderWork();readAssignmentLink();
  }

  listen(document,'course-open-item',e=>openAssignment(e.detail));
  listen(document,'course-visuals-ready',()=>renderTop(personal.completed));
  setupRememberedContacts();setupSources();setupCompletedFilter();setupSearch();setupCalendar();setupPersonalTools();setupBackups();setupWorkAndUpdates();
  listen(window,"storage",e=>{
    if(e.key!==null&&e.key!==PROFILE_KEY&&e.key!==PLAN_KEY)return;
    if(e.key===null||e.key===PLAN_KEY){
      personal=cleanPlan(readSaved(PLAN_KEY,{}));lastQuickCompletion=null;$("quick-confirm").hidden=true;
      for(const item of allItems){$("note-"+item.id).value=personal.notes[item.id]||"";$("target-"+item.id).value=personal.targets[item.id]||"";}
      syncCompletionCounts();renderWork();document.dispatchEvent(new window.CustomEvent("guide-completion"));
    }
    if(e.key===null||e.key===PROFILE_KEY){
      const profile=validProfile(readSaved(PROFILE_KEY,null));syncingProfile=true;
      try{
        $("contact-section").value=profile?.section||"";$("contact-section").dispatchEvent(new Event("change",{bubbles:true}));
        $("contact-group").value=profile?.group||"";$("contact-group").dispatchEvent(new Event("change",{bubbles:true}));
      }finally{syncingProfile=false;}
      updateCourseContext(profile);window.CourseWorkspace?.refresh();
    }
  });
})();

  }catch(error){unmount();throw error}
}

