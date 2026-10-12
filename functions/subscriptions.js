import {now,plus,esc,random,hash,mac,page,sameOrigin,sendEmail,cookie,session} from './_recovery/subscriptions.js';
import {subscriptionLinkEmail} from './_recovery/subscription-link-email.js';
import {announcementIdentity} from './_recovery/announcement-identities.js';
const labels=new Map([['little-mini','Little Mini'],['recovery-tags','Recovery Tags Updates'],['asm-instructor','ASM Instructor'],['classes-basic','Basic ASM Classes'],['classes-advanced','Advanced ASM Classes']]);
function subscriptionSender(purpose,topics){
 const neutral={from:'PeterHamRN.com <subscriptions@peterhamrn.com>',reply_to:'support@peterhamrn.com'};
 if(purpose==='manage'||!topics.length)return neutral;
 const identities=topics.map(topic=>announcementIdentity([topic])),first=identities[0];
 // A shared topic identity covers Basic/Advanced together. General, mixed-topic
 // confirmation messages use the neutral subscription-system identity.
 return identities.every(i=>i.from===first.from&&i.reply_to===first.reply_to)?{from:first.from,reply_to:first.reply_to}:neutral;
}
const norm=v=>String(v||'').trim().toLowerCase();
const valid=v=>v.length<=254&&/^[^\s@<>"?&#]+@[^\s@<>"?&#]+\.[^\s@<>"?&#]+$/.test(v);
const tokenFormat=v=>/^[a-f0-9]{64}$/.test(v);
const sessionCookie=raw=>`subscription_session=${raw}; Path=/subscriptions; Max-Age=${raw?3600:0}; HttpOnly; Secure; SameSite=Strict`;
async function availableTopics(env){return (await env.RECOVERY_DB.prepare('SELECT id,label FROM subscription_topics WHERE enabled=1 ORDER BY label').all()).results.filter(t=>labels.has(t.id));}
function signup(topics,selected=[],message='',manageOnly=false){
 return page(`<h1>${manageOnly?'Manage My Subscriptions':'Email Updates'}</h1>${message?`<p role="status" class="notice">${esc(message)}</p>`:''}${!manageOnly?`<section><h2>Subscribe to Updates</h2><p>Choose your topics. We’ll email a secure confirmation link—no code to enter. Only selected topics will be enabled after confirmation.</p><form method="post" action="/subscriptions"><input type="hidden" name="action" value="send"><input type="hidden" name="purpose" value="subscribe"><label>Email address<input type="email" name="email" required maxlength="254" autocomplete="email"></label><fieldset><legend>Subscription topics</legend>${topics.map(t=>`<label><input type="checkbox" name="topics" value="${esc(t.id)}" ${selected.includes(t.id)?'checked':''}>${esc(labels.get(t.id))}</label>`).join('')}</fieldset><button>Send Confirmation Link</button></form></section>`:''}<section><h2>Manage My Subscriptions</h2><p>Request a secure access link to view or change your preferences. This does not enroll you in any topic.</p><form method="post" action="/subscriptions"><input type="hidden" name="action" value="send"><input type="hidden" name="purpose" value="manage"><label>Email address<input type="email" name="email" required maxlength="254" autocomplete="email"></label><button>Send Management Link</button></form></section><p><a href="/subscriptions${manageOnly?'':'?manage=1'}">${manageOnly?'Subscribe to updates':'Manage my subscriptions'}</a></p>`);
}
function checkEmail(purpose){return page(`<h1>Check Your Email</h1><p>If your request can be processed, an email with a ${purpose==='manage'?'Manage My Subscriptions':'Confirm My Subscription'} button will arrive shortly. ${purpose==='manage'?'Open it and select Confirm on PeterHamRN.com.':'Click the emailed button to confirm your selected subscriptions immediately.'} No code entry is required.</p><p>The link is single-use and expires in ${purpose==='manage'?'30 minutes':'24 hours'}.</p><p><a href="/subscriptions${purpose==='manage'?'?manage=1':''}">Resend a link</a> if it expires or does not arrive. Wait at least one minute before requesting another.</p>`);}
async function dashboard(env,email,message=''){
 const q=await env.RECOVERY_DB.prepare('SELECT t.id,t.label,COALESCE(s.active,0) active FROM subscription_topics t LEFT JOIN subscriber_topics s ON s.topic_id=t.id AND s.email=? WHERE t.enabled=1 ORDER BY t.label').bind(email).all();
 return page(`<h1>Manage My Subscriptions</h1><p>Signed in as ${esc(email)}</p>${message?`<p role="status" class="notice">${esc(message)}</p>`:''}<form method="post" action="/subscriptions"><input type="hidden" name="action" value="save">${q.results.map(t=>`<label><input type="checkbox" name="topics" value="${esc(t.id)}" ${t.active?'checked':''}>${esc(labels.get(t.id)||t.label)}</label>`).join('')}<button>Save preferences</button></form><form method="post" action="/subscriptions"><input type="hidden" name="action" value="unsubscribe-all"><button>Unsubscribe from everything</button></form><form method="post" action="/subscriptions"><input type="hidden" name="action" value="signout"><button>Sign out</button></form>`);
}
async function linkRecord(env,token){return tokenFormat(token)?env.RECOVERY_DB.prepare('SELECT * FROM subscription_link_challenges WHERE token_hash=?').bind(await hash(token)).first():null;}
const usable=c=>c&&!c.consumed_at&&!c.revoked_at&&c.expires_at>now();
async function selectedFor(env,tokenHash){return (await env.RECOVERY_DB.prepare('SELECT l.topic_id,t.enabled FROM subscription_link_topics l JOIN subscription_topics t ON t.id=l.topic_id WHERE l.token_hash=? ORDER BY l.topic_id').bind(tokenHash).all()).results;}
async function linkScreen(env,token,topics){
 const c=await linkRecord(env,token);
 if(c?.purpose==='subscribe')return await confirmLink(env,token,topics,'subscribe');
 if(!usable(c))return signup(topics,[],'This link is invalid, expired, or already used. Request a fresh link below.',c?.purpose==='manage');
 const selected=await selectedFor(env,c.token_hash);
 return page(`<h1>${c.purpose==='manage'?'Manage My Subscriptions':'Confirm My Subscription'}</h1><p>${c.purpose==='manage'?'Select Confirm to securely sign in and manage only the preferences for the email address that received this link. This does not enroll you.':'Select Confirm to enable only: '+esc(selected.map(t=>labels.get(t.topic_id)||t.topic_id).join(', '))+'. Other preferences will remain unchanged.'}</p><p>Opening this page has not used your link or changed any subscriptions.</p><form method="post" action="/subscriptions"><input type="hidden" name="action" value="confirm-link"><input type="hidden" name="token" value="${esc(token)}"><button>Confirm</button></form><p><a href="/subscriptions${c.purpose==='manage'?'?manage=1':''}">Request a fresh link</a></p>`);
}
async function sendLink(request,env,form,topics){
 const purpose=String(form.get('purpose')||''),email=norm(form.get('email')),selected=[...new Set(form.getAll('topics').map(String))];
 if(!['subscribe','manage'].includes(purpose))return page('<h1>Unknown request</h1>',400);
 const manage=purpose==='manage';
 if(!valid(email))return signup(topics,selected,'Enter a valid email address.',manage);
 if(!manage&&(!selected.length||selected.some(id=>!topics.some(t=>t.id===id))))return signup(topics,selected,'Select at least one available subscription topic.');
 const token=random(),tokenHash=await hash(token),id=crypto.randomUUID(),ip=await mac(env.RECOVERY_OTP_SECRET,request.headers.get('CF-Connecting-IP')||'unknown'),stamp=now(),hourAgo=plus(-60),minuteAgo=plus(-1);
 // Keep rejected deliveries in the ledger so failures and resends cannot bypass
 // the limit. The conditional insert also limits concurrent requests atomically.
 const writes=[env.RECOVERY_DB.prepare(`INSERT INTO subscription_link_challenges(token_hash,id,email,purpose,ip_mac,expires_at,created_at)
  SELECT ?,?,?,?,?,?,? WHERE
  (SELECT COUNT(*) FROM subscription_link_challenges WHERE created_at>? AND (email=? OR ip_mac=?))<5
  AND NOT EXISTS(SELECT 1 FROM subscription_link_challenges WHERE created_at>? AND (email=? OR ip_mac=?))`).bind(tokenHash,id,email,purpose,ip,plus(manage?30:1440),stamp,hourAgo,email,ip,minuteAgo,email,ip)];
 if(!manage)for(const topic of selected)writes.push(env.RECOVERY_DB.prepare('INSERT INTO subscription_link_topics(token_hash,topic_id) SELECT ?,? WHERE EXISTS(SELECT 1 FROM subscription_link_challenges WHERE token_hash=? AND id=?)').bind(tokenHash,topic,tokenHash,id));
 const result=await env.RECOVERY_DB.batch(writes);
 if(!result[0].meta?.changes)return signup(topics,selected,'Please wait before requesting another link. Requests and resends share the same limit.',manage);
 const content=subscriptionLinkEmail(purpose,selected.map(t=>labels.get(t)),purpose==='subscribe'?'https://peterhamrn.com/subscriptions?confirm=1#token='+token:'https://peterhamrn.com/subscriptions?token='+token);
 try{
  const response=await sendEmail(env,id,email,content.subject,content.text,{html:content.html,...subscriptionSender(purpose,selected)},AbortSignal.timeout(15000));
  if(!response.ok){await env.RECOVERY_DB.prepare('UPDATE subscription_link_challenges SET revoked_at=? WHERE token_hash=?').bind(now(),tokenHash).run();return signup(topics,selected,'Email is temporarily unavailable. Please request another link later.',manage);}
 }catch{
  // Acceptance may be unknown. Keep the link usable if its email arrives; never
  // retry the send here or reveal whether the address has a subscriber record.
 }
 return checkEmail(purpose);
}
function confirmationLanding(){
 const response=page('<h1>Confirming Your Subscription</h1><p id="confirmation-progress" role="status">Please wait while your email link is confirmed.</p><noscript><p>Please enable JavaScript and reopen your email link. No code or second confirmation is needed.</p></noscript>');
 return response.text().then(html=>new Response(html.replace('</main>','</main><script src="/assets/subscription-confirm.js" defer></script>'),{headers:{...Object.fromEntries(response.headers),'Referrer-Policy':'origin','Content-Security-Policy':"default-src 'none'; style-src 'self'; script-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"}}));
}
async function subscriptionOutcome(env,c,already=false){
 const rows=(await env.RECOVERY_DB.prepare('SELECT l.topic_id,s.active,s.confirmed_at FROM subscription_link_topics l LEFT JOIN subscriber_topics s ON s.email=? AND s.topic_id=l.topic_id WHERE l.token_hash=? ORDER BY l.topic_id').bind(c.email,c.token_hash).all()).results;
 const confirmed=rows.filter(t=>t.active&&t.confirmed_at),complete=confirmed.length===rows.length&&rows.length>0;
 const response=page(`<h1>${already?'Already Confirmed':"You’re Subscribed!"}</h1><p>${complete?(already?'This email link has already confirmed your subscriptions.':'Your email is confirmed and you’re subscribed to:'):'This link was previously confirmed. Your current preferences may have changed; they have not been re-enabled.'}</p>${confirmed.length?`<ul>${confirmed.map(t=>`<li>${esc(labels.get(t.topic_id)||t.topic_id)}</li>`).join('')}</ul>`:''}<p><a href="/subscriptions?manage=1">Manage subscription preferences</a></p>`);
 response.headers.set('Referrer-Policy','no-referrer');return response;
}
async function confirmLink(env,token,topics,requiredPurpose=''){
 const c=await linkRecord(env,token);
 if(requiredPurpose&&c?.purpose!==requiredPurpose)return page('<h1>Invalid subscription link</h1><p><a href="/subscriptions">Request a fresh confirmation link</a></p>',400);
 if(c?.purpose==='subscribe'&&c.consumed_at&&!c.revoked_at)return await subscriptionOutcome(env,c,true);
 if(!usable(c))return signup(topics,[],'This link is invalid, expired, or already used. Request a fresh link below.',c?.purpose==='manage');
 const selected=await selectedFor(env,c.token_hash);
 if(c.purpose==='subscribe'&&(!selected.length||selected.some(t=>!t.enabled||!labels.has(t.topic_id))))return signup(topics,[],'A selected topic is no longer available. Request a fresh link with your current preferences.');
 const stamp=now(),operation=crypto.randomUUID(),raw=c.purpose==='manage'?random():'',sessionHash=raw?await hash(raw):'';
 // Every side effect is guarded by this unique redemption in one D1 transaction.
 // Concurrent/repeated redemptions cannot reapply opt-ins or create a session.
 const writes=[
  env.RECOVERY_DB.prepare(`UPDATE subscription_link_challenges SET consumed_at=?,consumption_id=? WHERE token_hash=? AND consumed_at IS NULL AND revoked_at IS NULL AND expires_at>? AND (purpose='manage' OR (EXISTS(SELECT 1 FROM subscription_link_topics WHERE token_hash=subscription_link_challenges.token_hash) AND NOT EXISTS(SELECT 1 FROM subscription_link_topics l JOIN subscription_topics t ON t.id=l.topic_id WHERE l.token_hash=subscription_link_challenges.token_hash AND t.enabled!=1)))`).bind(stamp,operation,c.token_hash,stamp),
  env.RECOVERY_DB.prepare('INSERT OR IGNORE INTO subscribers(email) SELECT email FROM subscription_link_challenges WHERE token_hash=? AND consumption_id=?').bind(c.token_hash,operation)
 ];
 if(c.purpose==='manage')writes.push(env.RECOVERY_DB.prepare('INSERT INTO subscription_sessions(session_hash,email,expires_at) SELECT ?,email,? FROM subscription_link_challenges WHERE token_hash=? AND consumption_id=?').bind(sessionHash,plus(60),c.token_hash,operation));
 if(c.purpose==='subscribe')for(const t of selected)writes.push(env.RECOVERY_DB.prepare(`INSERT INTO subscriber_topics(email,topic_id,active,confirmed_at,updated_at) SELECT email,?,1,?,? FROM subscription_link_challenges WHERE token_hash=? AND consumption_id=? AND purpose='subscribe' ON CONFLICT(email,topic_id) DO UPDATE SET active=1,confirmed_at=COALESCE(subscriber_topics.confirmed_at,excluded.confirmed_at),updated_at=excluded.updated_at`).bind(t.topic_id,stamp,stamp,c.token_hash,operation));
 const result=await env.RECOVERY_DB.batch(writes);
 if(!result[0].meta?.changes){const current=await linkRecord(env,token);if(current?.purpose==='subscribe'&&current.consumed_at&&!current.revoked_at)return await subscriptionOutcome(env,current,true);return signup(topics,[],'This link is invalid, expired, or already used. Request a fresh link below.',c.purpose==='manage');}
 if(c.purpose==='subscribe')return await subscriptionOutcome(env,c);
 return new Response(null,{status:303,headers:{Location:'/subscriptions','Cache-Control':'no-store','Set-Cookie':sessionCookie(raw)}});
}
export async function onRequest({request,env}){try{
 if(!['GET','POST'].includes(request.method))return page('<h1>Method not allowed</h1>',405);
 if(!env.RECOVERY_DB||!env.RESEND_API_KEY||!env.RECOVERY_OTP_SECRET)return page('<h1>Email updates are temporarily unavailable</h1>',503);
 const u=new URL(request.url),topics=await availableTopics(env),s=await session(request,env);
 if(request.method==='GET'){
  if(u.searchParams.has('token')){const response=await linkScreen(env,u.searchParams.get('token')||'',topics);const c=await linkRecord(env,u.searchParams.get('token')||'');if(c?.purpose!=='manage')response.headers.set('Referrer-Policy','origin');return response;}
  const topic=u.searchParams.get('topic');
  if(topic){const selected=topic==='classes-both'?['classes-basic','classes-advanced']:[topic];return selected.every(id=>topics.some(t=>t.id===id))?signup(topics,selected):page('<h1>Unknown subscription topic</h1>',404);}
  if(u.searchParams.get('confirm')==='1')return await confirmationLanding();
  return s?await dashboard(env,s.email):signup(topics,[],'',u.searchParams.has('manage'));
 }
 if(!sameOrigin(request))return page('<h1>Request rejected</h1>',403);
 const f=await request.formData(),a=f.get('action');
 if(a==='send')return await sendLink(request,env,f,topics);
 if(a==='confirm-subscription-link')return await confirmLink(env,String(f.get('token')||''),topics,'subscribe');
 if(a==='confirm-link')return await confirmLink(env,String(f.get('token')||''),topics);
 if(a==='verify')return signup(topics,[],'Email codes have been replaced with secure links. Request a fresh link below.');
 if(!s)return signup(topics,[],'Please request an email access link to manage your preferences.',true);
 if(a==='signout'){await env.RECOVERY_DB.prepare('DELETE FROM subscription_sessions WHERE session_hash=?').bind(await hash(cookie(request))).run();const r=signup(topics,[],'Signed out.',true);r.headers.set('Set-Cookie',sessionCookie(''));return r;}
 if(a==='unsubscribe-all'){await env.RECOVERY_DB.prepare('UPDATE subscriber_topics SET active=0,updated_at=? WHERE email=?').bind(now(),s.email).run();return await dashboard(env,s.email,'All subscriptions disabled.');}
 if(a==='save'){
  const selected=new Set(f.getAll('topics').map(String)),enabled=(await env.RECOVERY_DB.prepare('SELECT id FROM subscription_topics WHERE enabled=1').all()).results;
  if([...selected].some(id=>!enabled.some(t=>t.id===id)))return await dashboard(env,s.email,'Choose only currently available subscription topics.');
  await env.RECOVERY_DB.batch(enabled.map(t=>env.RECOVERY_DB.prepare('INSERT INTO subscriber_topics(email,topic_id,active,confirmed_at,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(email,topic_id) DO UPDATE SET active=excluded.active,confirmed_at=CASE WHEN excluded.active=1 THEN COALESCE(subscriber_topics.confirmed_at,excluded.confirmed_at) ELSE subscriber_topics.confirmed_at END,updated_at=excluded.updated_at').bind(s.email,t.id,selected.has(t.id)?1:0,selected.has(t.id)?now():null,now())));
  return await dashboard(env,s.email,'Preferences saved.');
 }
 return page('<h1>Unknown action</h1>',400);
 }catch{return page('<h1>Email updates are temporarily unavailable</h1><p>Please try again later.</p>',503);}}
