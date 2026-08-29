const UPSTREAM_FEED_URL = 'https://test.asm.peterhamrn.com/api/public/classes';
const UUID = /^[0-9a-f-]{36}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function escapeIcs(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

function foldLine(line) {
  const encoder = new TextEncoder(), parts = [];
  let current = '';
  for (const character of line) {
    const candidate = current + character;
    if (encoder.encode(candidate).length > (parts.length ? 74 : 75)) { parts.push(current); current = ` ${character}`; }
    else current = candidate;
  }
  parts.push(current);
  return parts;
}

function compactDate(value) { return value.replaceAll('-', ''); }
function nextDate(value) { const date = new Date(`${value}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + 1); return date.toISOString().slice(0, 10); }
function stamp() { return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z'); }

function calendar(item) {
  const timed = TIME.test(item.startTime || '') && (!item.endTime || TIME.test(item.endTime));
  const start = timed ? `DTSTART;TZID=America/New_York:${compactDate(item.date)}T${item.startTime.replace(':', '')}00` : `DTSTART;VALUE=DATE:${compactDate(item.date)}`;
  const endTime = item.endTime || item.startTime;
  const end = timed ? `DTEND;TZID=America/New_York:${compactDate(item.date)}T${endTime.replace(':', '')}00` : `DTEND;VALUE=DATE:${compactDate(nextDate(item.date))}`;
  const description = [item.publicDescription, item.registrationLink].filter(Boolean).join('\n\n');
  return [
    'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//PeterHamRN.com//Upcoming Classes//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH',
    'BEGIN:VTIMEZONE','TZID:America/New_York','X-LIC-LOCATION:America/New_York',
    'BEGIN:DAYLIGHT','TZOFFSETFROM:-0500','TZOFFSETTO:-0400','TZNAME:EDT','DTSTART:19700308T020000','RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU','END:DAYLIGHT',
    'BEGIN:STANDARD','TZOFFSETFROM:-0400','TZOFFSETTO:-0500','TZNAME:EST','DTSTART:19701101T020000','RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU','END:STANDARD','END:VTIMEZONE',
    'BEGIN:VEVENT',`UID:${item.publicId}@peterhamrn.com`,`DTSTAMP:${stamp()}`,start,end,`SUMMARY:${escapeIcs(item.classType)}`,`LOCATION:${escapeIcs(item.location)}`,`DESCRIPTION:${escapeIcs(description)}`,`URL:${escapeIcs(item.registrationLink)}`,'END:VEVENT','END:VCALENDAR',''
  ].flatMap(foldLine).join('\r\n');
}

export async function onRequestGet(context) {
  const publicId = new URL(context.request.url).searchParams.get('publication') || '';
  if (!UUID.test(publicId)) return Response.json({ error: 'A valid class publication ID is required.' }, { status: 400 });
  const response = await fetch(UPSTREAM_FEED_URL, { headers: { Accept: 'application/json' }, cf: { cacheTtl: 60, cacheEverything: true } });
  if (!response.ok) return Response.json({ error: 'Published class information is temporarily unavailable.' }, { status: 502 });
  const snapshot = await response.json();
  const item = Array.isArray(snapshot?.classes) ? snapshot.classes.find(entry => entry.publicId === publicId) : null;
  if (!item || !DATE.test(item.date || '')) return Response.json({ error: 'Published class was not found.' }, { status: 404 });
  return new Response(calendar(item), { headers: {
    'Content-Type': 'text/calendar; charset=utf-8',
    'Content-Disposition': `attachment; filename="peterhamrn-class-${compactDate(item.date)}.ics"`,
    'Cache-Control': 'public, max-age=60',
    'X-Content-Type-Options': 'nosniff'
  } });
}

export const _test = { calendar, escapeIcs, foldLine };
