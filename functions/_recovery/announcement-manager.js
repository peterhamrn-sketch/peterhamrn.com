import {now,random,hash,esc,page,sendEmail} from './subscriptions.js';
import {emailContent,safeError} from './email-content.js';
const allowed=new Map([['asm-instructor','ASM Instructor'],['classes-basic','Basic ASM Classes'],['classes-advanced','Advanced ASM Classes']]);
const publicationMessage=a=>a.mode==='published'?a.message+'\n\nPublished: '+a.publication_date:a.message;
const fields=a=>`<input type="hidden" name="id" value="${esc(a.id)}"><input type="hidden" name="version" value="${a.version}">`;
function publicURL(value){
 let u;try{u=new URL(value);}catch{throw Error('Use a complete HTTPS link.');}
 if(u.protocol!=='https:'||u.username||u.password)throw Error('Links must use HTTPS without embedded credentials.');
 return u.href;
}
function readLinks(value){
 const lines=String(value||'').trim().split('\n').filter(l=>l.trim());if(lines.length>12)throw Error('Use at most 12 destination links.');
 return lines.map(line=>{const i=line.indexOf('|'),label=i>=0?line.slice(0,i).trim():'Read more',url=publicURL((i>=0?line.slice(i+1):line).trim());if(!label||label.length>120||url.length>2000)throw Error('Each link needs a short label and valid URL.');return {label,url};});
}
const confirmed="s.active=1 AND s.confirmed_at IS NOT NULL AND julianday(s.confirmed_at) IS NOT NULL AND julianday(s.confirmed_at)<=julianday(?) AND t.enabled=1";
async function topicsFor(db,id){return (await db.prepare('SELECT a.topic_id,t.enabled FROM subscription_announcement_topics a JOIN subscription_topics t ON t.id=a.topic_id WHERE a.announcement_id=? ORDER BY a.topic_id').bind(id).all()).results||[];}
async function eligibleTopics(db,id,email){return (await db.prepare(`SELECT DISTINCT s.topic_id FROM subscription_announcement_topics a JOIN subscriber_topics s ON s.topic_id=a.topic_id JOIN subscription_topics t ON t.id=s.topic_id WHERE a.announcement_id=? AND s.email=? COLLATE NOCASE AND ${confirmed}`).bind(id,email,now()).all()).results||[];}
async function publishedContent(a){
 if(a.mode!=='published')return;
 const date=a.publication_date,today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 if(!date||date>today)throw Error('A published update needs its actual publication date, no later than today Eastern.');
 const link=JSON.parse(a.links_json)[0];if(!link)throw Error('A published update needs a direct published-content link.');
 const u=new URL(link.url);
 if(!['peterhamrn.com','classes.peterhamrn.com'].includes(u.hostname)||/^\/(admin|subscriptions|tags|activate|api)(\/|$)/.test(u.pathname))throw Error('Published updates must link to public content on PeterHamRN.com or the Classes website.');
 const response=await fetch(link.url,{method:'GET',redirect:'manual',signal:AbortSignal.timeout(10000)});await response.body?.cancel();
 if(response.status!==200||!response.headers.get('Content-Type')?.includes('text/html'))throw Error('The published-content link must return a public HTML page directly before recipients can be prepared.');
}
export async function announcementSection(env,editID=''){
 const db=env.RECOVERY_DB;
 const announcements=(await db.prepare('SELECT * FROM subscription_announcement_drafts ORDER BY updated_at DESC LIMIT 100').all()).results||[];
 const edit=editID?await db.prepare('SELECT * FROM subscription_announcement_drafts WHERE id=?').bind(editID).first():null;
 const selected=edit?(await topicsFor(db,edit.id)).map(t=>t.topic_id):[];
 const links=edit?JSON.parse(edit.links_json).map(l=>l.label+' | '+l.url).join('\n'):'';
 const editor=edit&&edit.status!=='draft'?'<p>This prepared announcement is locked to preserve recipient approval and duplicate protection. Create a new draft for a genuinely new announcement.</p>':`<form method="post"><input type="hidden" name="action" value="announcement-save"><input type="hidden" name="id" value="${esc(edit?.id||'')}"><input type="hidden" name="version" value="${edit?.version||0}"><label>Announcement method<select name="mode"><option value="standalone" ${edit?.mode!=='published'?'selected':''}>Standalone announcement</option><option value="published" ${edit?.mode==='published'?'selected':''}>Published project update</option></select></label><fieldset><legend>Subscription audience</legend>${[...allowed].map(([id,label])=>`<label><input type="checkbox" name="announcement_topics" value="${id}" ${selected.includes(id)?'checked':''}>${esc(label)}</label>`).join('')}<p>Select ASM Instructor, or Basic and/or Advanced Classes. Software and Classes audiences remain separate.</p></fieldset><label>Email subject / update title<input name="subject" maxlength="180" required value="${esc(edit?.subject||'')}"></label><label>Announcement message / update summary<textarea name="message" maxlength="20000" required>${esc(edit?.message||'')}</textarea></label><label>Actual publication date (published updates only, Eastern)<input type="date" name="publication_date" value="${esc(edit?.publication_date||'')}"></label><label>Destination links (optional for standalone announcements)<textarea name="links" placeholder="Link label | https://peterhamrn.com/page">${esc(links)}</textarea></label><p>For a published update, the first link must point directly to its published page. Nothing is sent by saving, previewing, or preparing.</p><button>Save Draft</button></form>`;
 const cards=await Promise.all(announcements.map(async a=>{
  const groups=(await db.prepare('SELECT status,COUNT(*) n FROM subscription_deliveries WHERE update_id=? GROUP BY status').bind(a.id).all()).results||[],n=status=>Number(groups.find(g=>g.status===status)?.n||0);
  const errors=(await db.prepare('SELECT DISTINCT m.last_error FROM subscription_auto_delivery_meta m WHERE m.update_id=? AND m.last_error IS NOT NULL LIMIT 5').bind(a.id).all()).results||[];
  const preparedRecipients=(await db.prepare('SELECT email,status FROM subscription_deliveries WHERE update_id=? ORDER BY email LIMIT 100').bind(a.id).all()).results||[];
  const audience=(await topicsFor(db,a.id)).map(t=>allowed.get(t.topic_id)||t.topic_id).join(', ');
  const recipients=groups.reduce((sum,g)=>sum+Number(g.n),0);
  let action=a.status==='draft'?'<button name="action" value="announcement-prepare">Prepare Eligible Recipients</button>':a.status==='prepared'?'<button name="action" value="announcement-approve">Approve Sending This Prepared Announcement</button>':a.status==='approved'&&n('pending')?'<button name="action" value="announcement-send">Send Approved Announcement to Next Batch</button>':'';
  return `<section><h3>${esc(a.subject)}</h3><p>${esc(audience)} · ${esc(a.mode==='published'?'Published project update':'Standalone announcement')} · ${esc(a.status)}</p>${a.publication_date?`<p>Published: ${esc(a.publication_date)}</p>`:''}<p>Recipients: ${recipients} · Accepted: ${n('sent')} · Pending: ${n('pending')} · Failed/unconfirmed: ${n('rejected')+n('uncertain')+n('sending')} · Skipped: ${n('skipped')}</p><p><small>Announcement ID: ${esc(a.id)}</small><a href="/admin/subscriptions?preview=${encodeURIComponent(a.id)}">Preview final email</a>${a.status==='draft'?` · <a href="/admin/subscriptions?edit=${encodeURIComponent(a.id)}">Edit draft</a>`:''}</p>${preparedRecipients.length?`<details><summary>Review prepared recipients (up to 100 shown)</summary><div class="scroll"><table><tr><th>Email</th><th>Delivery status</th></tr>${preparedRecipients.map(r=>`<tr><td><!--email_off-->${esc(r.email)}<!--/email_off--></td><td>${esc(r.status)}</td></tr>`).join('')}</table></div></details>`:''}${action?`<form method="post">${fields(a)}${action}</form>`:''}${errors.map(e=>`<p>${esc(e.last_error)}</p>`).join('')}</section>`;
 }));
 return `<h2>ASM Instructor &amp; Classes Announcements</h2><p>Save a draft, preview the email, prepare and review recipients, approve sending, then send. Nothing is sent automatically from page deployments or class changes. Combined Basic/Advanced audiences receive one copy per subscriber.</p>${editor}${cards.join('')||'<p>No announcement drafts yet.</p>'}`;
}
export async function announcementPreview(env,id){
 const a=await env.RECOVERY_DB.prepare('SELECT * FROM subscription_announcement_drafts WHERE id=?').bind(id).first();if(!a)return page('<h1>Announcement not found</h1>',404);
 const content=emailContent(a.subject,publicationMessage(a),JSON.parse(a.links_json),'https://peterhamrn.com/subscriptions-unsubscribe?token=recipient-specific-preview');
 return new Response(content.html.replace('</body>','<p style="text-align:center"><a href="/admin/subscriptions">Back to Subscription Manager</a></p><p style="text-align:center">Preview only. The recipient-specific unsubscribe link is created when sending.</p></body>'),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'"}});
}
export async function announcementAction(env,form){
 const db=env.RECOVERY_DB,action=String(form.get('action')),id=String(form.get('id')||''),version=Number(form.get('version'));
 if(action==='announcement-save'){
  const mode=String(form.get('mode')),subject=String(form.get('subject')||'').trim(),message=String(form.get('message')||'').trim();
  const selected=[...new Set(form.getAll('announcement_topics').map(String))],links=readLinks(form.get('links')),date=String(form.get('publication_date')||'');
  if(!['standalone','published'].includes(mode)||!subject||subject.length>180||/[\r\n]/.test(subject)||!message||message.length>20000||!selected.length||selected.some(t=>!allowed.has(t))||selected.includes('asm-instructor')&&selected.length>1)throw Error('Provide a subject, message, and either ASM Instructor or the selected Classes topics.');
  const parsedDate=new Date(date+'T12:00:00Z');
  if(mode==='published'&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(parsedDate.valueOf())||parsedDate.toISOString().slice(0,10)!==date||!links.length))throw Error('Published updates require a valid publication date and direct link.');
  const operation=crypto.randomUUID();
  const draftID=id||'announcement-'+crypto.randomUUID(),stamp=now();
  const edit=id?await db.prepare('SELECT status,version FROM subscription_announcement_drafts WHERE id=?').bind(id).first():null;
  if(id&&(!edit||edit.status!=='draft'||edit.version!==version))throw Error('This draft changed or is already prepared. Reload before editing.');
  const write=id?db.prepare("UPDATE subscription_announcement_drafts SET mode=?,subject=?,message=?,links_json=?,publication_date=?,version=version+1,updated_at=?,operation_id=? WHERE id=? AND status='draft' AND version=?").bind(mode,subject,message,JSON.stringify(links),mode==='published'?date:null,stamp,operation,id,version):db.prepare("INSERT INTO subscription_announcement_drafts(id,mode,subject,message,links_json,publication_date,created_at,updated_at,operation_id) VALUES(?,?,?,?,?,?,?,?,?)").bind(draftID,mode,subject,message,JSON.stringify(links),mode==='published'?date:null,stamp,stamp,operation);
  const guardVersion=id?version+1:1;
  const results=await db.batch([write,db.prepare('DELETE FROM subscription_announcement_topics WHERE announcement_id=? AND EXISTS(SELECT 1 FROM subscription_announcement_drafts WHERE id=? AND version=? AND operation_id=?)').bind(draftID,draftID,guardVersion,operation),...selected.map(topic=>db.prepare('INSERT OR IGNORE INTO subscription_announcement_topics(announcement_id,topic_id) SELECT ?,? WHERE EXISTS(SELECT 1 FROM subscription_announcement_drafts WHERE id=? AND version=? AND operation_id=?)').bind(draftID,topic,draftID,guardVersion,operation))]);
  if(!results[0].meta?.changes)throw Error('Draft changed in another session. Reload.');return 'Draft saved. No email was sent.';
 }
 const a=await db.prepare('SELECT * FROM subscription_announcement_drafts WHERE id=?').bind(id).first();
 if(!a||a.version!==version)throw Error('Announcement changed. Reload before continuing.');
 if(action==='announcement-prepare'){
  if(a.status!=='draft')throw Error('Only drafts can be prepared.');
  const topics=await topicsFor(db,id);if(!topics.length||topics.some(t=>!t.enabled))throw Error('Every selected subscription topic must be enabled.');
  await publishedContent(a);
  const stamp=now(),first=topics[0].topic_id,links=JSON.parse(a.links_json),publishedAt=a.mode==='published'?a.publication_date+'T12:00:00.000Z':stamp;
  const results=await db.batch([
   db.prepare("UPDATE subscription_announcement_drafts SET status='prepared',version=version+1,updated_at=? WHERE id=? AND version=? AND status='draft'").bind(stamp,id,version),
   db.prepare("INSERT OR IGNORE INTO subscription_updates(id,topic_id,title,url,published_at,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM subscription_announcement_drafts WHERE id=? AND status='prepared' AND version=? AND updated_at=?)").bind(id,first,a.subject,links[0]?.url||'https://peterhamrn.com/',publishedAt,stamp,id,version+1,stamp),
   db.prepare(`INSERT OR IGNORE INTO subscription_deliveries(update_id,email,status,created_at) SELECT DISTINCT ?,lower(s.email),'pending',? FROM subscription_announcement_topics a JOIN subscriber_topics s ON s.topic_id=a.topic_id JOIN subscription_topics t ON t.id=s.topic_id WHERE a.announcement_id=? AND ${confirmed} AND EXISTS(SELECT 1 FROM subscription_updates WHERE id=? AND audience_frozen=0)`).bind(id,stamp,id,stamp,id),
   db.prepare('UPDATE subscription_updates SET audience_frozen=1 WHERE id=?').bind(id)
  ]);
  if(!results[0].meta?.changes)throw Error('Announcement changed before preparation. Reload.');return 'Eligible recipients prepared and deduplicated. Review the preview and counts, then explicitly approve sending.';
 }
 if(action==='announcement-approve'){
  const approved=await db.prepare("UPDATE subscription_announcement_drafts SET status='approved',approved_at=?,version=version+1,updated_at=? WHERE id=? AND status='prepared' AND version=? RETURNING id").bind(now(),now(),id,version).first();
  if(!approved)throw Error('Prepare the recipients before approving.');return 'Sending approved. Select Send Approved Announcement to deliver the prepared email.';
 }
 if(action!=='announcement-send'||a.status!=='approved'||!a.approved_at)throw Error('Explicit approval of the prepared announcement is required before sending.');
 if(!env.RESEND_API_KEY)throw Error('Resend is not configured.');
 const recipients=(await db.prepare("SELECT email FROM subscription_deliveries WHERE update_id=? AND status='pending' ORDER BY email LIMIT 10").bind(id).all()).results||[];
 let accepted=0,failed=0,skipped=0;
 for(const recipient of recipients){
  const email=recipient.email,claim=await db.prepare("UPDATE subscription_deliveries SET status='sending' WHERE update_id=? AND email=? AND status='pending' RETURNING email").bind(id,email).first();if(!claim)continue;
  try{
   const scopes=await eligibleTopics(db,id,email);
   if(!scopes.length){skipped++;await db.prepare("UPDATE subscription_deliveries SET status='skipped' WHERE update_id=? AND email=?").bind(id,email).run();continue;}
   let meta=await db.prepare('SELECT * FROM subscription_auto_delivery_meta WHERE update_id=? AND email=?').bind(id,email).first();
   if(!meta){
    const token=random(),tokenHash=await hash(token),link='https://peterhamrn.com/subscriptions-unsubscribe?token='+token;
    const content=emailContent(a.subject,publicationMessage(a),JSON.parse(a.links_json),link);
    await db.batch([db.prepare('INSERT INTO subscription_unsubscribe(token_hash,email,topic_id,created_at) VALUES(?,?,?,?)').bind(tokenHash,email,scopes[0].topic_id,now()),...scopes.map(t=>db.prepare('INSERT INTO subscription_unsubscribe_scopes(token_hash,topic_id) VALUES(?,?)').bind(tokenHash,t.topic_id)),db.prepare('INSERT INTO subscription_auto_delivery_meta(update_id,email,payload_json,idempotency_key) VALUES(?,?,?,?)').bind(id,email,JSON.stringify(content),'manual-'+await hash(id+':'+email))]);
    meta=await db.prepare('SELECT * FROM subscription_auto_delivery_meta WHERE update_id=? AND email=?').bind(id,email).first();
   }
   await db.prepare('UPDATE subscription_auto_delivery_meta SET first_attempt_at=COALESCE(first_attempt_at,?),last_attempt_at=?,last_error=NULL WHERE update_id=? AND email=?').bind(now(),now(),id,email).run();
   if(!(await eligibleTopics(db,id,email)).length){skipped++;await db.prepare("UPDATE subscription_deliveries SET status='skipped' WHERE update_id=? AND email=?").bind(id,email).run();continue;}
   const content=JSON.parse(meta.payload_json),response=await sendEmail(env,meta.idempotency_key,email,content.subject,content.text,{html:content.html,headers:content.headers},AbortSignal.timeout(15000));
   const data=await response.json().catch(()=>({})),ok=response.ok&&typeof data.id==='string'&&!!data.id;
   const state=ok?'sent':response.status>=400&&response.status<500&&response.status!==409?'rejected':'uncertain';
   const error=ok?null:safeError('Resend HTTP '+response.status+'; '+(data.name||'')+': '+(data.message||'Acceptance unconfirmed'));
   await db.batch([db.prepare('UPDATE subscription_deliveries SET status=?,resend_id=? WHERE update_id=? AND email=?').bind(state,ok?data.id:null,id,email),db.prepare('UPDATE subscription_auto_delivery_meta SET last_error=? WHERE update_id=? AND email=?').bind(error,id,email)]);
   if(ok)accepted++;else failed++;
  }catch(error){failed++;await db.batch([db.prepare("UPDATE subscription_deliveries SET status='uncertain' WHERE update_id=? AND email=?").bind(id,email),db.prepare('UPDATE subscription_auto_delivery_meta SET last_error=? WHERE update_id=? AND email=?').bind(safeError(error),id,email)]);}
  await new Promise(resolve=>setTimeout(resolve,600));
 }
 const remaining=await db.prepare("SELECT COUNT(*) n FROM subscription_deliveries WHERE update_id=? AND status NOT IN ('sent','skipped')").bind(id).first();
 if(!remaining.n)await db.prepare("UPDATE subscription_announcement_drafts SET status='sent',updated_at=? WHERE id=? AND status='approved'").bind(now(),id).run();
 return `Batch complete: ${accepted} accepted by Resend, ${failed} failed or unconfirmed, ${skipped} skipped. Accepted recipients will not be resent. Failures remain held for review.`;
}
