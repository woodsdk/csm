const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

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

// Base paths
const UI_DIR = './Peoples Clinic/People\'s Clinic UI Update';
const DESIGN_DIR = './Peoples Clinic/Design System';

const server = http.createServer((req, res) => {
  // Strip query parameters (?v=7 etc.) before resolving file path
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  let filePath;

  if (urlPath === '/' || urlPath === '') {
    // Root serves Start Konsultation page
    filePath = path.join(UI_DIR, 'platform-preview.html');
  } else if (urlPath === '/onboarding') {
    // Onboarding presentation
    filePath = path.join(UI_DIR, 'slides/onboarding.html');
  } else if (urlPath === '/investor-pitch') {
    // Investor pitch presentation
    filePath = path.join(UI_DIR, 'slides/investor-pitch.html');
  } else if (urlPath.startsWith('/billeder/')) {
    // Slide images (referenced by onboarding.html)
    filePath = path.join(UI_DIR, 'slides', urlPath);
  } else if (urlPath.startsWith('/Design System/')) {
    // Design System assets
    filePath = './Peoples Clinic' + urlPath;
  } else if (urlPath.endsWith('.css') && !urlPath.includes('/')) {
    // CSS files in UI folder (e.g., /klinikdrift.css)
    filePath = path.join(UI_DIR, urlPath);
  } else if (urlPath.endsWith('.html')) {
    // HTML files
    filePath = path.join(UI_DIR, urlPath);
  } else if (urlPath.startsWith('/Assets/')) {
    // Assets folder
    filePath = path.join(UI_DIR, urlPath);
  } else {
    // Default to UI folder
    filePath = path.join(UI_DIR, urlPath);
  }

  const extname = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        console.log('404 Not Found:', urlPath, '->', filePath);
        res.writeHead(404);
        res.end('File not found');
      } else {
        console.log('500 Error:', error.code, filePath);
        res.writeHead(500);
        res.end('Server error');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
