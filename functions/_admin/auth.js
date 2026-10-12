export const ADMIN_COOKIE='__Host-admin_session';
export const iso=()=>new Date().toISOString();
export const random=()=>[...crypto.getRandomValues(new Uint8Array(32))].map(b=>b.toString(16).padStart(2,'0')).join('');
export async function hash(value){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(b=>b.toString(16).padStart(2,'0')).join('');}
export async function signed(secret,value){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return [...new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(value)))].map(b=>b.toString(16).padStart(2,'0')).join('');}
export function equal(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let result=0;for(let i=0;i<a.length;i++)result|=a.charCodeAt(i)^b.charCodeAt(i);return result===0;}
export function cookie(request,name=ADMIN_COOKIE){return (request.headers.get('Cookie')||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(name+'='))?.slice(name.length+1)||'';}
export async function session(request,env){
 const token=cookie(request);if(!/^[a-f0-9]{64}$/.test(token)||!env.RECOVERY_DB||!env.RECOVERY_ADMIN_PASSWORD)return null;
 const row=await env.RECOVERY_DB.prepare('SELECT * FROM admin_sessions WHERE token_hash=? AND expires_at>?').bind(await hash(token),iso()).first();
 if(!row||row.user_name!=='peter'||!equal(row.credential_hash,await hash(env.RECOVERY_ADMIN_PASSWORD)))return null;
 return {...row,csrf:await signed(env.RECOVERY_ADMIN_PASSWORD,'admin-csrf:'+row.token_hash)};
}
export async function basic(request,env){
 const header=request.headers.get('Authorization')||'';if(!env.RECOVERY_ADMIN_PASSWORD||!header.startsWith('Basic '))return false;
 try{const decoded=atob(header.slice(6)),i=decoded.indexOf(':');return decoded.slice(0,i)==='peter'&&equal(await hash(decoded.slice(i+1)),await hash(env.RECOVERY_ADMIN_PASSWORD));}catch{return false;}
}
export async function authorized(request,env){return Boolean(await session(request,env))||await basic(request,env);}
export function returnPath(value){return typeof value==='string'&&/^\/admin(?:\/|$)/.test(value)&&!value.includes('\\')&&!/[\r\n]/.test(value)&&!value.startsWith('/admin/login')?value:'/admin/';}
export function sessionCookie(token,remembered=false,expiresAt=null){
 const base=`${ADMIN_COOKIE}=${token}; Path=/; HttpOnly; Secure`;
 if(!remembered)return base+'; SameSite=Strict';
 // Permit safe top-level return navigation. POST Origin/CSRF validation remains mandatory.
 // Bind browser persistence to the existing absolute server expiry, never renew 30 days here.
 const expiry=new Date(expiresAt);
 if(!expiresAt||!Number.isFinite(expiry.valueOf()))throw Error('Remembered session expiration is required.');
 const remaining=Math.max(0,Math.floor((expiry.valueOf()-Date.now())/1000));
 return `${base}; SameSite=Lax; Max-Age=${remaining}; Expires=${expiry.toUTCString()}`;
}
export const clearCookie=()=>`${ADMIN_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
