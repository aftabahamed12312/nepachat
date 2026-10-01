import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import { MongoClient, ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

const {
  MONGO_URL = 'mongodb://mongo:27017/nepachat', JWT_SECRET = 'dev-secret', PORT = 4000,
  CORS_ORIGIN = '*', SMTP_HOST, SMTP_PORT = '587', SMTP_SECURE = 'false', SMTP_USER,
  SMTP_PASS, SMTP_FROM, RESEND_API_KEY, RESEND_FROM,
  GMAIL_OAUTH_CLIENT_ID, GMAIL_OAUTH_CLIENT_SECRET, GMAIL_OAUTH_REFRESH_TOKEN, GMAIL_FROM,
  TURN_KEY_ID, TURN_API_TOKEN, TURN_URL, TURN_USERNAME, TURN_CREDENTIAL, OTP_DEV_MODE = 'false',
} = process.env;
const client = new MongoClient(MONGO_URL);
await client.connect();
const db = client.db();
const users = db.collection('users'), chats = db.collection('chats'), msgs = db.collection('messages'), pendingUsers = db.collection('pendingUsers');
await users.createIndex({ email: 1 }, { unique: true });
await users.createIndex({ username: 1 }, { unique: true });
await chats.createIndex({ members: 1 });
await msgs.createIndex({ chatId: 1, ts: 1 });
await pendingUsers.createIndex({ email: 1 }, { unique: true });
await pendingUsers.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const app = express();
app.use(cors({ origin: CORS_ORIGIN === '*' ? true : CORS_ORIGIN.split(',') }));
app.use(express.json({ limit: '50kb' }));
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: CORS_ORIGIN === '*' ? true : CORS_ORIGIN.split(',') } });
const mailer = SMTP_HOST && SMTP_USER && SMTP_PASS ? nodemailer.createTransport({
  host: SMTP_HOST, port: Number(SMTP_PORT), secure: SMTP_SECURE === 'true',
  connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000,
  auth: { user: SMTP_USER, pass: SMTP_PASS },
}) : null;
const gmailApiConfigured = Boolean(GMAIL_OAUTH_CLIENT_ID && GMAIL_OAUTH_CLIENT_SECRET && GMAIL_OAUTH_REFRESH_TOKEN && GMAIL_FROM);

async function sendGmailOtp(to, code) {
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GMAIL_OAUTH_CLIENT_ID,
      client_secret: GMAIL_OAUTH_CLIENT_SECRET,
      refresh_token: GMAIL_OAUTH_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  if (!tokenResponse.ok) throw new Error(`Google OAuth token request failed with status ${tokenResponse.status}`);
  const { access_token: accessToken } = await tokenResponse.json();
  const mime = [
    `From: ${GMAIL_FROM}`,
    `To: ${to}`,
    'Subject: Your NepaChat verification code',
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    '',
    `Your NepaChat verification code is ${code}. It expires in 10 minutes.`,
  ].join('\r\n');
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: Buffer.from(mime).toString('base64url') }),
  });
  if (!response.ok) throw new Error(`Gmail API send failed with status ${response.status}`);
}

const pub = u => ({ id: String(u._id), username: u.username, email: u.email });
const sign = u => jwt.sign({ id: String(u._id) }, JWT_SECRET, { expiresIn: '30d' });
const oid = s => { try { return new ObjectId(s); } catch { return null; } };
const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function seedAccount() {
  const username = String(process.env.SEED_USERNAME || '').trim().toLowerCase().replace(/^@/, '');
  const email = String(process.env.SEED_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.SEED_PASSWORD || '');
  if (!username && !email && !password) return;
  if (!/^[a-z0-9_]{3,20}$/.test(username) || !emailRx.test(email) || password.length < 6) {
    throw new Error('Set valid SEED_USERNAME, SEED_EMAIL, and SEED_PASSWORD values to create the seed account');
  }
  if (await users.findOne({ email })) return;
  if (await users.findOne({ username })) throw new Error('SEED_USERNAME is already assigned to another account');
  await users.insertOne({ username, email, hash: await bcrypt.hash(password, 10), created: Date.now(), verified: true });
  console.log(`Seed account created: @${username}`);
}

