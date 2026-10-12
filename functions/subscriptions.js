import {now,plus,esc,random,hash,mac,page,sameOrigin,sendEmail,cookie,session} from './_recovery/subscriptions.js';
const norm=v=>String(v||'').trim().toLowerCase();
const valid=v=>v.length<=254&&/^[^\s@<>"?&#]+@[^\s@<>"?&#]+\.[^\s@<>"?&#]+$/.test(v);
async function resolveTopic(env,id){
 if(id==='classes-both'){
  const rows=(await env.RECOVERY_DB.prepare("SELECT id FROM subscription_topics WHERE enabled=1 AND id IN ('classes-basic','classes-advanced')").all()).results||[];
  return rows.length===2?{id,label:'Basic and Advanced ASM Classes',topics:['classes-basic','classes-advanced']}:null;
 }
 return env.RECOVERY_DB.prepare('SELECT id,label FROM subscription_topics WHERE id=? AND enabled=1').bind(id).first();
}
function signup(topic,message=''){return page(`<h1>${topic?'Subscribe to '+esc(topic.label)+' Updates':'Manage My Subscriptions'}</h1><p>${topic?'Only your selected project or class preferences will be enabled after you confirm your email.':'Confirm your email to view and change your project subscriptions.'}</p>${message?`<p>${esc(message)}</p>`:''}<form method="post"><input type="hidden" name="action" value="send"><input type="hidden" name="topic" value="${esc(topic?.id||'')}"><label>Email address<input type="email" name="email" required maxlength="254" autocomplete="email"></label><button>Send confirmation code</button></form><a href="/subscriptions">Manage my subscriptions</a>`)}
function codeForm(id,email,topic,message=''){return page(`<h1>Check Your Email</h1><p>Enter the six-digit code for ${esc(topic?.label||'subscription management')} sent to ${esc(email)}. It expires in 10 minutes.</p><p>${esc(message)}</p><form method="post"><input type="hidden" name="action" value="verify"><input type="hidden" name="id" value="${esc(id)}"><input type="hidden" name="topic" value="${esc(topic?.id||'')}"><input type="hidden" name="email" value="${esc(email)}"><label>Confirmation code<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required></label><button>Confirm</button></form>`)}
async function dashboard(env,email,message=''){const q=await env.RECOVERY_DB.prepare('SELECT t.id,t.label,COALESCE(s.active,0) active FROM subscription_topics t LEFT JOIN subscriber_topics s ON s.topic_id=t.id AND s.email=? WHERE t.enabled=1 ORDER BY t.label').bind(email).all();return page(`<h1>Manage My Subscriptions</h1><p>Signed in as ${esc(email)}</p><p class="notice">${esc(message)}</p><form method="post"><input type="hidden" name="action" value="save">${q.results.map(t=>`<label><input type="checkbox" name="topics" value="${esc(t.id)}" ${t.active?'checked':''}>${esc(t.label)}</label>`).join('')}<button>Save preferences</button></form><form method="post"><input type="hidden" name="action" value="unsubscribe-all"><button>Unsubscribe from everything</button></form><form method="post"><input type="hidden" name="action" value="signout"><button>Sign out</button></form>`)}
export async function onRequest({request,env}){try{
 if(!['GET','POST'].includes(request.method))return page('<h1>Method not allowed</h1>',405);
 if(!env.RECOVERY_DB||!env.RESEND_API_KEY||!env.RECOVERY_OTP_SECRET)return page('<h1>Email updates are temporarily unavailable</h1>',503);
 const u=new URL(request.url),s=await session(request,env);
 if(request.method==='GET'){const id=u.searchParams.get('topic');if(id){const t=await resolveTopic(env,id);return t?signup(t):page('<h1>Unknown project</h1>',404)}return s?dashboard(env,s.email):signup(null)}
 if(!sameOrigin(request))return page('<h1>Request rejected</h1>',403);
 const f=await request.formData(),a=f.get('action'),topicId=String(f.get('topic')||''),topic=topicId?await resolveTopic(env,topicId):null;
 if(topicId&&!topic)return page('<h1>Unknown project</h1>',400);
 if(a==='send'){
 const email=norm(f.get('email'));if(!valid(email))return signup(topic,'Enter a valid email address.');
 const ip=await mac(env.RECOVERY_OTP_SECRET,request.headers.get('CF-Connecting-IP')||'unknown');
 const recent=await env.RECOVERY_DB.prepare('SELECT COUNT(*) n,MAX(created_at) latest FROM subscription_challenges WHERE created_at>? AND (email=? OR ip_mac=?)').bind(plus(-60),email,ip).first();
 if(recent.n>=5||recent.latest&&Date.now()-Date.parse(recent.latest)<60000)return signup(topic,'Please wait before requesting another code.');
 const id=crypto.randomUUID();let n;do{n=crypto.getRandomValues(new Uint32Array(1))[0]}while(n>=4294000000);const code=String(n%1000000).padStart(6,'0');
 await env.RECOVERY_DB.prepare('INSERT INTO subscription_challenges(id,email,topic_id,code_mac,ip_mac,expires_at,created_at) VALUES(?,?,?,?,?,?,?)').bind(id,email,topic?.id||null,await mac(env.RECOVERY_OTP_SECRET,`subscription:${id}:${email}:${topicId}:${code}`),ip,plus(10),now()).run();
 const r=await sendEmail(env,id,email,topic?`Confirm ${topic.label} updates`:'Manage your subscriptions',`Your confirmation code is ${code}. It expires in 10 minutes.\n\n${topic?`This confirms only ${topic.label} updates.`:'This signs you in to manage your subscriptions; it does not enroll you.'}\n\nIf you did not request this code, ignore this email.`);
 if(!r.ok){await env.RECOVERY_DB.prepare('DELETE FROM subscription_challenges WHERE id=?').bind(id).run();return signup(topic,'Email could not be sent. Please try again later.')}return codeForm(id,email,topic);
 }
 if(a==='verify'){
 const id=String(f.get('id')||''),email=norm(f.get('email')),code=String(f.get('code')||'');
 const c=await env.RECOVERY_DB.prepare('SELECT * FROM subscription_challenges WHERE id=? AND email=? AND COALESCE(topic_id,\'\')=?').bind(id,email,topicId).first();
 if(!c||c.consumed_at||c.expires_at<=now()||c.attempts>=5)return signup(topic,'That code is invalid or expired. Request another.');
 // Reserve an attempt atomically, including successful submissions, to cap concurrent guesses.
 const attempt=await env.RECOVERY_DB.prepare('UPDATE subscription_challenges SET attempts=attempts+1 WHERE id=? AND attempts<5 AND consumed_at IS NULL AND expires_at>? RETURNING id').bind(id,now()).first();
 if(!attempt||!/^\d{6}$/.test(code)||await mac(env.RECOVERY_OTP_SECRET,`subscription:${id}:${email}:${topicId}:${code}`)!==c.code_mac)return codeForm(id,email,topic,'The code is not correct.');
 const consumed=await env.RECOVERY_DB.prepare('UPDATE subscription_challenges SET consumed_at=? WHERE id=? AND consumed_at IS NULL RETURNING id').bind(now(),id).first();if(!consumed)return signup(topic,'That code has already been used.');
 const raw=random(),writes=[env.RECOVERY_DB.prepare('INSERT OR IGNORE INTO subscribers(email) VALUES(?)').bind(email),env.RECOVERY_DB.prepare('INSERT INTO subscription_sessions(session_hash,email,expires_at) VALUES(?,?,?)').bind(await hash(raw),email,plus(60))];
 if(topic)for(const topicID of topic.topics||[topic.id])writes.push(env.RECOVERY_DB.prepare('INSERT INTO subscriber_topics(email,topic_id,active,confirmed_at,updated_at) VALUES(?,?,1,?,?) ON CONFLICT(email,topic_id) DO UPDATE SET active=1,confirmed_at=excluded.confirmed_at,updated_at=excluded.updated_at').bind(email,topicID,now(),now()));
 await env.RECOVERY_DB.batch(writes);const r=await dashboard(env,email,topic?`${topic.label} updates confirmed.`:'Email confirmed.');r.headers.set('Set-Cookie',`subscription_session=${raw}; Path=/subscriptions; Max-Age=3600; HttpOnly; Secure; SameSite=Strict`);return r;
 }
 if(!s)return signup(topic,'Please confirm your email first.');
 if(a==='signout'){await env.RECOVERY_DB.prepare('DELETE FROM subscription_sessions WHERE session_hash=?').bind(await hash(cookie(request))).run();const r=signup(null);r.headers.set('Set-Cookie','subscription_session=; Path=/subscriptions; Max-Age=0; HttpOnly; Secure; SameSite=Strict');return r}
 if(a==='unsubscribe-all'){await env.RECOVERY_DB.prepare('UPDATE subscriber_topics SET active=0,updated_at=? WHERE email=?').bind(now(),s.email).run();return dashboard(env,s.email,'All subscriptions disabled.');}
 if(a==='save'){const selected=new Set(f.getAll('topics').map(String)),topics=await env.RECOVERY_DB.prepare('SELECT id FROM subscription_topics WHERE enabled=1').all();await env.RECOVERY_DB.batch(topics.results.map(t=>env.RECOVERY_DB.prepare('INSERT INTO subscriber_topics(email,topic_id,active,confirmed_at,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(email,topic_id) DO UPDATE SET active=excluded.active,confirmed_at=CASE WHEN excluded.active=1 THEN excluded.confirmed_at ELSE subscriber_topics.confirmed_at END,updated_at=excluded.updated_at').bind(s.email,t.id,selected.has(t.id)?1:0,selected.has(t.id)?now():null,now())));return dashboard(env,s.email,'Preferences saved.');}
 return page('<h1>Unknown action</h1>',400);
 }catch{return page('<h1>Email updates are temporarily unavailable</h1><p>Please try again later.</p>',503)}}
