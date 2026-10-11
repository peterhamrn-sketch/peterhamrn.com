import {DurableObject} from 'cloudflare:workers';
import {publishDue,nextWeeklyWindow} from '../../functions/_mini/scheduling.js';

export class WeeklyRelease extends DurableObject {
 async fetch(request){
  if(request.method!=='POST'||new URL(request.url).pathname!=='/initialize')return new Response('Not found',{status:404});
  // Idempotent provisioning only: never duplicate or advance an existing alarm.
  const next=await this.ctx.blockConcurrencyWhile(async()=>{
   const existing=await this.ctx.storage.getAlarm();
   if(existing)return new Date(existing).toISOString();
   const date=nextWeeklyWindow();await this.ctx.storage.setAlarm(new Date(date).valueOf());return date;
  });
  return Response.json({initialized:true,next_release_window:next,timezone:'America/New_York'});
 }
 async alarm(){
  const now=new Date().toISOString(),next=nextWeeklyWindow();
  // One next-week alarm only. No constructor timers, polling, or short-interval retries.
  await this.ctx.storage.setAlarm(new Date(next).valueOf());
  try{await publishDue(this.env.LITTLE_MINI_DB,now);await this.ctx.storage.put('last_result',{at:now,ok:true,next});}
  catch(error){await this.ctx.storage.put('last_result',{at:now,ok:false,error:String(error),next});}
 }
}
export default {
 async fetch(request,env){
  if(request.method!=='POST'||new URL(request.url).pathname!=='/initialize'||!env.LITTLE_MINI_SETUP_SECRET||request.headers.get('Authorization')!=='Bearer '+env.LITTLE_MINI_SETUP_SECRET)return new Response('Not found',{status:404});
  return env.WEEKLY_RELEASE.get(env.WEEKLY_RELEASE.idFromName('little-mini-weekly-release')).fetch(new Request('https://internal/initialize',{method:'POST'}));
 }
};
