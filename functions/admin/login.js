import {session,hash,signed,equal,random,iso,cookie,returnPath,sessionCookie} from '../_admin/auth.js';
import {page,esc} from '../_recovery/subscriptions.js';
const challengeName='__Host-admin_login';
function form(next,challenge,message='',status=200){const response=page(`<h1>Admin Center Sign In</h1><p>Sign in as peter using the existing administrator password.</p>${message?`<p>${esc(message)}</p>`:''}<form method="post"><input type="hidden" name="next" value="${esc(next)}"><input type="hidden" name="challenge" value="${esc(challenge)}"><label>Username<input name="username" autocomplete="username" required value="peter"></label><label>Password<input type="password" name="password" autocomplete="current-password" required maxlength="1024"></label><label><input type="checkbox" name="remember" value="1">Remember This Device for 30 Days</label><button>Sign In</button></form><p>Without remembering, access expires after eight hours or when the browser session ends. Remembered access expires after 30 days; sign in again to renew it.</p>`,status);response.headers.append('Set-Cookie',`${challengeName}=${challenge}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=600`);return response;}
export async function onRequest({request,env}){
 if(!env.RECOVERY_DB||!env.RECOVERY_ADMIN_PASSWORD)return page('<h1>Administrator sign-in unavailable</h1>',503);
 const url=new URL(request.url);
 if(request.method==='GET'){
  const next=returnPath(url.searchParams.get('next'));
  if(await session(request,env))return new Response(null,{status:303,headers:{Location:next,'Cache-Control':'no-store'}});
  const nonce=Date.now()+':'+random(),challenge=nonce+':'+await signed(env.RECOVERY_ADMIN_PASSWORD,'login:'+nonce);
  return form(next,challenge);
 }
 if(request.method!=='POST')return page('<h1>Method not allowed</h1>',405);
 if(request.headers.get('Origin')!==url.origin)return page('<h1>Request rejected</h1>',403);
 try{
  const f=await request.formData(),challenge=String(f.get('challenge')||''),parts=challenge.split(':'),next=returnPath(f.get('next'));
  if(!equal(challenge,cookie(request,challengeName))||parts.length!==3||!Number.isFinite(Number(parts[0]))||Date.now()-Number(parts[0])>600000||Number(parts[0])>Date.now()||!equal(parts[2],await signed(env.RECOVERY_ADMIN_PASSWORD,'login:'+parts.slice(0,2).join(':'))))return page('<h1>Sign-in form expired</h1><a href="/admin/login">Sign in again</a>',403);
  const ip=await signed(env.RECOVERY_ADMIN_PASSWORD,'login-rate:'+(request.headers.get('CF-Connecting-IP')||'unknown'));
  const recent=new Date(Date.now()-900000).toISOString();
  // Atomic reservation also counts successful attempts, preventing concurrent password guessing.
  const reserved=await env.RECOVERY_DB.prepare('INSERT INTO admin_login_attempts(id,ip_hash,created_at) SELECT ?,?,? WHERE (SELECT COUNT(*) FROM admin_login_attempts WHERE ip_hash=? AND created_at>?)<10 RETURNING id').bind(crypto.randomUUID(),ip,iso(),ip,recent).first();
  if(!reserved)return form(next,challenge,'Too many sign-in attempts. Try again in 15 minutes.',429);
  if(String(f.get('password')||'').length>1024||f.get('username')!=='peter'||!equal(await hash(String(f.get('password')||'')),await hash(env.RECOVERY_ADMIN_PASSWORD)))return form(next,challenge,'Username or password was not accepted.',401);
  const token=random(),remembered=f.get('remember')==='1',stamp=iso(),expiry=new Date(Date.now()+(remembered?30*86400000:8*3600000)).toISOString();
  const old=cookie(request);
  await env.RECOVERY_DB.batch([
   env.RECOVERY_DB.prepare('DELETE FROM admin_sessions WHERE token_hash=? OR expires_at<=?').bind(await hash(old),stamp),
   env.RECOVERY_DB.prepare('DELETE FROM admin_login_attempts WHERE created_at<=?').bind(recent),
   env.RECOVERY_DB.prepare('INSERT INTO admin_sessions(token_hash,user_name,credential_hash,remembered,created_at,expires_at) VALUES(?,?,?,?,?,?)').bind(await hash(token),'peter',await hash(env.RECOVERY_ADMIN_PASSWORD),remembered?1:0,stamp,expiry)
  ]);
  const response=new Response(null,{status:303,headers:{Location:next,'Cache-Control':'no-store'}});response.headers.append('Set-Cookie',sessionCookie(token,remembered));response.headers.append('Set-Cookie',`${challengeName}=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0`);return response;
 }catch{return page('<h1>Administrator sign-in temporarily unavailable</h1>',503);}
}
