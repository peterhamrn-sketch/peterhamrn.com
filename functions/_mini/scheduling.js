export const ZONE='America/New_York';
export function easternInput(value){
 if(!value)return '';
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value));
 const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
export function easternToUTC(value){
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw Error('Choose a date and time in America/New_York.');
 const candidates=[4,5].map(h=>new Date(value+':00Z').valueOf()+h*3600000).filter(ms=>Number.isFinite(ms)&&easternInput(ms)===value);
 if(candidates.length!==1)throw Error('This Eastern time is invalid or ambiguous at a daylight saving change. Choose a different time.');
 return new Date(candidates[0]).toISOString();
}
export const easternLabel=value=>value?new Intl.DateTimeFormat('en-US',{timeZone:ZONE,dateStyle:'full',timeStyle:'short'}).format(new Date(value))+' Eastern':'Not scheduled';
export const statusLabel=value=>({draft:'Draft',scheduled:'Scheduled',held:'On Hold',published:'Published'}[value]||value);
export async function publishDue(db,now=new Date().toISOString()){
 const publicationDate=easternInput(now).slice(0,10);
 // Only the exact approved saved revision may release. Draft saves invalidate this pointer.
 return db.batch([
  db.prepare(`UPDATE mini_chapters SET status='published',published_revision=draft_revision,draft_revision=NULL,
   publication_date=?,version=version+1,modified_at=?
   WHERE status='scheduled' AND EXISTS(
    SELECT 1 FROM mini_release_queue q JOIN mini_revisions r ON r.id=q.approved_revision AND r.chapter_id=q.chapter_id
    WHERE q.chapter_id=mini_chapters.id AND q.scheduled_at IS NOT NULL AND q.scheduled_at<=?
    AND q.approved_revision=mini_chapters.draft_revision AND trim(r.source)!='')`).bind(publicationDate,now,now),
  db.prepare(`UPDATE mini_release_queue SET published_at=? WHERE published_at IS NULL AND EXISTS(
   SELECT 1 FROM mini_chapters c WHERE c.id=mini_release_queue.chapter_id AND c.status='published'
   AND c.published_revision=mini_release_queue.approved_revision)`).bind(now)
 ]);
}
export async function releaseAction(db,input){
 if(!['schedule','publish-now','hold','resume'].includes(input.action))throw Error('Unknown release action.');
 const ids=input.ids;
 if(!Array.isArray(ids)||ids.length<1||ids.length>2||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'))throw Error('Choose one chapter or its matching pair.');
 const placeholders=ids.map(()=>'?').join(',');
 const rows=(await db.prepare(`SELECT c.*,q.scheduled_at,q.approved_revision FROM mini_chapters c LEFT JOIN mini_release_queue q ON q.chapter_id=c.id WHERE c.id IN (${placeholders})`).bind(...ids).all()).results||[];
 if(rows.length!==ids.length||rows.some(c=>c.status==='published'))throw Error('Release controls apply only to unpublished chapters.');
 if(rows.length===2&&(rows[0].number!==rows[1].number||rows[0].kind===rows[1].kind))throw Error('Pair controls require matching story and manual chapter numbers.');
 if(rows.some(c=>!Number.isSafeInteger(input.versions?.[c.id])||input.versions[c.id]!==c.version))throw Error('A chapter changed. Reload before changing its release.');
 const now=new Date().toISOString();let when=null;
 if(input.action==='schedule') {when=weeklyWindow(input.when);if(when<=now)throw Error('Choose a future date, or use Publish Now.');}
 if(['schedule','publish-now'].includes(input.action)){
  if(input.approved!==true)throw Error('Confirm the saved manuscripts are reviewed, complete, and factually/technically verified.');
  for(const c of rows){const r=await db.prepare('SELECT source FROM mini_revisions WHERE id=? AND chapter_id=?').bind(c.draft_revision,c.id).first();if(!r?.source.trim())throw Error('Save a complete manuscript draft before scheduling or publishing.');}
 }
 if(input.action==='resume'&&rows.some(c=>c.status!=='held'||!c.scheduled_at||c.scheduled_at<=now||!c.approved_revision||c.approved_revision!==c.draft_revision))throw Error('Resume requires a held, unchanged approved draft and a future saved date. Reschedule if the date passed or text changed.');
 const event=crypto.randomUUID();
 // Claim the whole operation only if every chapter still has the loaded version.
 const guard=rows.map(()=>'(id=? AND version=? AND status!=\'published\')').join(' OR ');
 const guardArgs=rows.flatMap(c=>[c.id,c.version]);
 const stmts=[db.prepare(`INSERT INTO mini_release_events(id,action,chapter_ids,created_at) SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM mini_chapters WHERE ${guard})=?`).bind(event,input.action,JSON.stringify(ids),now,...guardArgs,rows.length)];
 for(const c of rows){
  const revision=['schedule','publish-now'].includes(input.action)?c.draft_revision:c.approved_revision;
  const scheduled=input.action==='schedule'?when:c.scheduled_at;
  const state={schedule:'scheduled','publish-now':'published',hold:'held',resume:'scheduled'}[input.action];
  stmts.push(db.prepare(`INSERT INTO mini_release_queue(chapter_id,scheduled_at,approved_revision,published_at) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM mini_release_events WHERE id=?)
   ON CONFLICT(chapter_id) DO UPDATE SET scheduled_at=excluded.scheduled_at,approved_revision=excluded.approved_revision,published_at=excluded.published_at`).bind(c.id,scheduled,revision,input.action==='publish-now'?now:null,event));
  const publish=input.action==='publish-now';
  stmts.push(db.prepare(`UPDATE mini_chapters SET status=?,version=version+1,modified_at=?${publish?',published_revision=?,draft_revision=NULL,publication_date=?':''} WHERE id=? AND EXISTS(SELECT 1 FROM mini_release_events WHERE id=?)`).bind(state,now,...(publish?[revision,easternInput(now).slice(0,10)]:[]),c.id,event));
 }
 const results=await db.batch(stmts);if(!results[0].meta?.changes)throw Error('The chapter changed in another session. Reload before retrying.');
 return {ok:true,action:input.action,ids,scheduled_at:when};
}

export function weeklyWindow(value){
 const utc=easternToUTC(value);
 const date=new Date(value+':00Z');
 if(date.getUTCDay()!==6||!value.endsWith('T09:00'))throw Error('Automatic publication supports Saturdays at 9:00 a.m. Eastern only. Choose that weekly window or use Publish Now.');
 return utc;
}
export function nextWeeklyWindow(now=Date.now()){
 const local=easternInput(now),date=new Date(local.slice(0,10)+'T12:00:00Z');
 date.setUTCDate(date.getUTCDate()+(6-date.getUTCDay()+7)%7);
 let next=easternToUTC(date.toISOString().slice(0,10)+'T09:00');
 if(new Date(next).valueOf()<=now){date.setUTCDate(date.getUTCDate()+7);next=easternToUTC(date.toISOString().slice(0,10)+'T09:00');}
 return next;
}
