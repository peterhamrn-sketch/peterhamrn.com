import {hash,now} from '../../_recovery/subscriptions.js';
import {announcePublication} from '../../_recovery/automatic-announcements.js';
export async function onRequest({request,env}){
 if(request.method!=='POST'||!env.LITTLE_MINI_SETUP_SECRET||await hash(request.headers.get('Authorization')||'')!==await hash('Bearer '+env.LITTLE_MINI_SETUP_SECRET))return new Response('Not found',{status:404});
 let id;
 try{
  const input=await request.json();id=input.event_id;
  if(typeof id!=='string'||id.length>150)throw Error('Invalid publication event.');
  const rows=(await env.LITTLE_MINI_DB.prepare(`SELECT o.* FROM mini_publication_outbox o JOIN mini_chapters c ON c.id=o.chapter_id WHERE o.event_id=? AND c.status='published' AND c.published_revision IS NOT NULL ORDER BY o.kind DESC`).bind(id).all()).results||[];
  if(!rows.length)throw Error('An actual published update is required.');
  const first=rows[0],p={id,topic:first.topic_id,title:`Little Mini Update: Chapter ${first.number} Is Here!`,intro:'The Little Mini adventure continues. The newly published chapter'+(rows.length>1?'s are':' is')+' ready to read.',publishedAt:first.published_at,links:rows.map(r=>({kind:r.kind,title:r.title,url:'https://peterhamrn.com'+r.path}))};
  return Response.json(await announcePublication(env,p,input.retry===true),{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  if(id)await env.RECOVERY_DB.prepare("UPDATE subscription_automatic_updates SET state='failed',last_error=?,updated_at=? WHERE update_id=?").bind(String(error),now(),id).run().catch(()=>{});
  return Response.json({error:String(error)},{status:503,headers:{'Cache-Control':'no-store'}});
 }
}
