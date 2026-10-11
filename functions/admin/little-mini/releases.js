import {authorized,login,json} from '../../_mini/auth.js';
import {easternLabel,chapterStatusLabel,releaseAction} from '../../_mini/scheduling.js';
export async function onRequest({request,env}){
 if(!await authorized(request,env))return login();
 if(!env.LITTLE_MINI_DB)return json({error:'Little Mini database unavailable.'},503);
 const db=env.LITTLE_MINI_DB;
 try{
  if(request.method==='GET'){
   const rows=(await db.prepare('SELECT c.id,c.kind,c.number,c.title,c.status,c.version,c.draft_revision,q.scheduled_at,q.approved_revision FROM mini_chapters c LEFT JOIN mini_release_queue q ON q.chapter_id=c.id ORDER BY c.kind,c.number').all()).results||[];
   return json({chapters:rows.map(c=>({...c,status_label:chapterStatusLabel(c),scheduled_label:easternLabel(c.scheduled_at)}))});
  }
  if(request.method!=='POST')return json({error:'Method not allowed.'},405);
  if(request.headers.get('Origin')!==new URL(request.url).origin||!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'Request rejected.'},403);
  return json(await releaseAction(db,await request.json()));
 }catch(error){return json({error:error.message||'Release controls unavailable.'},400)}
}
