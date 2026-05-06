const http = require('http');
const fs = require('fs');
const path = require('path');

const port = process.env.PORT || 8080;
const root = process.cwd();

http.createServer((req, res) => {
    let url = req.url.split('?')[0];
    if (url === '/' || url === '') url = '/index.html';
    const filePath = path.join(root, url);
    fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); res.end('Not found'); return; }
        const ext = path.extname(filePath).toLowerCase();
        const map = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json' };
        res.writeHead(200, { 'Content-Type': map[ext] || 'application/octet-stream' });
        res.end(data);
    });
}).listen(port, () => console.log('Serving', root, 'on', port));
