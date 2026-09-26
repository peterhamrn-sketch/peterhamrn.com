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
  if (!tag) return { queue_status: 'done' };
  return { queue_status: 'waiting', id: tag.id, serial: tag.serial_number,
    url: 'https://peterhamrn.com/find/' + tag.public_token };
}
// GLOB's * is unrestricted: also reject every non-digit in the suffix.
const NUMBERED = "serial_number GLOB 'RT-[0-9]*' AND SUBSTR(serial_number, 4) NOT GLOB '*[^0-9]*'";
function serialList(value) {
  if (value === '') return [];
  if (value.length > 6500) return null;
  const serials = value.split(',');
  if (serials.length > 100 || serials.some(s => !/^RT-[0-9]+$/.test(s) || s.length > 64)) return null;
  return [...new Set(serials)];
}
async function reconcile(env, serials) {
  const rows = serials.length ? (await env.RECOVERY_DB.prepare(`
    SELECT serial_number, programmed_at FROM recovery_tags
    WHERE serial_number IN (${serials.map(() => '?').join(',')})
  `).bind(...serials).all()).results : [];
  const bySerial = new Map(rows.map(t => [t.serial_number, t]));
  const failures = serials.flatMap(serial => {
    const tag = bySerial.get(serial);
    return !tag ? [{ serial, reason: 'missing' }] : tag.programmed_at === null
      ? [{ serial, reason: 'not_programmed' }] : [];
  });
  return { reconciliation_status: 'complete', attempted_count: serials.length,
    programmed_count: serials.length - failures.length, failures,
    report: failures.length ? failures.map(f => `${f.serial}: ${f.reason}`).join('\n')
      : serials.length ? `All ${serials.length} attempted tags programmed.` : 'No tags attempted.' };
}
async function nextTag(env, exclude = []) {
  return env.RECOVERY_DB.prepare(`
    SELECT id, public_token, serial_number FROM recovery_tags
    WHERE status IN ('unclaimed', 'active')
      AND ${NUMBERED}
      AND programmed_at IS NULL
    ${exclude.length ? `AND serial_number NOT IN (${exclude.map(() => '?').join(',')})` : ''}
    ORDER BY CAST(SUBSTR(serial_number, 4) AS INTEGER) ASC, serial_number ASC LIMIT 1
  `).bind(...exclude).first();
}
export async function onRequest({ request, env }) {
  if (request.method !== 'GET' && request.method !== 'POST')
    return json({ error: 'method_not_allowed' }, 405);
  if (!(await authorized(request, env))) return json({ error: 'unauthorized' }, 401);
  try {
    if (request.method === 'GET') {
      const params = new URL(request.url).searchParams;
      if (params.has('serials') && params.has('exclude')) return json({ error: 'invalid_query' }, 400);
      const key = params.has('serials') ? 'serials' : 'exclude';
      if (params.getAll(key).length > 1) return json({ error: 'invalid_query' }, 400);
      const serials = serialList(params.get(key) || '');
      if (!serials) return json({ error: 'invalid_serials' }, 400);
      return json(key === 'serials' ? await reconcile(env, serials) : tagPayload(await nextTag(env, serials)));
    }
    const body = await request.json().catch(() => null);
    const id = String(body?.id || '');
    const expectedUrl = String(body?.expected_url || '');
    const scannedUrl = String(body?.scanned_url || '');
    if (!id || !expectedUrl || !scannedUrl) return json({ error: 'missing_fields' }, 400);

    const tag = await env.RECOVERY_DB.prepare(`
      SELECT id, public_token, serial_number, status, programmed_at
      FROM recovery_tags WHERE id = ? LIMIT 1
    `).bind(id).first();
    if (!tag || !['unclaimed', 'active'].includes(tag.status) || !tag.serial_number ||
        !/^RT-\d+$/.test(tag.serial_number) || tag.programmed_at !== null)
      return json({ error: 'tag_not_eligible' }, 409);

    const canonicalUrl = 'https://peterhamrn.com/find/' + tag.public_token;
    if (expectedUrl !== canonicalUrl || scannedUrl !== canonicalUrl)
      return json({ error: 'verification_failed', serial: tag.serial_number }, 409);

    const result = await env.RECOVERY_DB.prepare(`
      UPDATE recovery_tags
      SET programmed_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ? AND status IN ('unclaimed', 'active')
        AND ${NUMBERED} AND programmed_at IS NULL
        AND serial_number = ? AND public_token = ?
    `).bind(id, tag.serial_number, tag.public_token).run();
    if (!result.meta?.changes) return json({ error: 'update_conflict' }, 409);

    return json({ verification_status: 'programmed', serial: tag.serial_number,
      next: tagPayload(await nextTag(env)) });
  } catch {
    return json({ error: 'temporarily_unavailable' }, 503);
  }
}
