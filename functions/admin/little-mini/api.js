import {authorized,login,json} from '../../_mini/auth.js';
import {markdown} from '../../../tools/little-mini/render.mjs';
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
 const rendered=markdown(input.source);
 if(input.action==='preview')return json({html:rendered});
 if(!['draft','publish','restore'].includes(input.action)||!Number.isSafeInteger(input.version))return json({error:'Invalid action or version.'},400);
 const chapter=await db.prepare('SELECT * FROM mini_chapters WHERE id=?').bind(id).first();
 if(!chapter)return json({error:'Chapter not found.'},404);
 if(input.action==='publish'&&chapter.status!=='published')return json({error:'This editor cannot release unpublished chapters.'},409);
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
  db.prepare(`UPDATE mini_chapters SET ${pointer}=?,${input.action==='publish'?'draft_revision=NULL,':''}version=version+1,modified_at=? WHERE id=? AND version=? AND EXISTS(SELECT 1 FROM mini_revisions WHERE id=?)`).bind(revision,date,id,input.version,revision)
 ]);
 if(!results[1].meta.changes)return json({error:'Another session changed this chapter. Copy your edits, then reload before saving.'},409);
 return json({ok:true,version:input.version+1,modified_at:date});
 }catch{return json({error:'Chapter administration is unavailable. Check the Little Mini binding and migration; content has not been replaced with placeholders.'},503)}
}
