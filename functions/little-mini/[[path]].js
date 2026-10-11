// Public reads select only the published pointer. Draft revisions are never returned.
export async function onRequest({request,env,next}){
 if(!['GET','HEAD'].includes(request.method))return next();
 const url=new URL(request.url),path=url.pathname.replace(/\/index\.html$/,'/').replace(/\/?$/,'/');
 if(!env.LITTLE_MINI_DB)return next();
 try{
  const chapter=await env.LITTLE_MINI_DB.prepare("SELECT c.page_html,r.html FROM mini_chapters c JOIN mini_revisions r ON r.id=c.published_revision AND r.chapter_id=c.id WHERE c.path=? AND c.status='published'").bind(path).first();
  if(!chapter)return next();
  const response=new Response(chapter.page_html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  if(request.method==='HEAD')return new Response(null,{headers:response.headers});
  return new HTMLRewriter().on('div.manuscript',{element(element){element.setInnerContent(chapter.html,{html:true})}}).transform(response);
 }catch{return next()} // Original static published pages remain available during migration/outages.
}
