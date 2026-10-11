import {hash,now,esc,page,sameOrigin} from './_recovery/subscriptions.js';
export async function onRequest({request,env}){try{
 if(!['GET','POST'].includes(request.method))return page('<h1>Method not allowed</h1>',405);
 const u=new URL(request.url),f=request.method==='POST'?await request.formData():null,token=String(f?.get('token')||u.searchParams.get('token')||'');
 const row=await env.RECOVERY_DB.prepare('SELECT email,topic_id FROM subscription_unsubscribe WHERE token_hash=?').bind(await hash(token)).first();if(!row)return page('<h1>Invalid unsubscribe link</h1><a href="/subscriptions">Manage subscriptions</a>',400);
 if(request.method==='GET')return page(`<h1>Unsubscribe</h1><p>Stop ${esc(row.topic_id)} updates for ${esc(row.email)}?</p><form method="post"><input type="hidden" name="token" value="${esc(token)}"><button>Unsubscribe from this project</button><button name="all" value="1">Unsubscribe from everything</button></form>`);
 // Resend one-click requests use List-Unsubscribe=One-Click without a browser Origin.
 const oneClick=f.get('List-Unsubscribe')==='One-Click'&&request.headers.get('Content-Type')?.startsWith('application/x-www-form-urlencoded');
 if(!oneClick&&!sameOrigin(request))return page('<h1>Request rejected</h1>',403);
 const all=!oneClick&&f.get('all')==='1';await env.RECOVERY_DB.prepare(all?'UPDATE subscriber_topics SET active=0,updated_at=? WHERE email=?':'UPDATE subscriber_topics SET active=0,updated_at=? WHERE email=? AND topic_id=?').bind(...(all?[now(),row.email]:[now(),row.email,row.topic_id])).run();
 return page('<h1>Unsubscribed</h1><p>Your preference has been saved.</p><a href="/subscriptions">Manage subscriptions</a>');
 }catch{return page('<h1>Temporarily unavailable</h1>',503)}}
