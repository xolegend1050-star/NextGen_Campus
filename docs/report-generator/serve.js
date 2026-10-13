/**
 * Throwaway static server used to inspect the finished PDF. Serves the generator
 * directory so a page can load pdf.js, fetch the PDF and rasterise it to a canvas.
 * Not part of the build.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = +(process.argv[2] || 8732);

const TYPES = {
  '.pdf': 'application/pdf',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.map': 'application/json',
  '.json': 'application/json',
  '.png': 'image/png',
  '.bcmap': 'application/octet-stream',
  '.pfb': 'application/octet-stream'
};

http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
  if (rel === '') rel = 'preview.html';
  const file = path.resolve(ROOT, rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('not found: ' + rel); return;
  }
  res.writeHead(200, {
    'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'Access-Control-Allow-Origin': '*'
  });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log('serving ' + ROOT + ' on http://localhost:' + PORT));