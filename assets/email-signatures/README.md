# Email signature installers

This directory contains approved email-signature PNGs and private-by-convention
installer pages. The installers are not linked from the public site navigation.
They are designed to be opened in Safari so the rendered signature can be
copied into Proton Mail's rich-text Signature field.

## Naming convention

For an approved address name, use a matching pair:

- `<name>.png`
- `<name>-install.html`

For example, Peter uses `peter.png` and `peter-install.html`. Do not add an
installer until its final graphic, wording, contact details, and link targets
have been approved.

## Image and installer contract

- Use the approved PNG as the only visible signature content. Do not recreate
  its text or design in HTML.
- Reference the PNG through its absolute public HTTPS URL on
  `https://peterhamrn.com/assets/email-signatures/`.
- Never embed a PNG as base64, a `data:` URI, or an attachment. Proton Mail can
  convert embedded images into a broken `unknown.png`.
- This signature design uses native dimensions of 520 × 260 pixels. Set both
  matching HTML `width` and `height` attributes and inline pixel dimensions.
- Define clickable regions as inline-styled, transparent, absolutely positioned
  anchors within the fixed-size signature canvas. Each region must align with
  the corresponding visible contact row and have its own HTTPS, `tel:`, or
  `mailto:` target.
- Keep the actual signature block free of JavaScript and dependent page styles.
  Inline its layout so Safari rich-text copy/paste can carry the image and links.

## Adding another approved signature

1. Add the approved `<name>.png` at its approved native dimensions.
2. Copy `peter-install.html` to `<name>-install.html` as the installer shell.
3. Change only the page heading, remote PNG URL, image dimensions/alt text, and
   approved transparent link rectangles and destinations.
4. Keep `installer.css` as the shared installer-page presentation.
5. Verify the remote PNG, every link target, Safari selection/copy behavior,
   Proton rich-text paste behavior, and the deployed HTTPS installer URL.
