import {session,clearCookie} from '../_admin/auth.js';
import {page,esc} from '../_recovery/subscriptions.js';
export async function onRequest({request,env}){
 const admin=await session(request,env);if(!admin)return new Response(null,{status:303,headers:{Location:'/admin/login'}});
 if(request.method==='GET')return page(`<h1>Administrator Session</h1><p>${admin.remembered?'Remembered browser':'Short-lived browser session'}. Expires ${esc(new Date(admin.expires_at).toLocaleString('en-US',{timeZone:'America/New_York',dateStyle:'full',timeStyle:'short'}))} Eastern.</p><form method="post"><button name="action" value="current">Log Out</button><button name="action" value="all">Log Out All Devices</button></form>`);
 if(request.method!=='POST')return page('<h1>Method not allowed</h1>',405);
 const f=await request.formData();if(!['current','all'].includes(f.get('action')))return page('<h1>Unknown action</h1>',400);
 await env.RECOVERY_DB.prepare(f.get('action')==='all'?'DELETE FROM admin_sessions WHERE user_name=?':'DELETE FROM admin_sessions WHERE token_hash=?').bind(f.get('action')==='all'?'peter':admin.token_hash).run();
 return new Response(null,{status:303,headers:{Location:'/admin/login','Cache-Control':'no-store','Set-Cookie':clearCookie()}});
}
