import {authorized,login,json} from '../../_mini/auth.js';
import {renderSource,newChapterPage} from '../../_mini/publication.js';
import {publisherRequest} from '../../_mini/publisher.js';
export async function onRequest({request,env}){
 if(!await authorized(request,env))return login();
 if(!env.LITTLE_MINI_DB)return json({error:'Little Mini database is not configured.'},503);
 const db=env.LITTLE_MINI_DB,url=new URL(request.url),id=url.searchParams.get('id');
 try{
 if(request.method==='GET'){
  const chapter=await db.prepare('SELECT * FROM mini_chapters WHERE id=?').bind(id).first();
  if(!chapter)return json({error:'Chapter not found.'},404);
  const revision=url.searchParams.get('revision');
  const current=await db.prepare('SELECT id,source,created_at,action FROM mini_revisions WHERE chapter_id=? AND id=?').bind(id,revision||chapter.draft_revision||chapter.published_revision).first();
  const history=await db.prepare('SELECT id,created_at,action FROM mini_revisions WHERE chapter_id=? ORDER BY created_at DESC,id DESC').bind(id).all();
  return json({chapter,current,history:history.results});
 }
 if(request.method!=='POST')return json({error:'Method not allowed.'},405);
 if(request.headers.get('Origin')!==url.origin || !request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'Request rejected.'},403);
 const input=await request.json();
 if(typeof input.source!=='string'||!input.source.trim()||input.source.length>150000)return json({error:'Chapter text must contain 1–150,000 characters.'},400);
 const rendered=renderSource(input.source);
 if(input.action==='create'){
  if(!['story','manual'].includes(input.kind)||!Number.isSafeInteger(input.number)||input.number<4||typeof input.title!=='string'||!input.title.trim()||input.title.length>180||typeof input.slug!=='string'||! /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug))return json({error:'Choose story/manual, a chapter number from 4 onward, a title, and a lowercase URL slug.'},400);
  const chapterId=crypto.randomUUID(),revision=crypto.randomUUID(),date=new Date().toISOString(),path=`/little-mini/${input.kind}/${input.slug}/`;
  const existing=await db.prepare('SELECT id FROM mini_chapters WHERE kind=? AND number=?').bind(input.kind,input.number).first();
  if(existing)return json({error:'This chapter number already exists in that reading track.'},409);
  const c={id:chapterId,kind:input.kind,number:input.number,title:input.title.trim(),path};
  await db.batch([
   db.prepare("INSERT INTO mini_chapters(id,kind,number,title,path,status,publication_date,page_html,draft_revision,modified_at) VALUES(?,?,?,?,?,'draft','',?,?,?)").bind(c.id,c.kind,c.number,c.title,c.path,newChapterPage(c),revision,date),
   db.prepare("INSERT INTO mini_revisions(id,chapter_id,source,html,action,created_at) VALUES(?,?,?,?,'draft',?)").bind(revision,c.id,input.source,rendered,date)
  ]);return json({ok:true,id:chapterId});
 }
 if(input.action==='preview')return json({html:rendered});
 if(!['draft','publish','restore','approve'].includes(input.action)||!Number.isSafeInteger(input.version))return json({error:'Invalid action or version.'},400);
 const chapter=await db.prepare('SELECT * FROM mini_chapters WHERE id=?').bind(id).first();
 if(!chapter)return json({error:'Chapter not found.'},404);
 if(input.action==='publish'&&chapter.status!=='published')return json({error:'This editor cannot release unpublished chapters.'},409);
 if(input.action==='approve'){
  if(chapter.status==='published'||!chapter.draft_revision)return json({error:'Approval applies to a saved unpublished manuscript.'},409);
  const saved=await db.prepare('SELECT source FROM mini_revisions WHERE id=? AND chapter_id=?').bind(chapter.draft_revision,id).first();
  if(!saved||saved.source!==input.source)return json({error:'Save this exact manuscript before approving it.'},409);
  const event=crypto.randomUUID(),date=new Date().toISOString();
  const results=await db.batch([
   db.prepare("INSERT INTO mini_release_events(id,action,chapter_ids,created_at) SELECT ?,'approve',?,? WHERE EXISTS(SELECT 1 FROM mini_chapters WHERE id=? AND version=? AND draft_revision=? AND status!='published')").bind(event,JSON.stringify([id]),date,id,input.version,chapter.draft_revision),
   db.prepare('INSERT INTO mini_release_queue(chapter_id,approved_revision) SELECT ?,? WHERE EXISTS(SELECT 1 FROM mini_release_events WHERE id=?) ON CONFLICT(chapter_id) DO UPDATE SET approved_revision=excluded.approved_revision').bind(id,chapter.draft_revision,event),
   db.prepare('UPDATE mini_chapters SET version=version+1,modified_at=? WHERE id=? AND EXISTS(SELECT 1 FROM mini_release_events WHERE id=?)').bind(date,id,event)
  ]);
  if(!results[0].meta.changes)return json({error:'Another session changed this chapter. Reload before approving.'},409);
  return json({ok:true,version:input.version+1,modified_at:date});
 }
 let source=input.source,html=rendered;
 if(input.action==='restore'){
  const earlier=await db.prepare('SELECT source,html FROM mini_revisions WHERE chapter_id=? AND id=?').bind(id,String(input.revision||'')).first();
  if(!earlier)return json({error:'Revision not found.'},404);
  source=earlier.source;html=earlier.html;
 }
 const revision=crypto.randomUUID(),date=new Date().toISOString();
 const pointer=input.action==='publish'?'published_revision':'draft_revision';
 const results=await db.batch([
  db.prepare('INSERT INTO mini_revisions(id,chapter_id,source,html,action,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM mini_chapters WHERE id=? AND version=?)').bind(revision,id,source,html,input.action,date,id,input.version),
  db.prepare(`UPDATE mini_chapters SET ${pointer}=?,${input.action==='publish'?'draft_revision=NULL,':''}${input.action==='publish'?'':"status=CASE WHEN status='scheduled' THEN 'held' ELSE status END,"}version=version+1,modified_at=? WHERE id=? AND version=? AND EXISTS(SELECT 1 FROM mini_revisions WHERE id=?)`).bind(revision,date,id,input.version,revision),
  db.prepare('UPDATE mini_release_queue SET approved_revision=NULL WHERE chapter_id=? AND EXISTS(SELECT 1 FROM mini_revisions WHERE id=?)').bind(id,revision)
 ]);
 if(!results[1].meta.changes)return json({error:'Another session changed this chapter. Copy your edits, then reload before saving.'},409);
 let warning;
 if(chapter.status==='scheduled'){try{await publisherRequest(env,'/reconcile');}catch(error){warning='Draft saved and approval cleared, but the alarm could not be refreshed. '+error.message;}}
 return json({ok:true,version:input.version+1,modified_at:date,warning});
 }catch{return json({error:'Chapter administration is unavailable. Check the Little Mini binding and migration; content has not been replaced with placeholders.'},503)}
}
