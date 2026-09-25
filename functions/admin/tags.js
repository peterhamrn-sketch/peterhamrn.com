const HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
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
function page(tags) {
  const rows = tags.map(tag => {
    const url = 'https://peterhamrn.com/find/' + tag.public_token;
    return `<tr><td><strong>${escapeHtml(tag.item_label || 'Unlabeled tag')}</strong></td>
<td><span class="status ${escapeHtml(tag.status)}">${escapeHtml(tag.status)}</span></td>
<td><code>${escapeHtml(tag.public_token)}</code></td>
<td class="date">${escapeHtml(formatDate(tag.created_at))}</td>
<td class="date">${escapeHtml(formatDate(tag.updated_at))}</td>
<td class="actions"><button type="button" data-copy="${escapeHtml(url)}">Copy URL</button><a href="${escapeHtml(url)}" target="_blank" rel="noopener">Open Recovery Page</a></td></tr>`;
  }).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive"><title>Recovery Tags Admin | PeterHamRN.com</title>
<style>*{box-sizing:border-box}body{margin:0;background:#071a33;color:#eef5ff;font:16px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}header{padding:18px 24px;border-bottom:1px solid #294461;background:#06162b}header a{color:#fff;text-decoration:none;font-weight:800;font-size:20px}header span{color:#69b7ff}main{max-width:1200px;margin:auto;padding:32px 20px}h1{margin:0 0 8px;font-size:32px}.sub{margin:0 0 24px;color:#adc2d9}.card{background:#0c2748;border:1px solid #294b70;border-radius:16px;overflow:hidden;box-shadow:0 16px 40px #0004}.scroll{overflow-x:auto}table{width:100%;border-collapse:collapse;min-width:960px}th,td{text-align:left;padding:15px 14px;border-bottom:1px solid #294b70;vertical-align:middle}th{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#9fb8d2;background:#0a213d}tr:last-child td{border-bottom:0}code{font-size:12px;color:#cce4ff}.status{display:inline-block;padding:5px 9px;border-radius:999px;background:#263e59;text-transform:capitalize}.status.active{background:#164d38;color:#bff8d8}.status.unclaimed{background:#5a4818;color:#ffe49a}.status.inactive,.status.replaced{background:#5b2930;color:#ffd0d5}.date{white-space:nowrap;font-size:13px;color:#c2d2e3}.actions{white-space:nowrap}.actions a,.actions button{display:inline-block;margin:3px;padding:8px 10px;border:1px solid #5d8fc2;border-radius:8px;background:#12385f;color:#fff;text-decoration:none;font:inherit;cursor:pointer}.count{margin:0 0 12px;color:#c7d7e8}@media(max-width:700px){main{padding:22px 12px}h1{font-size:27px}}</style></head>
<body><header><a href="/">PeterHamRN<span>.com</span></a></header><main><h1>Recovery Tags Admin</h1>
<p class="sub">Read-only view of the recovery-tag database.</p><p class="count">${tags.length} tag${tags.length === 1 ? '' : 's'}</p>
<div class="card"><div class="scroll"><table><thead><tr><th>Item</th><th>Status</th><th>Token</th><th>Created</th><th>Updated</th><th>Actions</th></tr></thead><tbody>${rows || '<tr><td colspan="6">No tags found.</td></tr>'}</tbody></table></div></div></main>
<script>document.addEventListener('click',async e=>{const b=e.target.closest('[data-copy]');if(!b)return;try{await navigator.clipboard.writeText(b.dataset.copy);const old=b.textContent;b.textContent='Copied';setTimeout(()=>b.textContent=old,1200)}catch{prompt('Copy this URL:',b.dataset.copy)}})</script></body></html>`;
}export async function onRequest({ request, env }) {
  const method = request.method;
  if (method !== 'GET' && method !== 'HEAD') {
    return response('<h1>Method not allowed</h1>', 405, method, { Allow: 'GET, HEAD' });
  }
  if (!(await authorized(request, env))) return login(method);
  try {
    const result = await env.RECOVERY_DB.prepare(`
      SELECT id, public_token, item_label, status, created_at, updated_at
      FROM recovery_tags
      ORDER BY created_at ASC
    `).all();
    return response(page(result.results || []), 200, method);
  } catch {
    return response('<!doctype html><title>Recovery Tags Admin</title><h1>Temporarily unavailable</h1><p>The tag database could not be read.</p>', 503, method);
  }
}
