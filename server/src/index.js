import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import { MongoClient, ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import webpush from 'web-push';
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';

const {
  MONGO_URL = 'mongodb://mongo:27017/nepachat', JWT_SECRET = 'dev-secret', PORT = 4000,
  CORS_ORIGIN = '*', SMTP_HOST, SMTP_PORT = '587', SMTP_SECURE = 'false', SMTP_USER,
  SMTP_PASS, SMTP_FROM, RESEND_API_KEY, RESEND_FROM,
  GMAIL_OAUTH_CLIENT_ID, GMAIL_OAUTH_CLIENT_SECRET, GMAIL_OAUTH_REFRESH_TOKEN, GMAIL_FROM,
  TURN_KEY_ID, TURN_API_TOKEN, TURN_URL, TURN_USERNAME, TURN_CREDENTIAL, OWNER_EMAIL = '', OTP_DEV_MODE = 'false',
  R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME,
  VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT = 'mailto:admin@nepachat.pages.dev',
} = process.env;
const client = new MongoClient(MONGO_URL);
await client.connect();
const db = client.db();
const users = db.collection('users'), chats = db.collection('chats'), msgs = db.collection('messages'), pendingUsers = db.collection('pendingUsers'), calls = db.collection('calls'), locationShares = db.collection('locationShares'), pushSubs = db.collection('pushSubscriptions');
await users.createIndex({ email: 1 }, { unique: true });
await users.createIndex({ username: 1 }, { unique: true });
await chats.createIndex({ members: 1 });
await msgs.createIndex({ chatId: 1, ts: 1 });
await pendingUsers.createIndex({ email: 1 }, { unique: true });
await pendingUsers.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
await calls.createIndex({ participants: 1, startedAt: -1 });
await calls.createIndex({ callId: 1 }, { unique: true });
await locationShares.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
await locationShares.createIndex({ chatId: 1, ownerId: 1 });
await pushSubs.createIndex({ endpoint: 1 }, { unique: true });
await pushSubs.createIndex({ userId: 1 });

const app = express();
app.use(cors({ origin: CORS_ORIGIN === '*' ? true : CORS_ORIGIN.split(',') }));
app.use(express.json({ limit: '50kb' }));
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: CORS_ORIGIN === '*' ? true : CORS_ORIGIN.split(',') } });
const r2Configured = Boolean(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME);
const r2 = r2Configured ? new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
}) : null;
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
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
const accountView = u => ({ ...pub(u), role: u.role || 'user' });
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
if (OWNER_EMAIL) {
  const result = await users.updateOne({ email: OWNER_EMAIL.trim().toLowerCase() }, { $set: { role: 'admin' } });
  if (!result.matchedCount) console.warn('OWNER_EMAIL does not match an existing user account');
}

const auth = (req, res, next) => {
  try { req.uid = jwt.verify((req.headers.authorization || '').slice(7), JWT_SECRET).id; next(); }
  catch { res.status(401).json({ error: 'Please sign in again' }); }
};
const wrap = fn => (req, res) => fn(req, res).catch(e => { console.error(e); res.status(500).json({ error: 'Server error' }); });
const admin = (req, res, next) => {
  users.findOne({ _id: oid(req.uid) }, { projection: { role: 1 } }).then(user => {
    if (user?.role !== 'admin') return res.status(403).json({ error: 'Owner account required' });
    next();
  }).catch(next);
};

async function notifyUser(userId, notification) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;
  const subscriptions = await pushSubs.find({ userId }).toArray();
  await Promise.all(subscriptions.map(async item => {
    try {
      await webpush.sendNotification(item.subscription, JSON.stringify(notification));
    } catch (error) {
      if (error.statusCode === 404 || error.statusCode === 410) await pushSubs.deleteOne({ _id: item._id });
      else console.error(`Push notification failed with status ${error.statusCode || 'unknown'}`);
    }
  }));
}

