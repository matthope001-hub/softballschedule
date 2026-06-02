export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': '*',
        }
      });
    }

    const url = new URL(request.url);
    const target = url.searchParams.get('url');

    if (!target) {
      return new Response('HCCSL Proxy — OK', {
        headers: { 'Access-Control-Allow-Origin': '*' }
      });
    }

    if (!target.includes('htosports.com')) {
      return new Response('Forbidden', {
        status: 403,
        headers: { 'Access-Control-Allow-Origin': '*' }
      });
    }

    try {
      const res = await fetch(decodeURIComponent(target), {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      const html = await res.text();
      return new Response(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
        }
      });
    } catch (e) {
      return new Response('Upstream fetch failed: ' + e.message, {
        status: 502,
        headers: { 'Access-Control-Allow-Origin': '*' }
      });
    }
  }
};
