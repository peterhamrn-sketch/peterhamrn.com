import { esc } from './render.mjs';

// Call with published chapters only. Each reading sequence stays within its kind.
export function chapterNavigation(chapter, publishedChapters) {
  const url = c => `/little-mini/${c.kind}/${c.slug}/`;
  const sequence = publishedChapters.filter(c => c.kind === chapter.kind).sort((a, b) => a.number - b.number);
  const index = sequence.findIndex(c => c.id === chapter.id);
  const previous = sequence[index - 1];
  const next = sequence[index + 1];
  const story = chapter.kind === 'story';
  const trackName = story ? 'Humorous story' : 'Technical manual';
  const companionName = story ? 'The Little Mini Resurrection Manual' : 'The Little Mini Who Wouldn’t Quit';
  const companions = publishedChapters.filter(c => c.kind !== chapter.kind && (chapter.related || []).includes(c.id));
  const track = `<nav class="chapter-nav ${story ? 'story-track' : 'manual-track'}" aria-label="${trackName} chapter navigation"><h2>${trackName}</h2>${previous ? `<a class="chapter-previous" rel="prev" href="${url(previous)}">← Previous Chapter<span>${previous.number}. ${esc(previous.title)}</span></a>` : ''}${next ? `<a class="chapter-next" rel="next" href="${url(next)}">Next Chapter →<span>${next.number}. ${esc(next.title)}</span></a>` : '<p class="chapter-coming-soon">More chapters coming soon</p>'}</nav>`;
  const companion = `<aside class="related companion-reading"><h2>Companion reading</h2><p>${esc(companionName)}</p>${companions.map(c => `<a href="${url(c)}">Chapter ${c.number} — ${esc(c.title)}</a>`).join('')}</aside>`;
  return `<div class="reading-navigation">${story ? track + companion : companion + track}</div>`;
}