async function messageView(message) {
  const attachments = await Promise.all((message.attachments || []).map(async attachment => ({
    ...attachment,
    url: await getSignedUrl(r2, new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: attachment.key }), { expiresIn: 3600 }),
  })));
  let replyTo = null;
  if (message.replyTo) {
    const parent = await msgs.findOne({ _id: oid(message.replyTo) }, { projection: { from: 1, text: 1, attachments: 1, ts: 1 } });
    if (parent) {
      replyTo = {
        id: String(parent._id),
        from: parent.from,
        text: parent.text || 'Shared media',
        ts: parent.ts,
        attachments: (parent.attachments || []).map(item => ({ ...item })),
      };
    }
  }
  return { id: String(message._id), from: message.from, text: message.text, ts: message.ts, attachments, replyTo };
}

async function chatView(c, me) {
  const other = c.members.find(m => m !== me) || me;
  const u = await users.findOne({ _id: oid(other) });
  return { id: String(c._id), other: u ? pub(u) : { id: other, username: 'unknown', email: '' }, last: c.last || '', ts: c.ts || 0, by: c.by || '' };
}

app.get('/api/health', (_, res) => res.json({ ok: true }));
app.get('/api/config', (_, res) => res.json({
  allowPublicSignUp: !OWNER_EMAIL,
  vapidPublicKey: VAPID_PUBLIC_KEY || null,
  mediaEnabled: r2Configured,
}));

app.post('/api/register', wrap(async (req, res) => {
  if (OWNER_EMAIL) return res.status(403).json({ error: 'Ask the account owner to create your account' });
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
    res.json({ token: sign(u), user: accountView(u) });
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: 'Email or username already in use' });
    throw e;
  }
}));

app.post('/api/login', wrap(async (req, res) => {
  const id = String(req.body.email || '').trim().toLowerCase().replace(/^@/, '');
  const u = await users.findOne(id.includes('@') ? { email: id } : { username: id });
  if (!u || !(await bcrypt.compare(String(req.body.password || ''), u.hash))) return res.status(401).json({ error: 'Wrong email/username or password' });
  res.json({ token: sign(u), user: accountView(u) });
}));

app.post('/api/admin/users', auth, admin, wrap(async (req, res) => {
  const username = String(req.body.username || '').trim().toLowerCase().replace(/^@/, '');
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!/^[a-z0-9_]{3,20}$/.test(username)) return res.status(400).json({ error: 'Username: 3-20 letters, numbers or _' });
  if (!emailRx.test(email)) return res.status(400).json({ error: 'Enter a valid email address' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  if (await users.findOne({ $or: [{ email }, { username }] })) return res.status(409).json({ error: 'Email or username already in use' });
  try {
    const user = { username, email, hash: await bcrypt.hash(password, 10), created: Date.now(), verified: true, role: 'user' };
    const result = await users.insertOne(user);
    res.status(201).json({ user: pub({ ...user, _id: result.insertedId }) });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'Email or username already in use' });
    throw error;
  }
}));

app.get('/api/me', auth, wrap(async (req, res) => {
  const u = await users.findOne({ _id: oid(req.uid) });
  u ? res.json(accountView(u)) : res.status(401).json({ error: 'Unknown user' });
}));

app.get('/api/calls/history', auth, wrap(async (req, res) => {
  const list = await calls.find({ participants: req.uid }).sort({ startedAt: -1 }).limit(100).toArray();
  const history = await Promise.all(list.map(async item => {
    const peerId = item.participants.find(id => id !== req.uid);
    const peer = peerId && await users.findOne({ _id: oid(peerId) });
    return {
      id: item.callId, chatId: item.chatId, kind: item.kind,
      direction: item.from === req.uid ? 'outgoing' : 'incoming',
      status: item.status, startedAt: item.startedAt, endedAt: item.endedAt || null,
      other: peer ? pub(peer) : { id: peerId, username: 'unknown', email: '' },
    };
  }));
  res.json(history);
}));

