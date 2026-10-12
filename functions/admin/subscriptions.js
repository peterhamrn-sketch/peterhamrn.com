import {announcementSection,announcementPreview,announcementAction} from '../_recovery/announcement-manager.js';
import {safeError} from '../_recovery/email-content.js';
import {publisherRequest} from '../_mini/publisher.js';
import {easternLabel} from '../_mini/scheduling.js';
import {now,random,hash,esc,page,sameOrigin,adminAuth,sendEmail} from '../_recovery/subscriptions.js';
import {publishedUpdates} from '../_recovery/published-updates.js';
async function view(env,message='',editID=''){
 const [people,topics,updates]=await Promise.all([
 env.RECOVERY_DB.prepare('SELECT s.email,s.created_at,t.topic_id,t.active FROM subscribers s LEFT JOIN subscriber_topics t ON t.email=s.email ORDER BY s.email,t.topic_id').all(),
 env.RECOVERY_DB.prepare('SELECT t.id,t.label,t.enabled,COUNT(CASE WHEN s.active=1 AND s.confirmed_at IS NOT NULL AND julianday(s.confirmed_at) IS NOT NULL AND julianday(s.confirmed_at)<=julianday(CURRENT_TIMESTAMP) THEN 1 END) active FROM subscription_topics t LEFT JOIN subscriber_topics s ON s.topic_id=t.id GROUP BY t.id ORDER BY t.label').all(),
 env.RECOVERY_DB.prepare('SELECT u.id,u.title,d.status,COUNT(d.email) n FROM subscription_updates u LEFT JOIN subscription_deliveries d ON d.update_id=u.id GROUP BY u.id,d.status').all()]);
 const topicNames=new Map(topics.results.map(t=>[t.id,t.label]));
 const count=(id,status)=>Number(updates.results.find(u=>u.id===id&&u.status===status)?.n||0);
 const legacyErrors=(await env.RECOVERY_DB.prepare('SELECT update_id,last_error FROM subscription_auto_delivery_meta WHERE last_error IS NOT NULL').all()).results||[];
 const prepared=id=>updates.results.some(u=>u.id===id);
 const statusNames={pending:'Waiting to send',sent:'Emails sent',skipped:'Skipped because the subscriber opted out',sending:'Delivery in progress or awaiting review',uncertain:'Delivery needs review',rejected:'Email service rejected the send'};
 const announcements=publishedUpdates.map(p=>{
 const ready=prepared(p.id),pending=count(p.id,'pending'),audience=Number(topics.results.find(t=>t.id===p.topic)?.active||0);
 return `<section><h3>${esc(p.title)}</h3><p>${esc(p.summary||'A new project update is available.')}</p><p><a href="${esc(p.url)}">Read the published update</a> · Audience: ${esc(topicNames.get(p.topic)||p.topic)}</p><form method="post"><input type="hidden" name="id" value="${esc(p.id)}">${!ready?`<p>${audience} confirmed subscriber${audience===1?'':'s'}. Prepare saves this recipient list without sending email.</p><button name="action" value="prepare">Prepare email for ${audience} subscriber${audience===1?'':'s'}</button>`:pending?`<p>${pending} email${pending===1?'':'s'} waiting to send.</p><button name="action" value="send">Approve and Send announcement${pending>25?' to next 25 subscribers':''}</button>`:'<p>No emails are waiting to send for this update.</p>'}</form>${ready?`<ul>${updates.results.filter(u=>u.id===p.id&&u.status).map(u=>`<li>${esc(statusNames[u.status]||u.status)}: ${u.n}</li>`).join('')}</ul>`:''}</section>`;
 }).join('')+legacyErrors.filter(e=>publishedUpdates.some(p=>p.id===e.update_id)).map(e=>`<p>${esc(e.last_error)}</p>`).join('');
 const events=env.LITTLE_MINI_DB?(await env.LITTLE_MINI_DB.prepare(`SELECT event_id,MAX(published_at) published_at,MAX(number) number,MAX(status) status,MAX(last_error) last_error FROM mini_publication_outbox GROUP BY event_id ORDER BY published_at DESC LIMIT 10`).all()).results||[]:[];
 const automatic=(await Promise.all(events.map(async e=>{
  const metadata=await env.RECOVERY_DB.prepare('SELECT * FROM subscription_automatic_updates WHERE update_id=?').bind(e.event_id).first();
  const rows=updates.results.filter(u=>u.id===e.event_id),total=rows.reduce((sum,r)=>sum+Number(r.n),0),accepted=count(e.event_id,'sent'),failures=count(e.event_id,'rejected')+count(e.event_id,'uncertain')+count(e.event_id,'sending'),pending=count(e.event_id,'pending');
  const title=metadata?JSON.parse(metadata.details_json).title:'Little Mini Update: Chapter '+e.number+' Is Here!';
  return `<section><h3>${esc(title)}</h3><p>Published: ${esc(easternLabel(e.published_at))}</p><p>Recipients: ${metadata?total:'Not prepared yet'} · Accepted by Resend: ${accepted} · Failures or unconfirmed deliveries: ${failures} · Pending: ${pending} · Skipped: ${count(e.event_id,'skipped')}</p><p>Status: ${esc(metadata?.state||e.status)}</p>${metadata?.last_error||e.last_error?`<p class="notice">${esc(metadata?.last_error||e.last_error)}</p>`:''}${e.status!=='complete'||failures||pending?`<form method="post"><input type="hidden" name="id" value="${esc(e.event_id)}"><button name="action" value="retry-automatic">Retry pending or failed announcement</button></form>`:''}</section>`;
 }))).join('');
 const composer=await announcementSection(env,editID);
 const subscriberCount=new Set(people.results.map(p=>p.email)).size;
 return page(`<h1>Email Subscriptions Admin</h1>${message?`<p class="notice">${esc(message)}</p>`:''}${composer}<h2>Automatic publication announcements</h2><p>Successful project releases create topic-specific emails. Matching Little Mini chapters released together receive one combined announcement. Accepted means Resend accepted the message; inbox delivery is not confirmed. Unconfirmed sends older than 23 hours require review in Resend before another send.</p>${automatic||'<p>No automatic publication announcements yet.</p>'}<h2>Send a project update</h2><p>Choose the published update below. First prepare its recipient list, then send the announcement. Each subscriber receives each update once. For larger lists, send up to 25 emails at a time until none remain.</p>${announcements}<h2>Subscribers and preferences</h2><p>${subscriberCount} subscriber${subscriberCount===1?'':'s'}</p><div class="scroll"><table><tr><th>Email</th><th>Project</th><th>Preference</th></tr>${people.results.map(p=>`<tr><td><!--email_off-->${esc(p.email)}<!--/email_off--></td><td>${esc(topicNames.get(p.topic_id)||p.topic_id||'—')}</td><td>${p.active?'Subscribed':'Off'}</td></tr>`).join('')}</table></div><h2>Subscription topics</h2><ul>${topics.results.map(t=>`<li>${esc(t.label)}: ${t.active} active subscriber${Number(t.active)===1?'':'s'}; ${t.enabled?'enabled':'disabled'}</li>`).join('')}</ul><details><summary>Add a future project topic</summary><form method="post"><input type="hidden" name="action" value="topic"><label>Topic ID (for example, a-new-project)<input name="id" pattern="[a-z0-9]+(-[a-z0-9]+)*" maxlength="64" required></label><label>Project name<input name="label" maxlength="100" required></label><button>Add topic</button></form></details><p>Delivery marked as awaiting review will not be resent automatically. Review these messages in Resend before taking further action.</p>`);

}
export async function onRequest({request,env}){
 if(!await adminAuth(request,env)){const r=page('<h1>Authorization required</h1>',401);r.headers.set('WWW-Authenticate','Basic realm="Subscriptions Admin", charset="UTF-8"');return r}
 try{
 if(!['GET','POST'].includes(request.method))return page('<h1>Method not allowed</h1>',405);
 if(request.method==='GET'){const url=new URL(request.url);if(url.searchParams.has('preview'))return announcementPreview(env,url.searchParams.get('preview'));return view(env,'',url.searchParams.get('edit')||'');}
 if(!sameOrigin(request))return page('<h1>Request rejected</h1>',403);
 const f=await request.formData(),action=f.get('action'),id=String(f.get('id')||'');
 if(String(action).startsWith('announcement-')){try{return view(env,await announcementAction(env,f));}catch(error){return view(env,error.message||'Announcement operation was not completed.');}}
 if(action==='topic'){const label=String(f.get('label')||'').trim();if(!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)||id.length>64||!label||label.length>100)return page('<h1>Invalid topic</h1>',400);await env.RECOVERY_DB.prepare('INSERT OR IGNORE INTO subscription_topics(id,label) VALUES(?,?)').bind(id,label).run();return view(env,'Topic added. No subscribers were enrolled.');}
 if(action==='retry-automatic'){
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
 ]);return view(env,'Recipient list prepared. Click Send announcement to send the email.');
 }
 if(action!=='send')return page('<h1>Unknown action</h1>',400);
 if(!env.RESEND_API_KEY)return page('<h1>Email is not configured</h1>',503);
 const update=await env.RECOVERY_DB.prepare('SELECT * FROM subscription_updates WHERE id=?').bind(id).first();if(!update)return view(env,'Prepare this announcement first.');
 const recipients=await env.RECOVERY_DB.prepare("SELECT email FROM subscription_deliveries WHERE update_id=? AND status='pending' LIMIT 25").bind(id).all();
 let sent=0,held=0,skipped=0;
 for(const recipient of recipients.results){
 const email=recipient.email;
 const claim=await env.RECOVERY_DB.prepare("UPDATE subscription_deliveries SET status='sending' WHERE update_id=? AND email=? AND status='pending' RETURNING email").bind(id,email).first();if(!claim)continue;
 const active=await env.RECOVERY_DB.prepare('SELECT 1 active FROM subscriber_topics WHERE email=? AND topic_id=? AND active=1 AND confirmed_at IS NOT NULL AND julianday(confirmed_at) IS NOT NULL AND julianday(confirmed_at)<=julianday(CURRENT_TIMESTAMP) AND EXISTS(SELECT 1 FROM subscription_topics WHERE id=topic_id AND enabled=1)').bind(email,update.topic_id).first();if(!active){skipped++;await env.RECOVERY_DB.prepare("UPDATE subscription_deliveries SET status='skipped' WHERE update_id=? AND email=?").bind(id,email).run();continue}
 const token=random();await env.RECOVERY_DB.prepare('INSERT INTO subscription_unsubscribe(token_hash,email,topic_id,created_at) VALUES(?,?,?,?)').bind(await hash(token),email,update.topic_id,now()).run();
 const link=`https://peterhamrn.com/subscriptions-unsubscribe?token=${token}`;
 const content=publishedUpdates.find(p=>p.id===id),summary=content?.summary||'A new project update is ready to read.',button=content?.buttonLabel||'Read the update';
 const text=`${update.title}\n\n${summary}\n\n${button}: ${update.url}\n\nYou received this email because you subscribed to this project on PeterHamRN.com.\nManage subscriptions: https://peterhamrn.com/subscriptions\nUnsubscribe from this project: ${link}`;
 const html=`<!doctype html><html lang="en"><body style="margin:0;background:#f4f7fb;font-family:Arial,sans-serif;color:#102440"><div style="max-width:600px;margin:24px auto;padding:32px;background:#fff;border-radius:12px"><p style="color:#0b62bf;font-weight:bold">PeterHamRN.com</p><h1 style="font-size:26px;line-height:1.3">${esc(update.title)}</h1><p style="font-size:17px;line-height:1.6">${esc(summary)}</p><p style="margin:28px 0"><a href="${esc(update.url)}" style="display:inline-block;background:#0b62bf;color:#fff;text-decoration:none;padding:14px 22px;border-radius:7px;font-weight:bold">${esc(button)}</a></p><p style="font-size:13px;line-height:1.6;color:#526478">You received this email because you subscribed to this project on PeterHamRN.com.</p><p style="font-size:13px"><a href="https://peterhamrn.com/subscriptions">Manage subscriptions</a> · <a href="${esc(link)}">Unsubscribe from this project</a></p></div></body></html>`;
 try{const response=await sendEmail(env,`update-${await hash(`${id}:${email}`)}`,email,update.title,text,{html,headers:{'List-Unsubscribe':`<${link}>`,'List-Unsubscribe-Post':'List-Unsubscribe=One-Click'}});
 const data=await response.json().catch(()=>({})),accepted=response.ok&&typeof data.id==='string'&&!!data.id,state=accepted?'sent':response.status>=400&&response.status<500&&response.status!==409?'rejected':'uncertain';
 if(accepted)sent++;else held++;
 await env.RECOVERY_DB.batch([env.RECOVERY_DB.prepare('UPDATE subscription_deliveries SET status=?,resend_id=? WHERE update_id=? AND email=?').bind(state,accepted?data.id:null,id,email),env.RECOVERY_DB.prepare('INSERT OR IGNORE INTO subscription_auto_delivery_meta(update_id,email,payload_json,idempotency_key,first_attempt_at,last_attempt_at,last_error) VALUES(?,?,?,?,?,?,?)').bind(id,email,'{}','update-'+await hash(id+':'+email),now(),now(),accepted?null:safeError('Resend HTTP '+response.status+'; '+(data.name||'')+': '+(data.message||'Acceptance unconfirmed')))]);
 }catch(error){held++;await env.RECOVERY_DB.batch([env.RECOVERY_DB.prepare("UPDATE subscription_deliveries SET status='uncertain' WHERE update_id=? AND email=?").bind(id,email),env.RECOVERY_DB.prepare('INSERT OR IGNORE INTO subscription_auto_delivery_meta(update_id,email,payload_json,idempotency_key,first_attempt_at,last_attempt_at,last_error) VALUES(?,?,?,?,?,?,?)').bind(id,email,'{}','update-'+await hash(id+':'+email),now(),now(),safeError(error))])}
 }
 const remaining=await env.RECOVERY_DB.prepare("SELECT COUNT(*) n FROM subscription_deliveries WHERE update_id=? AND status='pending'").bind(id).first();
 return view(env,`Announcement sent to ${sent} subscriber${sent===1?'':'s'} in this batch. ${remaining.n?`${remaining.n} still waiting; click Send announcement again.`:'No emails remain waiting to send.'}${skipped?` ${skipped} skipped after opting out.`:''}${held?` ${held} delivery result${held===1?'':'s'} need review in Resend.`:''}`);
 }catch{return page('<h1>Subscription administration temporarily unavailable</h1><p>The subscription migration must be applied before this feature is enabled.</p>',503)}
}
