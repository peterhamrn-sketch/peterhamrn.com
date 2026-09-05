(() => {
  'use strict';

  const SEND_URL = 'https://test.asm.peterhamrn.com/api/student-resource/send';
  const icons = { classes:'☰', share:'↗', contact:'✉', resources:'+', facebook:'f', instagram:'◎' };
  const media = {
    lovely: { src:'/images/class-resources/lovely-law-firm-banner.png', alt:'Lovely Law Firm', placeholder:'Approved Lovely Law Firm banner asset pending' },
    basic: { src:'/images/class-resources/asm-basic-banner.png', alt:'Road Guardians and Basic ASM', placeholder:'Approved Basic ASM / Road Guardians banner asset pending' },
    advanced: { src:'/images/class-resources/asm-basic-banner.png', alt:'Road Guardians and Basic ASM', placeholder:'Approved Advanced banner asset pending' }
  };
  // Emergency display-only fallback derived from the verified pre-JSON renderer.
  // resources.json remains the sole source used by email and normal page rendering.
  const fallback = {
    common: [
      { id:'classes', title:'Classes with Peter & Tamara', description:'See our upcoming ASM classes, clinics, and other training opportunities.', url:'https://peterhamrn.com/classes/' },
      { id:'share', title:'Share With a Friend', description:'Know someone who should take an ASM class? Share our upcoming classes with them.', url:'https://peterhamrn.com/classes/' },
      { id:'resources', title:'Resources', description:'Helpful motorcycle safety, emergency response, and rider resources from your class.', url:'https://peterhamrn.com/resources.html' },
      { id:'facebook', title:'Facebook', description:'Join the SC Road Guardians–Accident Scene Management group for class updates, upcoming events, and motorcycle safety information.', url:'https://www.facebook.com/groups/953062826227905/?ref=share_group_link' },
      { id:'instagram', title:'Instagram', description:'Follow us on Instagram for class updates, photos, events, and motorcycle safety content.', url:'https://www.instagram.com/lifesavertrainingmb/' },
      { id:'contact', title:'Contact Peter', description:'Have a question about the class or need help afterward? Contact Peter directly.', url:'https://peterhamrn.com/#projects' }
    ],
    banners: {
      lovely: { title:'Lovely Law Firm', description:'Our generous sponsor helping make these ASM classes free to students. Learn more about their motorcycle accident resources.', url:'https://www.justiceislovely.com/myrtle-beach-motorcycle-accident-lawyer-near-you/' },
      basic: { title:'Road Guardians and Basic ASM', url:'https://roadguardians.org/' },
      advanced: { title:'Road Guardians and Advanced ASM', url:'https://roadguardians.org/' }
    }
  };

  const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[character]));
  const validUrl = value => { try { return new URL(value).protocol === 'https:'; } catch { return false; } };
  const validLink = item => item && typeof item.id === 'string' && typeof item.title === 'string' && typeof item.description === 'string' && validUrl(item.url);
  function validData(data) {
    return data && data.schemaVersion === 1 && Array.isArray(data.common) && data.common.every(validLink) &&
      data.banners && ['lovely','basic','advanced'].every(key => validLink(data.banners[key])) &&
      data.courses && ['basic','advanced'].every(key => data.courses[key] && typeof data.courses[key].pageTitle === 'string' && typeof data.courses[key].emailSubject === 'string' && typeof data.courses[key].emailIntroduction === 'string');
  }
  function card(item, index) {
    const inside = `<span class="card-icon" aria-hidden="true">${icons[item.id] || '+'}</span><span><h2>${esc(item.title)}</h2><p>${esc(item.description)}</p></span>`;
    if (item.id === 'share') return `<div class="resource-card" data-share-card tabindex="0" role="button" aria-label="${esc(item.title)}: ${esc(item.description)}">${inside}<span class="share-status" data-share-status aria-live="polite"></span></div>`;
    const external = !item.url.startsWith('https://peterhamrn.com/');
    return `<a class="resource-card" href="${esc(item.url)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''} data-card="${index + 1}">${inside}</a>`;
  }
  function banner(item, kind) {
    const image = media[kind];
    return `<a class="banner-link" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(item.title)}"><img src="${image.src}" alt="${image.alt}" data-banner-image><span class="banner-placeholder" data-banner-placeholder hidden>${image.placeholder}</span></a>`;
  }
  async function share(element, url) {
    const status = element.querySelector('[data-share-status]');
    if (navigator.share) { try { await navigator.share({ title:'Classes with Peter & Tamara', text:'See upcoming classes and clinics.', url }); return; } catch (error) { if (error?.name === 'AbortError') return; } }
    try { await navigator.clipboard.writeText(url); status.textContent = 'Classes link copied.'; } catch { status.textContent = `Copy this link: ${url}`; }
  }
  async function send(button, note) {
    button.disabled = true; note.textContent = 'Sending…';
    try {
      const reply = await fetch(SEND_URL, { method:'POST', credentials:'include', headers:{ 'Content-Type':'application/json' }, body:'{}' });
      const result = await reply.json().catch(() => ({}));
      if (!reply.ok || !result.ok) throw new Error();
      note.textContent = result.alreadySent ? 'This information was already sent.' : 'This information was sent.';
    } catch { button.disabled = false; note.textContent = 'Email could not be sent. Please try again.'; }
  }
  function render(data) {
    const type = document.body.dataset.course === 'advanced' ? 'advanced' : 'basic';
    document.querySelector('[data-resource-cards]').innerHTML = data.common.map(card).join('');
    document.querySelector('[data-banners]').innerHTML = banner(data.banners.lovely, 'lovely') + banner(data.banners[type], type);
    document.querySelectorAll('[data-banner-image]').forEach(image => image.addEventListener('error', () => { image.hidden = true; image.nextElementSibling.hidden = false; }, { once:true }));
    const shareItem = data.common.find(item => item.id === 'share');
    const shareCard = document.querySelector('[data-share-card]');
    shareCard.addEventListener('click', () => share(shareCard, shareItem.url));
    shareCard.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); share(shareCard, shareItem.url); } });
    const panel = document.querySelector('.send-panel'), button = panel.querySelector('button'), note = panel.querySelector('.send-note');
    button.disabled = false; button.removeAttribute('aria-disabled'); note.textContent = 'Send these resources to the email on your class roster.';
    button.addEventListener('click', () => send(button, note));
  }
  async function start() {
    try { const reply = await fetch('/class-resources/resources.json', { headers:{ accept:'application/json' } }); if (!reply.ok) throw new Error(); const data = await reply.json(); if (!validData(data)) throw new Error(); render(data); }
    catch { render(fallback); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true }); else start();
})();
