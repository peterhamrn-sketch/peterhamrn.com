const reply=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
async function authorized(request,env){
 if(!env.LITTLE_MINI_EXPORT_TOKEN)return false;
 const match=/^Bearer ([A-Za-z0-9_-]{32,})$/.exec(request.headers.get('Authorization')||'');
 if(!match)return false;
 const digest=async s=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
 const [a,b]=await Promise.all([digest(match[1]),digest(env.LITTLE_MINI_EXPORT_TOKEN)]);
 let mismatch=0;for(let i=0;i<a.length;i++)mismatch|=a[i]^b[i];return mismatch===0;
}
export async function onRequest({request,env}){
 if(!await authorized(request,env))return reply({error:'Unauthorized'},401);
 if(!env.LITTLE_MINI_DB)return reply({error:'Database unavailable'},503);
 const db=env.LITTLE_MINI_DB;
 try{
  if(request.method==='GET')return reply((await db.prepare('SELECT request_id,state FROM mini_export_requests WHERE id=1').first())||{state:'idle'});
  if(request.method!=='POST')return reply({error:'Method not allowed'},405);
  const {request_id,state,count,message}=await request.json();
  if(typeof request_id!=='string'||!['running','completed','failed'].includes(state))return reply({error:'Invalid update'},400);
  if(state==='running')await db.prepare("UPDATE mini_export_requests SET state='running' WHERE id=1 AND request_id=? AND state IN ('pending','running')").bind(request_id).run();
  else await db.prepare("UPDATE mini_export_requests SET state=?,completed_at=datetime('now'),count=?,message=? WHERE id=1 AND request_id=?").bind(state,Number.isInteger(count)?count:null,String(message||'').slice(0,200),request_id).run();
  return reply({ok:true});
 }catch(e){return reply({error:'Export control unavailable'},503)}
}
