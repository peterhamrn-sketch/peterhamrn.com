import {now,random,hash,sendEmail} from './subscriptions.js';
import {emailContent} from './email-content.js';
import {announcementIdentity,deliveryExtras} from './announcement-identities.js';
function sanitizedError(value){
 return String(value||'').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[email redacted]').replace(/Bearer\s+\S+/gi,'Bearer [redacted]').replace(/re_[A-Za-z0-9_]+/g,'[key redacted]').replace(/([?&]token=)[^\s&]+/gi,'$1[redacted]').replace(/[\r\n]+/g,' ').slice(0,500);
}
// A publication descriptor can be supplied by another project's authenticated publication hook.
export async function announcePublication(env,p,retry=false){
 const db=env.RECOVERY_DB;
 const topic=await db.prepare('SELECT id FROM subscription_topics WHERE id=? AND enabled=1').bind(p.topic).first();
 if(!topic)throw Error('The publication subscription topic is disabled or missing.');
 await db.batch([
  db.prepare('INSERT OR IGNORE INTO subscription_updates(id,topic_id,title,url,published_at,created_at) VALUES(?,?,?,?,?,?)').bind(p.id,p.topic,p.title,p.links[0].url,p.publishedAt,now()),
  db.prepare("INSERT OR IGNORE INTO subscription_automatic_updates(update_id,details_json,updated_at) VALUES(?,?,?)").bind(p.id,JSON.stringify(p),now()),
  db.prepare(`INSERT OR IGNORE INTO subscription_deliveries(update_id,email,status,created_at)
   SELECT ?,email,'pending',? FROM subscriber_topics WHERE topic_id=? AND active=1 AND confirmed_at IS NOT NULL AND julianday(confirmed_at) IS NOT NULL AND julianday(confirmed_at)<=julianday(?)
   AND EXISTS(SELECT 1 FROM subscription_updates WHERE id=? AND audience_frozen=0)`).bind(p.id,now(),p.topic,p.publishedAt,p.id),
  db.prepare('UPDATE subscription_updates SET audience_frozen=1 WHERE id=?').bind(p.id)
 ]);
 // Public availability is checked at delivery time, never inferred from a draft or a schedule.
 for(const link of p.links){
  const response=await fetch(link.url,{method:'GET',redirect:'manual',signal:AbortSignal.timeout(10000)});
  await response.body?.cancel();
  if(response.status>=300&&response.status<400)throw Error('Published chapter URL redirected (HTTP '+response.status+'). Resolve the public URL before retrying this announcement.');
  if(!response.ok)throw Error('Published chapter is not publicly available (HTTP '+response.status+'). Retry after resolving the public route.');
 }
 if(!env.RESEND_API_KEY)throw Error('Resend is not configured.');
 const lease=await db.prepare(`UPDATE subscription_automatic_updates SET state='sending',updated_at=? WHERE update_id=? AND (state!='sending' OR updated_at<?) RETURNING update_id`).bind(now(),p.id,new Date(Date.now()-90000).toISOString()).first();
 if(!lease)return {busy:true,pending:0,failures:0};
 const eligible=retry?"('pending','rejected','uncertain','sending')":"('pending')";
 const recipients=(await db.prepare(`SELECT d.email,d.status,m.first_attempt_at,m.last_attempt_at FROM subscription_deliveries d
  LEFT JOIN subscription_auto_delivery_meta m ON m.update_id=d.update_id AND m.email=d.email
  WHERE d.update_id=? AND d.status IN ${eligible} ORDER BY CASE d.status WHEN 'pending' THEN 0 ELSE 1 END,d.email LIMIT 2`).bind(p.id).all()).results||[];
 let busy=false;
 for(const r of recipients){
  if(r.status==='sending'&&r.last_attempt_at&&Date.now()-Date.parse(r.last_attempt_at)<90000){busy=true;continue;}
  // Unknown acceptance must not be replayed after the provider's 24-hour idempotency window.
  if(['sending','uncertain'].includes(r.status)&&r.first_attempt_at&&Date.now()-Date.parse(r.first_attempt_at)>=23*3600000)continue;
  const claim=await db.prepare(`UPDATE subscription_deliveries SET status='sending' WHERE update_id=? AND email=? AND status=?
   AND (status!='sending' OR NOT EXISTS(SELECT 1 FROM subscription_auto_delivery_meta WHERE update_id=? AND email=? AND last_attempt_at>?)) RETURNING email`).bind(p.id,r.email,r.status,p.id,r.email,new Date(Date.now()-90000).toISOString()).first();
  if(!claim){busy=true;continue;}
  try{
   const active=await db.prepare('SELECT 1 FROM subscriber_topics s JOIN subscription_topics t ON t.id=s.topic_id WHERE s.email=? AND s.topic_id=? AND s.active=1 AND s.confirmed_at IS NOT NULL AND julianday(s.confirmed_at) IS NOT NULL AND julianday(s.confirmed_at)<=julianday(CURRENT_TIMESTAMP) AND t.enabled=1').bind(r.email,p.topic).first();
   if(!active){await db.prepare("UPDATE subscription_deliveries SET status='skipped' WHERE update_id=? AND email=?").bind(p.id,r.email).run();continue;}
   let meta=await db.prepare('SELECT * FROM subscription_auto_delivery_meta WHERE update_id=? AND email=?').bind(p.id,r.email).first();
   if(!meta){
    const token=random(),link='https://peterhamrn.com/subscriptions-unsubscribe?token='+token;
    const links=p.links.map(l=>({label:(l.kind==='story'?'Humorous Story: ':l.kind==='manual'?'Technical Manual: ':'')+l.title,url:l.url}));
    const payload=emailContent(p.title,p.intro,links,link,announcementIdentity([p.topic]));
    await db.batch([db.prepare('INSERT INTO subscription_unsubscribe(token_hash,email,topic_id,created_at) VALUES(?,?,?,?)').bind(await hash(token),r.email,p.topic,now()),db.prepare('INSERT OR IGNORE INTO subscription_auto_delivery_meta(update_id,email,payload_json,idempotency_key) VALUES(?,?,?,?)').bind(p.id,r.email,JSON.stringify(payload),'auto-'+await hash(p.id+':'+r.email))]);
    meta=await db.prepare('SELECT * FROM subscription_auto_delivery_meta WHERE update_id=? AND email=?').bind(p.id,r.email).first();
   }
   await db.prepare('UPDATE subscription_auto_delivery_meta SET first_attempt_at=COALESCE(first_attempt_at,?),last_attempt_at=?,last_error=NULL WHERE update_id=? AND email=?').bind(now(),now(),p.id,r.email).run();
   const stillEligible=await db.prepare('SELECT 1 FROM subscriber_topics s JOIN subscription_topics t ON t.id=s.topic_id WHERE s.email=? AND s.topic_id=? AND s.active=1 AND s.confirmed_at IS NOT NULL AND julianday(s.confirmed_at) IS NOT NULL AND julianday(s.confirmed_at)<=julianday(CURRENT_TIMESTAMP) AND t.enabled=1').bind(r.email,p.topic).first();
   if(!stillEligible){await db.prepare("UPDATE subscription_deliveries SET status='skipped' WHERE update_id=? AND email=?").bind(p.id,r.email).run();continue;}
   const payload=JSON.parse(meta.payload_json);
   const response=await sendEmail(env,meta.idempotency_key,r.email,payload.subject,payload.text,deliveryExtras(payload),AbortSignal.timeout(15000));
   const data=await response.json().catch(()=>({}));
   const detail='Resend acceptance unconfirmed; HTTP '+response.status+(data.name?'; '+sanitizedError(data.name):'')+(data.message?': '+sanitizedError(data.message):'');
   const state=response.ok&&typeof data.id==='string'&&data.id?'sent':response.status>=400&&response.status<500&&response.status!==409?'rejected':'uncertain';
   await db.batch([db.prepare('UPDATE subscription_deliveries SET status=?,resend_id=? WHERE update_id=? AND email=?').bind(state,state==='sent'?data.id:null,p.id,r.email),db.prepare('UPDATE subscription_auto_delivery_meta SET last_error=? WHERE update_id=? AND email=?').bind(state==='sent'?null:detail,p.id,r.email)]);
  }catch(error){await db.batch([db.prepare("UPDATE subscription_deliveries SET status='uncertain' WHERE update_id=? AND email=?").bind(p.id,r.email),db.prepare('UPDATE subscription_auto_delivery_meta SET last_error=? WHERE update_id=? AND email=?').bind(sanitizedError(error),p.id,r.email)]);}
  // Finite delivery pacing, not a publication polling loop.
  await new Promise(resolve=>setTimeout(resolve,600));
 }
 const counts=(await db.prepare('SELECT status,COUNT(*) n FROM subscription_deliveries WHERE update_id=? GROUP BY status').bind(p.id).all()).results||[];
 const n=status=>Number(counts.find(c=>c.status===status)?.n||0);
 const result={accepted:n('sent'),pending:n('pending'),failures:n('rejected')+n('uncertain')+n('sending'),recipients:counts.reduce((sum,c)=>sum+Number(c.n),0),busy};
 const failure=await db.prepare("SELECT m.last_error FROM subscription_auto_delivery_meta m JOIN subscription_deliveries d ON d.update_id=m.update_id AND d.email=m.email WHERE m.update_id=? AND d.status IN ('rejected','uncertain','sending') AND m.last_error IS NOT NULL ORDER BY m.last_attempt_at DESC LIMIT 1").bind(p.id).first();
 await db.prepare('UPDATE subscription_automatic_updates SET state=?,last_error=?,updated_at=? WHERE update_id=?').bind(result.failures?'failed':result.pending?'pending':'complete',failure?.last_error||null,now(),p.id).run();
 return result;
}
