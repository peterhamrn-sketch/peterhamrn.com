import {publishedChapters,navigation,launchPaths,renderSource} from '../_mini/publication.js';
import {esc} from '../../tools/little-mini/render.mjs';
const notFound=()=>new Response('Not found',{status:404,headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex'}});
export async function onRequest({request,env,next}){
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
 const url=new URL(request.url),path=url.pathname.replace(/\/index\.html$/,'/').replace(/\/?$/,'/');
 const home=path==='/little-mini/';
 if(!env.LITTLE_MINI_DB)return home||launchPaths.has(path)?next():notFound();
 try{
  const db=env.LITTLE_MINI_DB;
  if(home){
   const chapters=await publishedChapters(db),original=await next();
   const response=new Response(original.body,{status:original.status,headers:original.headers});response.headers.set('Cache-Control','no-store');response.headers.delete('Content-Length');response.headers.delete('ETag');
   const list=kind=>chapters.filter(c=>c.kind===kind).map(c=>`<li><a href="${esc(c.path)}">Chapter ${c.number} — ${esc(c.title)}</a><small>Published <time datetime="${esc(c.publication_date)}">${esc(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'long',day:'numeric'}).format(new Date(c.publication_date+'T12:00:00Z')))}</time></small></li>`).join('');
   const latest=['story','manual'].map(kind=>{
    const c=chapters.filter(c=>c.kind===kind).sort((a,b)=>b.publication_date.localeCompare(a.publication_date)||b.number-a.number)[0];
    if(!c)return '';
    const date=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'long',day:'numeric'}).format(new Date(c.publication_date+'T12:00:00Z'));
    return `<p><strong>${kind==='story'?'Humorous Story':'Technical Manual'}</strong><br><a href="${esc(c.path)}">Chapter ${c.number} — ${esc(c.title)}</a><br>Published <time datetime="${esc(c.publication_date)}">${esc(date)}</time></p>`;
   }).join('')||'<p>No chapters have been published yet.</p>';
   if(request.method==='HEAD')return new Response(null,{headers:response.headers});
   return new HTMLRewriter().on('#mini-latest-updates',{element(e){e.setInnerContent(latest,{html:true})}}).on('#story .chapter-list',{element(e){e.setInnerContent(list('story'),{html:true})}}).on('#manual .chapter-list',{element(e){e.setInnerContent(list('manual'),{html:true})}}).transform(response);
  }
  const chapter=await db.prepare('SELECT c.id,c.kind,c.number,c.title,c.status,c.page_html,c.publication_date,r.source FROM mini_chapters c LEFT JOIN mini_revisions r ON r.id=c.published_revision AND r.chapter_id=c.id WHERE c.path=?').bind(path).first();
  if(!chapter)return launchPaths.has(path)?next():notFound();
  if(chapter.status!=='published'||chapter.source==null)return notFound();
  const chapters=await publishedChapters(db);
  const response=new Response(chapter.page_html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  if(request.method==='HEAD')return new Response(null,{headers:response.headers});
  const publicationDate=chapter.publication_date;
  return new HTMLRewriter().on('div.manuscript',{element(e){e.setInnerContent(renderSource(chapter.source),{html:true})}})
   .on('div.reading-navigation',{element(e){e.replace(navigation(chapter,chapters),{html:true})}})
   .on('.mini-publication-date',{element(e){e.setInnerContent(`Published <time datetime="${esc(publicationDate)}">${esc(publicationDate)}</time>`,{html:true})}}).transform(response);
 }catch{return home||launchPaths.has(path)?next():notFound()}
}
