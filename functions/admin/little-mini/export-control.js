import {authorized,login,json} from '../../_mini/auth.js';
export async function onRequest({request,env}){
 if(!await authorized(request,env))return login();
 if(!env.LITTLE_MINI_DB)return json({error:'Database unavailable'},503);
 const db=env.LITTLE_MINI_DB;
 try{
  if(request.method==='GET'){
   const row=await db.prepare('SELECT * FROM mini_export_requests WHERE id=1').first();
   return json(row||{state:'idle'});
  }
  if(request.method!=='POST')return json({error:'Method not allowed'},405);
  if(request.headers.get('Origin')!==new URL(request.url).origin||!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'Request rejected'},403);
  const row=await db.prepare('SELECT state FROM mini_export_requests WHERE id=1').first();
  if(row&&['pending','running'].includes(row.state))return json({error:'An export is already pending'},409);
  await db.prepare("INSERT INTO mini_export_requests (id,request_id,state,requested_at,completed_at,count,message) VALUES (1,?,'pending',datetime('now'),NULL,NULL,NULL) ON CONFLICT(id) DO UPDATE SET request_id=excluded.request_id,state='pending',requested_at=excluded.requested_at,completed_at=NULL,count=NULL,message=NULL").bind(crypto.randomUUID()).run();
  return json({state:'pending'});
 }catch(e){return json({error:'Export control unavailable'},503)}
}