await seedAccount();

const auth = (req, res, next) => {
  try { req.uid = jwt.verify((req.headers.authorization || '').slice(7), JWT_SECRET).id; next(); }
  catch { res.status(401).json({ error: 'Please sign in again' }); }
};
const wrap = fn => (req, res) => fn(req, res).catch(e => { console.error(e); res.status(500).json({ error: 'Server error' }); });

async function chatView(c, me) {
  const other = c.members.find(m => m !== me) || me;
  const u = await users.findOne({ _id: oid(other) });
  return { id: String(c._id), other: u ? pub(u) : { id: other, username: 'unknown', email: '' }, last: c.last || '', ts: c.ts || 0, by: c.by || '' };
}

app.get('/api/health', (_, res) => res.json({ ok: true }));

app.post('/api/register', wrap(async (req, res) => {
  const username = String(req.body.username || '').trim().toLowerCase().replace(/^@/, '');
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!/^[a-z0-9_]{3,20}$/.test(username)) return res.status(400).json({ error: 'Username: 3-20 letters, numbers or _' });
  if (!emailRx.test(email)) return res.status(400).json({ error: 'Enter a valid email address' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  const resendConfigured = Boolean(RESEND_API_KEY && RESEND_FROM);
  if (!mailer && !resendConfigured && !gmailApiConfigured && OTP_DEV_MODE !== 'true') return res.status(503).json({ error: 'Email verification is not configured on this server' });
  if (await users.findOne({ $or: [{ email }, { username }] })) return res.status(409).json({ error: 'Email or username already in use' });
  const existing = await pendingUsers.findOne({ email });
  if (existing && Date.now() - existing.lastSentAt < 60_000) return res.status(429).json({ error: 'Wait a minute before requesting another code' });
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const sentAt = Date.now();
  if (gmailApiConfigured) {
    await sendGmailOtp(email, code);
  } else if (resendConfigured) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: RESEND_FROM, to: [email], subject: 'Your NepaChat verification code',
        text: `Your NepaChat verification code is ${code}. It expires in 10 minutes.`,
      }),
    });
    if (!response.ok) throw new Error(`Email API request failed with status ${response.status}`);
  } else if (mailer) await mailer.sendMail({
    from: SMTP_FROM || SMTP_USER, to: email, subject: 'Your NepaChat verification code',
    text: `Your NepaChat verification code is ${code}. It expires in 10 minutes.`,
  });
  await pendingUsers.updateOne({ email }, { $set: {
    username, email, hash: await bcrypt.hash(password, 10),
    codeHash: createHmac('sha256', JWT_SECRET).update(email + ':' + code).digest('hex'),
    expiresAt: new Date(sentAt + 10 * 60_000), lastSentAt: sentAt, attempts: 0,
  } }, { upsert: true });
  res.json({ ok: true, message: mailer || resendConfigured || gmailApiConfigured ? 'Verification code sent' : `Local verification code: ${code}` });
}));

app.post('/api/verify-email', wrap(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const code = String(req.body.code || '').trim();
  if (!emailRx.test(email) || !/^\d{6}$/.test(code)) return res.status(400).json({ error: 'Enter the six-digit code sent to your email' });
  const pending = await pendingUsers.findOne({ email });
  if (!pending || pending.expiresAt <= new Date()) {
    if (pending) await pendingUsers.deleteOne({ _id: pending._id });
    return res.status(400).json({ error: 'Code expired or not found. Request a new one.' });
  }
  const expected = Buffer.from(pending.codeHash, 'hex');
  const supplied = Buffer.from(createHmac('sha256', JWT_SECRET).update(email + ':' + code).digest('hex'), 'hex');
  if (!timingSafeEqual(expected, supplied)) {
    if (pending.attempts >= 4) {
      await pendingUsers.deleteOne({ _id: pending._id });
      return res.status(429).json({ error: 'Too many attempts. Request a new code.' });
    }
    await pendingUsers.updateOne({ _id: pending._id }, { $inc: { attempts: 1 } });
    return res.status(400).json({ error: 'That verification code is incorrect' });
  }
  try {
    const r = await users.insertOne({ username: pending.username, email, hash: pending.hash, created: Date.now(), verified: true });
    await pendingUsers.deleteOne({ _id: pending._id });
    const u = { _id: r.insertedId, username: pending.username, email };
    res.json({ token: sign(u), user: pub(u) });
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: 'Email or username already in use' });
    throw e;
  }
}));

