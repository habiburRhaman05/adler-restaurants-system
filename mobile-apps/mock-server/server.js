/**
 * Adler mock API — json-server + custom business routes.
 *
 * This server mirrors the FUTURE real API contract exactly:
 *   - same paths (/api/v1/...)
 *   - same response envelope: { success, message, data }
 *   - same cookie-based auth (login / refresh / logout / profile)
 *
 * Switching to the real backend = change EXPO_PUBLIC_API_URL. Nothing else.
 *
 * Login: any seeded email (see db.json) + password "password".
 */
const path = require('path');
const jsonServer = require('json-server');
const cookieParser = require('cookie-parser');

const PORT = process.env.PORT || 3001;
const LATENCY_MS = 300;
const COOKIE = 'adler_token';

const server = jsonServer.create();
const router = jsonServer.router(path.join(__dirname, 'db.json'));
const db = router.db; // lowdb instance

/* ---------- helpers ---------- */
const ok = (res, data, message = 'OK') => res.json({ success: true, message, data });
const fail = (res, status, message) =>
  res.status(status).json({ success: false, message, data: null });

const publicUser = (u) => ({
  id: u.id,
  email: u.email,
  firstName: u.firstName,
  lastName: u.lastName,
  mustChangePassword: u.mustChangePassword,
});

function audit(who, action, detail) {
  db.get('auditEvents')
    .push({ id: 'a' + Date.now(), at: new Date().toISOString(), who, action, detail })
    .write();
}

/* ---------- global middleware ---------- */
// CORS that works with credentials (reflect origin instead of *)
server.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
server.use(jsonServer.bodyParser);
server.use(cookieParser());
// log every request — if you don't see a line here when the app calls, the
// device can't reach this machine (wrong IP / firewall)
server.use((req, res, next) => {
  console.log(`  ${new Date().toLocaleTimeString()}  ${req.method} ${req.originalUrl}`);
  next();
});
// artificial latency so real loading states are exercised
server.use((req, res, next) => setTimeout(next, LATENCY_MS));

/* ---------- auth ---------- */
function currentUser(req) {
  const token = req.cookies[COOKIE];
  if (!token) return null;
  const userId = Buffer.from(token, 'base64').toString('utf8');
  return db.get('users').find({ id: userId }).value() || null;
}

function requireAuth(req, res, next) {
  const user = currentUser(req);
  if (!user) return fail(res, 401, 'Not authenticated');
  req.user = user;
  next();
}

