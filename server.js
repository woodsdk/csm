const http = require('http');
const fs = require('fs');
const path = require('path');
const db = require('./db');

const PORT = process.env.PORT || 3001;
const STATIC_DIR = __dirname;

const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// ── Route handlers ──

const tasks = require('./routes/tasks');
const customers = require('./routes/customers');
const team = require('./routes/team');
const activities = require('./routes/activities');
const bookingsRoute = require('./routes/bookings');
const shiftsRoute = require('./routes/shifts');

// ── JSON helpers ──

function json(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > 1e6) { reject(new Error('Body too large')); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString();
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function parseQuery(url) {
  const idx = url.indexOf('?');
  if (idx === -1) return {};
  const params = new URLSearchParams(url.slice(idx));
  const obj = {};
  for (const [k, v] of params) obj[k] = v;
  return obj;
}

// ── API router ──

async function handleAPI(req, res) {
  const urlPath = req.url.split('?')[0];
  const parts = urlPath.split('/').filter(Boolean); // ['api', 'tasks', ':id']
  const method = req.method;
  const query = parseQuery(req.url);

  try {
    // /api/tasks
    if (parts[1] === 'tasks') {
      if (parts.length === 2) {
        if (method === 'GET') return json(res, await tasks.list(query));
        if (method === 'POST') return json(res, await tasks.create(await parseBody(req)), 201);
      }
      if (parts.length === 3) {
        const id = decodeURIComponent(parts[2]);
        if (method === 'GET') {
          const task = await tasks.get(id);
          return task ? json(res, task) : json(res, { error: 'Not found' }, 404);
        }
        if (method === 'PATCH') return json(res, await tasks.update(id, await parseBody(req)));
        if (method === 'DELETE') return json(res, await tasks.remove(id));
      }
    }

    // /api/customers
    if (parts[1] === 'customers') {
      if (parts.length === 2) {
        if (method === 'GET') return json(res, await customers.list());
        if (method === 'POST') return json(res, await customers.create(await parseBody(req)), 201);
      }
      if (parts.length === 3) {
        const id = decodeURIComponent(parts[2]);
        if (method === 'GET') {
          const cust = await customers.get(id);
          return cust ? json(res, cust) : json(res, { error: 'Not found' }, 404);
        }
        if (method === 'PATCH') return json(res, await customers.update(id, await parseBody(req)));
      }
    }

    // /api/team
    if (parts[1] === 'team' && parts.length === 2 && method === 'GET') {
      return json(res, await team.list());
    }

    // /api/activities/:taskId
    if (parts[1] === 'activities' && parts.length === 3 && method === 'GET') {
      return json(res, await activities.listForTask(decodeURIComponent(parts[2])));
    }

    // /api/shifts
    if (parts[1] === 'shifts') {
      // /api/shifts/calendar
      if (parts[2] === 'calendar' && parts.length === 3 && method === 'GET') {
        return json(res, await shiftsRoute.getCalendar());
      }
      // /api/shifts/available?date=
      if (parts[2] === 'available' && parts.length === 3 && method === 'GET') {
        return json(res, await shiftsRoute.getAvailable(query.date));
      }
      // /api/shifts (list / create)
      if (parts.length === 2) {
        if (method === 'GET') return json(res, await shiftsRoute.list(query));
        if (method === 'POST') return json(res, await shiftsRoute.create(await parseBody(req)), 201);
      }
      // /api/shifts/:id/cancel
      if (parts.length === 4 && parts[3] === 'cancel' && method === 'POST') {
        return json(res, await shiftsRoute.cancel(decodeURIComponent(parts[2])));
      }
    }

    // /api/bookings
    if (parts[1] === 'bookings') {
      // /api/bookings/available?date=
      if (parts[2] === 'available' && parts.length === 3 && method === 'GET') {
        return json(res, await bookingsRoute.getAvailable(query.date));
      }
      // /api/bookings/dates
      if (parts[2] === 'dates' && parts.length === 3 && method === 'GET') {
        return json(res, await bookingsRoute.getAvailableDates());
      }
      // /api/bookings (list / create)
      if (parts.length === 2) {
        if (method === 'GET') return json(res, await bookingsRoute.list(query));
        if (method === 'POST') return json(res, await bookingsRoute.create(await parseBody(req)), 201);
      }
      // /api/bookings/:id (update)
      if (parts.length === 3 && method === 'PATCH') {
        return json(res, await bookingsRoute.update(decodeURIComponent(parts[2]), await parseBody(req)));
      }
    }

    json(res, { error: 'Not found' }, 404);
  } catch (err) {
    console.error('API error:', err);
    json(res, { error: err.message || 'Server error' }, 500);
  }
}

// ── Server ──

const server = http.createServer((req, res) => {
  // API routes
  if (req.url.startsWith('/api/')) {
    return handleAPI(req, res);
  }

  // Static file serving
  let urlPath = decodeURIComponent(req.url.split('?')[0]);

  if (urlPath === '/' || urlPath === '') {
    urlPath = '/index.html';
  }

  const filePath = path.join(STATIC_DIR, urlPath);
  const extname = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        if (!extname) {
          fs.readFile(path.join(STATIC_DIR, 'index.html'), (err2, fallback) => {
            if (err2) {
              res.writeHead(404);
              res.end('Not found');
            } else {
              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end(fallback, 'utf-8');
            }
          });
        } else {
          res.writeHead(404);
          res.end('Not found');
        }
      } else {
        res.writeHead(500);
        res.end('Server error');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

// Initialize DB then start server
db.init()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`SynergyHub running on http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to initialize database:', err.message);
    console.log('Starting without database (static files only)...');
    server.listen(PORT, () => {
      console.log(`SynergyHub running on http://localhost:${PORT} (no database)`);
    });
  });
