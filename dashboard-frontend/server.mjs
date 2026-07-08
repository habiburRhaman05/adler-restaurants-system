// Zero-dependency mock API server for Adler Frontend (dev only).
// Serves db.json with a { success, message, data, statusCode } envelope.
// Supports: /auth/login, /auth/me, /auth/register, /auth/logout,
// CRUD on collections, query filters (name_like, field=value), _page/_limit,
// _sort/_order, and singular resource (settings).
//
// Run: node server.mjs   (or: npm run dev:server)
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, 'db.json');
const PORT = process.env.MOCK_API_PORT ? Number(process.env.MOCK_API_PORT) : 3001;

// Collections that are arrays vs singular objects.
const SINGULAR = new Set(['settings']);

function loadDb() {
  if (!existsSync(DB_PATH)) throw new Error(`db.json not found at ${DB_PATH}`);
  return JSON.parse(readFileSync(DB_PATH, 'utf-8'));
}

function saveDb(db) {
  writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function genId(prefix) {
  return `${prefix}${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
}

function send(res, statusCode, data, message) {
  const success = statusCode >= 200 && statusCode < 400;
  const body = JSON.stringify({
    success,
    message: message || (success ? 'Success' : 'Error'),
    data: data === undefined ? null : data,
    statusCode,
  });
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve({});
      }
    });
  });
}

function fakeToken(user) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ id: user.id, email: user.email, role: user.role, iat: Date.now() })
  ).toString('base64url');
  return `${header}.${payload}.mock-signature`;
}

function publicUser(u) {
  const { password, ...rest } = u;
  return rest;
}

function applyQuery(items, params) {
  let result = [...items];

  for (const [key, value] of params.entries()) {
    if (['_page', '_limit', '_sort', '_order', 'q'].includes(key)) continue;

    if (key.endsWith('_like')) {
      const field = key.slice(0, -5);
      const needle = value.toLowerCase();
      result = result.filter((it) =>
        String(it[field] ?? '').toLowerCase().includes(needle)
      );
    } else {
      result = result.filter((it) => {
        const v = it[key];
        if (Array.isArray(v)) return v.map(String).includes(value);
        return String(v ?? '') === value;
      });
    }
  }

  // Full-text-ish search across string fields via ?q=
  const q = params.get('q');
  if (q) {
    const needle = q.toLowerCase();
    result = result.filter((it) =>
      Object.values(it).some(
        (v) => typeof v === 'string' && v.toLowerCase().includes(needle)
      )
    );
  }

  // Sort
  const sort = params.get('_sort');
  if (sort) {
    const order = params.get('_order') === 'desc' ? -1 : 1;
    result.sort((a, b) => {
      if (a[sort] < b[sort]) return -1 * order;
      if (a[sort] > b[sort]) return 1 * order;
      return 0;
    });
  }

  const total = result.length;

  // Pagination
  const page = params.get('_page');
  const limit = params.get('_limit');
  if (page && limit) {
    const p = Math.max(1, Number(page));
    const l = Math.max(1, Number(limit));
    result = result.slice((p - 1) * l, (p - 1) * l + l);
  }

  return { result, total };
}

const server = createServer(async (req, res) => {
  const method = req.method || 'GET';
  if (method === 'OPTIONS') return send(res, 204, null, 'OK');

  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  const parts = url.pathname.split('/').filter(Boolean);
  const db = loadDb();

  try {
    // ── Auth ───────────────────────────────────────────────
    if (parts[0] === 'auth') {
      const action = parts[1];

      if (action === 'login' && method === 'POST') {
        const { email, password } = await readBody(req);
        const user = (db.users || []).find(
          (u) => u.email === email && u.password === password
        );
        if (!user) return send(res, 401, null, 'Invalid email or password');
        return send(
          res,
          200,
          { user: publicUser(user), accessToken: fakeToken(user), refreshToken: fakeToken(user) },
          'Login successful'
        );
      }

      if (action === 'register' && method === 'POST') {
        const { name, email, password } = await readBody(req);
        if ((db.users || []).some((u) => u.email === email)) {
          return send(res, 400, null, 'Email already registered');
        }
        const user = {
          id: genId('user'),
          name,
          email,
          password,
          role: 'admin',
          avatar: `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(name || email)}`,
          createdAt: new Date().toISOString(),
        };
        db.users = [...(db.users || []), user];
        saveDb(db);
        return send(
          res,
          201,
          { user: publicUser(user), accessToken: fakeToken(user), refreshToken: fakeToken(user) },
          'Account created'
        );
      }

      if (action === 'me' && method === 'GET') {
        const auth = req.headers.authorization || '';
        const token = auth.replace('Bearer ', '');
        let userId = null;
        try {
          const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
          userId = payload.id;
        } catch {
          /* ignore */
        }
        const user = (db.users || []).find((u) => u.id === userId) || db.users?.[0];
        if (!user) return send(res, 401, null, 'Not authenticated');
        return send(res, 200, publicUser(user), 'OK');
      }

      if (action === 'logout' && method === 'POST') {
        return send(res, 200, null, 'Logged out');
      }

      return send(res, 404, null, 'Unknown auth route');
    }

    // ── Collections ────────────────────────────────────────
    const collection = parts[0];
    const id = parts[1];

    if (!collection || !(collection in db)) {
      return send(res, 404, null, `Unknown resource: ${collection}`);
    }

    // Singular resource (settings)
    if (SINGULAR.has(collection)) {
      if (method === 'GET') return send(res, 200, db[collection], 'OK');
      if (method === 'PUT' || method === 'PATCH') {
        const body = await readBody(req);
        db[collection] = { ...db[collection], ...body };
        saveDb(db);
        return send(res, 200, db[collection], 'Settings updated');
      }
      return send(res, 405, null, 'Method not allowed');
    }

    const items = db[collection];

    // GET /collection  or GET /collection/:id
    if (method === 'GET') {
      if (id) {
        const item = items.find((it) => String(it.id) === String(id));
        if (!item) return send(res, 404, null, 'Not found');
        return send(res, 200, item, 'OK');
      }
      const { result, total } = applyQuery(items, url.searchParams);
      // Return list plus meta for pagination consumers.
      const page = Number(url.searchParams.get('_page')) || 1;
      const limit = Number(url.searchParams.get('_limit')) || total || result.length;
      return send(
        res,
        200,
        { items: result, total, page, limit, totalPages: limit ? Math.ceil(total / limit) : 1 },
        'OK'
      );
    }

    // POST /collection
    if (method === 'POST') {
      const body = await readBody(req);
      const item = {
        id: body.id || genId(collection.slice(0, 3)),
        createdAt: new Date().toISOString(),
        ...body,
      };
      db[collection] = [...items, item];
      saveDb(db);
      return send(res, 201, item, 'Created');
    }

    // PUT/PATCH /collection/:id
    if ((method === 'PUT' || method === 'PATCH') && id) {
      const idx = items.findIndex((it) => String(it.id) === String(id));
      if (idx === -1) return send(res, 404, null, 'Not found');
      const body = await readBody(req);
      const updated = method === 'PUT'
        ? { ...body, id: items[idx].id }
        : { ...items[idx], ...body, id: items[idx].id };
      db[collection][idx] = updated;
      saveDb(db);
      return send(res, 200, updated, 'Updated');
    }

    // DELETE /collection/:id
    if (method === 'DELETE' && id) {
      const idx = items.findIndex((it) => String(it.id) === String(id));
      if (idx === -1) return send(res, 404, null, 'Not found');
      db[collection].splice(idx, 1);
      saveDb(db);
      return send(res, 200, { id }, 'Deleted');
    }

    return send(res, 405, null, 'Method not allowed');
  } catch (err) {
    return send(res, 500, null, err?.message || 'Server error');
  }
});

server.listen(PORT, () => {
  console.log(`\n  🗄️  Adler mock API running at http://localhost:${PORT}`);
  console.log(`  📄  Serving db.json with { success, message, data, statusCode } envelope`);
  console.log(`  🔑  Demo login: admin@adler.ch / Admin@123\n`);
});
