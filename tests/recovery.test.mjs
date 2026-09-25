import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { onRequest } from '../functions/find/[token].js';

const token = 'A'.repeat(32);
function fixture() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../functions/_recovery/schema.sql', import.meta.url), 'utf8'));
  db.exec(`INSERT INTO owners(id,display_name,phone,email,show_name,allow_call,allow_text,allow_email)
    VALUES('one','Alex Example','+12025550123','alex@example.com',1,1,1,1),
          ('two','Other Owner','+12025550124','other@example.com',1,1,1,1);`);
  db.prepare('INSERT INTO recovery_tags(id,owner_id,public_token,item_label,status) VALUES(?,?,?,?,?)')
    .run('tag-one', 'one', token, 'Test Keys', 'active');
  const env = { RECOVERY_DB: { prepare(sql) { return { bind(value) {
    return { async first() { return db.prepare(sql).get(value) ?? null; } };
  } }; } } };
  const request = (value = token, method = 'GET') => onRequest({
    request: new Request(`https://example.com/find/${encodeURIComponent(value)}`, { method }),
    params: { token: value }, env
  });
  return { db, request };
}

test('active token reveals only its assigned owner and sends privacy headers', async () => {
  const { db, request } = fixture();
  try {
    const response = await request();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    assert.match(response.headers.get('x-robots-tag'), /noindex/);
    assert.match(response.headers.get('content-security-policy'), /default-src 'none'/);
    const html = await response.text();
    assert.match(html, /Test Keys/);
    assert.match(html, /CALL ALEX/);
    assert.match(html, /href="tel:\+12025550123"/);
    assert.doesNotMatch(html, /Other Owner|other@example|12025550124|Alex Example/);
    assert.equal(await (await request(token, 'HEAD')).text(), '');
  } finally { db.close(); }
});

test('unavailable states, unknown tokens, and invalid tokens never expose contact details', async () => {
  const { db, request } = fixture();
  try {
    for (const status of ['inactive', 'replaced']) {
      db.prepare('UPDATE recovery_tags SET status=?, owner_id=?').run(status, 'one');
      const response = await request();
      assert.equal(response.status, 404);
      assert.doesNotMatch(await response.text(), /Alex|Test Keys|alex@example|12025550123/);
    }
    db.prepare('UPDATE recovery_tags SET status=?, owner_id=?').run('unclaimed', null);
    const unclaimed = await request();
    assert.equal(unclaimed.status, 200);
    const activationHtml = await unclaimed.text();
    assert.match(activationHtml, /Activate Your Recovery Tag/);
    assert.match(activationHtml, /ACTIVATE TAG/);
    assert.match(activationHtml, new RegExp('href="/activate/' + token + '"'));
    assert.doesNotMatch(activationHtml, /Alex|Test Keys|alex@example|12025550123/);
    for (const value of ['B'.repeat(32), "' OR 1=1 --", 'A'.repeat(31), 'A'.repeat(33)]) {
      assert.equal((await request(value)).status, 404);
    }
    assert.equal((await request(token, 'POST')).status, 405);
  } finally { db.close(); }
});

test('privacy preferences remove personal values and displayed text is escaped', async () => {
  const { db, request } = fixture();
  try {
    db.exec('UPDATE owners SET show_name=0, allow_call=0, allow_text=0, allow_email=0');
    let html = await (await request()).text();
    assert.doesNotMatch(html, /Alex|alex@example|12025550123|tel:|sms:|mailto:/);
    db.prepare('UPDATE recovery_tags SET item_label=?').run('<img src=x onerror=alert(1)>');
    db.prepare('UPDATE owners SET show_name=1, display_name=? WHERE id=?').run('<script>alert(1)</script>', 'one');
    html = await (await request()).text();
    assert.match(html, /&lt;img/);
    assert.match(html, /&lt;script&gt;/);
    assert.doesNotMatch(html, /<script>|<img src=x/);
  } finally { db.close(); }
});

test('database outage fails closed', async () => {
  const response = await onRequest({ request: new Request('https://example.com/find/'+token), params: { token }, env: {} });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.doesNotMatch(await response.text(), /tel:|sms:|mailto:|Test Keys/);
});

test('schema enforces token permanence, uniqueness, owner relationships, and lifecycle', () => {
  const { db } = fixture();
  try {
    assert.throws(() => db.prepare('UPDATE recovery_tags SET public_token=?').run('B'.repeat(32)));
    assert.throws(() => db.prepare('INSERT INTO recovery_tags(id,public_token) VALUES(?,?)').run('duplicate', token));
    assert.throws(() => db.exec("UPDATE recovery_tags SET owner_id=NULL"));
    assert.throws(() => db.exec("UPDATE recovery_tags SET status='unclaimed'"));
    assert.throws(() => db.exec("UPDATE recovery_tags SET status='unsupported'"));
    assert.throws(() => db.exec("DELETE FROM owners WHERE id='one'"));
  } finally { db.close(); }
});
