const TOKEN = /^[A-Za-z0-9_-]{32}$/;
const HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; style-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function page(content, status, method, extraHeaders = {}) {
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#061d3c"><meta name="robots" content="noindex,nofollow,noarchive"><title>Found keys | PeterHamRN.com</title><link rel="icon" type="image/svg+xml" href="/peterhamrn-logo.svg"><link rel="stylesheet" href="/assets/recovery.css"></head>
<body><header><a class="brand" href="/"><img src="/peterhamrn-logo.svg" width="38" height="44" alt="">PeterHamRN<span>.com</span></a></header>
<main><article class="card"><div class="identity"><img src="/peterhamrn-logo.svg" width="104" height="104" alt="PH shield logo"><p class="eyebrow">Lost item recovery</p></div>${content}</article></main>
<footer>Peter Ham Solutions · <a href="/">PeterHamRN.com</a></footer></body></html>`;
  return new Response(method === 'HEAD' ? null : html, {
    status, headers: { ...HEADERS, ...extraHeaders }
  });
}

function unavailable(method) {
  return page('<div class="content"><h1>Tag unavailable</h1><p>No contact details are available for this tag.</p></div>', 404, method);
}

export async function onRequest({ request, params, env }) {
  const method = request.method;
  if (method !== 'GET' && method !== 'HEAD') {
    return page('<div class="content"><h1>Method not allowed</h1></div>', 405, method, { Allow: 'GET, HEAD' });
  }
  if (typeof params.token !== 'string' || !TOKEN.test(params.token)) return unavailable(method);

  let tag;
  try {
    tag = await env.RECOVERY_DB.prepare(`
      SELECT t.item_label, o.display_name, o.phone, o.email,
             o.show_name, o.allow_call, o.allow_text, o.allow_email
      FROM recovery_tags AS t
      JOIN owners AS o ON o.id = t.owner_id
      WHERE t.public_token = ? AND t.status = 'active'
      LIMIT 1
    `).bind(params.token).first();
  } catch {
    // Fail closed without logging tokens, database details, or owner information.
    return page('<div class="content"><h1>Temporarily unavailable</h1><p>Please try this tag again shortly.</p></div>', 503, method);
  }
  if (!tag) return unavailable(method);

  const firstName = tag.show_name === 1 ? String(tag.display_name || '').trim().split(/\s+/)[0] : '';
  const recipient = firstName ? ` ${firstName.toUpperCase()}` : ' OWNER';
  const phone = /^\+[1-9][0-9]{6,14}$/.test(tag.phone || '') ? tag.phone : '';
  const email = /^[^\s@<>"?&#]+@[^\s@<>"?&#]+\.[^\s@<>"?&#]+$/.test(tag.email || '') ? tag.email : '';
  const actions = [];
  const link = (href, label) => `<a class="action" href="${escapeHtml(href)}">${escapeHtml(label)}</a>`;
  if (tag.allow_call === 1 && phone) actions.push(link(`tel:${phone}`, `CALL${recipient}`));
  if (tag.allow_text === 1 && phone) actions.push(link(`sms:${phone}`, `TEXT${recipient}`));
  if (tag.allow_email === 1 && email) actions.push(link(`mailto:${encodeURIComponent(email).replace('%40', '@')}`, `EMAIL${recipient}`));

  return page(`<div class="content"><h1>Thanks for finding my keys!</h1>
<p class="item">${escapeHtml(tag.item_label)}</p>
${firstName ? `<p class="owner">${escapeHtml(firstName)}</p>` : ''}
<div class="actions">${actions.join('') || '<p>No contact options are currently available.</p>'}</div>
<p class="note">Thank you for helping these keys find their way home.</p></div>`, 200, method);
}