app.post('/api/push/subscribe', auth, wrap(async (req, res) => {
  const subscription = req.body.subscription;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return res.status(503).json({ error: 'Push notifications are not configured' });
  if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) return res.status(400).json({ error: 'Invalid push subscription' });
  await pushSubs.updateOne({ endpoint: subscription.endpoint }, { $set: { endpoint: subscription.endpoint, subscription, userId: req.uid, updatedAt: Date.now() } }, { upsert: true });
  res.json({ ok: true });
}));

app.delete('/api/push/subscribe', auth, wrap(async (req, res) => {
  const endpoint = String(req.body.endpoint || '');
  if (endpoint) await pushSubs.deleteOne({ endpoint, userId: req.uid });
  res.json({ ok: true });
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

const mediaTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm']);
const mediaLimit = 25 * 1024 * 1024;

app.put('/api/chats/:id/uploads', auth, express.raw({ type: [...mediaTypes], limit: mediaLimit }), wrap(async (req, res) => {
  const chat = await member(req.params.id, req.uid);
  if (!chat) return res.status(404).json({ error: 'Chat not found' });
  if (!r2Configured) return res.status(503).json({ error: 'Media storage is not configured' });
  const type = String(req.get('content-type') || '').split(';')[0].toLowerCase();
  if (!mediaTypes.has(type) || !Buffer.isBuffer(req.body) || !req.body.length || req.body.length > mediaLimit) {
    return res.status(400).json({ error: 'Upload a supported image or video under 25 MB' });
  }
  const name = decodeURIComponent(String(req.get('x-file-name') || 'attachment')).replace(/[\r\n\\/]/g, '').slice(0, 120);
  const key = `${req.params.id}/${req.uid}/${randomUUID()}`;
  await r2.send(new PutObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key, Body: req.body, ContentType: type }));
  res.status(201).json({ attachment: { key, type, name: name || 'attachment', size: req.body.length } });
}));

async function locationView(share) {
  const owner = await users.findOne({ _id: oid(share.ownerId) });
  return {
    id: String(share._id), chatId: share.chatId, ownerId: share.ownerId,
    ownerName: owner?.username || 'unknown', latitude: share.latitude, longitude: share.longitude,
    startedAt: share.startedAt, updatedAt: share.updatedAt || share.startedAt, expiresAt: share.expiresAt.getTime(),
    mapsUrl: `https://maps.google.com/?q=${share.latitude},${share.longitude}`,
  };
}

app.get('/api/chats/:id/location-shares', auth, wrap(async (req, res) => {
  const chat = await member(req.params.id, req.uid);
  if (!chat) return res.status(404).json({ error: 'Chat not found' });
  const list = await locationShares.find({ chatId: req.params.id, participants: req.uid, expiresAt: { $gt: new Date() } }).toArray();
  res.json(await Promise.all(list.map(locationView)));
}));

app.post('/api/chats/:id/location-shares', auth, wrap(async (req, res) => {
  const chat = await member(req.params.id, req.uid);
  if (!chat) return res.status(404).json({ error: 'Chat not found' });
  const latitude = Number(req.body.latitude), longitude = Number(req.body.longitude), duration = Number(req.body.durationSeconds);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) return res.status(400).json({ error: 'Invalid location' });
  if (![900, 3600, 28800].includes(duration)) return res.status(400).json({ error: 'Choose a supported sharing duration' });
  const now = Date.now();
  const peerId = chat.members.find(id => id !== req.uid);
  const existing = await locationShares.findOne({ ownerId: req.uid, expiresAt: { $gt: new Date(now) } });
  if (existing) return res.status(409).json({ error: 'You are already sharing your location in this chat' });
  const share = { chatId: req.params.id, ownerId: req.uid, peerId, participants: chat.members, latitude, longitude, startedAt: now, expiresAt: new Date(now + duration * 1000) };
  const result = await locationShares.insertOne(share);
  const view = await locationView({ ...share, _id: result.insertedId });
  io.to('u:' + peerId).emit('location:update', view);
  res.status(201).json(view);
}));

