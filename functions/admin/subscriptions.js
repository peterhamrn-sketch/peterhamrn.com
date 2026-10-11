import {now,random,hash,esc,page,sameOrigin,adminAuth,sendEmail} from '../_recovery/subscriptions.js';
import {publishedUpdates} from '../_recovery/published-updates.js';
async function view(env,message=''){
 const [people,topics,updates]=await Promise.all([
 env.RECOVERY_DB.prepare('SELECT s.email,s.created_at,t.topic_id,t.active FROM subscribers s LEFT JOIN subscriber_topics t ON t.email=s.email ORDER BY s.email,t.topic_id').all(),
 env.RECOVERY_DB.prepare('SELECT t.id,t.label,t.enabled,COUNT(CASE WHEN s.active=1 THEN 1 END) active FROM subscription_topics t LEFT JOIN subscriber_topics s ON s.topic_id=t.id GROUP BY t.id ORDER BY t.label').all(),
 env.RECOVERY_DB.prepare('SELECT u.id,u.title,d.status,COUNT(d.email) n FROM subscription_updates u LEFT JOIN subscription_deliveries d ON d.update_id=u.id GROUP BY u.id,d.status').all()]);
 return page(`<h1>Email Subscriptions Admin</h1><p class="notice">${esc(message)}</p><h2>Topics</h2><ul>${topics.results.map(t=>`<li>${esc(t.label)} (${esc(t.id)}): ${t.active} active; ${t.enabled?'enabled':'disabled'}</li>`).join('')}</ul><form method="post"><input type="hidden" name="action" value="topic"><label>New topic ID<input name="id" pattern="[a-z0-9]+(-[a-z0-9]+)*" maxlength="64" required></label><label>Label<input name="label" maxlength="100" required></label><button>Add topic</button></form><h2>Subscribers and preferences</h2><p>${new Set(people.results.map(p=>p.email)).size} subscribers</p><div class="scroll"><table><tr><th>Email</th><th>Topic</th><th>Preference</th></tr>${people.results.map(p=>`<tr><td>${esc(p.email)}</td><td>${esc(p.topic_id||'—')}</td><td>${p.active?'Subscribed':'Off'}</td></tr>`).join('')}</table></div><h2>Published updates</h2><p>Prepare freezes the current confirmed audience. Send delivers up to 25 pending emails per click. Preparing again does not add recipients. A new subscription never receives earlier announcements.</p><form method="post"><label>Published update<select name="id">${publishedUpdates.map(p=>`<option value="${esc(p.id)}">${esc(p.title)}</option>`).join('')}</select></label><button name="action" value="prepare">Prepare announcement</button><button name="action" value="send">Send next 25</button></form><h2>Delivery records</h2><ul>${updates.results.map(u=>`<li>${esc(u.title)}: ${esc(u.status||'No recipients')} ${u.n}</li>`).join('')}</ul><p>Sending or uncertain records are held to prevent duplicate delivery. Do not delete delivery records or change publication IDs to resend an update.</p>`);
}
export async function onRequest({request,env}){
 if(!await adminAuth(request,env)){const r=page('<h1>Authorization required</h1>',401);r.headers.set('WWW-Authenticate','Basic realm="Subscriptions Admin", charset="UTF-8"');return r}
 try{
 if(!['GET','POST'].includes(request.method))return page('<h1>Method not allowed</h1>',405);
 if(request.method==='GET')return view(env);
 if(!sameOrigin(request))return page('<h1>Request rejected</h1>',403);
 const f=await request.formData(),action=f.get('action'),id=String(f.get('id')||'');
 if(action==='topic'){const label=String(f.get('label')||'').trim();if(!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)||id.length>64||!label||label.length>100)return page('<h1>Invalid topic</h1>',400);await env.RECOVERY_DB.prepare('INSERT OR IGNORE INTO subscription_topics(id,label) VALUES(?,?)').bind(id,label).run();return view(env,'Topic added. No subscribers were enrolled.');}
 const publication=publishedUpdates.find(p=>p.id===id);if(!publication||publication.publishedAt>now())return page('<h1>Published update required</h1>',400);
 if(action==='prepare'){
 // Atomic batch: the audience is inserted only in the transaction that first creates the update.
 await env.RECOVERY_DB.batch([
 env.RECOVERY_DB.prepare('INSERT OR IGNORE INTO subscription_updates(id,topic_id,title,url,published_at,created_at) VALUES(?,?,?,?,?,?)').bind(id,publication.topic,publication.title,publication.url,publication.publishedAt,now()),
 env.RECOVERY_DB.prepare("INSERT INTO subscription_deliveries(update_id,email,status,created_at) SELECT ?,email,'pending',? FROM subscriber_topics WHERE topic_id=? AND active=1 AND EXISTS(SELECT 1 FROM subscription_updates WHERE id=? AND audience_frozen=0)").bind(id,now(),publication.topic,id),
 env.RECOVERY_DB.prepare('UPDATE subscription_updates SET audience_frozen=1 WHERE id=?').bind(id)
 ]);return view(env,'Announcement prepared for current confirmed subscribers.');
 }
 if(action!=='send')return page('<h1>Unknown action</h1>',400);
 if(!env.RESEND_API_KEY)return page('<h1>Email is not configured</h1>',503);
 const update=await env.RECOVERY_DB.prepare('SELECT * FROM subscription_updates WHERE id=?').bind(id).first();if(!update)return view(env,'Prepare this announcement first.');
 const recipients=await env.RECOVERY_DB.prepare("SELECT email FROM subscription_deliveries WHERE update_id=? AND status='pending' LIMIT 25").bind(id).all();
 for(const recipient of recipients.results){
 const email=recipient.email;
 const claim=await env.RECOVERY_DB.prepare("UPDATE subscription_deliveries SET status='sending' WHERE update_id=? AND email=? AND status='pending' RETURNING email").bind(id,email).first();if(!claim)continue;
 const active=await env.RECOVERY_DB.prepare('SELECT 1 active FROM subscriber_topics WHERE email=? AND topic_id=? AND active=1').bind(email,update.topic_id).first();if(!active){await env.RECOVERY_DB.prepare("UPDATE subscription_deliveries SET status='skipped' WHERE update_id=? AND email=?").bind(id,email).run();continue}
 const token=random();await env.RECOVERY_DB.prepare('INSERT INTO subscription_unsubscribe(token_hash,email,topic_id,created_at) VALUES(?,?,?,?)').bind(await hash(token),email,update.topic_id,now()).run();
 const link=`https://peterhamrn.com/subscriptions-unsubscribe?token=${token}`;
 try{const response=await sendEmail(env,`update-${await hash(`${id}:${email}`)}`,email,update.title,`${update.title}\n\nRead the published update: ${update.url}\n\nManage subscriptions: https://peterhamrn.com/subscriptions\nUnsubscribe: ${link}`,{headers:{'List-Unsubscribe':`<${link}>`,'List-Unsubscribe-Post':'List-Unsubscribe=One-Click'}});
 const data=await response.json().catch(()=>({}));await env.RECOVERY_DB.prepare('UPDATE subscription_deliveries SET status=?,resend_id=? WHERE update_id=? AND email=?').bind(response.ok?'sent':'rejected',data.id||null,id,email).run();
 }catch{await env.RECOVERY_DB.prepare("UPDATE subscription_deliveries SET status='uncertain' WHERE update_id=? AND email=?").bind(id,email).run()}
 }
 return view(env,'Batch processed. Pending recipients can be sent with the next click.');
 }catch{return page('<h1>Subscription administration temporarily unavailable</h1><p>The subscription migration must be applied before this feature is enabled.</p>',503)}
}
