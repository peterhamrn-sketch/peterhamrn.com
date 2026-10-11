import {authorized,login} from '../../_mini/auth.js';
import {page,esc} from '../../_mini/ui.js';
export async function onRequest({request,env}){
 if(!await authorized(request,env))return login();
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
 if(!env.LITTLE_MINI_DB)return page('Chapter Manager','<h1>Chapter Manager unavailable</h1><p>The dedicated Little Mini database must be configured.</p>');
 try{
 const chapters=(await env.LITTLE_MINI_DB.prepare('SELECT id,kind,number,title,status,modified_at,draft_revision FROM mini_chapters ORDER BY kind,number').all()).results;
 const category=(kind,label)=>`<section><h2>${label}</h2><ol>${chapters.filter(c=>c.kind===kind).map(c=>`<li><button type="button" data-chapter="${esc(c.id)}">Chapter ${c.number} — ${esc(c.title)}</button> <span class="pill">${esc(c.status)}</span>${c.draft_revision?' · Draft saved':''}<small>Last modified: ${esc(c.modified_at)}</small></li>`).join('')}</ol></section>`;
 return page('Chapter Manager',`<p><a href="/admin/">← Admin Center</a></p><h1>Little Mini Chapter Manager</h1><p class="muted">Select a chapter. Preview corrections, save a private draft, then publish when ready. Publication dates and release status stay fixed.</p><div id="list" class="grid">${category('story','Humorous Story')}${category('manual','Technical Manual')}</div><p class="muted">Future installment scheduling: Coming Soon. Planned cadence remains Saturdays at 9 a.m. America/New_York. No automatic release service is active.</p><section id="editor" hidden><h2 id="title"></h2><p id="details" class="muted"></p><p><a id="public-link" target="_blank" rel="noopener">Open published chapter</a></p><p>Edit Markdown: keep heading markers, paragraph breaks, and links. Original publication text is retained in revision history.</p><button id="load-published" type="button">Load Current Published Text</button><label for="source">Chapter text</label><textarea id="source" spellcheck="true" autocapitalize="sentences"></textarea><div class="tools"><label>Find<input id="find" type="text"></label><label>Replace with<input id="replacement" type="text"></label><button id="find-next" type="button">Find Next</button><button id="replace" type="button">Replace Selection</button><button id="replace-all" type="button">Replace All</button></div><div class="tools"><button id="preview-button" type="button">Preview</button><button id="save" type="button">Save Draft</button><button id="publish" type="button" disabled>Publish Changes</button></div><p id="message" class="notice" role="status" aria-live="polite"></p><div id="preview" hidden><h3>Draft preview</h3><iframe title="Chapter draft preview" sandbox=""></iframe></div><h3>Revision history</h3><p>Restoring an earlier revision saves a new private draft. Preview and publish it to update the public chapter.</p><label>Earlier revision<select id="history"></select></label><button id="restore" type="button">Restore as Draft</button></section>`,script);
 }catch{return page('Chapter Manager','<h1>Chapter Manager unavailable</h1><p>The dedicated Little Mini migration must be applied before editing is enabled.</p>')}
}
const script=String.raw`
const el=id=>document.getElementById(id),text=el('source');
let selected=null,version=0,saved='',previewed=null,busy=false;
const dirty=()=>selected&&text.value!==saved;
const say=message=>el('message').textContent=message;
function controls(){for(const id of ['save','restore','preview-button','load-published'])el(id).disabled=busy;el('publish').disabled=busy||previewed!==text.value;}
function changed(){previewed=null;controls();say('Unsaved changes. Preview before publishing.');}
text.addEventListener('input',changed);
window.addEventListener('beforeunload',event=>{if(dirty()||busy){event.preventDefault();event.returnValue='';}});
document.addEventListener('click',event=>{const link=event.target.closest('a');if(link&&!link.target&&(dirty()||busy)&&!confirm('Leave this chapter? Unsaved changes will be lost.'))event.preventDefault();});
async function api(action,extra={}){
 const response=await fetch('/admin/little-mini/api?id='+encodeURIComponent(selected),action?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,source:text.value,version,...extra})}:{cache:'no-store'});
 const data=await response.json().catch(()=>({error:'Sign-in is required or the request failed.'}));
 if(!response.ok)throw Error(data.error||'Request failed.');return data;
}
async function load(id){
 if(busy)return;
 if(dirty()&&!confirm('Discard unsaved changes and select this chapter?'))return;
 const previous=selected;selected=id;busy=true;controls();
 try{const data=await api();version=data.chapter.version;text.value=data.current.source;saved=text.value;previewed=null;
 el('title').textContent=data.chapter.title;el('details').textContent=data.chapter.status+' · Last modified: '+new Date(data.chapter.modified_at).toLocaleString();
 el('public-link').href=data.chapter.path;el('history').replaceChildren(...data.history.map(r=>{const option=document.createElement('option');option.value=r.id;option.textContent=new Date(r.created_at).toLocaleString()+' — '+r.action+(r.id===data.chapter.published_revision?' (current published)':'');return option;}));
 el('editor').hidden=false;el('preview').hidden=true;el('editor').scrollIntoView({behavior:'smooth'});say(data.chapter.draft_revision?'Loaded saved draft. The public chapter is unchanged.':'Loaded current published content.');
 }catch(error){selected=previous;alert(error.message);}finally{busy=false;controls();}
}
for(const button of document.querySelectorAll('[data-chapter]'))button.addEventListener('click',()=>load(button.dataset.chapter));
el('preview-button').onclick=async()=>{if(busy)return;busy=true;controls();const snapshot=text.value;
 try{const result=await api('preview');if(text.value!==snapshot){say('Text changed while preparing the preview. Preview again.');return;}
 el('preview').querySelector('iframe').srcdoc='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src '+"'none'"+'; style-src '+"'self'"+'; base-uri '+"'none'"+'"><link rel="stylesheet" href="/assets/little-mini.css"></head><body><main class="wrap"><article class="reader"><div class="manuscript">'+result.html+'</div></article></main></body></html>';
 el('preview').hidden=false;previewed=snapshot;say('Preview ready. Review it before publishing.');el('preview').scrollIntoView({behavior:'smooth'});
 }catch(error){say(error.message);}finally{busy=false;controls();}};
async function save(action,extra={}){
 if(busy)return;
 if(action==='publish'&&(previewed!==text.value||!confirm('Publish these changes to the live chapter now?')))return;
 if(action==='restore'&&!confirm('Restore this revision as a new private draft? Your unsaved edits will be replaced.'))return;
 busy=true;controls();text.readOnly=true;const snapshot=text.value;
 try{const result=await api(action,extra);version=result.version;saved=snapshot;
 if(action==='restore'){const data=await api();text.value=data.current.source;saved=text.value;}
 previewed=null;el('details').textContent='published · Last modified: '+new Date(result.modified_at).toLocaleString();
 const data=await api();el('history').replaceChildren(...data.history.map(r=>{const o=document.createElement('option');o.value=r.id;o.textContent=new Date(r.created_at).toLocaleString()+' — '+r.action+(r.id===data.chapter.published_revision?' (current published)':'');return o;}));
 say(action==='publish'?'Published changes. The chapter is live without a site deployment.':action==='restore'?'Earlier version restored as a draft. Preview and publish when ready.':'Draft saved. The public chapter is unchanged.');
 }catch(error){say(error.message);}finally{busy=false;text.readOnly=false;controls();}
}
el('load-published').onclick=async()=>{if(busy)return;if(dirty()&&!confirm('Replace unsaved edits with the current published text?'))return;busy=true;controls();
try{const data=await api();const response=await fetch('/admin/little-mini/api?id='+encodeURIComponent(selected)+'&revision='+encodeURIComponent(data.chapter.published_revision),{cache:'no-store'});const published=await response.json();if(!response.ok)throw Error(published.error||'Could not load the published text.');text.value=published.current.source;changed();say('Loaded exact current published text. Any saved draft remains private until you save or publish.');}catch(error){say(error.message);}finally{busy=false;controls();}};
el('save').onclick=()=>save('draft');el('publish').onclick=()=>save('publish');el('restore').onclick=()=>save('restore',{revision:el('history').value});
el('find-next').onclick=()=>{const query=el('find').value;if(!query)return;let index=text.value.indexOf(query,text.selectionEnd);if(index<0)index=text.value.indexOf(query);if(index<0){say('Text not found. Find is case sensitive.');return;}text.focus();text.setSelectionRange(index,index+query.length);};
el('replace').onclick=()=>{const query=el('find').value;if(!query||text.value.slice(text.selectionStart,text.selectionEnd)!==query){say('Use Find Next to select the text first.');return;}text.setRangeText(el('replacement').value,text.selectionStart,text.selectionEnd,'select');changed();};
el('replace-all').onclick=()=>{const query=el('find').value;if(!query)return;const pieces=text.value.split(query),count=pieces.length-1;if(!count){say('Text not found.');return;}if(!confirm('Replace all '+count+' occurrences in this chapter?'))return;text.value=pieces.join(el('replacement').value);changed();say(count+' replacements made. Review and save or publish.');};
`;
