(() => {
  const config = window.BRISKET_CONFIG || {};
  const rsvpButton = document.querySelector('#rsvp-button');
  const potluckList = document.querySelector('#potluck-list');
  const potluckStatus = document.querySelector('#potluck-status');
  const refreshPotluck = document.querySelector('#refresh-potluck');
  const invitationImage = document.querySelector('#invitation-image');

  if (invitationImage) {
    const showImage = () => {
      invitationImage.hidden = false;
      invitationImage.classList.remove('is-broken');
    };

    const hideBrokenImage = () => {
      invitationImage.hidden = true;
      invitationImage.classList.add('is-broken');
    };

    invitationImage.addEventListener('load', showImage);
    invitationImage.addEventListener('error', hideBrokenImage);

    // The image may finish loading before this script runs, especially from cache.
    if (invitationImage.complete) {
      if (invitationImage.naturalWidth > 0) showImage();
      else hideBrokenImage();
    }
  }

  if (rsvpButton) {
    if (config.rsvpUrl) {
      rsvpButton.href = config.rsvpUrl;
      rsvpButton.target = '_blank';
      rsvpButton.rel = 'noopener';
    } else {
      rsvpButton.addEventListener('click', (event) => {
        event.preventDefault();
        alert('The RSVP link is being connected.');
      });
    }
  }

  function renderPotluck(items) {
    if (!potluckList) return;
    potluckList.replaceChildren();

    items
      .filter((item) => item && item.name && item.item)
      .forEach((item) => {
        const row = document.createElement('li');
        const name = document.createElement('strong');
        const contribution = document.createElement('span');
        name.textContent = item.name;
        contribution.textContent = item.item;
        row.append(name, contribution);
        potluckList.append(row);
      });
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;

    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];
      const nextCharacter = text[index + 1];

      if (character === '"') {
        if (quoted && nextCharacter === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = !quoted;
        }
      } else if (character === ',' && !quoted) {
        row.push(cell.trim());
        cell = '';
      } else if ((character === '\n' || character === '\r') && !quoted) {
        if (character === '\r' && nextCharacter === '\n') index += 1;
        row.push(cell.trim());
        cell = '';
        if (row.some(Boolean)) rows.push(row);
        row = [];
      } else {
        cell += character;
      }
    }

    row.push(cell.trim());
    if (row.some(Boolean)) rows.push(row);

    return rows
      .slice(1)
      .map((columns) => ({ name: columns[0] || '', item: columns[1] || '' }))
      .filter((item) => item.name && item.item);
  }

  async function loadPotluck() {
    if (!potluckStatus) return;
    potluckStatus.textContent = 'Updating…';

    try {
      if (!config.potluckEndpoint) throw new Error('No endpoint configured');
      const response = await fetch(config.potluckEndpoint, { cache: 'no-store' });
      if (!response.ok) throw new Error(String(response.status));

      const items = config.potluckFormat === 'csv'
        ? parseCsv(await response.text())
        : await response.json();

      renderPotluck(items);
      potluckStatus.textContent = 'Updated just now.';
    } catch {
      renderPotluck(config.fallbackPotluck || []);
      potluckStatus.textContent = 'Showing the latest saved list.';
    }
  }

  if (refreshPotluck) refreshPotluck.addEventListener('click', loadPotluck);
  loadPotluck();
})();
