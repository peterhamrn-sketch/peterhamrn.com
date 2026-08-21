const UPSTREAM_FEED_URL = 'https://test.asm.peterhamrn.com/api/public/classes';

export async function onRequestGet() {
  const response = await fetch(UPSTREAM_FEED_URL, {
    headers: { Accept: 'application/json' },
    cf: { cacheTtl: 60, cacheEverything: true }
  });

  if (!response.ok) {
    return Response.json(
      { error: 'Published class information is temporarily unavailable.' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const contentType = response.headers.get('Content-Type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return Response.json(
      { error: 'Published class information returned an invalid response.' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  return new Response(response.body, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=60',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}
