import {now,random,hash,esc,page,sendEmail} from './subscriptions.js';
import {emailContent,safeError} from './email-content.js';
import {announcementTopics as allowed,announcementIdentity,deliveryExtras} from './announcement-identities.js';
const publicationMessage=a=>a.mode==='published'?a.message+'\n\nPublished: '+a.publication_date:a.message;
const fields=a=>`<input type="hidden" name="id" value="${esc(a.id)}"><input type="hidden" name="version" value="${a.version}">`;
const root='/admin/subscriptions';
const modified=value=>new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',dateStyle:'medium',timeStyle:'short'}).format(new Date(value))+' Eastern';
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
async function identityFor(db,a){
 const topics=(await topicsFor(db,a.id)).map(t=>t.topic_id);
 const sender=await db.prepare('SELECT topic_id FROM subscription_announcement_senders WHERE announcement_id=?').bind(a.id).first();
 return announcementIdentity(topics,sender?.topic_id||'');
}
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
function readDraft(form){
 const mode=String(form.get('mode')),subject=String(form.get('subject')||'').trim(),message=String(form.get('message')||'').trim();
 const selected=[...new Set(form.getAll('announcement_topics').map(String))],links=readLinks(form.get('links')),date=String(form.get('publication_date')||'');
 if(!['standalone','published'].includes(mode)||!subject||subject.length>180||/[\r\n]/.test(subject)||!message||message.length>20000)throw Error('Provide a subject and message within the displayed limits.');
 const identity=announcementIdentity(selected,String(form.get('sender_topic')||'')),parsedDate=new Date(date+'T12:00:00Z');
 if(mode==='published'&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(parsedDate.valueOf())||parsedDate.toISOString().slice(0,10)!==date||!links.length))throw Error('Published updates require a valid publication date and direct link.');
 return {id:String(form.get('id')||''),version:Number(form.get('version')||0),mode,subject,message,selected,links_json:JSON.stringify(links),publication_date:mode==='published'?date:null,sender_topic:identity.topic,identity,status:'draft'};
}
export function draftBuffer(form){
 // Keep unsaved text visible after a harmless preview or a validation error.
 return {id:String(form.get('id')||''),version:Number(form.get('version')||0),mode:String(form.get('mode')||'standalone'),subject:String(form.get('subject')||''),message:String(form.get('message')||''),selected:form.getAll('announcement_topics').map(String),links_text:String(form.get('links')||''),publication_date:String(form.get('publication_date')||''),sender_topic:String(form.get('sender_topic')||''),status:'draft'};
}
function previewMarkup(a,identity,frozen=null){
 const content=frozen||emailContent(a.subject,publicationMessage(a),JSON.parse(a.links_json),null,identity);
 return `<section class="email-preview" id="email-preview"><h2>Email Preview</h2><dl class="preview-meta"><dt>From</dt><dd>${esc(identity.from)}</dd><dt>Reply-To</dt><dd>${esc(identity.reply_to)}</dd><dt>Subject</dt><dd>${esc(a.subject)}</dd><dt>Topic</dt><dd>${esc(identity.label)}</dd></dl><p>Preview only. No email is sent. ${frozen?'This shows the existing immutable delivery payload. ':''}Actual unsubscribe links are unique to each recipient and cover only their eligible topics in this announcement.</p><div class="email-body">${content.html.match(/<body[^>]*>([\s\S]*)<\/body>/)[1]}</div><details><summary>Plain-text version</summary><pre>${esc(content.text)}</pre></details></section>`;
}
function editorMarkup(a={}){
 const selected=a.selected||[],links=a.links_text??(a.links_json?JSON.parse(a.links_json).map(l=>l.label+' | '+l.url).join('\n'):'');
 return `<section id="announcement-editor" class="announcement-editor"><a href="${root}">← Back to My Drafts</a><h2>${a.id?'Edit Draft':'New Announcement'}</h2><p>Saving and previewing never send email. Your saved draft keeps the same announcement ID.</p><form method="post" class="draft-editor"><input type="hidden" name="id" value="${esc(a.id||'')}"><input type="hidden" name="version" value="${a.version||0}"><label>Announcement type<select name="mode"><option value="standalone" ${a.mode!=='published'?'selected':''}>Standalone announcement</option><option value="published" ${a.mode==='published'?'selected':''}>Published Update</option></select></label><fieldset><legend>Subscription audience</legend><div class="audience-options">${[...allowed].map(([id,label])=>`<label><input type="checkbox" name="announcement_topics" value="${id}" ${selected.includes(id)?'checked':''}>${esc(label)}</label>`).join('')}</div><p>Basic and Advanced can be combined; each subscriber receives one copy. Keep ASM Instructor software separate from Classes.</p></fieldset><label>Sender identity<select name="sender_topic"><option value="">Use this audience’s shared identity</option>${[...allowed].map(([id,label])=>`<option value="${id}" ${a.sender_topic===id?'selected':''}>${esc(label)}</option>`).join('')}</select></label><p class="help">When selected audiences have different senders, explicitly choose one of those audiences here. From and Reply-To appear in Preview.</p><label>Subject / title<input name="subject" maxlength="180" required value="${esc(a.subject||'')}"></label><label>Message / summary<textarea class="message-editor" name="message" maxlength="20000" required>${esc(a.message||'')}</textarea></label><div class="publication-field"><label>Actual publication date (Published Update only, Eastern)<input type="date" name="publication_date" value="${esc(a.publication_date||'')}"></label></div><label>Destination links<textarea name="links" rows="3" placeholder="Link label | https://peterhamrn.com/page">${esc(links)}</textarea></label><p class="help">One link per line. Links are optional for standalone announcements; a Published Update needs its actual public page as the first link.</p><div class="actions"><button name="action" value="announcement-save">Save Draft</button><button class="secondary" name="action" value="announcement-preview-draft">Preview Email</button></div></form></section>`;
}
export async function announcementSection(env,options={}){
 const db=env.RECOVERY_DB,announcements=(await db.prepare('SELECT a.*,COALESCE(SUM(CASE WHEN d.status IN (\'rejected\',\'uncertain\',\'sending\') THEN 1 ELSE 0 END),0) failures FROM subscription_announcement_drafts a LEFT JOIN subscription_deliveries d ON d.update_id=a.id GROUP BY a.id ORDER BY a.updated_at DESC').all()).results||[];
 const buckets={drafts:[],prepared:[],attention:[],completed:[]};
 for(const a of announcements)buckets[a.status==='draft'?'drafts':a.status==='sent'?'completed':a.failures?'attention':'prepared'].push(a);
 const work=['drafts','prepared','attention','completed'].includes(options.work)?options.work:'drafts';
 let editor=options.buffer||null;
 if(options.edit){const a=await db.prepare('SELECT * FROM subscription_announcement_drafts WHERE id=?').bind(options.edit).first();if(a){const sender=await db.prepare('SELECT topic_id FROM subscription_announcement_senders WHERE announcement_id=?').bind(a.id).first();editor={...a,selected:(await topicsFor(db,a.id)).map(t=>t.topic_id),sender_topic:sender?.topic_id||''};}}
 const labels={drafts:'My Drafts',prepared:'Prepared / Awaiting Approval',attention:'Sending / Needs Attention',completed:'Completed Announcements'};
 const navigation=`<div class="workspace-heading"><h2>Announcements</h2><a class="button" href="${root}?new=1">New Announcement</a></div><nav class="workspace-tabs" aria-label="Announcement workspace">${Object.entries(labels).map(([key,label])=>`<a ${work===key?'aria-current="page"':''} href="${root}?work=${key}">${label} <span class="count">${buckets[key].length}</span></a>`).join('')}</nav><p class="workflow">Draft → Preview → Prepare Recipients → Approve → Send → Completed</p><p class="help">Save your wording. Preview the email. Prepare locks the content and audience without sending. Review, approve, and then explicitly send.</p>`;
 if(editor||options.new){
  if(editor&&editor.status!=='draft')return navigation+`<p class="notice">This announcement is locked. Its approved content and recipient snapshot cannot be edited.</p><form method="post">${fields(editor)}<button name="action" value="announcement-copy">Create a New Draft from This Announcement</button></form><p><a href="${root}?work=prepared">Return to prepared announcements</a></p>`;
  let preview='';if(options.preview){const a=readDraft(options.preview);preview=previewMarkup(a,a.identity);}
  return navigation+editorMarkup(editor||{})+preview;
 }
 const cards=await Promise.all(buckets[work].map(async a=>{
  const groups=(await db.prepare('SELECT status,COUNT(*) n FROM subscription_deliveries WHERE update_id=? GROUP BY status').bind(a.id).all()).results||[],n=status=>Number(groups.find(g=>g.status===status)?.n||0),total=groups.reduce((sum,g)=>sum+Number(g.n),0);
  const errors=(await db.prepare('SELECT DISTINCT last_error FROM subscription_auto_delivery_meta WHERE update_id=? AND last_error IS NOT NULL LIMIT 5').bind(a.id).all()).results||[];
  const audience=(await topicsFor(db,a.id)).map(t=>allowed.get(t.topic_id)||t.topic_id).join(', ');
  const recipients=(await db.prepare('SELECT email,status,resend_id FROM subscription_deliveries WHERE update_id=? ORDER BY email').bind(a.id).all()).results||[];
  let action=a.status==='draft'?'<button name="action" value="announcement-prepare">Prepare Recipients</button>':a.status==='prepared'&&n('pending')?'<button name="action" value="announcement-approve">Approve Sending</button>':a.status==='approved'&&n('pending')?'<button name="action" value="announcement-send-confirm">Send Approved Announcement</button>':'';
  const status={draft:'Draft',prepared:'Awaiting approval',approved:'Sending approved',sent:'Completed'}[a.status]||a.status;
  return `<article class="announcement-card"><div class="card-heading"><h3>${esc(a.subject)}</h3><span class="status">${esc(status)}</span></div><p>${esc(audience)} · ${a.mode==='published'?'Published Update':'Standalone'}</p><p class="help">Last modified: ${esc(modified(a.updated_at))}</p>${a.status==='draft'?'':`<p class="delivery-counts">Prepared: ${total} · Accepted: ${n('sent')} · Pending: ${n('pending')} · Failed / Unconfirmed: ${n('rejected')+n('uncertain')+n('sending')} · Skipped: ${n('skipped')}</p>${!total?'<p class="notice">No eligible subscribers. Nothing to send.</p>':''}`}<div class="actions">${a.status==='draft'?`<a class="button secondary" href="${root}?edit=${encodeURIComponent(a.id)}">Edit</a>`:''}<a class="button secondary" href="${root}?preview=${encodeURIComponent(a.id)}">Preview</a>${action?`<form method="post">${fields(a)}${action}</form>`:''}${a.status!=='draft'?`<form method="post">${fields(a)}<button class="secondary" name="action" value="announcement-copy">Create New Draft from This</button></form>`:''}</div>${a.status!=='draft'?'<p class="help">Content and audience are locked. A copied draft is a new announcement; it does not reopen or resend this one.</p>':''}<details><summary>Announcement and delivery details${total?' ('+total+' recipients)':''}</summary><p class="announcement-id">ID: ${esc(a.id)}</p>${a.approved_at?`<p>Approved: ${esc(modified(a.approved_at))}</p>`:'<p>Sending has not been approved.</p>'}${a.publication_date?`<p>Content publication date: ${esc(a.publication_date)}</p>`:''}${recipients.length?`<div class="scroll"><table><tr><th>Email</th><th>Status</th><th>Resend message ID</th></tr>${recipients.map(r=>`<tr><td><!--email_off-->${esc(r.email)}<!--/email_off--></td><td>${esc(r.status)}</td><td class="announcement-id">${esc(r.resend_id||'—')}</td></tr>`).join('')}</table></div>`:''}${errors.map(e=>`<p class="notice">${esc(e.last_error)}</p>`).join('')}</details></article>`;
 }));
 return navigation+`<h2>${labels[work]}</h2>${cards.join('')||'<p>No announcements in this view.</p>'}`;
}
async function savedPreview(db,a,identity){
 // If a pending recipient already has a payload, recovery must show its original
 // content and sender. Never regenerate a retry payload or expose its opt-out token.
 const pending=await db.prepare("SELECT m.payload_json FROM subscription_deliveries d LEFT JOIN subscription_auto_delivery_meta m ON m.update_id=d.update_id AND m.email=d.email WHERE d.update_id=? AND d.status='pending' ORDER BY d.email LIMIT 1").bind(a.id).first();
 const stored=pending||await db.prepare('SELECT payload_json FROM subscription_auto_delivery_meta WHERE update_id=? ORDER BY email LIMIT 1').bind(a.id).first();
 let frozen=stored?.payload_json?JSON.parse(stored.payload_json):null;
 if(!frozen?.html||!frozen.text)frozen=null;
 if(frozen){
  frozen={...frozen,html:frozen.html.replace(/<a[^>]*href="https:\/\/peterhamrn\.com\/subscriptions-unsubscribe\?token=[^"]+"[^>]*>[\s\S]*?<\/a>/g,'<span>Recipient-specific unsubscribe link (added at delivery)</span>'),text:frozen.text.replace(/https:\/\/peterhamrn\.com\/subscriptions-unsubscribe\?token=[^\s<>"']+/g,'[recipient-specific unsubscribe link]')};
  identity={...identity,from:frozen.from||'PeterHamRN.com <recovery@peterhamrn.com>',reply_to:frozen.reply_to||'recovery@peterhamrn.com'};
 }
 return previewMarkup(a,identity,frozen);
}
export async function announcementPreview(env,id){
 const a=await env.RECOVERY_DB.prepare('SELECT * FROM subscription_announcement_drafts WHERE id=?').bind(id).first();if(!a)return page('<h1>Announcement not found</h1>',404);
 const identity=await identityFor(env.RECOVERY_DB,a),preview=await savedPreview(env.RECOVERY_DB,a,identity);
 return workspacePage(`<h1>Announcement Preview</h1><p><a href="${root}${a.status==='draft'?'?edit='+encodeURIComponent(id):'?work=prepared'}">← Back to ${a.status==='draft'?'draft editor':'announcement workspace'}</a></p>${preview}`);
}
export async function publicationPreview(env,p){
 const a={id:p.id,subject:p.title,message:p.intro||p.summary||'A new project update is available.',mode:'standalone',links_json:JSON.stringify(p.links?p.links.map(l=>({label:(l.kind==='story'?'Humorous Story: ':l.kind==='manual'?'Technical Manual: ':'')+l.title,url:l.url})):[{label:p.buttonLabel||'Read the update',url:p.url}])};
 const preview=await savedPreview(env.RECOVERY_DB,a,announcementIdentity([p.topic]));
 return workspacePage(`<h1>Publication Announcement Preview</h1><p><a href="${root}">← Back to announcement workspace</a></p>${preview}`);
}
export function workspacePage(body,status=200){
 return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Subscription Manager | PeterHamRN.com</title><link rel="stylesheet" href="/assets/subscriptions.css"><link rel="stylesheet" href="/assets/subscription-manager.css"><script src="/assets/subscription-manager.js" defer></script></head><body><main class="subscription-workspace"><a href="/admin/">← Admin Center</a>${body}</main></body></html>`,{status,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'same-origin','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'self' 'unsafe-inline'; script-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"}});
}
export async function announcementSendConfirmation(env,id,version){
 const a=await env.RECOVERY_DB.prepare("SELECT * FROM subscription_announcement_drafts WHERE id=? AND version=? AND status='approved' AND approved_at IS NOT NULL").bind(id,version).first();
 const pending=await env.RECOVERY_DB.prepare("SELECT COUNT(*) n FROM subscription_deliveries WHERE update_id=? AND status='pending'").bind(id).first();
 if(!a||!pending.n)throw Error('No approved pending recipients. Nothing to send.');
 const identity=await identityFor(env.RECOVERY_DB,a);
 return workspacePage(`<h1>Confirm Sending</h1><p>This sends the approved, locked announcement to up to 10 of its ${pending.n} pending recipients. Eligibility is checked again before each send.</p>${await savedPreview(env.RECOVERY_DB,a,identity)}<form method="post">${fields(a)}<input type="hidden" name="send_confirm" value="1"><button name="action" value="announcement-send">Send This Approved Announcement</button></form><p><a href="${root}?work=prepared">Cancel and return to workspace</a></p>`);
}
export async function announcementAction(env,form){
 const db=env.RECOVERY_DB,action=String(form.get('action')),id=String(form.get('id')||''),version=Number(form.get('version'));
 if(action==='announcement-copy'){
  const source=await db.prepare('SELECT * FROM subscription_announcement_drafts WHERE id=? AND version=?').bind(id,version).first();
  if(!source)throw Error('Announcement changed. Reload before copying.');
  const topics=(await topicsFor(db,id)).map(t=>t.topic_id),identity=await identityFor(db,source);
  const copy=new FormData();copy.set('action','announcement-save');copy.set('mode',source.mode);copy.set('subject',source.subject);copy.set('message',source.message);copy.set('publication_date',source.publication_date||'');copy.set('links',JSON.parse(source.links_json).map(l=>l.label+' | '+l.url).join('\n'));copy.set('sender_topic',identity.topic);topics.forEach(t=>copy.append('announcement_topics',t));
  const result=await announcementAction(env,copy);return {...result,message:'A new, unsent draft was created. The original announcement remains locked and unchanged.'};
 }
 if(action==='announcement-save'){
  const draft=readDraft(form),{mode,subject,message,selected,publication_date:date,identity}=draft,links=JSON.parse(draft.links_json);
  const operation=crypto.randomUUID();
  const draftID=id||'announcement-'+crypto.randomUUID(),stamp=now();
  const edit=id?await db.prepare('SELECT status,version FROM subscription_announcement_drafts WHERE id=?').bind(id).first():null;
  if(id&&(!edit||edit.status!=='draft'||edit.version!==version))throw Error('This draft changed or is already prepared. Reload before editing.');
  const write=id?db.prepare("UPDATE subscription_announcement_drafts SET mode=?,subject=?,message=?,links_json=?,publication_date=?,version=version+1,updated_at=?,operation_id=? WHERE id=? AND status='draft' AND version=?").bind(mode,subject,message,JSON.stringify(links),mode==='published'?date:null,stamp,operation,id,version):db.prepare("INSERT INTO subscription_announcement_drafts(id,mode,subject,message,links_json,publication_date,created_at,updated_at,operation_id) VALUES(?,?,?,?,?,?,?,?,?)").bind(draftID,mode,subject,message,JSON.stringify(links),mode==='published'?date:null,stamp,stamp,operation);
  const guardVersion=id?version+1:1;
  const results=await db.batch([write,db.prepare('DELETE FROM subscription_announcement_topics WHERE announcement_id=? AND EXISTS(SELECT 1 FROM subscription_announcement_drafts WHERE id=? AND version=? AND operation_id=?)').bind(draftID,draftID,guardVersion,operation),...selected.map(topic=>db.prepare('INSERT OR IGNORE INTO subscription_announcement_topics(announcement_id,topic_id) SELECT ?,? WHERE EXISTS(SELECT 1 FROM subscription_announcement_drafts WHERE id=? AND version=? AND operation_id=?)').bind(draftID,topic,draftID,guardVersion,operation)),db.prepare('INSERT INTO subscription_announcement_senders(announcement_id,topic_id) SELECT ?,? WHERE EXISTS(SELECT 1 FROM subscription_announcement_drafts WHERE id=? AND version=? AND operation_id=?) ON CONFLICT(announcement_id) DO UPDATE SET topic_id=excluded.topic_id').bind(draftID,identity.topic,draftID,guardVersion,operation)]);
  if(!results[0].meta?.changes)throw Error('Draft changed in another session. Reload.');return {message:'Draft saved. No email was sent. Preview it or prepare recipients when ready.',work:'drafts',id:draftID};
 }
 const a=await db.prepare('SELECT * FROM subscription_announcement_drafts WHERE id=?').bind(id).first();
 if(!a||a.version!==version)throw Error('Announcement changed. Reload before continuing.');
 if(action==='announcement-prepare'){
  if(a.status!=='draft')throw Error('Only drafts can be prepared.');
  const topics=await topicsFor(db,id);if(!topics.length||topics.some(t=>!t.enabled))throw Error('Every selected subscription topic must be enabled.');
  await identityFor(db,a);
  await publishedContent(a);
  const stamp=now(),first=topics[0].topic_id,links=JSON.parse(a.links_json),publishedAt=a.mode==='published'?a.publication_date+'T12:00:00.000Z':stamp;
  const results=await db.batch([
   db.prepare("UPDATE subscription_announcement_drafts SET status='prepared',version=version+1,updated_at=? WHERE id=? AND version=? AND status='draft'").bind(stamp,id,version),
   db.prepare("INSERT OR IGNORE INTO subscription_updates(id,topic_id,title,url,published_at,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM subscription_announcement_drafts WHERE id=? AND status='prepared' AND version=? AND updated_at=?)").bind(id,first,a.subject,links[0]?.url||'https://peterhamrn.com/',publishedAt,stamp,id,version+1,stamp),
   db.prepare(`INSERT OR IGNORE INTO subscription_deliveries(update_id,email,status,created_at) SELECT DISTINCT ?,lower(s.email),'pending',? FROM subscription_announcement_topics a JOIN subscriber_topics s ON s.topic_id=a.topic_id JOIN subscription_topics t ON t.id=s.topic_id WHERE a.announcement_id=? AND ${confirmed} AND EXISTS(SELECT 1 FROM subscription_updates WHERE id=? AND audience_frozen=0)`).bind(id,stamp,id,stamp,id),
   db.prepare('UPDATE subscription_updates SET audience_frozen=1 WHERE id=?').bind(id)
  ]);
  if(!results[0].meta?.changes)throw Error('Announcement changed before preparation. Reload.');return {message:'Eligible recipients prepared and deduplicated. Content and audience are now locked. Review, approve, then send.',work:'prepared'};
 }
 if(action==='announcement-approve'){
  const approved=await db.prepare("UPDATE subscription_announcement_drafts SET status='approved',approved_at=?,version=version+1,updated_at=? WHERE id=? AND status='prepared' AND version=? AND EXISTS(SELECT 1 FROM subscription_deliveries WHERE update_id=subscription_announcement_drafts.id AND status='pending') RETURNING id").bind(now(),now(),id,version).first();
  if(!approved)throw Error('Prepare the recipients before approving.');return {message:'Sending approved. Select Send Approved Announcement and confirm to deliver the locked email.',work:'prepared'};
 }
 if(action!=='announcement-send'||a.status!=='approved'||!a.approved_at)throw Error('Explicit approval of the prepared announcement is required before sending.');
 if(form.get('send_confirm')!=='1')throw Error('Confirm sending this approved announcement before delivery.');
 if(!env.RESEND_API_KEY)throw Error('Resend is not configured.');
 const recipients=(await db.prepare("SELECT email FROM subscription_deliveries WHERE update_id=? AND status='pending' ORDER BY email LIMIT 10").bind(id).all()).results||[];
 if(!recipients.length)throw Error('No eligible subscribers. Nothing to send.');
 const identity=await identityFor(db,a);
 let accepted=0,failed=0,skipped=0;
 for(const recipient of recipients){
  const email=recipient.email,claim=await db.prepare("UPDATE subscription_deliveries SET status='sending' WHERE update_id=? AND email=? AND status='pending' RETURNING email").bind(id,email).first();if(!claim)continue;
  try{
   const scopes=await eligibleTopics(db,id,email);
   if(!scopes.length){skipped++;await db.prepare("UPDATE subscription_deliveries SET status='skipped' WHERE update_id=? AND email=?").bind(id,email).run();continue;}
   let meta=await db.prepare('SELECT * FROM subscription_auto_delivery_meta WHERE update_id=? AND email=?').bind(id,email).first();
   if(!meta){
    const token=random(),tokenHash=await hash(token),link='https://peterhamrn.com/subscriptions-unsubscribe?token='+token;
    const content=emailContent(a.subject,publicationMessage(a),JSON.parse(a.links_json),link,identity);
    await db.batch([db.prepare('INSERT INTO subscription_unsubscribe(token_hash,email,topic_id,created_at) VALUES(?,?,?,?)').bind(tokenHash,email,scopes[0].topic_id,now()),...scopes.map(t=>db.prepare('INSERT INTO subscription_unsubscribe_scopes(token_hash,topic_id) VALUES(?,?)').bind(tokenHash,t.topic_id)),db.prepare('INSERT INTO subscription_auto_delivery_meta(update_id,email,payload_json,idempotency_key) VALUES(?,?,?,?)').bind(id,email,JSON.stringify(content),'manual-'+await hash(id+':'+email))]);
    meta=await db.prepare('SELECT * FROM subscription_auto_delivery_meta WHERE update_id=? AND email=?').bind(id,email).first();
   }
   await db.prepare('UPDATE subscription_auto_delivery_meta SET first_attempt_at=COALESCE(first_attempt_at,?),last_attempt_at=?,last_error=NULL WHERE update_id=? AND email=?').bind(now(),now(),id,email).run();
   if(!(await eligibleTopics(db,id,email)).length){skipped++;await db.prepare("UPDATE subscription_deliveries SET status='skipped' WHERE update_id=? AND email=?").bind(id,email).run();continue;}
   const content=JSON.parse(meta.payload_json),response=await sendEmail(env,meta.idempotency_key,email,content.subject,content.text,deliveryExtras(content),AbortSignal.timeout(15000));
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
 return {message:`Batch complete: ${accepted} accepted by Resend, ${failed} failed or unconfirmed, ${skipped} skipped. Accepted recipients will not be resent. Failures remain held for review.`,work:failed?'attention':remaining.n?'prepared':'completed'};
}
