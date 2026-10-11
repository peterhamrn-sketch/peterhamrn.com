import {authorized,login} from '../../_mini/auth.js';
import {page,esc} from '../../_mini/ui.js';
import {easternLabel,chapterStatusLabel} from '../../_mini/scheduling.js';
export async function onRequest({request,env}){
 if(!await authorized(request,env))return login();
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
 if(!env.LITTLE_MINI_DB)return page('Chapter Manager','<h1>Chapter Manager unavailable</h1><p>The dedicated Little Mini database must be configured.</p>');
 try{
 const chapters=(await env.LITTLE_MINI_DB.prepare('SELECT c.id,c.kind,c.number,c.title,c.status,c.modified_at,c.draft_revision,q.scheduled_at,q.approved_revision FROM mini_chapters c LEFT JOIN mini_release_queue q ON q.chapter_id=c.id ORDER BY c.kind,c.number').all()).results;
 const category=(kind,label)=>`<section class="chapter-track" aria-label="${label}"><h2>${label}</h2><ol class="chapter-list">${chapters.filter(c=>c.kind===kind).map(c=>`<li class="chapter-row"><button class="chapter-select" type="button" data-chapter="${esc(c.id)}"><span class="chapter-number">Chapter ${c.number}</span><span class="chapter-title">${esc(c.title)}</span></button><span class="pill release-status" data-status="${esc(c.status)}" data-status-id="${esc(c.id)}">${esc(chapterStatusLabel(c))}</span><small class="chapter-schedule" data-date-id="${esc(c.id)}"${c.status==='scheduled'?'':' hidden'}>${esc(easternLabel(c.scheduled_at))}</small>${c.draft_revision?'<small class="chapter-draft">Draft saved</small>':''}</li>`).join('')}</ol></section>`;
 return page('Chapter Manager',`<p><a href="/admin/">← Admin Center</a></p><h1>Little Mini Chapter Manager</h1><p class="muted">Select a chapter to edit, preview, publish, or manage its scheduled release.</p><div id="list" class="grid">${category('story','Humorous Story')}${category('manual','Technical Manual')}</div><section><h2>Add a supplied manuscript</h2><p>New chapters begin as private drafts. No placeholder chapter text is created.</p><label>Reading track<select id="new-kind"><option value="story">Humorous story</option><option value="manual">Technical manual</option></select></label><label>Chapter number<input id="new-number" type="number" min="4"></label><label>Title<input id="new-title" maxlength="180"></label><label>URL slug<input id="new-slug" placeholder="lowercase-words-with-hyphens"></label><label>Exact manuscript<textarea id="new-source"></textarea></label><button id="create-chapter" type="button">Create Private Draft</button><p id="create-message" role="status"></p></section><section id="editor" hidden><h2 id="title"></h2><p id="details" class="muted"></p><p><a id="public-link" target="_blank" rel="noopener">Open published chapter</a></p><p>Edit Markdown: keep heading markers, paragraph breaks, and links. Original publication text is retained in revision history.</p><button id="load-published" type="button">Load Current Published Text</button><label for="source">Chapter text</label><textarea id="source" spellcheck="true" autocapitalize="sentences"></textarea><div class="tools"><label>Find<input id="find" type="text"></label><label>Replace with<input id="replacement" type="text"></label><button id="find-next" type="button">Find Next</button><button id="replace" type="button">Replace Selection</button><button id="replace-all" type="button">Replace All</button></div><div class="tools"><button id="preview-button" type="button">Preview</button><button id="save" type="button">Save Draft</button><button id="approve-manuscript" type="button" disabled>Approve Saved Manuscript</button><button id="publish" type="button" disabled>Publish Changes</button></div><p id="message" class="notice" role="status" aria-live="polite"></p><div id="preview" hidden><h3>Draft preview</h3><iframe title="Chapter draft preview" sandbox=""></iframe></div><section id="release-controls" hidden><h3>Publication controls</h3><p id="release-details"></p><div class="release-fields"><label for="release-date">Publication date · Eastern<input id="release-date" type="date" required></label><label for="release-time">Publication time · Eastern<input id="release-time" type="time" step="60" required></label></div><p id="release-selection" class="muted" aria-live="polite"></p><p>Choose any future date and time in America/New_York. The next Saturday at 9 a.m. is suggested only when no date is saved. Times skipped or repeated at daylight saving changes must be replaced with an unambiguous time. Save edits before scheduling; edited or restored manuscripts need approval again.</p><div class="tools"><button type="button" data-release="schedule">Schedule Publication</button><button type="button" data-release="publish-now">Publish Now</button><button type="button" data-release="hold">Hold</button><button type="button" data-release="resume">Resume</button></div><label><input id="release-pair" type="checkbox"> Apply to this chapter and its matching companion chapter</label><p class="muted">Pair actions require both chapters to be unpublished. Other chapter dates are never changed. Resume uses the saved date; a past date must be rescheduled.</p></section><h3>Revision history</h3><p>Restoring an earlier revision saves a new private draft. Preview and publish it to update the public chapter.</p><label>Earlier revision<select id="history"></select></label><button id="restore" type="button">Restore as Draft</button></section>`,script,styles);
 }catch{return page('Chapter Manager','<h1>Chapter Manager unavailable</h1><p>The dedicated Little Mini migration must be applied before editing is enabled.</p>')}
}
const script=String.raw`
const el=id=>document.getElementById(id),text=el('source');
let selected=null,version=0,saved='',previewed=null,busy=false,currentChapter=null,releaseRows=[];
const dirty=()=>selected&&text.value!==saved;
const say=message=>el('message').textContent=message;
function controls(){for(const id of ['save','restore','preview-button','load-published'])el(id).disabled=busy;el('approve-manuscript').hidden=!currentChapter||currentChapter.status==='published';el('approve-manuscript').disabled=busy||dirty()||previewed!==text.value;el('publish').disabled=busy||currentChapter?.status!=='published'||previewed!==text.value;el('load-published').disabled=busy||!currentChapter?.published_revision;for(const b of document.querySelectorAll('[data-release]'))b.disabled=busy;}
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
 try{const data=await api();currentChapter=data.chapter;version=data.chapter.version;text.value=data.current?.source||'';saved=text.value;previewed=null;
 el('title').textContent=data.chapter.title;el('details').textContent=data.chapter.status+' · Last modified: '+new Date(data.chapter.modified_at).toLocaleString();
 el('public-link').href=data.chapter.path;el('public-link').hidden=data.chapter.status!=='published';await refreshReleases();el('history').replaceChildren(...data.history.map(r=>{const option=document.createElement('option');option.value=r.id;option.textContent=new Date(r.created_at).toLocaleString()+' — '+r.action+(r.id===data.chapter.published_revision?' (current published)':'');return option;}));
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
 if(action==='approve'&&(dirty()||previewed!==text.value)){say('Save and preview the exact manuscript before approving it.');return;}
 if(action==='publish'&&(previewed!==text.value||!confirm('Publish these changes to the live chapter now?')))return;
 if(action==='restore'&&!confirm('Restore this revision as a new private draft? Your unsaved edits will be replaced.'))return;
 busy=true;controls();text.readOnly=true;const snapshot=text.value;
 try{const result=await api(action,extra);version=result.version;saved=snapshot;
 if(action==='restore'){const data=await api();text.value=data.current.source;saved=text.value;}
 previewed=null;el('details').textContent='Saved · Last modified: '+new Date(result.modified_at).toLocaleString();
 const data=await api();currentChapter=data.chapter;await refreshReleases();el('history').replaceChildren(...data.history.map(r=>{const o=document.createElement('option');o.value=r.id;o.textContent=new Date(r.created_at).toLocaleString()+' — '+r.action+(r.id===data.chapter.published_revision?' (current published)':'');return o;}));
 say(result.warning||(action==='publish'?'Published changes. The chapter is live without a site deployment.':action==='approve'?'Saved manuscript approved. Choose a release date or Publish Now when ready.':action==='restore'?'Earlier version restored as a draft. Preview and approve it before scheduling.':'Draft saved. The public chapter is unchanged.'));
 }catch(error){say(error.message);}finally{busy=false;text.readOnly=false;controls();}
}
el('load-published').onclick=async()=>{if(busy)return;if(dirty()&&!confirm('Replace unsaved edits with the current published text?'))return;busy=true;controls();
try{const data=await api();const response=await fetch('/admin/little-mini/api?id='+encodeURIComponent(selected)+'&revision='+encodeURIComponent(data.chapter.published_revision),{cache:'no-store'});const published=await response.json();if(!response.ok)throw Error(published.error||'Could not load the published text.');text.value=published.current.source;changed();say('Loaded exact current published text. Any saved draft remains private until you save or publish.');}catch(error){say(error.message);}finally{busy=false;controls();}};
el('approve-manuscript').onclick=()=>save('approve');el('save').onclick=()=>save('draft');el('publish').onclick=()=>save('publish');el('restore').onclick=()=>save('restore',{revision:el('history').value});
el('find-next').onclick=()=>{const query=el('find').value;if(!query)return;let index=text.value.indexOf(query,text.selectionEnd);if(index<0)index=text.value.indexOf(query);if(index<0){say('Text not found. Find is case sensitive.');return;}text.focus();text.setSelectionRange(index,index+query.length);};
el('replace').onclick=()=>{const query=el('find').value;if(!query||text.value.slice(text.selectionStart,text.selectionEnd)!==query){say('Use Find Next to select the text first.');return;}text.setRangeText(el('replacement').value,text.selectionStart,text.selectionEnd,'select');changed();};
el('replace-all').onclick=()=>{const query=el('find').value;if(!query)return;const pieces=text.value.split(query),count=pieces.length-1;if(!count){say('Text not found.');return;}if(!confirm('Replace all '+count+' occurrences in this chapter?'))return;text.value=pieces.join(el('replacement').value);changed();say(count+' replacements made. Review and save or publish.');};

async function refreshReleases(){
 const r=await fetch('/admin/little-mini/releases',{cache:'no-store'}),data=await r.json();if(!r.ok)throw Error(data.error||'Release controls unavailable.');releaseRows=data.chapters;
 for(const c of releaseRows){const badge=document.querySelector('[data-status-id="'+c.id+'"]'),date=document.querySelector('[data-date-id="'+c.id+'"]');if(badge){badge.textContent=c.status_label;badge.dataset.status=c.status;}if(date){date.textContent=c.scheduled_label;date.hidden=c.status!=='scheduled';}}
 const c=releaseRows.find(c=>c.id===selected);el('release-controls').hidden=!c||c.status==='published';
 if(c){el('release-details').textContent=c.status_label+' · '+c.scheduled_label;const value=c.scheduled_at?easternValue(c.scheduled_at):data.suggested_eastern;el('release-date').value=value.slice(0,10);el('release-time').value=value.slice(11,16);document.querySelector('[data-release="schedule"]').textContent=c.scheduled_at?'Reschedule Publication':'Schedule Publication';el('release-pair').checked=false;showReleaseSelection();}
}
function easternValue(value){if(!value)return '';const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value)).map(x=>[x.type,x.value]));return p.year+'-'+p.month+'-'+p.day+'T'+p.hour+':'+p.minute;}
function futureEastern(value){
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw Error('Choose both a date and a time in Eastern Time.');
 const candidates=[4,5].map(h=>new Date(value+':00Z').valueOf()+h*3600000).filter(ms=>Number.isFinite(ms)&&easternValue(ms)===value);
 if(!candidates.length)throw Error('This date/time does not exist in Eastern Time, including during the spring daylight saving jump. Choose a valid time.');
 if(candidates.length>1)throw Error('This Eastern time occurs twice when daylight saving time ends. Choose a time outside the repeated hour.');
 if(candidates[0]<=Date.now())throw Error('Choose a publication date and time later than now.');
 return new Date(candidates[0]);
}
function showReleaseSelection(){
 try{const date=futureEastern(el('release-date').value+'T'+el('release-time').value);el('release-selection').textContent=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',weekday:'long',year:'numeric',month:'long',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(date)+' · Eastern';}
 catch(error){el('release-selection').textContent=error.message;}
}
for(const id of ['release-date','release-time'])el(id).addEventListener('input',showReleaseSelection);
for(const button of document.querySelectorAll('[data-release]'))button.onclick=async()=>{
 if(busy)return;if(dirty()){say('Save your text edits before changing publication.');return;}
 const c=releaseRows.find(c=>c.id===selected),action=button.dataset.release;if(!c)return;
 let targets=[c];if(el('release-pair').checked){const other=releaseRows.find(r=>r.kind!==c.kind&&r.number===c.number);if(!other||other.status==='published'){say('A matching unpublished companion is required for pair actions.');return;}targets.push(other);}
 if(['schedule','publish-now','resume'].includes(action)&&targets.some(c=>!c.approved_revision||c.approved_revision!==c.draft_revision)){say('Each selected manuscript must have an approved saved revision.');return;}
 let when=el('release-date').value+'T'+el('release-time').value;
 if(action==='schedule'){try{futureEastern(when);}catch(error){say(error.message);return;}}
 if(action==='publish-now'&&!confirm('Publish immediately: '+targets.map(c=>c.kind+' chapter '+c.number).join(' and ')+'?'))return;
 busy=true;controls();
 try{const r=await fetch('/admin/little-mini/releases',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,ids:targets.map(c=>c.id),versions:Object.fromEntries(targets.map(c=>[c.id,c.version])),when})});const result=await r.json();if(!r.ok)throw Error(result.error||'Release action failed.');
 const data=await api();currentChapter=data.chapter;version=data.chapter.version;el('public-link').hidden=data.chapter.status!=='published';el('details').textContent=data.chapter.status+' · Last modified: '+new Date(data.chapter.modified_at).toLocaleString();await refreshReleases();say(result.warning||(action==='publish-now'?'Published immediately. Navigation and companion links now include this release.':'Release settings saved. The automatic alarm now follows the earliest eligible release. No other installment dates changed.'));
 }catch(error){say(error.message);}finally{busy=false;controls();}
};
el('create-chapter').onclick=async()=>{
 if(busy)return;const message=el('create-message');el('create-chapter').disabled=true;
 try{const r=await fetch('/admin/little-mini/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'create',kind:el('new-kind').value,number:Number(el('new-number').value),title:el('new-title').value,slug:el('new-slug').value,source:el('new-source').value})});const data=await r.json();if(!r.ok)throw Error(data.error||'Could not create draft.');message.textContent='Private draft created. Reload the Chapter Manager to edit and schedule it.';
 }catch(error){message.textContent=error.message;}finally{el('create-chapter').disabled=false;}
};
`;

