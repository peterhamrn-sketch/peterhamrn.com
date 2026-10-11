import {markdown,shell,esc} from '../../tools/little-mini/render.mjs';
import {chapterNavigation} from '../../tools/little-mini/navigation.mjs';
import manifest from '../../tools/little-mini/project.json' with {type:'json'};
export const launchPaths=new Set(manifest.chapters.map(c=>`/little-mini/${c.kind}/${c.slug}/`));
export function renderSource(source){
 // Preserve the exact historical file in revision source. This prefix is archive status metadata.
 return markdown(source.replace(/^> \*\*REVIEW DRAFT — NOT YET APPROVED OR PUBLISHED\*\*\r?\n\r?\n/,''));
}
export function newChapterPage(c){
 const publication=c.kind==='story'?'The Little Mini Who Wouldn’t Quit':'The Little Mini Resurrection Manual';
 const body=`<main id="main" class="wrap"><article class="reader"><p><a href="/little-mini/">← Little Mini project home</a></p><p class="publication-title">${esc(publication)}</p><p class="eyebrow" style="color:#0b62bf">Chapter ${c.number}</p><h1>${esc(c.title)}</h1><p class="muted mini-publication-date"></p><div class="manuscript"></div><div class="reading-navigation"></div><p><a href="/little-mini/">Back to the Little Mini project home</a></p></article></main>`;
 return shell(c.title+' | '+publication,body,c.path);
}
export async function publishedChapters(db){
 const rows=(await db.prepare("SELECT id,kind,number,title,path,publication_date FROM mini_chapters WHERE status='published' AND published_revision IS NOT NULL ORDER BY kind,number").all()).results||[];
 return rows.map(c=>({...c,slug:c.path.split('/').filter(Boolean).at(-1),related:manifest.chapters.find(m=>m.id===c.id)?.related||rows.filter(r=>r.kind!==c.kind&&r.number===c.number).map(r=>r.id)}));
}
export function navigation(c,published){return chapterNavigation(published.find(p=>p.id===c.id)||c,published);}
