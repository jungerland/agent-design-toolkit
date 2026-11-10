// Local proxy: serves index.html and forwards /v1/messages to Anthropic
// with ANTHROPIC_API_KEY from the environment, so the key never touches the browser.
// Usage: ANTHROPIC_API_KEY=sk-ant-... node server.js   then open http://localhost:8787
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8787;
const KEY = process.env.ANTHROPIC_API_KEY;
if (!KEY) {
  console.error('ANTHROPIC_API_KEY is not set.');
  process.exit(1);
}

http.createServer(async (req, res) => {
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    fs.createReadStream(path.join(__dirname, 'index.html')).pipe(res);
    return;
  }
  if (req.method === 'POST' && req.url === '/v1/messages') {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    try {
      const upstream = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': KEY,
          'anthropic-version': req.headers['anthropic-version'] || '2023-06-01',
        },
        body: Buffer.concat(chunks),
      });
      res.writeHead(upstream.status, { 'Content-Type': 'application/json' });
      res.end(await upstream.text());
    } catch (e) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'Proxy error: ' + e.message } }));
    }
    return;
  }
  if (req.method === 'GET' && req.url.startsWith('/v1/models')) {
    try {
      const upstream = await fetch('https://api.anthropic.com' + req.url, {
        headers: { 'x-api-key': KEY, 'anthropic-version': req.headers['anthropic-version'] || '2023-06-01' },
      });
      res.writeHead(upstream.status, { 'Content-Type': 'application/json' });
      res.end(await upstream.text());
    } catch (e) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'Proxy error: ' + e.message } }));
    }
    return;
  }
  res.writeHead(404);
  res.end();
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Agent Design Toolkit running at http://localhost:${PORT}`);
});
