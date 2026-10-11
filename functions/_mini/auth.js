// An explicit production account grant is required; Recovery sign-in alone is insufficient.
export async function authorized(request, env) {
 if (env.LITTLE_MINI_ADMIN_USER !== 'peter' || !env.RECOVERY_ADMIN_PASSWORD) return false;
 const header=request.headers.get('Authorization')||'';
 if (!header.startsWith('Basic ')) return false;
 try {
  const decoded=atob(header.slice(6)), split=decoded.indexOf(':');
  if(split<0 || decoded.slice(0,split)!==env.LITTLE_MINI_ADMIN_USER) return false;
  const digest=async s=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
  const [a,b]=await Promise.all([digest(decoded.slice(split+1)),digest(env.RECOVERY_ADMIN_PASSWORD)]);
  let difference=0;for(let i=0;i<a.length;i++) difference|=a[i]^b[i];return difference===0;
 }catch{return false}
}
export const headers={'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow, noarchive','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
export function login(){return new Response('Administrator authorization required',{status:401,headers:{...headers,'WWW-Authenticate':'Basic realm="PeterHamRN Admin", charset="UTF-8"'}})}
export function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{...headers,'Content-Type':'application/json; charset=utf-8'}})}
