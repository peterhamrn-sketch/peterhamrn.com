import {markdown} from '../../tools/little-mini/render.mjs';

// Editorial notices remain in immutable revision.source; only reader output is filtered.
export function publicationSource(source){
 const lines=source.replace(/^\uFEFF/,'').split(/\r?\n/),kept=[];
 for(let i=0;i<lines.length;i++){
  const label=lines[i].trim().replace(/^>\s*/,'').replace(/\*\*/g,'');
  const notice=/^(?:(?:REVIEW DRAFT|ASSEMBLED DRAFT|RECOVERED SOURCE DRAFT)\s*[—–-]\s*NOT (?:YET )?APPROVED (?:OR PUBLISHED|FOR PUBLICATION)|EDITORIALLY APPROVED\s*[—–-]\s*NOT YET SCHEDULED OR PUBLISHED)\s*$/i.test(label);
  if(!notice){kept.push(lines[i]);continue;}
  // Archive provenance/editorial lines form the same leading blockquote as the notice.
  if(lines[i].trim().startsWith('>'))while(i+1<lines.length&&/^\s*>/.test(lines[i+1]))i++;
 }
 return kept.join('\n');
}
export const renderSource=source=>markdown(publicationSource(source));
