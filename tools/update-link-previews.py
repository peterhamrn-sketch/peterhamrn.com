#!/usr/bin/env python3
"""Update initial-HTML sharing metadata only; --check detects drift without writes."""
import argparse
import html
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
START, END = '<!-- link-preview:start -->', '<!-- link-preview:end -->'

def updated(source, page):
    esc = lambda value: html.escape(value, quote=True)
    image = 'https://peterhamrn.com/images/previews/' + page['image']
    tags = [START, '<link rel="canonical" href="' + esc(page['url']) + '">']
    og = {'type': 'website', 'site_name': 'PeterHamRN.com', 'title': page['title'],
          'description': page['description'], 'url': page['url'], 'image': image,
          'image:type': 'image/jpeg', 'image:width': '1200', 'image:height': '630',
          'image:alt': page['title']}
    tags += [f'<meta property="og:{key}" content="{esc(value)}">' for key, value in og.items()]
    twitter = {'card': 'summary_large_image', 'title': page['title'],
               'description': page['description'], 'image': image, 'image:alt': page['title']}
    tags += [f'<meta name="twitter:{key}" content="{esc(value)}">' for key, value in twitter.items()]
    tags.append(END)
    source = re.sub(re.escape(START) + r'.*?' + re.escape(END) + r'\n?', '', source, flags=re.S)
    source = re.sub(r'<link\b(?=[^>]*\brel=["\']canonical["\'])[^>]*>', '', source, flags=re.I)
    source = re.sub(r'<meta\b(?=[^>]*(?:name|property)=["\'](?:og:|twitter:))[^>]*>', '', source, flags=re.I)
    description = '<meta name="description" content="' + esc(page['description']) + '">'
    if re.search(r'<meta name="description"[^>]*>', source):
        source = re.sub(r'<meta name="description"[^>]*>', lambda _: description, source)
    else:
        source = source.replace('<title>', description + '\n<title>', 1)
    source = re.sub(r'<title>.*?</title>', lambda _: '<title>' + esc(page['title']) + '</title>', source, count=1, flags=re.S)
    return source.replace('<title>', '\n'.join(tags) + '\n<title>', 1)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    pages = json.loads((ROOT / 'tools/link-previews.json').read_text())
    drift = []
    for page in pages:
        path = ROOT / page['file']
        source = path.read_text()
        output = updated(source, page)
        if source != output:
            drift.append(page['file'])
            if not args.check:
                path.write_text(output)
        if not (ROOT / 'images/previews' / page['image']).exists():
            raise SystemExit('Missing preview asset: ' + page['image'])
    if args.check and drift:
        raise SystemExit('Metadata needs regeneration: ' + ', '.join(drift))
    print(f'{len(pages)} public pages: ' + ('metadata consistent' if args.check else 'metadata updated'))

if __name__ == '__main__':
    main()