// These controls use the dedicated release API and preserve the existing editor workflow.

const styles=String.raw`
.release-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.release-fields input{display:block;width:100%;min-width:0}@media(max-width:450px){.release-fields{grid-template-columns:1fr}}
#list{grid-template-columns:repeat(2,minmax(0,1fr));align-items:start;gap:20px;margin:24px 0}
#list .chapter-track{min-width:0;padding:18px;margin:0}
#list h2{font-size:21px;line-height:1.3;margin:0 0 16px}
#list .chapter-list{list-style:none;padding:0;margin:0;display:grid;gap:10px}
#list .chapter-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px 10px;align-items:start;margin:0;padding:12px;background:#071e38;border:1px solid #294b70;border-radius:10px}
#list .chapter-select{display:flex;flex-direction:column;gap:3px;min-width:0;width:100%;padding:0;border:0;border-radius:3px;background:transparent;text-align:left;line-height:1.4}
#list .chapter-number{font-size:12px;font-weight:600;color:#adc2d9}
#list .chapter-title{font-size:16px;font-weight:600;overflow-wrap:anywhere}
#list .chapter-select:hover .chapter-title{color:#9fd0ff;text-decoration:underline}
#list .release-status{justify-self:end;white-space:nowrap;font-size:12px;line-height:1.5;padding:3px 8px}
#list .release-status[data-status="scheduled"]{background:#183f68;color:#c3e0ff}
#list .release-status[data-status="held"]{background:#594522;color:#ffe4a9}
#list .release-status[data-status="draft"]{background:#354157;color:#d9e3f2}
#list .chapter-schedule,#list .chapter-draft{grid-column:1/-1;font-size:13px;line-height:1.4}
@media(max-width:700px){#list{grid-template-columns:1fr;gap:16px}#list .chapter-track{padding:15px}}
`;
