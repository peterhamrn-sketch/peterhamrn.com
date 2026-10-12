import {renderSource,publicationSource} from './manuscript.js';
export const ZONE='America/New_York';
export function easternInput(value){
 if(!value)return '';
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value));
 const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
export function easternToUTC(value){
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw Error('Choose a date and time in America/New_York.');
 const candidates=[4,5].map(h=>new Date(value+':00Z').valueOf()+h*3600000).filter(ms=>Number.isFinite(ms)&&easternInput(ms)===value);
 if(!candidates.length)throw Error('This date/time does not exist in Eastern Time, including during the spring daylight saving jump. Choose a valid time.');
 if(candidates.length>1)throw Error('This Eastern time occurs twice when daylight saving time ends. Choose a time outside the repeated hour.');
 return new Date(candidates[0]).toISOString();
}
export const easternLabel=value=>value?new Intl.DateTimeFormat('en-US',{timeZone:ZONE,dateStyle:'full',timeStyle:'short'}).format(new Date(value))+' Eastern':'Not scheduled';
export const statusLabel=value=>({draft:'Draft',scheduled:'Scheduled',held:'On Hold',published:'Published'}[value]||value);
export const chapterStatusLabel=c=>c.status==='draft'&&!c.scheduled_at&&c.draft_revision&&c.approved_revision===c.draft_revision?'Approved, Unscheduled':statusLabel(c.status);
export async function publishDue(db,now=new Date().toISOString()){
 const publicationDate=easternInput(now).slice(0,10),event=crypto.randomUUID();
 // Only the exact approved saved revision may release. Draft saves invalidate this pointer.
 await db.batch([
  db.prepare(`INSERT OR IGNORE INTO mini_publication_outbox(chapter_id,event_id,kind,number,title,path,published_at,updated_at)
   SELECT c.id,'little-mini-chapter-'||c.number||'-'||?,c.kind,c.number,c.title,c.path,?,? FROM mini_chapters c
   JOIN mini_release_queue q ON q.chapter_id=c.id JOIN mini_revisions r ON r.id=q.approved_revision AND r.chapter_id=c.id
   WHERE c.status='scheduled' AND q.scheduled_at<=? AND q.approved_revision=c.draft_revision AND trim(r.source)!=''`).bind(event,now,now,now),
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
 return {publication_event:event};
}
export async function releaseAction(db,input,prepareAlarm){
 if(!['schedule','publish-now','hold','resume'].includes(input.action))throw Error('Unknown release action.');
 const ids=input.ids;
 if(!Array.isArray(ids)||ids.length<1||ids.length>2||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'))throw Error('Choose one chapter or its matching pair.');
 const placeholders=ids.map(()=>'?').join(',');
 const rows=(await db.prepare(`SELECT c.*,q.scheduled_at,q.approved_revision FROM mini_chapters c LEFT JOIN mini_release_queue q ON q.chapter_id=c.id WHERE c.id IN (${placeholders})`).bind(...ids).all()).results||[];
 if(rows.length!==ids.length||rows.some(c=>c.status==='published'))throw Error('Release controls apply only to unpublished chapters.');
 if(rows.length===2&&(rows[0].number!==rows[1].number||rows[0].kind===rows[1].kind))throw Error('Pair controls require matching story and manual chapter numbers.');
 if(rows.some(c=>!Number.isSafeInteger(input.versions?.[c.id])||input.versions[c.id]!==c.version))throw Error('A chapter changed. Reload before changing its release.');
 const now=new Date().toISOString();let when=null;
 if(input.action==='schedule') {when=easternToUTC(input.when);if(when<=now)throw Error('Choose a future date, or use Publish Now.');}
 const releasing=['schedule','publish-now'].includes(input.action),revisions=new Map();
 if(releasing){
  if(!ids.includes(input.selected_id)||typeof input.source!=='string'||!input.source.trim()||input.source.length>150000||!publicationSource(input.source).trim())throw Error('Provide the selected chapter and its complete current manuscript.');
  for(const c of rows){
   const saved=await db.prepare('SELECT source FROM mini_revisions WHERE id=? AND chapter_id=?').bind(c.draft_revision,c.id).first();
   if(c.id===input.selected_id){
    // Unchanged reschedules keep the same approved revision; edits append immutable history.
    const changed=!saved||saved.source!==input.source;
    revisions.set(c.id,{id:changed?crypto.randomUUID():c.draft_revision,source:input.source,changed,html:changed?renderSource(input.source):null});
   }else{
    // Pair actions use only a companion's already-approved saved revision, never editor buffers.
    if(!saved||!c.approved_revision||c.approved_revision!==c.draft_revision||!publicationSource(saved.source).trim())throw Error('The companion must have an approved saved manuscript. Schedule or publish its edits explicitly from its own editor first.');
    revisions.set(c.id,{id:c.approved_revision,changed:false});
   }
  }
 }
 if(input.action==='resume'&&rows.some(c=>c.status!=='held'||!c.scheduled_at||c.scheduled_at<=now||!c.approved_revision||c.approved_revision!==c.draft_revision))throw Error('Resume requires a held, unchanged approved draft and a future saved date. Reschedule if the date passed or text changed.');
 if(prepareAlarm)await prepareAlarm({rows,action:input.action,when});
 const event=crypto.randomUUID();
 // Claim the whole operation only if every chapter still has the loaded version.
 const guard=rows.map(()=>'(id=? AND version=? AND status!=\'published\')').join(' OR ');
 const guardArgs=rows.flatMap(c=>[c.id,c.version]);
 const stmts=[db.prepare(`INSERT INTO mini_release_events(id,action,chapter_ids,created_at) SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM mini_chapters WHERE ${guard})=?`).bind(event,input.action,JSON.stringify(ids),now,...guardArgs,rows.length)];
 for(const c of rows){
  const revision=releasing?revisions.get(c.id).id:c.approved_revision;
  const savedRevision=revisions.get(c.id);
  if(savedRevision?.changed)stmts.push(db.prepare("INSERT INTO mini_revisions(id,chapter_id,source,html,action,created_at) SELECT ?,?,?,?,'draft',? WHERE EXISTS(SELECT 1 FROM mini_release_events WHERE id=?)").bind(revision,c.id,savedRevision.source,savedRevision.html,now,event));
  const scheduled=input.action==='schedule'?when:c.scheduled_at;
  const state={schedule:'scheduled','publish-now':'published',hold:'held',resume:'scheduled'}[input.action];
  stmts.push(db.prepare(`INSERT INTO mini_release_queue(chapter_id,scheduled_at,approved_revision,published_at) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM mini_release_events WHERE id=?)
   ON CONFLICT(chapter_id) DO UPDATE SET scheduled_at=excluded.scheduled_at,approved_revision=excluded.approved_revision,published_at=excluded.published_at`).bind(c.id,scheduled,revision,input.action==='publish-now'?now:null,event));
  const publish=input.action==='publish-now';
  stmts.push(db.prepare(`UPDATE mini_chapters SET status=?,version=version+1,modified_at=?${publish?',published_revision=?,draft_revision=NULL,publication_date=?':releasing?',draft_revision=?':''} WHERE id=? AND EXISTS(SELECT 1 FROM mini_release_events WHERE id=?)`).bind(state,now,...(publish?[revision,easternInput(now).slice(0,10)]:releasing?[revision]:[]),c.id,event));
  if(publish)stmts.push(db.prepare(`INSERT OR IGNORE INTO mini_publication_outbox(chapter_id,event_id,kind,number,title,path,published_at,updated_at)
   SELECT id,'little-mini-chapter-'||number||'-'||?,kind,number,title,path,?,? FROM mini_chapters
   WHERE id=? AND status='published' AND EXISTS(SELECT 1 FROM mini_release_events WHERE id=?)`).bind(event,now,now,c.id,event));
 }
 const results=await db.batch(stmts);if(!results[0].meta?.changes)throw Error('The chapter changed in another session. Reload before retrying.');
 return {ok:true,action:input.action,ids,scheduled_at:when,publication_event:input.action==='publish-now'?event:null};
}

export function nextWeeklyWindow(now=Date.now()){
 const local=easternInput(now),date=new Date(local.slice(0,10)+'T12:00:00Z');
 date.setUTCDate(date.getUTCDate()+(6-date.getUTCDay()+7)%7);
 let next=easternToUTC(date.toISOString().slice(0,10)+'T09:00');
 if(new Date(next).valueOf()<=now){date.setUTCDate(date.getUTCDate()+7);next=easternToUTC(date.toISOString().slice(0,10)+'T09:00');}
 return next;
}
