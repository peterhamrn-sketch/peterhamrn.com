export const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function inline(source){
 // Protect inline code and links while applying emphasis. Raw HTML stays escaped.
 const chunks=[];const token=html=>'\u0000'+(chunks.push(html)-1)+'\u0000';
 let text=source.replace(/`([^`]+)`/g,(_,code)=>token('<code>'+esc(code)+'</code>'));
 text=text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,(_,label,url)=>token('<a href="'+esc(url)+'" rel="noopener noreferrer">'+esc(label)+'</a>'));
 text=esc(text).replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/\*([^*]+)\*/g,'<em>$1</em>');
 return text.replace(/\u0000(\d+)\u0000/g,(_,i)=>chunks[Number(i)]);
}
export function markdown(source){
 const lines=source.replace(/\r\n/g,'\n').split('\n');let html='',paragraph=[],list=null;
 const flushParagraph=()=>{if(paragraph.length){html+='<p>'+inline(paragraph.join('\n'))+'</p>';paragraph=[]}};
 const closeList=()=>{if(list){html+='</'+list+'>';list=null}};
 const flush=()=>{flushParagraph();closeList()};
 const cells=line=>line.trim().replace(/^\|/,'').replace(/\|$/,'').split('|').map(s=>s.trim());
 for(let i=0;i<lines.length;i++){
  const line=lines[i];
  if(/^```/.test(line)){flush();const language=line.slice(3).trim();const code=[];while(++i<lines.length&&!/^```/.test(lines[i]))code.push(lines[i]);html+='<div class="code-block">'+(language==='text'?'':'<button type="button" class="copy-command">Copy command</button>')+'<pre><code>'+esc(code.join('\n'))+'</code></pre></div>';continue}
  if(!line.trim()){flush();continue}
  if(/^\s*(?:---+|\*\*\*+)\s*$/.test(line)){flush();html+='<hr>';continue}
  const heading=line.match(/^(#{1,6})\s+(.+)$/);if(heading){flush();const level=heading[1].length;html+=`<h${level}>${inline(heading[2])}</h${level}>`;continue}
  if(line.trim().startsWith('|')&&lines[i+1]&&cells(lines[i+1]).every(c=>/^:?-{3,}:?$/.test(c))){
   flush();const headers=cells(line);i++;html+='<div class="table-scroll"><table><thead><tr>'+headers.map(c=>'<th scope="col">'+inline(c)+'</th>').join('')+'</tr></thead><tbody>';
   while(lines[i+1]?.trim().startsWith('|')){i++;html+='<tr>'+cells(lines[i]).map(c=>'<td>'+inline(c)+'</td>').join('')+'</tr>'}html+='</tbody></table></div>';continue;
  }
  const item=line.match(/^(?:(\d+)\.|[-*])\s+(.+)$/);if(item){flushParagraph();const type=item[1]?'ol':'ul';if(list!==type){closeList();html+='<'+type+(type==='ol'?' start="'+Number(item[1])+'"':'')+'>';list=type}
   const task=item[2].match(/^\[([ xX])\]\s+(.*)$/);html+='<li>'+(task?'<label><input type="checkbox" disabled'+(task[1].trim()?' checked':'')+'>'+inline(task[2])+'</label>':inline(item[2]))+'</li>';continue}
  if(line.startsWith('> ')){flush();const quote=[line.slice(2)];while(lines[i+1]?.startsWith('> '))quote.push(lines[++i].slice(2));html+='<blockquote>'+inline(quote.join('\n'))+'</blockquote>';continue}
  if(list)closeList();paragraph.push(line);
 }
 flush();return html;
}
export function shell(title,body,path){
 const links='<a href="/#top">Home</a><a href="/#projects">Projects</a><a href="/apps-automations.html">Apps</a><a href="/#journey">Journey</a><a href="/resources.html">Resources</a><a href="/classes/">Classes</a><a href="/contact">Contact</a>';
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#061d3c"><title>${esc(title)} | PeterHamRN.com</title><meta name="description" content="The true story of a 2012 Mac mini resurrection, with a practical companion manual for Mac computers."><link rel="canonical" href="https://peterhamrn.com${path}"><meta property="og:title" content="${esc(title)} | PeterHamRN.com"><meta property="og:type" content="article"><meta property="og:url" content="https://peterhamrn.com${path}"><meta property="og:site_name" content="PeterHamRN.com"><link rel="icon" type="image/svg+xml" href="/peterhamrn-logo.svg"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><link rel="stylesheet" href="/assets/little-mini.css"></head><body><a href="#main" class="skip">Skip to content</a><header><div class="wrap"><nav aria-label="Primary navigation"><a class="brand" href="/"><img src="/peterhamrn-logo.svg" alt="">PeterHamRN<b>.com</b></a><div class="links">${links}</div><button class="menu-toggle" type="button" aria-expanded="false" aria-controls="mini-mobile-nav">Menu</button></nav><div class="mobile-menu" id="mini-mobile-nav">${links}</div></div></header>${body}<footer><div class="wrap"><div class="footgrid"><div><h3>PeterHamRN.com</h3><p>Practical Experience.<br>Practical Solutions.</p></div><div><h3>Quick Links</h3><p><a href="/">Home</a><br><a href="/#projects">Projects</a><br><a href="/apps-automations.html">Apps &amp; Automations</a><br><a href="/#journey">Professional Journey</a><br><a href="/resources.html">Resources</a><br><a href="/classes/">Upcoming Classes</a></p></div><div><h3>Projects</h3><p><a href="/asm-instructor.html">ASM Instructor</a><br><a href="/bp-cuff-compare.html">BP Cuff Compare</a><br><a href="/little-mini/">The Little Mini</a></p></div><div><h3>Contact</h3><p><a href="mailto:support@PeterHamRN.com">support@PeterHamRN.com</a><br>South Carolina</p></div></div><div class="copyright">© 2026 Peter Ham, BSN, RN. All rights reserved. · <a href="mailto:webmaster@PeterHamRN.com">Webmaster</a></div></div></footer><script src="/assets/little-mini.js" defer></script></body></html>`;
}