app.post('/api/login', wrap(async (req, res) => {
  const id = String(req.body.email || '').trim().toLowerCase().replace(/^@/, '');
  const u = await users.findOne(id.includes('@') ? { email: id } : { username: id });
  if (!u || !(await bcrypt.compare(String(req.body.password || ''), u.hash))) return res.status(401).json({ error: 'Wrong email/username or password' });
  res.json({ token: sign(u), user: pub(u) });
}));

app.get('/api/me', auth, wrap(async (req, res) => {
  const u = await users.findOne({ _id: oid(req.uid) });
  u ? res.json(pub(u)) : res.status(401).json({ error: 'Unknown user' });
}));

app.get('/api/calls/ice-servers', auth, wrap(async (_, res) => {
  if (TURN_KEY_ID && TURN_API_TOKEN) {
    const response = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(TURN_KEY_ID)}/credentials/generate-ice-servers`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TURN_API_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ttl: 48 * 60 * 60 }),
    });
    if (!response.ok) {
      console.error(`Cloudflare TURN credentials request failed with status ${response.status}`);
      return res.status(503).json({ error: 'Call relay is temporarily unavailable' });
    }
    const { iceServers } = await response.json();
    res.set('Cache-Control', 'no-store').json({
      iceServers: iceServers.map(server => ({
        ...server,
        urls: Array.isArray(server.urls) ? server.urls.filter(url => !/:53(?:\?|$)/.test(url)) : server.urls,
      })),
    });
    return;
  }
  const iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];
  if (TURN_URL && TURN_USERNAME && TURN_CREDENTIAL) iceServers.push({
    urls: TURN_URL.split(',').map(url => url.trim()), username: TURN_USERNAME, credential: TURN_CREDENTIAL,
  });
  res.set('Cache-Control', 'no-store').json({ iceServers });
}));

app.get('/api/users/search', auth, wrap(async (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase().replace(/^@/, '');
  if (q.length < 2) return res.json([]);
  const esc = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const list = await users.find({ _id: { $ne: oid(req.uid) }, $or: [{ username: { $regex: '^' + esc } }, { email: q }] }).limit(10).toArray();
  res.json(list.map(pub));
}));

app.get('/api/chats', auth, wrap(async (req, res) => {
  const list = await chats.find({ members: req.uid }).sort({ ts: -1 }).toArray();
  res.json(await Promise.all(list.map(c => chatView(c, req.uid))));
}));

app.post('/api/chats', auth, wrap(async (req, res) => {
  const q = String(req.body.to || '').trim().toLowerCase().replace(/^@/, '');
  const target = await users.findOne(q.includes('@') ? { email: q } : { username: q });
  if (!target) return res.status(404).json({ error: 'No NepaChat user found', invite: emailRx.test(q) });
  const tid = String(target._id);
  const key = [req.uid, tid].sort().join('~');
  await chats.updateOne({ key }, { $setOnInsert: { key, members: [...new Set([req.uid, tid])], ts: Date.now(), last: '' } }, { upsert: true });
  res.json(await chatView(await chats.findOne({ key }), req.uid));
}));

const member = async (cid, uid) => { const id = oid(cid); return id && chats.findOne({ _id: id, members: uid }); };

app.get('/api/chats/:id/messages', auth, wrap(async (req, res) => {
  const chat = await member(req.params.id, req.uid);
  if (!chat) return res.status(404).json({ error: 'Chat not found' });
  const peerId = chat.members.find(id => id !== req.uid);
  const list = await msgs.find({ chatId: req.params.id }).sort({ ts: 1 }).limit(500).toArray();
  res.json(list.map(m => ({
    id: String(m._id), from: m.from, text: m.text, ts: m.ts,
    status: m.from === req.uid ? m.readBy?.includes(peerId) ? 'read' : m.deliveredTo?.includes(peerId) ? 'delivered' : 'sent' : undefined,
  })));
}));

app.post('/api/chats/:id/messages', auth, wrap(async (req, res) => {
  const chat = await member(req.params.id, req.uid);
  const text = String(req.body.text || '').trim().slice(0, 2000);
  if (!chat || !text) return res.status(400).json({ error: 'Invalid message' });
  const m = { chatId: req.params.id, from: req.uid, text, ts: Date.now(), deliveredTo: [], readBy: [] };
  const r = await msgs.insertOne(m);
  await chats.updateOne({ _id: chat._id }, { $set: { last: text.slice(0, 80), ts: m.ts, by: req.uid } });
  const message = { id: String(r.insertedId), from: m.from, text, ts: m.ts, status: 'sent' };
  for (const uid of chat.members) {
    io.to('u:' + uid).emit('message', { chatId: req.params.id, message, chat: await chatView({ ...chat, last: text.slice(0, 80), ts: m.ts, by: req.uid }, uid) });
  }
  res.json(message);
}));

io.use((s, next) => {
  try { s.uid = jwt.verify(s.handshake.auth.token, JWT_SECRET).id; next(); } catch { next(new Error('auth')); }
});
io.on('connection', s => {
  s.join('u:' + s.uid);
  const recordReceipt = async ({ chatId, messageId } = {}, status) => {
    try {
      const chat = typeof chatId === 'string' && await member(chatId, s.uid);
      const id = oid(messageId);
      if (!chat || !id) return;
      const update = status === 'read'
        ? { $addToSet: { deliveredTo: s.uid, readBy: s.uid } }
        : { $addToSet: { deliveredTo: s.uid } };
      const result = await msgs.updateOne({ _id: id, chatId, from: { $ne: s.uid } }, update);
      if (!result.matchedCount) return;
      const message = await msgs.findOne({ _id: id }, { projection: { from: 1, readBy: 1 } });
      io.to('u:' + message.from).emit('message:status', {
        chatId, messageId, status: message.readBy?.includes(s.uid) ? 'read' : 'delivered',
      });
    } catch (error) { console.error(error); }
  };
  s.on('message:delivered', payload => recordReceipt(payload, 'delivered'));
  s.on('message:read', payload => recordReceipt(payload, 'read'));
  s.on('call:invite', async ({ chatId, callId, kind, offer } = {}) => {
    const chat = typeof chatId === 'string' && await member(chatId, s.uid);
    if (!chat || typeof callId !== 'string' || !['audio', 'video'].includes(kind) || offer?.type !== 'offer' || typeof offer.sdp !== 'string') return;
    const peerId = chat.members.find(id => id !== s.uid);
    const from = await users.findOne({ _id: oid(s.uid) });
    if (peerId && from) io.to('u:' + peerId).emit('call:incoming', { chatId, callId, kind, offer, from: pub(from) });
  });
  s.on('call:signal', async ({ chatId, callId, signal } = {}) => {
    const chat = typeof chatId === 'string' && await member(chatId, s.uid);
    if (!chat || typeof callId !== 'string' || !signal || !['answer', 'candidate'].includes(signal.type)) return;
    const peerId = chat.members.find(id => id !== s.uid);
    if (peerId) io.to('u:' + peerId).emit('call:signal', { chatId, callId, signal });
  });
  s.on('call:end', async ({ chatId, callId, reason } = {}) => {
    const chat = typeof chatId === 'string' && await member(chatId, s.uid);
    if (!chat || typeof callId !== 'string') return;
    const peerId = chat.members.find(id => id !== s.uid);
    if (peerId) io.to('u:' + peerId).emit('call:ended', { chatId, callId, reason: reason === 'declined' ? 'declined' : 'ended' });
  });
});

server.listen(PORT, '0.0.0.0', () => console.log('NepaChat API on :' + PORT));
