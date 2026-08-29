import test from 'node:test';
import assert from 'node:assert/strict';
import { _test, onRequestGet } from '../functions/api/public/class-calendar.js';

const item = {
  publicId: '876227d0-4140-491f-a4ba-58e9088bda9b',
  classType: 'Advanced ASM, Myrtle Beach',
  date: '2026-09-19', startTime: '09:00', endTime: '17:00',
  location: 'Myrtle Beach, SC', publicDescription: 'Line one\nLine two',
  registrationLink: 'https://example.com/class?id=1'
};

test('ICS is one Eastern-time event with stable identity and CRLF', () => {
  const value = _test.calendar(item);
  assert.equal((value.match(/BEGIN:VCALENDAR/g) || []).length, 1);
  assert.equal((value.match(/BEGIN:VEVENT/g) || []).length, 1);
  assert.match(value, /UID:876227d0-4140-491f-a4ba-58e9088bda9b@peterhamrn\.com\r\n/);
  assert.match(value, /DTSTART;TZID=America\/New_York:20260919T090000\r\n/);
  assert.match(value, /DTEND;TZID=America\/New_York:20260919T170000\r\n/);
  assert.match(value, /SUMMARY:Advanced ASM\\, Myrtle Beach\r\n/);
  assert.equal(/(^|[^\r])\n/.test(value), false);
  assert.equal(value.split('\r\n').every(line => new TextEncoder().encode(line).length <= 75), true);
});

test('ICS uses an all-day event when valid times are absent', () => {
  const value = _test.calendar({ ...item, startTime: '', endTime: '' });
  assert.match(value, /DTSTART;VALUE=DATE:20260919\r\n/);
  assert.match(value, /DTEND;VALUE=DATE:20260920\r\n/);
});

test('each public ID downloads only its selected class with calendar headers', async () => {
  const originalFetch = globalThis.fetch;
  const classes = ['2026-09-19','2026-10-17','2026-11-21'].map((date,index)=>({ ...item, publicId:`${index+1}1111111-1111-4111-8111-111111111111`, date, classType:`Class ${index+1}` }));
  globalThis.fetch = async () => Response.json({ schemaVersion:1, classes });
  try {
    for (const selected of classes) {
      const response = await onRequestGet({ request:new Request(`https://peterhamrn.com/api/public/class-calendar?publication=${selected.publicId}`) });
      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-type'), /^text\/calendar/);
      assert.match(response.headers.get('content-disposition'), new RegExp(selected.date.replaceAll('-', '')));
      const value = await response.text();
      assert.match(value, new RegExp(`SUMMARY:${selected.classType}`));
      for (const other of classes.filter(entry=>entry!==selected)) assert.equal(value.includes(`SUMMARY:${other.classType}`), false);
    }
  } finally { globalThis.fetch = originalFetch; }
});
