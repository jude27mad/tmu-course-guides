export const DAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const dateObject = date => new Date(date + 'T12:00:00Z');
export function today(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(p => [p.type,p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
export function addDays(date, count) {
  const value = dateObject(date); value.setUTCDate(value.getUTCDate() + count);
  return value.toISOString().slice(0,10);
}
export const daysUntil = (date, now = new Date()) => Math.round((dateObject(date)-dateObject(today(now)))/86400000);
export const dateLabel = date => dateObject(date).toLocaleDateString('en-CA',{month:'short',day:'numeric',timeZone:'UTC'});
export const dayLabel = date => dateObject(date).toLocaleDateString('en-CA',{weekday:'long',timeZone:'UTC'});
export function clock(time) {
  const [h,m] = time.split(':').map(Number);
  return `${h%12||12}:${String(m).padStart(2,'0')} ${h<12?'AM':'PM'}`;
}
export function timestamp(date, time) {
  const [y,m,d]=date.split('-').map(Number),[h,min]=time.split(':').map(Number);
  const target=Date.UTC(y,m-1,d,h,min); let value=target;
  const formatter=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  for(let i=0;i<2;i++) {
    const p=Object.fromEntries(formatter.formatToParts(new Date(value)).map(x=>[x.type,x.value]));
    value+=target-Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second);
  }
  return value;
}
export function resolveAssessment(_course, assessment) {
  if (assessment.kind !== 'quiz') return { ...assessment, lab: null, sortDate: assessment.date || '9999-12-31' };
  return {
    ...assessment,
    date: null,
    lab: null,
    weekEnd: assessment.weekEnd || addDays(assessment.week, 4),
    sortDate: assessment.week,
  };
}
export function assessmentPassed(event, now = new Date()) {
  if(event.date) return event.time?timestamp(event.date,event.end||event.time)<now.getTime():event.date<today(now);
  if(event.week) return event.weekEnd<today(now);
  return false;
}
export function upcoming(course, section, completed = {}, now = new Date()) {
  return course.assessments.map(a=>resolveAssessment(course,a,section))
    .filter(a=>(a.date||a.week)&&!completed[a.id]&&!assessmentPassed(a,now))
    .sort((a,b)=>a.sortDate.localeCompare(b.sortDate)||a.id.localeCompare(b.id));
}
export function timing(event) {
  if(event.date) return `${dayLabel(event.date)}, ${dateLabel(event.date)}${event.time?` · ${clock(event.time)}–${clock(event.end)} Toronto time`:''}`;
  if(event.week) return `${dateLabel(event.week)}–${dateLabel(event.weekEnd)} · during your assigned lab`;
  return 'December · exact date, time and room to be announced';
}
const escapeICS = value => String(value).replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
function fold(line) {
  // RFC 5545 limits content lines to 75 octets, including continuation whitespace.
  const encoder=new TextEncoder(); let rows=[],row='';
  for(const char of line) {
    if(encoder.encode(row+char).length>75) {rows.push(row);row=' '+char;} else row+=char;
  }
  rows.push(row);return rows.join('\r\n');
}
export function calendar(course, _section, {includeTentative=false,onlyUpcoming=true,now=new Date()}={}) {
  const resolved = course.assessments.map((assessment) => resolveAssessment(course, assessment));
  const events = resolved.filter((event) =>
    (event.date || (includeTentative && event.week)) && (!onlyUpcoming || !assessmentPassed(event, now))
  );
  const utc = (date,time) => new Date(timestamp(date,time)).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
  let lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//TMU Course Guides//Fall 2026//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH'];
  for (const event of events) {
    const quizWeek = event.kind === 'quiz';
    lines.push('BEGIN:VEVENT', `UID:${course.code.toLowerCase()}-${event.id}-all-f26@jude27mad.github.io`, `DTSTAMP:${now.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')}`);
    if (event.time) {
      lines.push(`DTSTART:${utc(event.date, event.time)}`, `DTEND:${utc(event.date, event.end)}`);
    } else {
      const start = event.date || event.week;
      const exclusiveEnd = addDays(event.weekEnd || start, 1);
      lines.push(`DTSTART;VALUE=DATE:${start.replace(/-/g,'')}`, `DTEND;VALUE=DATE:${exclusiveEnd.replace(/-/g,'')}`, 'STATUS:TENTATIVE');
    }
    const suffix = quizWeek ? ' (quiz window)' : '';
    const note = quizWeek ? ' Check D2L for the exact quiz date and time.' : ' Check D2L for room assignments and updates.';
    lines.push(`SUMMARY:${escapeICS(course.code + ' ' + event.title + suffix)}`);
    lines.push(`DESCRIPTION:${escapeICS(event.scope + ' Source: ' + event.source + note)}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');return {text:lines.map(fold).join('\r\n')+'\r\n',count:events.length};
}
