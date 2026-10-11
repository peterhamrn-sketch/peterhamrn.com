// Drain work created by actual initial publication only. Never call this during deployment.
export async function dispatchAutomaticAnnouncements(env,eventId=null,retry=false){
 const rows=(await env.LITTLE_MINI_DB.prepare(`SELECT DISTINCT event_id FROM mini_publication_outbox
  WHERE status!='complete'${eventId?' AND event_id=?':''} ORDER BY published_at`).bind(...(eventId?[eventId]:[])).all()).results||[];
 for(const row of rows){
  try{
   if(!env.LITTLE_MINI_SETUP_SECRET)throw Error('Publication notification authentication is not configured.');
   let result,allowRetry=retry;
   do{
    const response=await fetch('https://peterhamrn.com/api/internal/project-announcements',{method:'POST',headers:{Authorization:'Bearer '+env.LITTLE_MINI_SETUP_SECRET,'Content-Type':'application/json'},body:JSON.stringify({event_id:row.event_id,retry:allowRetry}),signal:AbortSignal.timeout(45000)});
    result=await response.json();allowRetry=false;
    if(!response.ok)throw Error(result.error||'Automatic announcement request failed.');
    // Each continuation consumes another finite recipient batch, never an idle poll.
    if(result.busy)break;
   }while(result.pending>0);
   const state=result.busy?'pending':result.failures?'failed':result.pending?'pending':'complete';
   await env.LITTLE_MINI_DB.prepare('UPDATE mini_publication_outbox SET status=?,last_error=?,updated_at=? WHERE event_id=?').bind(state,result.error||null,new Date().toISOString(),row.event_id).run();
  }catch(error){await env.LITTLE_MINI_DB.prepare("UPDATE mini_publication_outbox SET status='failed',last_error=?,updated_at=? WHERE event_id=?").bind(String(error),new Date().toISOString(),row.event_id).run();}
 }
 return {ok:true,processed:rows.length};
}
