#!/usr/bin/env python3
"""Read-only production preview checks: initial HTML and unauthenticated images."""
import concurrent.futures
from html.parser import HTMLParser
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
AGENTS = {
    'browser': 'Mozilla/5.0 (iPad; CPU OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Version/26.0 Mobile/15E148 Safari/604.1',
    'crawler': 'Mozilla/5.0 (compatible; Applebot/0.1; +http://www.apple.com/go/applebot)',
}
class Metadata(HTMLParser):
    def __init__(self):
        super().__init__(); self.meta = {}; self.canonical = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'meta':
            key = attrs.get('property', attrs.get('name', ''))
            self.meta.setdefault(key, []).append(attrs.get('content', ''))
        if tag == 'link' and attrs.get('rel') == 'canonical':
            self.canonical.append(attrs.get('href'))

def fetch(url, agent):
    result = subprocess.run(['curl', '--http1.1', '-sS', '-L', '--max-redirs', '5',
                             '--max-time', '30', '-A', AGENTS[agent], '-w',
                             '\nPREVIEW_RESULT:%{http_code}|%{content_type}|%{url_effective}', url],
                            capture_output=True, timeout=35)
    if result.returncode:
        raise RuntimeError(f'{url}: curl failed ({result.returncode})')
    body, trailer = result.stdout.rsplit(b'\nPREVIEW_RESULT:', 1)
    code, content_type, final = trailer.decode().split('|')
    assert code == '200', (url, code)
    return body, content_type, final

def check(task):
    url, page, agent = task
    body, content_type, final = fetch(url, agent)
    assert content_type.startswith('text/html'), (url, content_type)
    parser = Metadata(); parser.feed(body.decode())
    image = 'https://peterhamrn.com/images/previews/' + page['image']
    assert parser.canonical == [page['url']], (url, 'canonical')
    expected = {'og:type':'website', 'og:title':page['title'], 'og:description':page['description'],
                'og:url':page['url'], 'og:image':image, 'og:image:type':'image/jpeg',
                'og:image:width':'1200', 'og:image:height':'630',
                'twitter:card':'summary_large_image', 'twitter:title':page['title'],
                'twitter:description':page['description'], 'twitter:image':image}
    for key, value in expected.items():
        assert parser.meta.get(key) == [value], (url, key, 'missing, duplicate, or stale metadata')
    assert not any('noindex' in value for value in parser.meta.get('robots', [])), url
    return {'url':url, 'agent':agent, 'final':final, 'status':'PASS'}

def check_image(task):
    name, agent = task
    url = 'https://peterhamrn.com/images/previews/' + name
    body, content_type, final = fetch(url, agent)
    assert content_type.startswith('image/jpeg') and final == url, (url, content_type, final)
    assert body == (ROOT / 'images/previews' / name).read_bytes(), (url, 'image bytes differ')
    return {'url':url, 'agent':agent, 'bytes':len(body), 'status':'PASS'}

def main():
    pages = json.loads((ROOT / 'tools/link-previews.json').read_text())
    urls = [(p['url'], p) for p in pages]
    classes = next(p for p in pages if p['file'] == 'classes/index.html')
    asm = next(p for p in pages if p['file'] == 'asm-instructor.html')
    brisket = next(p for p in pages if p['file'] == 'brisket/index.html')
    urls += [(u, classes) for u in ['https://classes.peterhamrn.com/', 'https://www.classes.peterhamrn.com/', 'https://peterhamrn.com/classes/']]
    urls += [('https://peterhamrn.com/asm-instructor.html', asm), ('https://brisket.peterhamrn.com/', brisket)]
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        checks = list(pool.map(check, [(url, page, agent) for url, page in urls for agent in AGENTS]))
        images = list(pool.map(check_image, [(name, agent) for name in sorted({p['image'] for p in pages}) for agent in AGENTS]))
    print(json.dumps({'pages':checks, 'images':images}, indent=2))

if __name__ == '__main__':
    main()
