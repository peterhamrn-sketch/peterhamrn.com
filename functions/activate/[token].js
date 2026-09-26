const TOKEN=/^[A-Za-z0-9_-]{32}$/;
const EMAIL=/^[^\s@<>"?&#]+@[^\s@<>"?&#]+\.[^\s@<>"?&#]+$/;
const H={'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow, noarchive','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'self'; img-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"};
const E=new TextEncoder(), esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const iso=()=>new Date().toISOString(), plus=n=>new Date(Date.now()+n*60000).toISOString();
function b64(b){let s='';for(const x of b)s+=String.fromCharCode(x);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function random(n=32){const b=new Uint8Array(n);crypto.getRandomValues(b);return b64(b)}
function otp(){const a=new Uint32Array(1);do crypto.getRandomValues(a);while(a[0]>=4294000000);return String(a[0]%1000000).padStart(6,'0')}
async function hash(v){const d=await crypto.subtle.digest('SHA-256',E.encode(v));return [...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function mac(k,v){const key=await crypto.subtle.importKey('raw',E.encode(k),{name:'HMAC',hash:'SHA-256'},false,['sign']);const d=await crypto.subtle.sign('HMAC',key,E.encode(v));return [...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,'0')).join('')}
function ck(r,n){for(const p of (r.headers.get('Cookie')||'').split(';')){const i=p.indexOf('=');if(i>0&&p.slice(0,i).trim()===n)return p.slice(i+1).trim()}return ''}
const normEmail=v=>String(v||'').trim().toLowerCase();
function normPhone(v){const raw=String(v||'').trim(),d=raw.replace(/\D/g,'');if(!d)return '';if(d.length===10)return '+1'+d;if(d.length===11&&d[0]==='1')return '+'+d;if(raw.startsWith('+')&&d.length>=7&&d.length<=15)return '+'+d;return ''}
function page(c,s=200,x={}){return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>Activate Recovery Tag | PeterHamRN.com</title><link rel="icon" type="image/svg+xml" href="/peterhamrn-logo.svg"><link rel="stylesheet" href="/assets/recovery.css?v=20260925b"></head><body><header><a class="brand" href="/"><img src="/peterhamrn-logo.svg" width="38" height="44" alt="">PeterHamRN<span>.com</span></a></header><main><article class="card activation-card"><div class="identity"><img src="/peterhamrn-logo.svg" width="104" height="104" alt="PH shield logo"><p class="eyebrow">Lost item recovery</p></div>${c}</article></main><footer><a class="footer-cta" href="/recovery-tags">Like how this works? Get your own Recovery Tag →</a><div>Peter Ham Solutions · <a href="/">PeterHamRN.com</a></div></footer></body></html>`,{status:s,headers:{...H,...x}})}
const msg=(t,p,s=200)=>page(`<div class="content"><h1>${esc(t)}</h1><p>${esc(p)}</p></div>`,s);
const unavailable=()=>msg('Tag unavailable','This recovery tag cannot be activated.',404);
function emailForm(err=''){return page(`<div class="content"><h1>Activate Your Recovery Tag</h1><p class="activation-copy">Enter your email address. We’ll send a six-digit verification code before any information is saved to this tag.</p>${err?`<p class="form-error">${esc(err)}</p>`:''}<form method="post" class="recovery-form"><input type="hidden" name="action" value="send-code"><label class="field">Email address<input name="email" type="email" inputmode="email" autocomplete="email" required maxlength="254"></label><button class="action" type="submit">SEND VERIFICATION CODE</button></form><p class="note">The code expires in 10 minutes.</p></div>`)}
function codeForm(email,id,err=''){return page(`<div class="content"><h1>Check Your Email</h1><p>Enter the six-digit code sent to <strong>${esc(email)}</strong>.</p>${err?`<p class="form-error">${esc(err)}</p>`:''}<form method="post" class="recovery-form"><input type="hidden" name="action" value="verify-code"><input type="hidden" name="challenge_id" value="${esc(id)}"><input type="hidden" name="email" value="${esc(email)}"><label class="field">Verification code<input name="code" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required></label><button class="action" type="submit">VERIFY CODE</button></form><form method="post" class="recovery-form secondary-form"><input type="hidden" name="action" value="send-code"><input type="hidden" name="email" value="${esc(email)}"><button class="secondary-action" type="submit">SEND A NEW CODE</button></form></div>`)}
function claimForm(email,id,err='',pre={}){return page(`<div class="content"><h1>Finish Activating Your Tag</h1><p class="verified">✓ Email verified: ${esc(email)}</p>${err?`<p class="form-error">${esc(err)}</p>`:''}<form method="post" class="recovery-form"><input type="hidden" name="action" value="claim"><input type="hidden" name="challenge_id" value="${esc(id)}"><label class="field">Your name<input name="display_name" autocomplete="name" value="${esc(pre.display_name||'')}" required maxlength="100"></label><label class="field">Item name<input name="item_label" placeholder="Bike Keys" required maxlength="100"></label><label class="field">Phone number (optional)<input name="phone" type="tel" autocomplete="tel" value="${esc(pre.phone||'')}" maxlength="30"></label><fieldset><legend>What should a finder be able to do?</legend><div class="preference-grid"><label class="check"><input type="checkbox" name="show_name" value="1" ${pre.show_name?'checked':''}> Show my first name</label><label class="check"><input type="checkbox" name="allow_email" value="1" checked> Email me</label><label class="check"><input type="checkbox" name="allow_text" value="1" ${pre.allow_text?'checked':''}> Text me</label><label class="check"><input type="checkbox" name="allow_call" value="1" ${pre.allow_call?'checked':''}> Call me</label></div></fieldset><button class="action" type="submit">CLAIM TAG</button></form></div>`)}
async function tag(env,t){return env.RECOVERY_DB.prepare('SELECT id,status FROM recovery_tags WHERE public_token=? LIMIT 1').bind(t).first()}
async function send(request,env,t,email){
 email=normEmail(email);if(!EMAIL.test(email))return emailForm('Enter a valid email address.');
 if(!env.RESEND_API_KEY||!env.RECOVERY_OTP_SECRET)return msg('Temporarily unavailable','Email verification is not configured. Please try again later.',503);
 const ip=await mac(env.RECOVERY_OTP_SECRET,'ip:'+(request.headers.get('CF-Connecting-IP')||'unknown')),since=new Date(Date.now()-3600000).toISOString();
 const last=await env.RECOVERY_DB.prepare('SELECT created_at FROM recovery_activation_challenges WHERE tag_id=? AND email=? ORDER BY created_at DESC LIMIT 1').bind(t.id,email).first();
 if(last&&Date.now()-Date.parse(last.created_at)<60000)return emailForm('Please wait one minute before requesting another code.');
 const c=await env.RECOVERY_DB.prepare('SELECT COUNT(*) n FROM recovery_activation_challenges WHERE created_at>=? AND (tag_id=? OR email=? OR ip_mac=?)').bind(since,t.id,email,ip).first();
 if(Number(c?.n||0)>=5)return emailForm('Too many verification requests. Please try again later.');
 const id=crypto.randomUUID(),code=otp(),cm=await mac(env.RECOVERY_OTP_SECRET,`${id}:${email}:${code}`);
 await env.RECOVERY_DB.prepare('INSERT INTO recovery_activation_challenges(id,tag_id,email,code_mac,ip_mac,expires_at) VALUES(?,?,?,?,?,?)').bind(id,t.id,email,cm,ip,plus(10)).run();
 const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':id},body:JSON.stringify({from:'Recovery Tags <recovery@peterhamrn.com>',to:[email],reply_to:'recovery@peterhamrn.com',subject:'Your Recovery Tag verification code',text:`Your Recovery Tag verification code is ${code}. It expires in 10 minutes. If you did not request this code, you can ignore this email.`})});
 if(!r.ok){await env.RECOVERY_DB.prepare('DELETE FROM recovery_activation_challenges WHERE id=?').bind(id).run();return msg('Email could not be sent','Please try again in a few minutes.',503)}
 return codeForm(email,id)
}
export async function onRequest({request,params,env}){
 const token=params.token;if(typeof token!=='string'||!TOKEN.test(token))return unavailable();
 if(request.method!=='GET'&&request.method!=='POST')return msg('Method not allowed','',405);
 let t;try{t=await tag(env,token)}catch{return msg('Temporarily unavailable','Please try again shortly.',503)}
 if(!t||t.status!=='unclaimed')return unavailable();if(request.method==='GET')return emailForm();
 const origin=request.headers.get('Origin');if(origin&&origin!=='null'){let host='';try{host=new URL(origin).hostname.toLowerCase()}catch{}if(host!=='peterhamrn.com'&&!host.endsWith('.peterhamrn.com'))return msg('Request blocked','Please open the tag again and retry.',403);}
 let f;try{f=await request.formData()}catch{return msg('Bad request','Please try again.',400)}
 const a=f.get('action');
 if(a==='send-code')return send(request,env,t,f.get('email'));
 if(a==='verify-code'){
  const id=String(f.get('challenge_id')||''),email=normEmail(f.get('email')),code=String(f.get('code')||'').trim();
  const c=await env.RECOVERY_DB.prepare('SELECT * FROM recovery_activation_challenges WHERE id=? AND tag_id=? AND email=? LIMIT 1').bind(id,t.id,email).first();
  if(!c||c.consumed_at||c.verified_at||Date.parse(c.expires_at)<=Date.now())return codeForm(email,id,'That code is invalid or expired. Send a new code.');
  if(c.attempts>=5)return codeForm(email,id,'Too many incorrect attempts. Send a new code.');
  const expected=await mac(env.RECOVERY_OTP_SECRET,`${id}:${email}:${code}`);
  if(!/^[0-9]{6}$/.test(code)||expected!==c.code_mac){await env.RECOVERY_DB.prepare('UPDATE recovery_activation_challenges SET attempts=attempts+1 WHERE id=?').bind(id).run();return codeForm(email,id,'That verification code is not correct.')}
  const session=random(),sh=await hash(session);await env.RECOVERY_DB.prepare('UPDATE recovery_activation_challenges SET verified_at=?,session_hash=?,session_expires_at=? WHERE id=?').bind(iso(),sh,plus(30),id).run();
  const existing=await env.RECOVERY_DB.prepare('SELECT display_name,phone,show_name,allow_call,allow_text,allow_email FROM owners WHERE lower(email)=? ORDER BY created_at ASC LIMIT 1').bind(email).first();const r=claimForm(email,id,'',existing||{});r.headers.set('Set-Cookie',`activation_session=${session}; Path=/activate/${token}; Max-Age=1800; HttpOnly; Secure; SameSite=Strict`);return r;
 }
 if(a==='claim'){
  const id=String(f.get('challenge_id')||''),sh=await hash(ck(request,'activation_session')||'');
  const c=await env.RECOVERY_DB.prepare('SELECT email FROM recovery_activation_challenges WHERE id=? AND tag_id=? AND verified_at IS NOT NULL AND consumed_at IS NULL AND session_hash=? AND session_expires_at>? LIMIT 1').bind(id,t.id,sh,iso()).first();
  if(!c)return msg('Verification expired','Start activation again to receive a new verification code.',403);
  const name=String(f.get('display_name')||'').trim(),item=String(f.get('item_label')||'').trim(),phone=normPhone(f.get('phone')),show=f.get('show_name')==='1'?1:0,ae=f.get('allow_email')==='1'?1:0,at=f.get('allow_text')==='1'?1:0,ac=f.get('allow_call')==='1'?1:0;
  if(!name||!item)return claimForm(c.email,id,'Name and item name are required.');if((at||ac)&&!phone)return claimForm(c.email,id,'Enter a valid phone number to enable calls or texts.');if(!ae&&!at&&!ac)return claimForm(c.email,id,'Choose at least one way for a finder to contact you.');
  const prior=await env.RECOVERY_DB.prepare('SELECT id FROM owners WHERE lower(email)=? ORDER BY created_at ASC LIMIT 1').bind(c.email).first(),owner=prior?.id||crypto.randomUUID();
  const ownerWrite=prior?env.RECOVERY_DB.prepare('UPDATE owners SET display_name=?,phone=?,show_name=?,allow_call=?,allow_text=?,allow_email=?,updated_at=? WHERE id=?').bind(name,phone||null,show,ac,at,ae,iso(),owner):env.RECOVERY_DB.prepare('INSERT INTO owners(id,display_name,phone,email,show_name,allow_call,allow_text,allow_email) VALUES(?,?,?,?,?,?,?,?)').bind(owner,name,phone||null,c.email,show,ac,at,ae);
  try{await env.RECOVERY_DB.batch([
   ownerWrite,
   env.RECOVERY_DB.prepare('INSERT INTO recovery_tag_claims(tag_id,owner_id) VALUES(?,?)').bind(t.id,owner),
   env.RECOVERY_DB.prepare("UPDATE recovery_tags SET owner_id=?,item_label=?,status='active',updated_at=? WHERE id=? AND status='unclaimed' AND owner_id IS NULL").bind(owner,item,iso(),t.id),
   env.RECOVERY_DB.prepare('UPDATE recovery_activation_challenges SET consumed_at=? WHERE id=?').bind(iso(),id)
  ])}catch{return msg('Tag could not be claimed','This tag may already have been activated. Scan it again to check its current status.',409)}
  const cur=await env.RECOVERY_DB.prepare('SELECT owner_id,status FROM recovery_tags WHERE id=?').bind(t.id).first();if(cur?.status!=='active'||cur?.owner_id!==owner)return msg('Tag could not be claimed','This tag may already have been activated. Scan it again to check its current status.',409);
  const ownerSession=random(),ownerHash=await hash(ownerSession);await env.RECOVERY_DB.prepare('INSERT INTO recovery_owner_sessions(session_hash,email,expires_at) VALUES(?,?,?)').bind(ownerHash,c.email,plus(1440)).run();const r=page(`<div class="content"><h1>Tag Activated</h1><p><strong>${esc(item)}</strong> is now active and has been added to your Recovery Tags.</p><div class="actions"><a class="action" href="/tags">MY RECOVERY TAGS</a><a class="action" href="/find/${esc(token)}">VIEW RECOVERY PAGE</a></div></div>`,200);r.headers.append('Set-Cookie','activation_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict');r.headers.append('Set-Cookie',`recovery_owner_session=${ownerSession}; Path=/tags; Max-Age=86400; HttpOnly; Secure; SameSite=Strict`);return r;
 }
 return msg('Bad request','Please try again.',400)
}