function setSession(res, userId) {
  res.cookie(COOKIE, Buffer.from(userId, 'utf8').toString('base64'), {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

server.post('/api/v1/auth/user/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = db.get('users').find({ email: String(email || '').toLowerCase() }).value();
  if (!user || password !== 'password') return fail(res, 401, 'Wrong email or password');
  setSession(res, user.id);
  audit(user.email, 'login', `${user.firstName} logged in.`);
  return ok(res, { user: publicUser(user) }, 'Logged in');
});

server.post('/api/v1/auth/user/refresh', (req, res) => {
  const user = currentUser(req);
  if (!user) return fail(res, 401, 'Session expired');
  setSession(res, user.id);
  return ok(res, { user: publicUser(user) }, 'Refreshed');
});

server.post('/api/v1/auth/user/logout', (req, res) => {
  res.clearCookie(COOKIE);
  return ok(res, null, 'Logged out');
});

server.get('/api/v1/auth/user/profile', requireAuth, (req, res) => {
  const u = req.user;
  return ok(res, {
    user: {
      ...publicUser(u),
      contract: { type: u.contractType, workloadPct: u.workloadPct, monthlyTargetHours: u.monthlyTargetHours },
    },
  });
});

/* ---------- my schedule ---------- */
server.get('/api/v1/me/shifts', requireAuth, (req, res) => {
  const month = String(req.query.month || '');
  if (!/^\d{4}-\d{2}$/.test(month)) return fail(res, 400, 'month=YYYY-MM required');
  const info = db.get('scheduleMonths').find({ month }).value();
  const status = info ? info.status : 'draft';
  // Drafts are NEVER exposed to staff (briefing rule #6)
  const shifts =
    status === 'published'
      ? db.get('shifts').filter({ userId: req.user.id, month }).sortBy('date').value()
      : [];
  return ok(res, { month, status, publishedAt: info ? info.publishedAt : null, shifts });
});

/* ---------- availability ---------- */
function availabilityWindow(month) {
  return db.get('config').find({ type: 'availability-window', month }).value() || null;
}

function getOrCreateAvailability(userId, month) {
  const id = `${userId}-${month}`;
  let a = db.get('availabilities').find({ id }).value();
  if (!a) {
    a = { id, userId, month, days: {}, times: {}, note: '', locked: false, submittedAt: null };
    db.get('availabilities').push(a).write();
  }
  return a;
}

server.get('/api/v1/me/availability', requireAuth, (req, res) => {
  const month = String(req.query.month || '');
  if (!/^\d{4}-\d{2}$/.test(month)) return fail(res, 400, 'month=YYYY-MM required');
  const a = getOrCreateAvailability(req.user.id, month);
  const win = availabilityWindow(month);
  return ok(res, {
    availability: a,
    window: win
      ? { opensAt: win.opensAt, cutoffAt: win.cutoffAt, minMarkedDays: win.minMarkedDays }
      : null,
  });
});

server.put('/api/v1/me/availability', requireAuth, (req, res) => {
  const { month, days, times, note } = req.body || {};
  if (!/^\d{4}-\d{2}$/.test(String(month))) return fail(res, 400, 'month=YYYY-MM required');
  const a = getOrCreateAvailability(req.user.id, month);
  if (a.locked) return fail(res, 409, 'Availability already submitted bindingly. Ask management to unlock.');
  const win = availabilityWindow(month);
  if (win && new Date() > new Date(win.cutoffAt)) return fail(res, 409, 'Cut-off has passed. Ask management to unlock.');
  const updated = db
    .get('availabilities')
    .find({ id: a.id })
    .assign({
      days: days ?? a.days,
      times: times ?? a.times,
      note: note ?? a.note,
    })
    .write();
  return ok(res, { availability: updated }, 'Saved');
});

server.post('/api/v1/me/availability/submit', requireAuth, (req, res) => {
  const { month } = req.body || {};
  if (!/^\d{4}-\d{2}$/.test(String(month))) return fail(res, 400, 'month=YYYY-MM required');
  const a = getOrCreateAvailability(req.user.id, month);
  if (a.locked) return fail(res, 409, 'Already submitted.');
  const win = availabilityWindow(month);
  if (win && new Date() > new Date(win.cutoffAt)) return fail(res, 409, 'Cut-off has passed.');
  const marked = Object.values(a.days || {}).filter(Boolean).length;
  const min = win ? win.minMarkedDays : 1;
  if (marked < min) return fail(res, 422, `Mark at least ${min} days before submitting.`);
  const updated = db
    .get('availabilities')
    .find({ id: a.id })
    .assign({ locked: true, submittedAt: new Date().toISOString() })
    .write();
  audit(req.user.email, 'availability-submitted', `${req.user.firstName} submitted availability for ${month} (${marked} days marked)${a.note ? ' with a note' : ''}.`);
  return ok(res, { availability: updated }, 'Availability submitted bindingly');
});

/* ---------- swaps ---------- */
function swapView(sw) {
  const shift = db.get('shifts').find({ id: sw.shiftId }).value() || null;
  const from = db.get('users').find({ id: sw.fromUserId }).value();
  const to = sw.toUserId ? db.get('users').find({ id: sw.toUserId }).value() : null;
  return {
    ...sw,
    shift,
    fromUser: from ? publicUser(from) : null,
    toUser: to ? publicUser(to) : null,
  };
}

// Fake deterministic rule check — the real backend replaces this with the L-GAV validator.
// Same structured shape { ruleId, pass, message } the real API will return.
function ruleCheck() {
  return [
    { ruleId: 'rest-11h', pass: true, message: 'Rest period ≥ 11 h before and after ✓' },
    { ruleId: 'weekly-max', pass: true, message: 'Weekly hours within L-GAV maximum ✓' },
    { ruleId: 'qualification', pass: true, message: 'Qualified for this function ✓' },
  ];
}

server.get('/api/v1/me/swaps', requireAuth, (req, res) => {
  const uid = req.user.id;
  const all = db.get('swapRequests').value();
  const incoming = all.filter((s) => (s.toUserId === uid || (s.open && s.fromUserId !== uid)) && s.fromUserId !== uid).map(swapView);
  const outgoing = all.filter((s) => s.fromUserId === uid).map(swapView);
  return ok(res, { incoming, outgoing });
});

server.post('/api/v1/swaps', requireAuth, (req, res) => {
  const { shiftId, toUserId } = req.body || {};
  const shift = db.get('shifts').find({ id: shiftId }).value();
  if (!shift) return fail(res, 404, 'Shift not found');
  if (shift.userId !== req.user.id) return fail(res, 403, 'You can only offer your own shifts');
  const info = db.get('scheduleMonths').find({ month: shift.month }).value();
  if (!info || info.status !== 'published') return fail(res, 409, 'Only published shifts can be offered');
  const sw = {
    id: 'sw' + Date.now(),
    shiftId,
    month: shift.month,
    fromUserId: req.user.id,
    toUserId: toUserId || null,
    open: !toUserId,
    status: 'open',
    createdAt: new Date().toISOString(),
    resolvedAt: null,
    ruleCheck: null,
  };
  db.get('swapRequests').push(sw).write();
  audit(req.user.email, 'swap-offered', `${req.user.firstName} offered ${shift.label} (${shift.date}) ${toUserId ? 'to a colleague' : 'to the whole team'}.`);
  return ok(res, { swap: swapView(sw) }, 'Swap offer sent');
});

server.post('/api/v1/swaps/:id/accept', requireAuth, (req, res) => {
  const sw = db.get('swapRequests').find({ id: req.params.id }).value();
  if (!sw) return fail(res, 404, 'Swap request not found');
  if (sw.status !== 'open') return fail(res, 409, 'Already taken or resolved');
  if (sw.fromUserId === req.user.id) return fail(res, 403, 'You cannot accept your own offer');
  const checks = ruleCheck();
  const allPass = checks.every((c) => c.pass);
  if (!allPass) {
    return res.status(422).json({
      success: false,
      message: 'This swap would create a rule violation and was blocked.',
      data: { ruleCheck: checks },
    });
  }
  // mutate shift ownership — first accepted claim wins
  db.get('shifts').find({ id: sw.shiftId }).assign({ userId: req.user.id, source: 'swap' }).write();
  const updated = db
    .get('swapRequests')
    .find({ id: sw.id })
    .assign({ status: 'accepted', toUserId: req.user.id, resolvedAt: new Date().toISOString(), ruleCheck: checks })
    .write();
  audit(req.user.email, 'swap-accepted', `Shift swap confirmed → ${req.user.firstName}. Automatic rule check passed.`);
  return ok(res, { swap: swapView(updated), ruleCheck: checks }, 'Swap accepted — rule check passed');
});

server.post('/api/v1/swaps/:id/decline', requireAuth, (req, res) => {
  const sw = db.get('swapRequests').find({ id: req.params.id }).value();
  if (!sw) return fail(res, 404, 'Swap request not found');
  if (sw.status !== 'open') return fail(res, 409, 'Already resolved');
  const updated = db
    .get('swapRequests')
    .find({ id: sw.id })
    .assign({ status: 'declined', resolvedAt: new Date().toISOString() })
    .write();
  audit(req.user.email, 'swap-declined', `${req.user.firstName} declined a swap request.`);
  return ok(res, { swap: swapView(updated) }, 'Swap declined');
});

/* ---------- hours ---------- */
server.get('/api/v1/me/hours', requireAuth, (req, res) => {
  const month = String(req.query.month || '');
  if (!/^\d{4}-\d{2}$/.test(month)) return fail(res, 400, 'month=YYYY-MM required');
  const entries = db.get('timeEntries').filter({ userId: req.user.id, month }).sortBy('date').value();
  const totalHours = Math.round(entries.reduce((s, e) => s + e.hours, 0) * 100) / 100;
  const confirmed = !!db.get('hoursConfirmations').find({ userId: req.user.id, month }).value();
  return ok(res, {
    month,
    totalHours,
    targetHours: req.user.monthlyTargetHours ?? null,
    confirmed,
    entries,
  });
});

server.post('/api/v1/me/hours/confirm', requireAuth, (req, res) => {
  const { month } = req.body || {};
  if (!/^\d{4}-\d{2}$/.test(String(month))) return fail(res, 400, 'month=YYYY-MM required');
  const existing = db.get('hoursConfirmations').find({ userId: req.user.id, month }).value();
  if (existing) return fail(res, 409, 'Already confirmed');
  db.get('hoursConfirmations')
    .push({ id: `${req.user.id}-${month}`, userId: req.user.id, month, confirmedAt: new Date().toISOString() })
    .write();
  audit(req.user.email, 'hours-confirmed', `${req.user.firstName} confirmed hours for ${month} — payroll can use these.`);
  return ok(res, { month, confirmed: true }, 'Hours confirmed');
});

/* ---------- fallback: raw json-server router (debug/inspection) ---------- */
server.use('/api/v1/raw', router);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  Adler mock API running on http://localhost:${PORT}`);
  console.log(`  Login: luca@adler.ch / password  (or any email in db.json)`);
  console.log(`  For a physical device set EXPO_PUBLIC_API_URL to your LAN IP, e.g. http://192.168.1.20:${PORT}\n`);
});
