import {authorized as sharedAuthorized} from '../_admin/auth.js';
// Keep the existing explicit Little Mini administrator grant.
export async function authorized(request,env){return env.LITTLE_MINI_ADMIN_USER==='peter'&&await sharedAuthorized(request,env);}
export const headers={'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow, noarchive','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
export function login(){return new Response('Administrator authorization required',{status:401,headers:{...headers,'WWW-Authenticate':'Basic realm="PeterHamRN Admin", charset="UTF-8"'}})}
export function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{...headers,'Content-Type':'application/json; charset=utf-8'}})}
