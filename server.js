const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const BASE_DIR = './Peoples Clinic/People\'s Clinic UI Update';

const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url);
  let filePath;

  if (urlPath === '/' || urlPath === '') {
    filePath = path.join(BASE_DIR, 'klinikdrift-dashboard.html');
  } else if (urlPath.startsWith('/Design System/') || urlPath.startsWith('../Design System/')) {
    // Handle Design System references
    filePath = './Peoples Clinic' + urlPath.replace('..', '');
  } else if (urlPath.startsWith('/Assets/')) {
    // Handle Assets folder
    filePath = path.join(BASE_DIR, urlPath);
  } else {
    // All other files relative to UI Update folder
    filePath = path.join(BASE_DIR, urlPath);
  }

  const extname = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        console.log('404 Not Found:', filePath);
        res.writeHead(404);
        res.end('File not found: ' + filePath);
      } else {
        console.log('500 Error:', error.code, filePath);
        res.writeHead(500);
        res.end('Server error: ' + error.code);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Serving files from: ${BASE_DIR}`);
});
