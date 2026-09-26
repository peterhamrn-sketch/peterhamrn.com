const HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
};
const ADMIN_USER = 'peter';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  })[c]);
}
async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}
async function authorized(request, env) {
  if (!env.RECOVERY_ADMIN_PASSWORD) return false;
  const header = request.headers.get('Authorization') || '';
  if (!header.startsWith('Basic ')) return false;
  try {
    const decoded = atob(header.slice(6));
    const split = decoded.indexOf(':');
    if (split < 0 || decoded.slice(0, split) !== ADMIN_USER) return false;
    return (await sha256(decoded.slice(split + 1))) === (await sha256(env.RECOVERY_ADMIN_PASSWORD));
  } catch { return false; }
}function response(body, status = 200, method = 'GET', extra = {}) {
  return new Response(method === 'HEAD' ? null : body, { status, headers: { ...HEADERS, ...extra } });
}
function login(method) {
  return response('<!doctype html><title>Recovery Tags Admin</title><h1>Authorization required</h1>', 401, method, {
    'WWW-Authenticate': 'Basic realm="Recovery Tags Admin", charset="UTF-8"'
  });
}
function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.valueOf()) ? String(value) : d.toLocaleString('en-US', {
    year:'numeric', month:'short', day:'numeric', hour:'numeric', minute:'2-digit', timeZone:'America/New_York'
  });
}
function randomBase64Url(byteLength = 24) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function page(tags, createdUrl = '', message = '') {
  const numbered = t => /^RT-[0-9]+$/.test(t.serial_number || '');
  const waiting = tags.filter(t => ['active', 'unclaimed'].includes(t.status) && numbered(t) && t.programmed_at === null)
    .sort((a, b) => Number(a.serial_number.slice(3)) - Number(b.serial_number.slice(3)) || a.serial_number.localeCompare(b.serial_number));
  const programmed = tags.filter(t => numbered(t) && t.programmed_at !== null);
  const next = waiting[0];
  const nextUrl = next ? 'https://peterhamrn.com/find/' + next.public_token : '';
  const rows = tags.map(tag => {
    const url = 'https://peterhamrn.com/find/' + tag.public_token;
    const lifecycle = tag.status === 'active' ? 'active' : (tag.status === 'unclaimed' && tag.programmed_at !== null ? 'unclaimed' : (tag.status === 'unclaimed' && tag.programmed_at === null ? 'not-provisioned' : tag.status));
    const lifecycleLabel = lifecycle === 'not-provisioned' ? 'Not Provisioned' : (lifecycle === 'unclaimed' ? 'Ready / Unclaimed' : lifecycle);
    return `<tr class="tag-row ${escapeHtml(lifecycle)}"><td><strong>${escapeHtml(tag.item_label || 'Unlabeled tag')}</strong></td>
<td><span class="status ${escapeHtml(lifecycle)}">${escapeHtml(lifecycleLabel)}</span></td>
<td>${tag.serial_number ? `<a class="serial-link" href="/admin/tag?serial=${encodeURIComponent(tag.serial_number)}"><strong>${escapeHtml(tag.serial_number)}</strong></a>` : '—'}</td>
<td><code>${escapeHtml(tag.public_token)}</code></td>
<td class="date">${escapeHtml(formatDate(tag.created_at))}</td>
<td class="date">${escapeHtml(formatDate(tag.updated_at))}</td>
<td class="date">${escapeHtml(formatDate(tag.programmed_at))}</td>
<td class="actions"><button type="button" data-copy="${escapeHtml(url)}">Copy URL</button><a href="${escapeHtml(url)}" target="_blank" rel="noopener">Open Recovery Page</a></td></tr>`;
  }).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive"><title>Recovery Tags Admin | PeterHamRN.com</title>
<style>*{box-sizing:border-box}body{margin:0;background:#071a33;color:#eef5ff;font:16px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}header{padding:18px 24px;border-bottom:1px solid #294461;background:#06162b}header a{color:#fff;text-decoration:none;font-weight:800;font-size:20px}header span{color:#69b7ff}main{max-width:1200px;margin:auto;padding:32px 20px}h1{margin:0 0 8px;font-size:32px}.sub{margin:0 0 24px;color:#adc2d9}.card{background:#0c2748;border:1px solid #294b70;border-radius:16px;overflow:hidden;box-shadow:0 16px 40px #0004}.scroll{overflow-x:auto}table{width:100%;border-collapse:collapse;min-width:960px}th,td{text-align:left;padding:15px 14px;border-bottom:1px solid #294b70;vertical-align:middle}th{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#9fb8d2;background:#0a213d}tr:last-child td{border-bottom:0}code{font-size:12px;color:#cce4ff}.status{display:inline-block;padding:5px 9px;border-radius:999px;background:#263e59;text-transform:capitalize}.status.active{background:#164d38;color:#bff8d8}.status.unclaimed{background:#5a4818;color:#ffe49a}.status.not-provisioned,.status.inactive,.status.replaced{background:#5b2930;color:#ffd0d5}.tag-row.active{background:#0d2f2a}.tag-row.unclaimed{background:#332d18}.tag-row.not-provisioned{background:#351e27}.date{white-space:nowrap;font-size:13px;color:#c2d2e3}.create{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:0 0 20px}.create button,.created button,.created a{padding:9px 12px;border:1px solid #5d8fc2;border-radius:8px;background:#12385f;color:#fff;text-decoration:none;font:inherit;cursor:pointer}.create span{color:#adc2d9;font-size:14px}.create input{width:90px;padding:9px;border:1px solid #5d8fc2;border-radius:8px;background:#061a31;color:#fff;font:inherit}.queue{padding:20px;margin:0 0 22px}.queue h2{margin:0 0 8px}.queue .url{display:block;margin:12px 0;overflow-wrap:anywhere}.queue form{display:inline}.created{padding:12px;border:1px solid #4b6f93;border-radius:10px;background:#0a213d;overflow-wrap:anywhere}.actions{white-space:nowrap}.actions a,.actions button{display:inline-block;margin:2px;padding:7px 8px;border:1px solid #5d8fc2;border-radius:8px;background:#12385f;color:#fff;text-decoration:none;font:inherit;cursor:pointer}.count{margin:0 0 12px;color:#c7d7e8}.scroll table{min-width:0;table-layout:auto}.scroll th,.scroll td{padding:12px 9px}.scroll code{font-size:11px;overflow-wrap:anywhere}.scroll th:nth-child(4),.scroll td:nth-child(4){max-width:225px}.scroll th:nth-child(5),.scroll td:nth-child(5),.scroll th:nth-child(6),.scroll td:nth-child(6),.scroll th:nth-child(7),.scroll td:nth-child(7){font-size:12px}@media(max-width:900px){.scroll th:nth-child(4),.scroll td:nth-child(4){max-width:170px}.actions a,.actions button{padding:6px;font-size:14px}}@media(max-width:700px){main{padding:22px 12px}h1{font-size:27px}.scroll{overflow-x:auto}.scroll table{min-width:850px}}</style></head>
<body><header><a href="/">PeterHamRN<span>.com</span></a></header><main><h1>Recovery Tags Admin</h1>
<p class="sub">Provision, program, and manage Recovery Tags.</p>
<form method="post" class="create"><input type="hidden" name="action" value="provision"><label>Quantity <input name="quantity" type="number" min="1" max="100" value="50"></label><button type="submit">Provision Tags</button><span>Creates unclaimed tags with permanent URLs and serial numbers.</span></form>
${message ? `<p class="created">${escapeHtml(message)}</p>` : ''}
<div class="card queue"><h2>Programming Queue</h2><p>${waiting.length} waiting to be programmed · ${programmed.length} programmed</p>
${next ? `<p><strong>Next: ${escapeHtml(next.serial_number || 'Unnumbered tag')}</strong></p><code class="url">${escapeHtml(nextUrl)}</code><button type="button" data-copy="${escapeHtml(nextUrl)}">Copy URL</button> <a href="${escapeHtml(nextUrl)}" target="_blank" rel="noopener">Open</a> <form method="post"><input type="hidden" name="action" value="mark-programmed"><input type="hidden" name="tag_id" value="${escapeHtml(next.id)}"><button type="submit">Mark Programmed &amp; Next</button></form>` : '<p>Nothing is waiting to be programmed.</p>'}</div>
<form method="post" class="create"><input type="hidden" name="action" value="create-test"><button type="submit">Create Test Tag</button><span>Creates one unclaimed test record.</span></form>
${createdUrl ? `<p class="created"><strong>Test tag created:</strong> <code>${escapeHtml(createdUrl)}</code> <button type="button" data-copy="${escapeHtml(createdUrl)}">Copy URL</button> <a href="${escapeHtml(createdUrl)}" target="_blank" rel="noopener">Open</a></p>` : ''}
<p class="count">${tags.length} tag${tags.length === 1 ? '' : 's'}</p>
<div class="card"><div class="scroll"><table><thead><tr><th>Item</th><th>Status</th><th>Serial</th><th>Token</th><th>Created</th><th>Updated</th><th>Programmed</th><th>Actions</th></tr></thead><tbody>${rows || '<tr><td colspan="8">No tags found.</td></tr>'}</tbody></table></div></div></main>
<script>document.addEventListener('click',async e=>{const b=e.target.closest('[data-copy]');if(!b)return;try{await navigator.clipboard.writeText(b.dataset.copy);const old=b.textContent;b.textContent='Copied';setTimeout(()=>b.textContent=old,1200)}catch{prompt('Copy this URL:',b.dataset.copy)}})</script></body></html>`;
}export async function onRequest({ request, env }) {
  const method = request.method;
  if (method !== 'GET' && method !== 'HEAD' && method !== 'POST') {
    return response('<h1>Method not allowed</h1>', 405, method, { Allow: 'GET, HEAD, POST' });
  }
  if (!(await authorized(request, env))) return login(method);
  try {
    let createdUrl = '';
    let message = '';
    if (method === 'POST') {
      const form = await request.formData();
      const action = form.get('action');
      if (action === 'create-test') {
        const token = randomBase64Url();
        const id = crypto.randomUUID();
        await env.RECOVERY_DB.prepare(`INSERT INTO recovery_tags (id, public_token, item_label, status) VALUES (?, ?, ?, 'unclaimed')`)
          .bind(id, token, 'Test Tag').run();
        createdUrl = 'https://peterhamrn.com/find/' + token;
      } else if (action === 'provision') {
        const quantity = Math.max(1, Math.min(100, Number(form.get('quantity')) || 1));
        const max = await env.RECOVERY_DB.prepare(`SELECT COALESCE(MAX(CAST(SUBSTR(serial_number,4) AS INTEGER)),0) AS n FROM recovery_tags WHERE serial_number GLOB 'RT-[0-9]*'`).first();
        const start = Number(max?.n || 0) + 1;
        const stmts = [];
        for (let i = 0; i < quantity; i++) {
          const serial = 'RT-' + String(start + i).padStart(4, '0');
          stmts.push(env.RECOVERY_DB.prepare(`INSERT INTO recovery_tags (id, public_token, item_label, status, serial_number) VALUES (?, ?, ?, 'unclaimed', ?)`).bind(crypto.randomUUID(), randomBase64Url(), 'Recovery Tag', serial));
        }
        await env.RECOVERY_DB.batch(stmts);
        message = `Provisioned ${quantity} tag${quantity === 1 ? '' : 's'}.`;
      } else if (action === 'mark-programmed') {
        const id = String(form.get('tag_id') || '');
        const result = await env.RECOVERY_DB.prepare(`UPDATE recovery_tags SET programmed_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND status IN ('unclaimed', 'active') AND serial_number GLOB 'RT-[0-9]*' AND SUBSTR(serial_number, 4) NOT GLOB '*[^0-9]*' AND programmed_at IS NULL`).bind(id).run();
        if (!result.meta?.changes) return response('<h1>Tag was not eligible to mark programmed.</h1>', 409, method);
        message = 'Tag marked programmed. The next tag is ready.';
      } else return response('<h1>Bad request</h1>', 400, method);
    }
    const result = await env.RECOVERY_DB.prepare(`
      SELECT id, public_token, item_label, status, serial_number, programmed_at, created_at, updated_at
      FROM recovery_tags
      ORDER BY created_at ASC
    `).all();
    return response(page(result.results || [], createdUrl, message), 200, method);
  } catch {
    return response('<!doctype html><title>Recovery Tags Admin</title><h1>Temporarily unavailable</h1><p>The tag database could not be read.</p>', 503, method);
  }
}
