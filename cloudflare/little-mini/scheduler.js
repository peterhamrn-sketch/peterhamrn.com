import {DurableObject} from 'cloudflare:workers';
import {dispatchAutomaticAnnouncements} from '../../functions/_mini/notifications.js';
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
 async prepareRelease({rows,action,when}){
  const previous=await this.ctx.storage.getAlarm();
  const excluded=rows.map(()=>'?').join(',');
  const other=await this.env.LITTLE_MINI_DB.prepare(`SELECT MIN(q.scheduled_at) AS next FROM mini_release_queue q
   JOIN mini_chapters c ON c.id=q.chapter_id
   JOIN mini_revisions r ON r.id=q.approved_revision AND r.chapter_id=c.id
   WHERE c.status='scheduled' AND q.scheduled_at IS NOT NULL
   AND q.approved_revision=c.draft_revision AND trim(r.source)!=''
   AND c.id NOT IN (${excluded})`).bind(...rows.map(c=>c.id)).first();
  const times=[other?.next,...(action==='schedule'?[when]:action==='resume'?rows.map(c=>c.scheduled_at):[])].filter(Boolean).sort();
  return {previous,next:times[0]||null};
 }
 async fetch(request){
  const path=new URL(request.url).pathname;
  if(path==='/notify'&&request.method==='POST'){const input=await request.json();return Response.json(await dispatchAutomaticAnnouncements(this.env,input.event_id,true));}
  let publicationEvent=null;
  if(request.method!=='POST'||!['/initialize','/reconcile','/release'].includes(path))return new Response('Not found',{status:404});
  const response=await this.ctx.blockConcurrencyWhile(async()=>{
   let result={},previousAlarm=null,alarmPrepared=false;
   try{
    if(path==='/release')result=await releaseAction(this.env.LITTLE_MINI_DB,await request.json(),async plan=>{
     // Arm the prospective queue before committing approval/revisions/schedules together.
     // This request blocks alarm handling until the transaction succeeds or is restored.
     const prepared=await this.prepareRelease(plan);previousAlarm=prepared.previous;alarmPrepared=true;
     const candidate=prepared.next?new Date(prepared.next).valueOf():null;
     // Keep an existing earlier alarm until D1 commits. A process interruption must
     // not postpone the old saved queue; an extra early wake cannot publish early.
     const safeAlarm=previousAlarm===null?candidate:candidate===null?previousAlarm:Math.min(previousAlarm,candidate);
     if(safeAlarm!==null&&safeAlarm!==previousAlarm)await this.ctx.storage.setAlarm(Math.max(safeAlarm,Date.now()+1));
    });
    publicationEvent=result.ok?result.publication_event:null;
    const alarm=await this.reconcile();
    return Response.json({...result,...alarm,initialized:path==='/initialize'});
   }catch(error){
    // A committed schedule is never reported as armed if setting the alarm fails.
    if(result.ok)return Response.json({...result,warning:'Release settings were saved, but the automatic alarm could not be updated. Reopen and save the release settings to retry. '+String(error)});
    if(alarmPrepared){try{
     if(previousAlarm===null)await this.ctx.storage.deleteAlarm();else await this.ctx.storage.setAlarm(previousAlarm);
    }catch(restoreError){return Response.json({error:'No manuscript approval or release changes were committed, but the prior alarm could not be restored. Administrator attention is required. '+String(restoreError)},{status:503});}}
    return Response.json({error:error.message||String(error)},{status:400});
   }
  });
  if(publicationEvent)this.ctx.waitUntil(dispatchAutomaticAnnouncements(this.env,publicationEvent).catch(error=>this.ctx.storage.put('last_email_error',String(error))));
  return response;
 }
 async alarm(){
  let publicationEvent=null;
  await this.ctx.blockConcurrencyWhile(async()=>{
   const now=new Date().toISOString();
   try{
    const published=await publishDue(this.env.LITTLE_MINI_DB,now);publicationEvent=published.publication_event;
    const next=await this.reconcile();
    await this.ctx.storage.put('last_result',{at:now,ok:true,...next});
   }catch(error){
    await this.ctx.storage.put('last_result',{at:now,ok:false,error:String(error)});
    // Cloudflare's bounded alarm failure retries; no polling or recurring check.
    throw error;
   }
  });
  try{await dispatchAutomaticAnnouncements(this.env,publicationEvent);}catch(error){await this.ctx.storage.put('last_email_error',String(error));}
 }
}
export default {
 async fetch(request,env){
  const url=new URL(request.url),path=url.pathname;
  const internal=url.hostname==='internal'&&['/reconcile','/release','/notify'].includes(path);
  const setup=path==='/initialize'&&env.LITTLE_MINI_SETUP_SECRET&&request.headers.get('Authorization')==='Bearer '+env.LITTLE_MINI_SETUP_SECRET;
  if(request.method!=='POST'||(!internal&&!setup))return new Response('Not found',{status:404});
  return env.WEEKLY_RELEASE.get(env.WEEKLY_RELEASE.idFromName('little-mini-weekly-release')).fetch(request);
 }
};
