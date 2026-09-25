const HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer'
};
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: HEADERS });
}
async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}
async function authorized(request, env) {
  if (!env.RECOVERY_PROGRAMMER_TOKEN) return false;
  const header = request.headers.get('Authorization') || '';
  if (!header.startsWith('Bearer ')) return false;
  return (await sha256(header.slice(7))) === (await sha256(env.RECOVERY_PROGRAMMER_TOKEN));
}
function tagPayload(tag) {
  if (!tag) return { done: true };
  return { done: false, id: tag.id, serial: tag.serial_number,
    url: 'https://peterhamrn.com/find/' + tag.public_token };
}
async function nextTag(env) {
  return env.RECOVERY_DB.prepare(`
    SELECT id, public_token, serial_number FROM recovery_tags
    WHERE status = 'unclaimed'
      AND serial_number GLOB 'RT-[0-9]*'
      AND programmed_at IS NULL
    ORDER BY CAST(SUBSTR(serial_number, 4) AS INTEGER) ASC LIMIT 1
  `).first();
}
export async function onRequest({ request, env }) {
  if (request.method !== 'GET' && request.method !== 'POST')
    return json({ error: 'method_not_allowed' }, 405);
  if (!(await authorized(request, env))) return json({ error: 'unauthorized' }, 401);
  try {
    if (request.method === 'GET') return json(tagPayload(await nextTag(env)));
    const body = await request.json().catch(() => null);
    const id = String(body?.id || '');
    const expectedUrl = String(body?.expected_url || '');
    const scannedUrl = String(body?.scanned_url || '');
    if (!id || !expectedUrl || !scannedUrl) return json({ error: 'missing_fields' }, 400);

    const tag = await env.RECOVERY_DB.prepare(`
      SELECT id, public_token, serial_number, status, programmed_at
      FROM recovery_tags WHERE id = ? LIMIT 1
    `).bind(id).first();
    if (!tag || tag.status !== 'unclaimed' || !tag.serial_number ||
        !/^RT-\d+$/.test(tag.serial_number) || tag.programmed_at)
      return json({ error: 'tag_not_eligible' }, 409);

    const canonicalUrl = 'https://peterhamrn.com/find/' + tag.public_token;
    if (expectedUrl !== canonicalUrl || scannedUrl !== canonicalUrl)
      return json({ error: 'verification_failed', serial: tag.serial_number }, 409);

    const result = await env.RECOVERY_DB.prepare(`
      UPDATE recovery_tags
      SET programmed_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ? AND status = 'unclaimed'
        AND serial_number GLOB 'RT-[0-9]*' AND programmed_at IS NULL
    `).bind(id).run();
    if (!result.meta?.changes) return json({ error: 'update_conflict' }, 409);

    return json({ programmed: true, serial: tag.serial_number,
      next: tagPayload(await nextTag(env)) });
  } catch {
    return json({ error: 'temporarily_unavailable' }, 503);
  }
}
