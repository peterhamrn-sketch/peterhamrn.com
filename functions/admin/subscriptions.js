import {announcementSection,announcementPreview,announcementAction,workspacePage,draftBuffer,announcementSendConfirmation,publicationPreview} from '../_recovery/announcement-manager.js';
import {emailContent,safeError} from '../_recovery/email-content.js';
import {announcementIdentity,deliveryExtras} from '../_recovery/announcement-identities.js';
import {publisherRequest} from '../_mini/publisher.js';
import {easternLabel} from '../_mini/scheduling.js';
import {now,random,hash,esc,page,sameOrigin,adminAuth,sendEmail} from '../_recovery/subscriptions.js';
import {publishedUpdates} from '../_recovery/published-updates.js';
async function view(env,message='',options={}){
 const [people,topics,updates]=await Promise.all([
 env.RECOVERY_DB.prepare('SELECT s.email,s.created_at,t.topic_id,t.active FROM subscribers s LEFT JOIN subscriber_topics t ON t.email=s.email ORDER BY s.email,t.topic_id').all(),
 env.RECOVERY_DB.prepare('SELECT t.id,t.label,t.enabled,COUNT(CASE WHEN s.active=1 AND s.confirmed_at IS NOT NULL AND julianday(s.confirmed_at) IS NOT NULL AND julianday(s.confirmed_at)<=julianday(CURRENT_TIMESTAMP) THEN 1 END) active FROM subscription_topics t LEFT JOIN subscriber_topics s ON s.topic_id=t.id GROUP BY t.id ORDER BY t.label').all(),
 env.RECOVERY_DB.prepare('SELECT u.id,u.title,d.status,COUNT(d.email) n FROM subscription_updates u LEFT JOIN subscription_deliveries d ON d.update_id=u.id GROUP BY u.id,d.status').all()]);
 const topicNames=new Map(topics.results.map(t=>[t.id,t.label]));
 const count=(id,status)=>Number(updates.results.find(u=>u.id===id&&u.status===status)?.n||0);
 const legacyErrors=(await env.RECOVERY_DB.prepare('SELECT update_id,last_error FROM subscription_auto_delivery_meta WHERE last_error IS NOT NULL').all()).results||[];
 const prepared=id=>updates.results.some(u=>u.id===id);
 const statusNames={pending:'Waiting to send',sent:'Emails sent',skipped:'Skipped because the subscriber opted out',sending:'Delivery in progress or awaiting review',uncertain:'Delivery needs review',rejected:'Email service rejected the send'};
 const approvals=(await env.RECOVERY_DB.prepare('SELECT update_id FROM subscription_manual_approvals').all()).results||[];
 const announcements=publishedUpdates.map(p=>{
 const ready=prepared(p.id),pending=count(p.id,'pending'),audience=Number(topics.results.find(t=>t.id===p.topic)?.active||0);
 return `<section><h3>${esc(p.title)}</h3><p>${esc(p.summary||'A new project update is available.')}</p><p><a href="${esc(p.url)}">Read the published update</a> · <a href="/admin/subscriptions?publication-preview=${encodeURIComponent(p.id)}">Preview Email</a> · Audience: ${esc(topicNames.get(p.topic)||p.topic)}</p><form method="post"><input type="hidden" name="id" value="${esc(p.id)}">${!ready?`<p>${audience} confirmed subscriber${audience===1?'':'s'}. Prepare saves this recipient list without sending email.</p><button name="action" value="prepare">Prepare email for ${audience} subscriber${audience===1?'':'s'}</button>`:pending?`<p>${pending} email${pending===1?'':'s'} waiting to send.</p>${approvals.some(a=>a.update_id===p.id)?'<button name="action" value="send-confirm">Send Approved Announcement</button>':'<button name="action" value="approve">Approve Sending</button>'}`:count(p.id,'sent')||count(p.id,'skipped')||count(p.id,'uncertain')||count(p.id,'rejected')||count(p.id,'sending')?'<p>No emails are waiting to send for this update.</p>':'<p>No eligible subscribers. Nothing to send.</p>'}</form>${ready?`<ul>${updates.results.filter(u=>u.id===p.id&&u.status).map(u=>`<li>${esc(statusNames[u.status]||u.status)}: ${u.n}</li>`).join('')}</ul>`:''}</section>`;
 }).join('')+legacyErrors.filter(e=>publishedUpdates.some(p=>p.id===e.update_id)).map(e=>`<p>${esc(e.last_error)}</p>`).join('');
 const events=env.LITTLE_MINI_DB?(await env.LITTLE_MINI_DB.prepare(`SELECT event_id,MAX(published_at) published_at,MAX(number) number,MAX(status) status,MAX(last_error) last_error FROM mini_publication_outbox GROUP BY event_id ORDER BY published_at DESC`).all()).results||[]:[];
 const automatic=(await Promise.all(events.map(async e=>{
  const metadata=await env.RECOVERY_DB.prepare('SELECT * FROM subscription_automatic_updates WHERE update_id=?').bind(e.event_id).first();
  const rows=updates.results.filter(u=>u.id===e.event_id),total=rows.reduce((sum,r)=>sum+Number(r.n),0),accepted=count(e.event_id,'sent'),failures=count(e.event_id,'rejected')+count(e.event_id,'uncertain')+count(e.event_id,'sending'),pending=count(e.event_id,'pending');
  const title=metadata?JSON.parse(metadata.details_json).title:'Little Mini Update: Chapter '+e.number+' Is Here!';
  return `<section><h3>${esc(title)}</h3><p>Published: ${esc(easternLabel(e.published_at))}</p><p>Recipients: ${metadata?total:'Not prepared yet'} · Accepted by Resend: ${accepted} · Failures or unconfirmed deliveries: ${failures} · Pending: ${pending} · Skipped: ${count(e.event_id,'skipped')}</p><p>Status: ${esc(metadata?.state||e.status)}</p>${metadata?.last_error||e.last_error?`<p class="notice">${esc(metadata?.last_error||e.last_error)}</p>`:''}${metadata&&!total?'<p class="notice">No eligible subscribers. Nothing to send.</p>':''}${metadata?`<p><a href="/admin/subscriptions?publication-preview=${encodeURIComponent(e.event_id)}">Preview Email</a></p>`:''}${(pending||failures||!metadata&&e.status!=='complete')?`<form method="post"><input type="hidden" name="id" value="${esc(e.event_id)}"><button name="action" value="retry-automatic-confirm">Review Pending or Failed Announcement Retry</button></form>`:''}</section>`;
 }))).join('');
 const composer=await announcementSection(env,options);
 const subscriberCount=new Set(people.results.map(p=>p.email)).size;
 const allHistory=new Map();for(const row of updates.results){if(!allHistory.has(row.id))allHistory.set(row.id,{title:row.title,rows:[]});allHistory.get(row.id).rows.push(row);}
 return workspacePage(`<h1>Subscription Manager</h1>${message?`<p role="status" class="notice">${esc(message)}</p>`:''}${composer}<details><summary>Automatic Publication Announcements (${events.length})</summary><p>Matching Little Mini chapters released together produce one combined announcement. Accepted means Resend accepted the message; inbox delivery is not confirmed. This workspace never changes chapter schedules. Unknown deliveries outside the safe retry window remain held.</p>${automatic||'<p>No automatic announcements yet.</p>'}</details><details><summary>Published Update Catalog (${publishedUpdates.length})</summary><p>These existing published updates retain their original IDs and recipient snapshots. Prepare, approve, and send are separate actions.</p>${announcements}</details><details><summary>Subscriber Lists and Preferences (${subscriberCount})</summary><div class="scroll"><table><tr><th>Email</th><th>Topic</th><th>Preference</th></tr>${people.results.map(p=>`<tr><td><!--email_off-->${esc(p.email)}<!--/email_off--></td><td>${esc(topicNames.get(p.topic_id)||p.topic_id||'—')}</td><td>${p.active?'Subscribed':'Off'}</td></tr>`).join('')}</table></div></details><details><summary>Subscription Topics (${topics.results.length})</summary><ul>${topics.results.map(t=>`<li>${esc(t.label)}: ${t.active} active, confirmed subscriber${Number(t.active)===1?'':'s'}; ${t.enabled?'enabled':'disabled'}</li>`).join('')}</ul></details><details><summary>Historical Delivery Details (${allHistory.size} announcements)</summary>${[...allHistory].map(([id,h])=>`<details><summary>${esc(h.title)}</summary><p class="announcement-id">ID: ${esc(id)}</p><ul>${h.rows.filter(r=>r.status).map(r=>`<li>${esc(statusNames[r.status]||r.status)}: ${r.n}</li>`).join('')}</ul>${legacyErrors.filter(e=>e.update_id===id).map(e=>`<p class="notice">${esc(e.last_error)}</p>`).join('')}</details>`).join('')||'<p>No delivery history yet.</p>'}</details><details><summary>Future Topic Administration (${topics.results.length} topics defined)</summary><p>Adding a topic never enrolls subscribers. New sender identities require an explicit configuration change.</p><form method="post"><input type="hidden" name="action" value="topic"><label>Topic ID<input name="id" pattern="[a-z0-9]+(-[a-z0-9]+)*" maxlength="64" required></label><label>Topic name<input name="label" maxlength="100" required></label><button>Add Topic</button></form></details>`);


}
export async function onRequest({request,env}){
 if(!await adminAuth(request,env)){const r=page('<h1>Authorization required</h1>',401);r.headers.set('WWW-Authenticate','Basic realm="Subscriptions Admin", charset="UTF-8"');return r}
 try{
 if(!['GET','POST'].includes(request.method))return page('<h1>Method not allowed</h1>',405);
 if(request.method==='GET'){const url=new URL(request.url);if(url.searchParams.has('publication-preview')){const id=url.searchParams.get('publication-preview'),saved=await env.RECOVERY_DB.prepare('SELECT details_json FROM subscription_automatic_updates WHERE update_id=?').bind(id).first(),p=saved?JSON.parse(saved.details_json):publishedUpdates.find(p=>p.id===id);return p?publicationPreview(env,p):page('<h1>Published announcement not found</h1>',404);}if(url.searchParams.has('preview'))return announcementPreview(env,url.searchParams.get('preview'));return view(env,url.searchParams.get('message')||'',{edit:url.searchParams.get('edit')||'',new:url.searchParams.has('new'),work:url.searchParams.get('work')||'drafts'});}
 if(!sameOrigin(request))return page('<h1>Request rejected</h1>',403);
 const f=await request.formData(),action=f.get('action'),id=String(f.get('id')||'');
 if(String(action).startsWith('announcement-')){
  try{
   if(action==='announcement-preview-draft')return await view(env,'Preview only. Unsaved wording is retained below; no email was sent.',{buffer:draftBuffer(f),preview:f});
   if(action==='announcement-send-confirm')return await announcementSendConfirmation(env,id,Number(f.get('version')));
   const result=await announcementAction(env,f);
   const destination=new URL('/admin/subscriptions',request.url);destination.searchParams.set('message',result.message||String(result));if(result.id&&action==='announcement-copy')destination.searchParams.set('edit',result.id);else destination.searchParams.set('work',result.work||'drafts');return new Response(null,{status:303,headers:{Location:destination.pathname+destination.search,'Cache-Control':'no-store'}});
  }catch(error){return view(env,error.message||'Announcement operation was not completed.',['announcement-save','announcement-preview-draft'].includes(action)?{buffer:draftBuffer(f)}:{work:'prepared'});}
 }
 if(action==='topic'){const label=String(f.get('label')||'').trim();if(!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)||id.length>64||!label||label.length>100)return page('<h1>Invalid topic</h1>',400);await env.RECOVERY_DB.prepare('INSERT OR IGNORE INTO subscription_topics(id,label) VALUES(?,?)').bind(id,label).run();return view(env,'Topic added. No subscribers were enrolled.');}
 if(action==='retry-automatic-confirm'||action==='send-confirm'){
  if(action==='retry-automatic-confirm'){
   const event=env.LITTLE_MINI_DB?await env.LITTLE_MINI_DB.prepare('SELECT event_id FROM mini_publication_outbox WHERE event_id=?').bind(id).first():null;
   if(!event)return page('<h1>Published announcement required</h1>',400);
  }else{
   const approved=await env.RECOVERY_DB.prepare('SELECT update_id FROM subscription_manual_approvals WHERE update_id=?').bind(id).first();
   const pending=await env.RECOVERY_DB.prepare("SELECT COUNT(*) n FROM subscription_deliveries WHERE update_id=? AND status='pending'").bind(id).first();
   if(!approved||!pending.n)return view(env,'No approved pending recipients. Nothing to send.');
  }
  return workspacePage(`<h1>Confirm ${action==='retry-automatic-confirm'?'Announcement Retry':'Sending'}</h1><p>This may send email to eligible pending ${action==='retry-automatic-confirm'?'or safely recoverable failed ':''}recipients. Accepted deliveries will not be resent. Uncertain deliveries outside the safe recovery window stay held.</p><p class="announcement-id">Announcement ID: ${esc(id)}</p><form method="post"><input type="hidden" name="id" value="${esc(id)}"><input type="hidden" name="send_confirm" value="1"><button name="action" value="${action==='retry-automatic-confirm'?'retry-automatic':'send'}">Confirm ${action==='retry-automatic-confirm'?'Retry':'Send'}</button></form><p><a href="/admin/subscriptions">Cancel and return to workspace</a></p>`);
 }
 if(action==='retry-automatic'){
  if(f.get('send_confirm')!=='1')return view(env,'Confirm the announcement retry first.');
  const event=await env.LITTLE_MINI_DB.prepare('SELECT event_id FROM mini_publication_outbox WHERE event_id=?').bind(id).first();
  if(!event)return page('<h1>Published announcement required</h1>',400);
  await publisherRequest(env,'/notify',{event_id:id});
  return view(env,'Announcement retry processed. Accepted recipients were not resent. Review the results below; unconfirmed sends outside the safe retry window remain held for review.');
 }
 const publication=publishedUpdates.find(p=>p.id===id);if(!publication||publication.publishedAt>now())return page('<h1>Published update required</h1>',400);
 if(action==='prepare'){
 // Atomic batch: the audience is inserted only in the transaction that first creates the update.
 await env.RECOVERY_DB.batch([
 env.RECOVERY_DB.prepare('INSERT OR IGNORE INTO subscription_updates(id,topic_id,title,url,published_at,created_at) VALUES(?,?,?,?,?,?)').bind(id,publication.topic,publication.title,publication.url,publication.publishedAt,now()),
 env.RECOVERY_DB.prepare("INSERT INTO subscription_deliveries(update_id,email,status,created_at) SELECT ?,email,'pending',? FROM subscriber_topics WHERE topic_id=? AND active=1 AND confirmed_at IS NOT NULL AND julianday(confirmed_at) IS NOT NULL AND julianday(confirmed_at)<=julianday(CURRENT_TIMESTAMP) AND EXISTS(SELECT 1 FROM subscription_topics WHERE id=topic_id AND enabled=1) AND EXISTS(SELECT 1 FROM subscription_updates WHERE id=? AND audience_frozen=0)").bind(id,now(),publication.topic,id),
 env.RECOVERY_DB.prepare('UPDATE subscription_updates SET audience_frozen=1 WHERE id=?').bind(id)
 ]);return view(env,'Recipient list prepared and locked. Approve sending, then explicitly send the announcement.');
 }
 if(action==='approve'){
  const pending=await env.RECOVERY_DB.prepare("SELECT COUNT(*) n FROM subscription_deliveries WHERE update_id=? AND status='pending'").bind(id).first();
  if(!pending.n)return view(env,'No eligible subscribers. Nothing to send.');
  await env.RECOVERY_DB.prepare('INSERT OR IGNORE INTO subscription_manual_approvals(update_id,approved_at) VALUES(?,?)').bind(id,now()).run();return view(env,'Sending approved. Select Send Approved Announcement and confirm to deliver it.');
 }
 if(action!=='send')return page('<h1>Unknown action</h1>',400);
 if(f.get('send_confirm')!=='1'||!await env.RECOVERY_DB.prepare('SELECT update_id FROM subscription_manual_approvals WHERE update_id=?').bind(id).first())return view(env,'Explicit approval and sending confirmation are required.');
 if(!env.RESEND_API_KEY)return page('<h1>Email is not configured</h1>',503);
 const update=await env.RECOVERY_DB.prepare('SELECT * FROM subscription_updates WHERE id=?').bind(id).first();if(!update)return view(env,'Prepare this announcement first.');
 const recipients=await env.RECOVERY_DB.prepare("SELECT email FROM subscription_deliveries WHERE update_id=? AND status='pending' LIMIT 25").bind(id).all();
 if(!recipients.results.length)return view(env,'No eligible subscribers. Nothing to send.');
 let sent=0,held=0,skipped=0;
 for(const recipient of recipients.results){
 const email=recipient.email;
 const claim=await env.RECOVERY_DB.prepare("UPDATE subscription_deliveries SET status='sending' WHERE update_id=? AND email=? AND status='pending' RETURNING email").bind(id,email).first();if(!claim)continue;
 const active=await env.RECOVERY_DB.prepare('SELECT 1 active FROM subscriber_topics WHERE email=? AND topic_id=? AND active=1 AND confirmed_at IS NOT NULL AND julianday(confirmed_at) IS NOT NULL AND julianday(confirmed_at)<=julianday(CURRENT_TIMESTAMP) AND EXISTS(SELECT 1 FROM subscription_topics WHERE id=topic_id AND enabled=1)').bind(email,update.topic_id).first();if(!active){skipped++;await env.RECOVERY_DB.prepare("UPDATE subscription_deliveries SET status='skipped' WHERE update_id=? AND email=?").bind(id,email).run();continue}
 try{
 const catalog=publishedUpdates.find(p=>p.id===id);
 let meta=await env.RECOVERY_DB.prepare('SELECT * FROM subscription_auto_delivery_meta WHERE update_id=? AND email=?').bind(id,email).first();
 if(!meta){
  const token=random(),link='https://peterhamrn.com/subscriptions-unsubscribe?token='+token;
  const payload=emailContent(update.title,catalog?.summary||'A new project update is ready to read.',[{label:catalog?.buttonLabel||'Read the update',url:update.url}],link,announcementIdentity([update.topic_id]));
  await env.RECOVERY_DB.batch([env.RECOVERY_DB.prepare('INSERT INTO subscription_unsubscribe(token_hash,email,topic_id,created_at) VALUES(?,?,?,?)').bind(await hash(token),email,update.topic_id,now()),env.RECOVERY_DB.prepare('INSERT INTO subscription_auto_delivery_meta(update_id,email,payload_json,idempotency_key) VALUES(?,?,?,?)').bind(id,email,JSON.stringify(payload),'update-'+await hash(id+':'+email))]);
  meta=await env.RECOVERY_DB.prepare('SELECT * FROM subscription_auto_delivery_meta WHERE update_id=? AND email=?').bind(id,email).first();
 }
 const payload=JSON.parse(meta.payload_json);if(!payload.subject||!payload.text)throw Error('Existing delivery has no recoverable frozen payload. Review it before any resend.');
 const stillActive=await env.RECOVERY_DB.prepare('SELECT 1 FROM subscriber_topics s JOIN subscription_topics t ON t.id=s.topic_id WHERE s.email=? AND s.topic_id=? AND s.active=1 AND s.confirmed_at IS NOT NULL AND julianday(s.confirmed_at) IS NOT NULL AND julianday(s.confirmed_at)<=julianday(CURRENT_TIMESTAMP) AND t.enabled=1').bind(email,update.topic_id).first();
 if(!stillActive){skipped++;await env.RECOVERY_DB.prepare("UPDATE subscription_deliveries SET status='skipped' WHERE update_id=? AND email=?").bind(id,email).run();continue;}
 await env.RECOVERY_DB.prepare('UPDATE subscription_auto_delivery_meta SET first_attempt_at=COALESCE(first_attempt_at,?),last_attempt_at=?,last_error=NULL WHERE update_id=? AND email=?').bind(now(),now(),id,email).run();
 const response=await sendEmail(env,meta.idempotency_key,email,payload.subject,payload.text,deliveryExtras(payload),AbortSignal.timeout(15000));
 const data=await response.json().catch(()=>({})),accepted=response.ok&&typeof data.id==='string'&&!!data.id,state=accepted?'sent':response.status>=400&&response.status<500&&response.status!==409?'rejected':'uncertain';
 if(accepted)sent++;else held++;
 await env.RECOVERY_DB.batch([env.RECOVERY_DB.prepare('UPDATE subscription_deliveries SET status=?,resend_id=? WHERE update_id=? AND email=?').bind(state,accepted?data.id:null,id,email),env.RECOVERY_DB.prepare('UPDATE subscription_auto_delivery_meta SET last_error=? WHERE update_id=? AND email=?').bind(accepted?null:safeError('Resend HTTP '+response.status+'; '+(data.name||'')+': '+(data.message||'Acceptance unconfirmed')),id,email)]);
 }catch(error){held++;await env.RECOVERY_DB.batch([env.RECOVERY_DB.prepare("UPDATE subscription_deliveries SET status='uncertain' WHERE update_id=? AND email=?").bind(id,email),env.RECOVERY_DB.prepare('INSERT INTO subscription_auto_delivery_meta(update_id,email,payload_json,idempotency_key,first_attempt_at,last_attempt_at,last_error) VALUES(?,?,?,?,?,?,?) ON CONFLICT(update_id,email) DO UPDATE SET last_error=excluded.last_error,last_attempt_at=excluded.last_attempt_at').bind(id,email,'{}','update-'+await hash(id+':'+email),now(),now(),safeError(error))]);}
 await new Promise(resolve=>setTimeout(resolve,600));
 }

 const remaining=await env.RECOVERY_DB.prepare("SELECT COUNT(*) n FROM subscription_deliveries WHERE update_id=? AND status='pending'").bind(id).first();
 return view(env,`Announcement sent to ${sent} subscriber${sent===1?'':'s'} in this batch. ${remaining.n?`${remaining.n} still waiting; click Send announcement again.`:'No emails remain waiting to send.'}${skipped?` ${skipped} skipped after opting out.`:''}${held?` ${held} delivery result${held===1?'':'s'} need review in Resend.`:''}`);
 }catch{return page('<h1>Subscription administration temporarily unavailable</h1><p>The subscription migration must be applied before this feature is enabled.</p>',503)}
}
