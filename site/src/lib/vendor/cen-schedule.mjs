/* Canonical CEN100 schedule shared by the guide, Desk and Night Shift.
   Ids are completion keys and calendar UIDs: never rename them. Importing data creates no globals. */
export const SCHEDULE=[
 {id:"intro",item:"y1",date:"2026-09-16",title:"Personal Introduction due"},
 {id:"entry",item:"y1",date:"2026-09-16",title:"Entry Survey due"},
 {id:"syllabus",item:"y1",date:"2026-09-16",title:"Course Syllabus Quiz due"},
 {id:"email",item:"y1",date:"2026-09-23",title:"Professional Email Assignment due"},
 {id:"contract",item:"m1",date:"2026-09-23",title:"Team Contract + Task Outline due"},
 {id:"outline",item:"m2",date:"2026-10-02",title:"Project Outline + User Research due",note:"Due by the end of the day. Check D2L for the exact submission time."},
 {id:"matlab-1",item:"y2",date:"2026-10-07",title:"MATLAB Assignment 1 due"},
 {id:"whmis",item:"y3",date:"2026-10-14",title:"WHMIS certification due"},
 {id:"integrity",item:"y4",date:"2026-10-14",time:"15:00",title:"Academic Integrity Quiz due"},
 {id:"failure",item:"m3",date:"2026-10-21",title:"Failure Analysis Labs: both parts due"},
 {id:"reflection-1",item:"y5",date:"2026-10-28",title:"Personal Reflection 1 due",note:"Email directly to your assigned Project Manager; no D2L submission box."},
 {id:"review",item:"m4",date:"2026-11-04",title:"Midterm Design Review",note:"In your assigned lab. Confirm your presentation time on D2L."},
 {id:"notebook-1",item:"y6",date:"2026-11-04",time:"15:00",title:"Team design notebook PDF: checkpoint 1 due"},
 {id:"matlab-2",item:"y2",date:"2026-11-04",title:"MATLAB Assignment 2 due"},
 {id:"prototype",item:"m5",date:"2026-11-25",time:"15:00",title:"Low-Fidelity Prototype due"},
 {id:"presentation-1",item:"m6",date:"2026-11-25",title:"First Final Presentation",note:"Confirm your assigned presentation time on D2L."},
 {id:"presentation-2",item:"m6",date:"2026-12-02",title:"Final Presentation and Innovation Showcase",note:"Confirm your assigned presentation time on D2L."},
 {id:"notebook-2",item:"y6",date:"2026-12-02",time:"15:00",title:"Team design notebook PDF: checkpoint 2 due"},
 {id:"reflection-2",item:"y5",date:"2026-12-02",title:"Personal Reflection 2 due",note:"Email directly to your assigned Project Manager; no D2L submission box."},
 {id:"exit",item:"y8",date:"2026-12-02",title:"Exit Survey due"},
 {id:"peer",item:"m8",date:"2026-12-02",title:"Peer Evaluation due"},
 {id:"report",item:"m7",date:"2026-12-02",time:"23:59",title:"Final Report due"},
 {id:"failure-lab",item:"m3",date:"2026-10-14",title:"Failure Analysis Part 1 in lab (Section 29)",who:"sub",section:29,calendar:false},
 {id:"showcase-signup",item:"m6",date:"2026-11-18",title:"Showcase sign-up (around now; check D2L)",calendar:false}
];
