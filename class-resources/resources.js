(() => {
  'use strict';

  const CLASSES_URL = 'https://peterhamrn.com/classes/';
  const sharedCards = [
    { title:'Classes with Peter & Tamara', subtitle:'See all upcoming classes and clinics', icon:'☰', href:'/classes/' },
    { title:'Share With a Friend', subtitle:'Invite a friend to take a class', icon:'↗', action:'share' },
    { title:'Contact Peter', subtitle:'Get in touch with Peter directly', icon:'✉', href:'/#projects' },
    { title:'Resources', subtitle:'Helpful resources for riders', icon:'+', href:'/resources.html' },
    { title:'Facebook', subtitle:'Follow us on Facebook', icon:'f', href:'https://www.facebook.com/groups/953062826227905/?ref=share_group_link', external:true },
    { title:'Instagram', subtitle:'Follow us on Instagram', icon:'◎', href:'https://www.instagram.com/cl.asses105/', external:true }
  ];

  const bannerDefinitions = {
    lovely: {
      href:'https://www.justiceislovely.com/myrtle-beach-motorcycle-accident-lawyer-near-you/',
      src:'/images/class-resources/lovely-law-firm-banner.png',
      alt:'Lovely Law Firm',
      placeholder:'Approved Lovely Law Firm banner asset pending'
    },
    basic: {
      href:'https://roadguardians.org/',
      src:'/images/class-resources/asm-basic-banner.png',
      alt:'Road Guardians and Basic ASM',
      placeholder:'Approved Basic ASM / Road Guardians banner asset pending'
    },
    advanced: {
      href:'https://roadguardians.org/',
      src:'',
      alt:'',
      placeholder:'Approved Advanced banner asset pending'
    }
  };

  function cardMarkup(card, index) {
    const content = `<span class="card-icon" aria-hidden="true">${card.icon}</span><span><h2>${card.title}</h2><p>${card.subtitle}</p></span>`;
    if (card.action === 'share') {
      return `<div class="resource-card" data-share-card tabindex="0" role="button" aria-label="${card.title}: ${card.subtitle}">${content}<span class="share-status" data-share-status aria-live="polite"></span></div>`;
    }
    const target = card.external ? ' target="_blank" rel="noopener noreferrer"' : '';
    return `<a class="resource-card" href="${card.href}"${target} data-card="${index + 1}">${content}</a>`;
  }

  function bannerMarkup(definition, label) {
    const media = definition.src
      ? `<img src="${definition.src}" alt="${definition.alt}" data-banner-image><span class="banner-placeholder" data-banner-placeholder hidden>${definition.placeholder}</span>`
      : `<span class="banner-placeholder">${definition.placeholder}</span>`;
    return `<a class="banner-link" href="${definition.href}" target="_blank" rel="noopener noreferrer" aria-label="${label}">${media}</a>`;
  }

  async function copyClassesUrl(status) {
    try {
      await navigator.clipboard.writeText(CLASSES_URL);
      status.textContent = 'Classes link copied.';
    } catch (_) {
      const field = document.createElement('textarea');
      field.value = CLASSES_URL;
      field.setAttribute('readonly', '');
      field.style.position = 'fixed';
      field.style.opacity = '0';
      document.body.appendChild(field);
      field.select();
      const copied = document.execCommand('copy');
      field.remove();
      status.textContent = copied ? 'Classes link copied.' : `Copy this link: ${CLASSES_URL}`;
    }
  }

  async function shareClasses(card) {
    const status = card.querySelector('[data-share-status]');
    status.textContent = '';
    if (navigator.share) {
      try {
        await navigator.share({title:'Classes with Peter & Tamara', text:'See upcoming classes and clinics.', url:CLASSES_URL});
        return;
      } catch (error) {
        if (error && error.name === 'AbortError') return;
      }
    }
    await copyClassesUrl(status);
  }

  function render() {
    const course = document.body.dataset.course === 'advanced' ? 'advanced' : 'basic';
    document.querySelector('[data-resource-cards]').innerHTML = sharedCards.map(cardMarkup).join('');
    document.querySelector('[data-banners]').innerHTML = [
      bannerMarkup(bannerDefinitions.lovely, 'Open the Lovely Law Firm website'),
      bannerMarkup(bannerDefinitions[course], 'Open the Road Guardians website')
    ].join('');

    document.querySelectorAll('[data-banner-image]').forEach(image => {
      image.addEventListener('error', () => {
        image.hidden = true;
        const placeholder = image.nextElementSibling;
        if (placeholder) placeholder.hidden = false;
      }, {once:true});
    });

    const shareCard = document.querySelector('[data-share-card]');
    shareCard.addEventListener('click', () => shareClasses(shareCard));
    shareCard.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        shareClasses(shareCard);
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render, {once:true});
  else render();
})();