app.patch('/api/chats/:id/location-shares/:shareId', auth, wrap(async (req, res) => {
  const chat = await member(req.params.id, req.uid);
  const id = oid(req.params.shareId);
  const latitude = Number(req.body.latitude), longitude = Number(req.body.longitude);
  if (!chat || !id) return res.status(404).json({ error: 'Location share not found' });
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) return res.status(400).json({ error: 'Invalid location' });
  const share = await locationShares.findOne({ _id: id, chatId: req.params.id, ownerId: req.uid, expiresAt: { $gt: new Date() } });
  if (!share) return res.status(404).json({ error: 'Location share expired or stopped' });
  await locationShares.updateOne({ _id: id }, { $set: { latitude, longitude, updatedAt: Date.now() } });
  const view = await locationView({ ...share, latitude, longitude, updatedAt: Date.now() });
  io.to('u:' + share.peerId).emit('location:update', view);
  res.json(view);
}));

app.delete('/api/chats/:id/location-shares/:shareId', auth, wrap(async (req, res) => {
  const chat = await member(req.params.id, req.uid);
  const id = oid(req.params.shareId);
  if (!chat || !id) return res.status(404).json({ error: 'Location share not found' });
  const share = await locationShares.findOne({ _id: id, chatId: req.params.id, ownerId: req.uid });
  if (!share) return res.status(404).json({ error: 'Location share not found' });
  await locationShares.deleteOne({ _id: id });
  io.to('u:' + share.peerId).emit('location:stopped', { chatId: share.chatId, shareId: String(id) });
  res.json({ ok: true });
}));

app.get('/api/chats/:id/messages', auth, wrap(async (req, res) => {
  const chat = await member(req.params.id, req.uid);
  if (!chat) return res.status(404).json({ error: 'Chat not found' });
  const peerId = chat.members.find(id => id !== req.uid);
  const list = await msgs.find({ chatId: req.params.id }).sort({ ts: 1 }).limit(500).toArray();
  res.json(await Promise.all(list.map(async m => ({
    ...await messageView(m),
    status: m.from === req.uid ? m.readBy?.includes(peerId) ? 'read' : m.deliveredTo?.includes(peerId) ? 'delivered' : 'sent' : undefined,
  }))));
}));

