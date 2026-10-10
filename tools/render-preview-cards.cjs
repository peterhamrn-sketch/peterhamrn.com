// Optional asset-maintenance tool: requires sharp locally; no website/build dependency.
// Produces new JPEG cards from existing artwork; never modifies original images.
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');
const cards = [
  ['peter-ham', 'images/peter-ham.png', ['Peter Ham', 'BSN, RN'], ['Peter Ham Solutions', 'Practical Experience. Practical Solutions.']],
  ['asm-instructor', 'images/asm-instructor-icon.jpg', ['ASM Instructor'], ['Class management for', 'Accident Scene Management instructors']],
  ['availability', 'images/availability-app-icon.png', ['Availability'], ['Calendar availability, made simple', 'For iPhone and Apple Shortcuts']],
  ['bp-compare', 'images/bp-cuff-compare-icon.jpg', ['BP Compare'], ['Paired blood-pressure readings', 'Compare devices. Review trends.']],
  ['macremote', 'images/macremote-icon.jpeg', ['MacRemote'], ['Your Mac workflows, on your iPhone']],
  ['ride-connected', 'images/ride-connected-icon.png', ['Ride Connected'], ['Motorcycle ride tools for iPhone', 'In development']],
  ['recovery-tags', 'peterhamrn-logo.svg', ['Recovery Tags'], ['Help lost items find their way home', 'Peter Ham Solutions']],
  ['brisket', 'cookout-invitation.jpg', ['Brisket Cookout'], ['September 6, 2026', 'Event information and photo links']]
];
const esc = value => value.replace(/&/g, '&amp;').replace(/</g, '&lt;');
function base(content) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><defs><linearGradient id="bg"><stop stop-color="#061d3c"/><stop offset="1" stop-color="#0b3b74"/></linearGradient></defs><rect width="1200" height="630" fill="url(#bg)"/><rect x="52" y="550" width="1096" height="2" fill="#479cff"/><g font-family="Arial, sans-serif">${content}<text x="52" y="600" fill="#c6e1ff" font-size="26">PeterHamRN.com</text></g></svg>`);
}
(async () => {
  const out = path.join(root, 'images/previews');
  fs.mkdirSync(out, {recursive:true});
  for (const [name, file, title, subtitle] of cards) {
    const art = await sharp(path.join(root, file)).resize(390, 400, {fit:'contain', background:'#061d3c'}).png().toBuffer();
    const titleY = title.length > 1 ? 190 : 225;
    const text = title.map((line,i)=>`<text x="492" y="${titleY+i*65}" font-size="${line.length > 17 ? 48 : 56}" font-weight="700" fill="white">${esc(line)}</text>`).join('') +
      subtitle.map((line,i)=>`<text x="492" y="${titleY+title.length*65+35+i*40}" font-size="28" fill="#c6e1ff">${esc(line)}</text>`).join('');
    await sharp(base(text)).composite([{input:art,left:52,top:95}]).jpeg({quality:88,mozjpeg:true}).toFile(path.join(out,name+'.jpg'));
  }
  const art = await sharp(path.join(root,'images/class-resources/asm-basic-banner.png')).resize(1096,365,{fit:'contain',background:'#061d3c'}).png().toBuffer();
  const text='<text x="52" y="463" fill="white" font-size="44" font-weight="700">Motorcycle Accident Scene Management</text><text x="52" y="510" fill="#c6e1ff" font-size="30">Basic &amp; Advanced Classes · Myrtle Beach, SC</text>';
  await sharp(base(text)).composite([{input:art,left:52,top:48}]).jpeg({quality:88,mozjpeg:true}).toFile(path.join(out,'classes.jpg'));
  console.log('Created nine 1200 × 630 JPEG preview cards.');
})();
