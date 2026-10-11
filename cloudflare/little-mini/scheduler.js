import {DurableObject} from 'cloudflare:workers';
import {publishDue,releaseAction} from '../../functions/_mini/scheduling.js';

// Preserve the existing class, namespace and named instance, including its stored alarm.
export class WeeklyRelease extends DurableObject {
 async reconcile(){
  const due=await this.env.LITTLE_MINI_DB.prepare(`SELECT MIN(q.scheduled_at) AS next FROM mini_release_queue q
   JOIN mini_chapters c ON c.id=q.chapter_id
   JOIN mini_revisions r ON r.id=q.approved_revision AND r.chapter_id=c.id
   WHERE c.status='scheduled' AND q.scheduled_at IS NOT NULL
   AND q.approved_revision=c.draft_revision AND trim(r.source)!=''`).first();
  const next=due?.next||null;
  const alarm=next?Math.max(new Date(next).valueOf(),Date.now()+1):null;
  const existing=await this.ctx.storage.getAlarm();
  if(alarm!==null&&existing!==alarm)await this.ctx.storage.setAlarm(alarm);
  else if(alarm===null&&existing!==null)await this.ctx.storage.deleteAlarm();
  return {next_release_window:next,alarm_at:alarm===null?null:new Date(alarm).toISOString(),timezone:'America/New_York'};
 }
 async fetch(request){
  const path=new URL(request.url).pathname;
  if(request.method!=='POST'||!['/initialize','/reconcile','/release'].includes(path))return new Response('Not found',{status:404});
  return this.ctx.blockConcurrencyWhile(async()=>{
   let result={};
   try{
    if(path==='/release')result=await releaseAction(this.env.LITTLE_MINI_DB,await request.json());
    const alarm=await this.reconcile();
    return Response.json({...result,...alarm,initialized:path==='/initialize'});
   }catch(error){
    // A committed schedule is never reported as armed if setting the alarm fails.
    if(result.ok)return Response.json({...result,warning:'Release settings were saved, but the automatic alarm could not be updated. Reopen and save the release settings to retry. '+String(error)});
    return Response.json({error:error.message||String(error)},{status:400});
   }
  });
 }
 async alarm(){
  return this.ctx.blockConcurrencyWhile(async()=>{
   const now=new Date().toISOString();
   try{
    await publishDue(this.env.LITTLE_MINI_DB,now);
    const next=await this.reconcile();
    await this.ctx.storage.put('last_result',{at:now,ok:true,...next});
   }catch(error){
    await this.ctx.storage.put('last_result',{at:now,ok:false,error:String(error)});
    // Cloudflare's bounded alarm failure retries; no polling or recurring check.
    throw error;
   }
  });
 }
}
export default {
 async fetch(request,env){
  const url=new URL(request.url),path=url.pathname;
  const internal=url.hostname==='internal'&&['/reconcile','/release'].includes(path);
  const setup=path==='/initialize'&&env.LITTLE_MINI_SETUP_SECRET&&request.headers.get('Authorization')==='Bearer '+env.LITTLE_MINI_SETUP_SECRET;
  if(request.method!=='POST'||(!internal&&!setup))return new Response('Not found',{status:404});
  return env.WEEKLY_RELEASE.get(env.WEEKLY_RELEASE.idFromName('little-mini-weekly-release')).fetch(request);
 }
};
