import {session,returnPath,equal,cookie,sessionCookie} from '../_admin/auth.js';
import {esc} from '../_recovery/subscriptions.js';
export async function onRequest(context){
 const {request,env}=context,url=new URL(request.url);
 // The shared admin session is scoped to the main website, never ASM application sign-in.
 if(url.hostname!=='peterhamrn.com')return new Response(null,{status:303,headers:{Location:'https://peterhamrn.com'+url.pathname+url.search,'Cache-Control':'no-store'}});
 if(url.pathname.replace(/\/$/,'')==='/admin/login')return context.next();
 let admin;try{admin=await session(request,env);}catch{return new Response('Administrator sessions are unavailable',{status:503,headers:{'Cache-Control':'no-store'}});}
 if(!admin){
  if(request.method==='GET'||request.method==='HEAD')return new Response(null,{status:303,headers:{Location:'/admin/login?next='+encodeURIComponent(returnPath(url.pathname+url.search)),'Cache-Control':'no-store'}});
  return Response.json({error:'Sign in to the Admin Center again.'},{status:401,headers:{'Cache-Control':'no-store'}});
 }
 if(!['GET','HEAD','OPTIONS'].includes(request.method)){
  if(request.headers.get('Origin')!==url.origin)return new Response('Request rejected',{status:403});
  const type=request.headers.get('Content-Type')||'';
  if(type.startsWith('application/x-www-form-urlencoded')||type.startsWith('multipart/form-data')){
   const f=await request.clone().formData();if(!equal(String(f.get('admin_csrf')||''),admin.csrf))return new Response('Request rejected',{status:403});
  }else if(!type.startsWith('application/json'))return new Response('Request rejected',{status:403});
 }
 let response=await context.next();
 if(admin.remembered&&['GET','HEAD'].includes(request.method)&&url.pathname.replace(/\/$/,'')!=='/admin/logout'){
  // Upgrade an existing remembered cookie after successful authorization; keep its token
  // and D1 expiry unchanged. Never override logout or revive an expired/revoked session.
  response=new Response(response.body,{status:response.status,statusText:response.statusText,headers:response.headers});
  response.headers.append('Set-Cookie',sessionCookie(cookie(request),true,admin.expires_at));
 }
 if(request.method==='HEAD'||!response.headers.get('Content-Type')?.includes('text/html'))return response;
 return new HTMLRewriter().on('form',{element(e){if((e.getAttribute('method')||'get').toLowerCase()==='post')e.prepend(`<input type="hidden" name="admin_csrf" value="${esc(admin.csrf)}">`,{html:true});}}).on('main',{element(e){e.prepend('<p><a href="/admin/">Admin Center</a> · <a href="/admin/logout">Session &amp; Sign Out</a></p>',{html:true});}}).transform(response);
}