app.post('/api/chats/:id/messages', auth, wrap(async (req, res) => {
  const chat = await member(req.params.id, req.uid);
  const text = String(req.body.text || '').trim().slice(0, 2000);
  const requestedAttachments = Array.isArray(req.body.attachments) ? req.body.attachments : [];
  const replyTo = typeof req.body.replyTo === 'string' ? req.body.replyTo.trim() : '';
  if (!chat || (!text && !requestedAttachments.length) || requestedAttachments.length > 5) return res.status(400).json({ error: 'Invalid message' });
  if (replyTo && !await msgs.findOne({ _id: oid(replyTo), chatId: req.params.id })) return res.status(400).json({ error: 'Reply target not found' });
  if (requestedAttachments.length && !r2Configured) return res.status(503).json({ error: 'Media storage is not configured' });
  const attachmentPrefix = `${req.params.id}/${req.uid}/`;
  const attachments = [];
  for (const item of requestedAttachments) {
    if (typeof item.key !== 'string' || !item.key.startsWith(attachmentPrefix) || !mediaTypes.has(item.type) || !Number.isInteger(item.size) || item.size < 1 || item.size > mediaLimit) {
      return res.status(400).json({ error: 'Invalid attachment' });
    }
    const object = await r2.send(new HeadObjectCommand({ Bucket: R2_BUCKET_NAME, Key: item.key }));
    if (object.ContentLength !== item.size || object.ContentType !== item.type) return res.status(400).json({ error: 'Attachment metadata did not match uploaded file' });
    attachments.push({ key: item.key, type: item.type, name: String(item.name || 'attachment').slice(0, 120), size: item.size });
  }
  const m = { chatId: req.params.id, from: req.uid, text, attachments, ts: Date.now(), deliveredTo: [], readBy: [], replyTo: replyTo || null };
  const r = await msgs.insertOne(m);
  const preview = text || 'Shared media';
  await chats.updateOne({ _id: chat._id }, { $set: { last: preview.slice(0, 80), ts: m.ts, by: req.uid } });
  const message = { ...await messageView({ ...m, _id: r.insertedId }), status: 'sent' };
  for (const uid of chat.members) {
    const chatViewForUser = await chatView({ ...chat, last: preview.slice(0, 80), ts: m.ts, by: req.uid }, uid);
    io.to('u:' + uid).emit('message', { chatId: req.params.id, message, chat: chatViewForUser });
    if (uid !== req.uid) {
      await notifyUser(uid, {
        title: 'New message',
        body: text || 'Shared media',
        tag: `message-${String(r.insertedId)}`,
        url: '/?chat=' + req.params.id,
      });
    }
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
    if (!peerId || !from) return;
    const startedAt = Date.now();
    await calls.updateOne({ callId }, { $setOnInsert: {
      callId, chatId, participants: chat.members, from: s.uid, to: peerId, kind, status: 'ringing', startedAt,
    } }, { upsert: true });
    io.to('u:' + peerId).emit('call:incoming', { chatId, callId, kind, offer, from: pub(from) });
    await notifyUser(peerId, {
      title: `Incoming ${kind} call`, body: `@${from.username} is calling you`,
      tag: `call-${callId}`, url: '/?callHistory=1',
    });
    const missedCallTimer = setTimeout(async () => {
      try {
        const result = await calls.updateOne({ callId, status: 'ringing' }, { $set: { status: 'missed', endedAt: Date.now() } });
        if (!result.modifiedCount) return;
        io.to('u:' + s.uid).emit('call:ended', { chatId, callId, reason: 'missed' });
        await notifyUser(peerId, { title: 'Missed call', body: `You missed a ${kind} call from @${from.username}`, tag: `missed-${callId}`, url: '/?callHistory=1' });
      } catch (error) { console.error(error); }
    }, 45_000);
    missedCallTimer.unref?.();
  });
  s.on('call:signal', async ({ chatId, callId, signal } = {}) => {
    const chat = typeof chatId === 'string' && await member(chatId, s.uid);
    if (!chat || typeof callId !== 'string' || !signal || !['answer', 'candidate'].includes(signal.type)) return;
    const peerId = chat.members.find(id => id !== s.uid);
    if (signal.type === 'answer') await calls.updateOne({ callId, chatId, participants: s.uid, status: 'ringing' }, { $set: { status: 'active', connectedAt: Date.now() } });
    if (peerId) io.to('u:' + peerId).emit('call:signal', { chatId, callId, signal });
  });
  s.on('call:end', async ({ chatId, callId, reason } = {}) => {
    const chat = typeof chatId === 'string' && await member(chatId, s.uid);
    if (!chat || typeof callId !== 'string') return;
    const peerId = chat.members.find(id => id !== s.uid);
    const record = await calls.findOne({ callId, chatId, participants: s.uid });
    if (record) {
      const status = record.status === 'ringing'
        ? reason === 'declined' ? 'declined' : s.uid === record.from ? 'cancelled' : 'missed'
        : 'ended';
      await calls.updateOne({ _id: record._id }, { $set: { status, endedAt: Date.now() } });
    }
    if (peerId) io.to('u:' + peerId).emit('call:ended', { chatId, callId, reason: reason === 'declined' ? 'declined' : 'ended' });
  });
});

server.listen(PORT, '0.0.0.0', () => console.log('NepaChat API on :' + PORT));
