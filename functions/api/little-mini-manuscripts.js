// Dedicated, read-only manuscript export. Never accepts administrator credentials.
const headers={'Cache-Control':'no-store','Content-Type':'application/json; charset=utf-8','X-Robots-Tag':'noindex, nofollow, noarchive','X-Content-Type-Options':'nosniff'};
const respond=(body,status)=>new Response(JSON.stringify(body),{status,headers});
async function equalSecret(a,b){
 const encoder=new TextEncoder();
 const digest=async value=>new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value)));
 const [left,right]=await Promise.all([digest(a),digest(b)]);
 let mismatch=0;
 for(let i=0;i<left.length;i++)mismatch|=left[i]^right[i];
 return mismatch===0;
}
export async function onRequest({request,env}){
 if(request.method!=='GET')return respond({error:'Method not allowed'},405);
 if(!env.LITTLE_MINI_EXPORT_TOKEN||!env.LITTLE_MINI_DB)return respond({error:'Export not configured'},503);
 const match=/^Bearer ([A-Za-z0-9_-]{32,})$/.exec(request.headers.get('Authorization')||'');
 if(!match||!await equalSecret(match[1],env.LITTLE_MINI_EXPORT_TOKEN))return respond({error:'Unauthorized'},401);
 try{
  const result=await env.LITTLE_MINI_DB.prepare(`
   SELECT c.id,c.kind,c.number,c.title,c.status,c.modified_at,c.version,
          c.published_revision,c.draft_revision,q.approved_revision,q.scheduled_at,
          r.id AS exported_revision,r.source
   FROM mini_chapters c
   LEFT JOIN mini_release_queue q ON q.chapter_id=c.id
   LEFT JOIN mini_revisions r ON r.id=CASE
     WHEN c.status='published' THEN c.published_revision
     WHEN q.approved_revision IS NOT NULL AND c.status='scheduled' THEN q.approved_revision
     ELSE NULL END
   WHERE c.status='published' OR (c.status='scheduled' AND q.approved_revision IS NOT NULL)
   ORDER BY c.kind,c.number
  `).all();
  if(result.results.some(row=>!row.source))return respond({error:'Incomplete manuscript revisions'},503);
  return respond({exported_at:new Date().toISOString(),chapters:result.results},200);
 }catch{return respond({error:'Export unavailable'},503);}
}
