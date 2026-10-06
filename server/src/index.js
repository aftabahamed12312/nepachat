import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'node:path';
import fs from 'node:fs/promises';
import { Server } from 'socket.io';
import { MongoClient, ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import webpush from 'web-push';
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';

const {
  MONGO_URL = 'mongodb://mongo:27017/nepachat', JWT_SECRET = 'dev-secret', PORT = 4000,
  CORS_ORIGIN = '*', SMTP_HOST, SMTP_PORT = '587', SMTP_SECURE = 'false', SMTP_USER,
  SMTP_PASS, SMTP_FROM, RESEND_API_KEY, RESEND_FROM,
  GMAIL_OAUTH_CLIENT_ID, GMAIL_OAUTH_CLIENT_SECRET, GMAIL_OAUTH_REFRESH_TOKEN, GMAIL_FROM,
  TURN_KEY_ID, TURN_API_TOKEN, TURN_URL, TURN_USERNAME, TURN_CREDENTIAL, OWNER_EMAIL = '', OTP_DEV_MODE = 'false',
  R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, UPLOADS_DIR,
  VAPID_PUBLIC_KEY: ENV_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY: ENV_VAPID_PRIVATE_KEY,
  VAPID_SUBJECT = 'mailto:admin@nepachat.pages.dev',
} = process.env;
const client = new MongoClient(MONGO_URL);
await client.connect();
const db = client.db();
const users = db.collection('users'), chats = db.collection('chats'), msgs = db.collection('messages'), pendingUsers = db.collection('pendingUsers'), calls = db.collection('calls'), locationShares = db.collection('locationShares'), pushSubs = db.collection('pushSubscriptions'), activityPosts = db.collection('activityPosts'), friendships = db.collection('friendships'), systemSettings = db.collection('systemSettings'), deviceSessions = db.collection('deviceSessions'), devicePairings = db.collection('devicePairings');
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
await activityPosts.createIndex({ createdAt: -1, _id: -1 });
await friendships.createIndex({ pairKey: 1 }, { unique: true });
await friendships.createIndex({ fromId: 1, status: 1 });
await friendships.createIndex({ toId: 1, status: 1 });
await deviceSessions.createIndex({ userId: 1, revokedAt: 1 });
await devicePairings.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const app = express();
app.use(cors({ origin: CORS_ORIGIN === '*' ? true : CORS_ORIGIN.split(',') }));
app.use(express.json({ limit: '50kb' }));
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: CORS_ORIGIN === '*' ? true : CORS_ORIGIN.split(',') } });
const localUploadsDir = path.resolve(UPLOADS_DIR || path.join(process.cwd(), 'uploads'));
await fs.mkdir(localUploadsDir, { recursive: true });
const r2Configured = Boolean(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME);
const mediaEnabled = true;
const r2 = r2Configured ? new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
}) : null;
app.use('/uploads', express.static(localUploadsDir, { index: false }));
let vapidPublicKey = ENV_VAPID_PUBLIC_KEY;
let vapidPrivateKey = ENV_VAPID_PRIVATE_KEY;
if (!vapidPublicKey || !vapidPrivateKey) {
  const stored = await systemSettings.findOne({ _id: 'vapid' });
  if (stored?.publicKey && stored?.privateKey) {
    vapidPublicKey = stored.publicKey;
    vapidPrivateKey = stored.privateKey;
  } else {
    const generated = webpush.generateVAPIDKeys();
    const keys = { _id: 'vapid', publicKey: generated.publicKey, privateKey: generated.privateKey };
    try {
      await systemSettings.insertOne(keys);
      vapidPublicKey = keys.publicKey;
      vapidPrivateKey = keys.privateKey;
      console.info('Generated persistent VAPID keys in the application settings store.');
    } catch (error) {
      if (error.code !== 11000) throw error;
      const winner = await systemSettings.findOne({ _id: 'vapid' });
      if (!winner?.publicKey || !winner?.privateKey) throw error;
      vapidPublicKey = winner.publicKey;
      vapidPrivateKey = winner.privateKey;
    }
  }
}
webpush.setVapidDetails(VAPID_SUBJECT, vapidPublicKey, vapidPrivateKey);
const mailer = SMTP_HOST && SMTP_USER && SMTP_PASS ? nodemailer.createTransport({
  host: SMTP_HOST, port: Number(SMTP_PORT), secure: SMTP_SECURE === 'true',
  connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000,
  auth: { user: SMTP_USER, pass: SMTP_PASS },
}) : null;
const gmailApiConfigured = Boolean(GMAIL_OAUTH_CLIENT_ID && GMAIL_OAUTH_CLIENT_SECRET && GMAIL_OAUTH_REFRESH_TOKEN && GMAIL_FROM);
const resendConfigured = Boolean(RESEND_API_KEY && RESEND_FROM);
const emailVerificationConfigured = Boolean(mailer || gmailApiConfigured || resendConfigured || OTP_DEV_MODE === 'true');
const configuredMailProviders = [
  resendConfigured && 'Resend',
  gmailApiConfigured && 'Gmail API',
  mailer && 'SMTP',
].filter(Boolean);
if (configuredMailProviders.length) console.info(`Email verification providers configured: ${configuredMailProviders.join(', ')}`);
else if (OTP_DEV_MODE !== 'true') console.warn('Email verification is unavailable: configure Resend, Gmail API, or SMTP credentials.');

async function sendGmailOtp(to, code) {
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    signal: AbortSignal.timeout(15_000),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GMAIL_OAUTH_CLIENT_ID,
      client_secret: GMAIL_OAUTH_CLIENT_SECRET,
      refresh_token: GMAIL_OAUTH_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  if (!tokenResponse.ok) {
    const details = await tokenResponse.text();
    throw new Error(`Google OAuth token request failed (${tokenResponse.status}): ${details.slice(0, 500)}`);
  }
  const { access_token: accessToken } = await tokenResponse.json();
  if (!accessToken) throw new Error('Google OAuth did not return an access token');
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
    signal: AbortSignal.timeout(15_000),
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: Buffer.from(mime).toString('base64url') }),
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Gmail API send failed (${response.status}): ${details.slice(0, 500)}`);
  }
}

async function sendResendOtp(to, code) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    signal: AbortSignal.timeout(15_000),
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: RESEND_FROM, to: [to], subject: 'Your NepaChat verification code',
      text: `Your NepaChat verification code is ${code}. It expires in 10 minutes.`,
    }),
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Resend email request failed (${response.status}): ${details.slice(0, 500)}`);
  }
}

async function sendVerificationEmail(to, code) {
  const providers = [
    ...(resendConfigured ? ['Resend'] : []),
    ...(gmailApiConfigured ? ['Gmail API'] : []),
    ...(mailer ? ['SMTP'] : []),
  ];
  const failures = [];
  for (const provider of providers) {
    try {
      if (provider === 'Resend') await sendResendOtp(to, code);
      else if (provider === 'Gmail API') await sendGmailOtp(to, code);
      else await mailer.sendMail({
        from: SMTP_FROM || SMTP_USER, to, subject: 'Your NepaChat verification code',
        text: `Your NepaChat verification code is ${code}. It expires in 10 minutes.`,
      });
      return provider;
    } catch (error) {
      console.error(`${provider} verification email delivery failed:`, error);
      failures.push(`${provider}: ${error.message}`);
    }
  }
  if (failures.length) throw new Error(failures.join('; '));
  return null;
}

const pub = u => ({
  id: String(u._id), username: u.username, email: u.email,
  avatarPath: u.avatarKey ? `/api/users/${u._id}/avatar?v=${encodeURIComponent(path.basename(u.avatarKey))}` : null,
});
const accountView = u => ({ ...pub(u), role: u.role || 'user' });
const sign = (u, deviceId) => jwt.sign({ id: String(u._id), did: deviceId }, JWT_SECRET, { expiresIn: '30d' });
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

const deviceIdRx = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const devicePairHash = secret => createHmac('sha256', JWT_SECRET).update(secret).digest('hex');
const withDeviceLock = async (userId, action) => {
  const lockUntil = new Date(Date.now() + 60_000);
  const acquired = await users.updateOne({
    _id: oid(userId),
    $or: [{ deviceLinkLockUntil: { $exists: false } }, { deviceLinkLockUntil: { $lt: new Date() } }],
  }, { $set: { deviceLinkLockUntil: lockUntil } });
  if (!acquired.matchedCount) return { error: 'Another device operation is in progress. Try again.', status: 409 };
  try {
    return await action();
  } finally {
    await users.updateOne({ _id: oid(userId), deviceLinkLockUntil: lockUntil }, { $unset: { deviceLinkLockUntil: '' } });
  }
};
const ensureDeviceSession = async (user, deviceId, name, allowAdditional = false) => withDeviceLock(String(user._id), async () => {
  const existing = await deviceSessions.findOne({ _id: deviceId });
  if (existing) {
    if (existing.userId !== String(user._id)) return { error: 'This browser device ID belongs to another account.', status: 409, deviceIdConflict: true };
    if (existing.revokedAt) return { error: 'This device session has been revoked. Link this device again.', status: 403 };
    await deviceSessions.updateOne({ _id: deviceId }, { $set: { name, lastSeenAt: new Date() } });
    return { device: { ...existing, name, lastSeenAt: new Date() } };
  }
  const activeCount = await deviceSessions.countDocuments({ userId: String(user._id), revokedAt: { $exists: false } });
  if (!allowAdditional && activeCount > 0) return { error: 'Link this device by scanning the QR code from an existing signed-in device.', status: 403, deviceLinkRequired: true };
  if (activeCount >= 5) return { error: 'This account already has five active devices. Remove one before adding another.', status: 409 };
  if (activeCount > 0 && await deviceSessions.countDocuments({ userId: String(user._id), isPrimary: false, revokedAt: { $exists: false } }) >= 4) {
    return { error: 'This account already has four companion devices. Unlink one before adding another.', status: 409 };
  }
  const device = {
    _id: deviceId, userId: String(user._id), name, isPrimary: activeCount === 0,
    createdAt: new Date(), lastSeenAt: new Date(),
  };
  await deviceSessions.insertOne(device);
  return { device };
});
const deviceInput = (body, res) => {
  const id = String(body.deviceId || '');
  const name = String(body.deviceName || 'Web browser').trim().slice(0, 60) || 'Web browser';
  if (!deviceIdRx.test(id)) {
    res.status(400).json({ error: 'A valid device ID is required' });
    return null;
  }
  return { id, name };
};
const loginWithDevice = async (res, user, device, allowAdditional = false) => {
  const result = await ensureDeviceSession(user, device.id, device.name, allowAdditional);
  if (result.error) {
    return res.status(result.status).json({
      error: result.error,
      ...(result.deviceLinkRequired && { deviceLinkRequired: true }),
      ...(result.deviceIdConflict && { deviceIdConflict: true }),
    });
  }
  return res.json({ token: sign(user, device.id), user: accountView(user), device: result.device });
};
const auth = (req, res, next) => {
  let claims;
  try {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) throw new Error('Missing bearer token');
    claims = jwt.verify(header.slice(7), JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Please sign in again' });
  }
  req.uid = claims.id;
  req.deviceId = claims.did || null;
  if (!req.deviceId) return next();
  deviceSessions.findOne({ _id: req.deviceId, userId: req.uid, revokedAt: { $exists: false } }).then(device => {
    if (!device) return res.status(401).json({ error: 'This device was unlinked. Please sign in again.' });
    req.device = device;
    if (!device.lastSeenAt || Date.now() - device.lastSeenAt.getTime() > 5 * 60_000) {
      deviceSessions.updateOne({ _id: device._id }, { $set: { lastSeenAt: new Date() } }).catch(error => console.error('Unable to update device activity:', error));
    }
    next();
  }).catch(error => {
    console.error('Unable to validate device session:', error);
    res.status(500).json({ error: 'Unable to validate device session' });
  });
};
const wrap = fn => (req, res) => fn(req, res).catch(e => { console.error(e); res.status(500).json({ error: 'Server error' }); });
const admin = (req, res, next) => {
  users.findOne({ _id: oid(req.uid) }, { projection: { role: 1 } }).then(user => {
    if (user?.role !== 'admin') return res.status(403).json({ error: 'Owner account required' });
    next();
  }).catch(next);
};

async function notifyUser(userId, notification) {
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

const attachmentUrlFromKey = (req, key) => {
  const raw = String(key || '').replace(/^\/+/, '');
  if (!raw) return '';
  if (r2Configured) return `https://placeholder.invalid/${raw}`;
  const host = req?.get('host');
  const protocol = req?.secure ? 'https' : 'http';
  const base = process.env.PUBLIC_MEDIA_BASE_URL || (host ? `${protocol}://${host}` : 'http://localhost:4000');
  return `${base.replace(/\/$/, '')}/uploads/${raw.replace(/^uploads\//, '')}`;
};

async function messageView(message, req) {
  const attachments = await Promise.all((message.attachments || []).map(async attachment => {
    const normalized = { ...attachment };
    if (r2Configured) {
      normalized.url = await getSignedUrl(r2, new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: attachment.key }), { expiresIn: 3600 });
    } else {
      normalized.url = attachmentUrlFromKey(req, attachment.key);
    }
    return normalized;
  }));
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
  allowPublicSignUp: true,
  emailVerificationEnabled: emailVerificationConfigured,
  vapidPublicKey,
  pushNotificationsEnabled: true,
  mediaEnabled: mediaEnabled,
}));

app.post('/api/register', wrap(async (req, res) => {
  const username = String(req.body.username || '').trim().toLowerCase().replace(/^@/, '');
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!/^[a-z0-9_]{3,20}$/.test(username)) return res.status(400).json({ error: 'Username: 3-20 letters, numbers or _' });
  if (!emailRx.test(email)) return res.status(400).json({ error: 'Enter a valid email address' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  if (!emailVerificationConfigured) return res.status(503).json({ error: 'Email verification is not configured. Set RESEND_API_KEY and RESEND_FROM (recommended), Gmail API credentials, or SMTP settings.' });
  if (await users.findOne({ $or: [{ email }, { username }] })) return res.status(409).json({ error: 'Email or username already in use' });
  const existing = await pendingUsers.findOne({ email });
  if (existing && Date.now() - existing.lastSentAt < 60_000) return res.status(429).json({ error: 'Wait a minute before requesting another code' });
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const sentAt = Date.now();
  let provider;
  try {
    provider = await sendVerificationEmail(email, code);
  } catch (error) {
    console.error('All configured verification email providers failed:', error.message);
    return res.status(502).json({ error: 'Could not send the verification email. Check the mail provider configuration and try again.' });
  }
  await pendingUsers.updateOne({ email }, { $set: {
    username, email, hash: await bcrypt.hash(password, 10),
    codeHash: createHmac('sha256', JWT_SECRET).update(email + ':' + code).digest('hex'),
    expiresAt: new Date(sentAt + 10 * 60_000), lastSentAt: sentAt, attempts: 0,
  } }, { upsert: true });
  res.json({
    ok: true,
    message: provider ? 'Verification code sent' : `Local verification code: ${code}`,
  });
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
    await users.insertOne({ username: pending.username, email, hash: pending.hash, created: Date.now(), verified: true });
    await pendingUsers.deleteOne({ _id: pending._id });
    res.json({ ok: true, message: 'Email verified. Sign in with your new account.' });
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: 'Email or username already in use' });
    throw e;
  }
}));

app.post('/api/login', wrap(async (req, res) => {
  const device = deviceInput(req.body, res);
  if (!device) return;
  const id = String(req.body.email || '').trim().toLowerCase().replace(/^@/, '');
  const u = await users.findOne(id.includes('@') ? { email: id } : { username: id });
  if (!u || !(await bcrypt.compare(String(req.body.password || ''), u.hash))) return res.status(401).json({ error: 'Wrong email/username or password' });
  await loginWithDevice(res, u, device, true);
}));

app.post('/api/devices/current', auth, wrap(async (req, res) => {
  const device = deviceInput(req.body, res);
  if (!device) return;
  const user = await users.findOne({ _id: oid(req.uid) });
  if (!user) return res.status(401).json({ error: 'Unknown user' });
  if (req.deviceId) {
    if (req.deviceId !== device.id) return res.status(409).json({ error: 'The signed-in device ID does not match this browser' });
    return res.json({ device: req.device });
  }
  const result = await ensureDeviceSession(user, device.id, device.name, !req.deviceId);
  if (result.error) return res.status(result.status).json({ error: result.error });
  res.json({ token: sign(user, device.id), user: accountView(user), device: result.device });
}));

app.get('/api/devices', auth, wrap(async (req, res) => {
  const list = await deviceSessions.find({ userId: req.uid, revokedAt: { $exists: false } }).sort({ isPrimary: -1, createdAt: 1 }).toArray();
  res.json(list.map(device => ({
    id: device._id,
    name: device.name,
    isPrimary: Boolean(device.isPrimary),
    current: device._id === req.deviceId,
    createdAt: device.createdAt,
    lastSeenAt: device.lastSeenAt,
  })));
}));

app.delete('/api/devices/:id', auth, wrap(async (req, res) => {
  if (!deviceIdRx.test(req.params.id)) return res.status(400).json({ error: 'Invalid device ID' });
  if (req.params.id === req.deviceId) return res.status(400).json({ error: 'Use sign out to remove the current device' });
  const result = await deviceSessions.updateOne(
    { _id: req.params.id, userId: req.uid, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } },
  );
  if (!result.matchedCount) return res.status(404).json({ error: 'Active device not found' });
  await pushSubs.deleteMany({ userId: req.uid, deviceId: req.params.id });
  io.in(`d:${req.params.id}`).disconnectSockets(true);
  res.json({ ok: true });
}));

app.post('/api/devices/pairing', wrap(async (req, res) => {
  const device = deviceInput(req.body, res);
  if (!device) return;
  const secret = randomBytes(32).toString('base64url');
  const requestId = randomUUID();
  const now = new Date();
  await devicePairings.insertOne({
    _id: requestId, deviceId: device.id, deviceName: device.name,
    secretHash: devicePairHash(secret), status: 'pending',
    createdAt: now, expiresAt: new Date(now.getTime() + 5 * 60_000),
  });
  res.set('Cache-Control', 'no-store');
  res.status(201).json({ requestId, secret, deviceName: device.name, expiresAt: new Date(now.getTime() + 5 * 60_000) });
}));

app.post('/api/devices/pairing/:id/claim', wrap(async (req, res) => {
  const secret = String(req.body.secret || '');
  if (!deviceIdRx.test(req.params.id) || secret.length < 40) return res.status(400).json({ error: 'Invalid device pairing request' });
  const pairing = await devicePairings.findOne({ _id: req.params.id });
  if (!pairing || pairing.expiresAt <= new Date()) return res.status(410).json({ error: 'Pairing request expired. Start again on the new device.' });
  const expected = Buffer.from(pairing.secretHash, 'hex');
  const supplied = Buffer.from(devicePairHash(secret), 'hex');
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return res.status(404).json({ error: 'Pairing request not found' });
  if (pairing.status !== 'approved') return res.json({ status: 'pending' });
  const user = await users.findOne({ _id: oid(pairing.userId) });
  const device = await deviceSessions.findOne({ _id: pairing.deviceId, userId: pairing.userId, revokedAt: { $exists: false } });
  if (!user || !device) return res.status(410).json({ error: 'This device link is no longer active' });
  res.set('Cache-Control', 'no-store');
  res.json({ status: 'approved', token: sign(user, device._id), user: accountView(user), device });
}));

app.post('/api/devices/pairings/:id/approve', auth, wrap(async (req, res) => {
  if (!req.deviceId) return res.status(403).json({ error: 'Refresh this device session before approving links' });
  if (!deviceIdRx.test(req.params.id)) return res.status(400).json({ error: 'Invalid pairing request' });
  const pairing = await devicePairings.findOne({ _id: req.params.id, status: 'pending', expiresAt: { $gt: new Date() } });
  if (!pairing) return res.status(404).json({ error: 'Pairing request expired or already handled' });
  const secret = String(req.body.secret || '');
  if (secret.length < 40) return res.status(400).json({ error: 'The QR code is invalid' });
  const expected = Buffer.from(pairing.secretHash, 'hex');
  const supplied = Buffer.from(devicePairHash(secret), 'hex');
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return res.status(404).json({ error: 'Pairing request not found' });
  const result = await withDeviceLock(req.uid, async () => {
    const activeCount = await deviceSessions.countDocuments({ userId: req.uid, revokedAt: { $exists: false } });
    if (activeCount >= 5) return { error: 'This account already has five active devices. Remove one before adding another.', status: 409 };
    const previous = await deviceSessions.findOne({ _id: pairing.deviceId });
    if (previous && (previous.userId !== req.uid || !previous.revokedAt)) return { error: 'This device ID is already in use', status: 409 };
    const companionCount = await deviceSessions.countDocuments({ userId: req.uid, isPrimary: false, revokedAt: { $exists: false } });
    if (companionCount >= 4) return { error: 'This account already has four companion devices. Unlink one before adding another.', status: 409 };
    const device = {
      _id: pairing.deviceId, userId: req.uid, name: pairing.deviceName, isPrimary: false,
      createdAt: new Date(), lastSeenAt: new Date(),
    };
    if (previous) {
      const restored = await deviceSessions.updateOne(
        { _id: previous._id, userId: req.uid, revokedAt: previous.revokedAt },
        { $set: { name: device.name, lastSeenAt: device.lastSeenAt }, $unset: { revokedAt: '' } },
      );
      if (!restored.modifiedCount) return { error: 'This device session changed. Scan the QR code again.', status: 409 };
    } else {
      await deviceSessions.insertOne(device);
    }
    const approved = await devicePairings.updateOne(
      { _id: pairing._id, status: 'pending', expiresAt: { $gt: new Date() } },
      { $set: { status: 'approved', userId: req.uid, approvedAt: new Date() } },
    );
    if (!approved.modifiedCount) {
      if (previous) {
        await deviceSessions.updateOne({ _id: previous._id, userId: req.uid }, { $set: { revokedAt: previous.revokedAt } });
      } else {
        await deviceSessions.deleteOne({ _id: device._id, userId: req.uid });
      }
      return { error: 'Pairing request expired or already handled', status: 409 };
    }
    return { device };
  });
  if (result.error) return res.status(result.status).json({ error: result.error });
  res.json({ ok: true });
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

app.get('/api/admin/users', auth, admin, wrap(async (req, res) => {
  const query = String(req.query.q || '').trim().slice(0, 100);
  const offsetValue = Number.parseInt(String(req.query.offset || '0'), 10);
  const offset = Number.isSafeInteger(offsetValue) && offsetValue > 0 ? offsetValue : 0;
  const filter = query
    ? { $or: ['username', 'email'].map(field => ({ [field]: { $regex: query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } })) }
    : {};
  const projection = { username: 1, email: 1, role: 1, created: 1, verified: 1, avatarKey: 1 };
  const [list, total] = await Promise.all([
    users.find(filter, { projection }).sort({ created: -1, _id: -1 }).skip(offset).limit(50).toArray(),
    users.countDocuments(filter),
  ]);
  res.json({
    users: list.map(user => ({
      id: String(user._id), username: user.username, email: user.email,
      role: user.role || 'user', created: user.created || null, verified: Boolean(user.verified),
      avatarPath: pub(user).avatarPath,
    })),
    total,
    offset,
    limit: 50,
  });
}));

app.delete('/api/admin/users/:id', auth, admin, wrap(async (req, res) => {
  const userId = oid(req.params.id);
  if (!userId) return res.status(400).json({ error: 'Invalid account' });
  const userIdString = String(userId);
  if (userIdString === req.uid) return res.status(403).json({ error: 'You cannot delete your own account' });
  const user = await users.findOne({ _id: userId });
  if (!user) return res.status(404).json({ error: 'Account not found' });
  if (OWNER_EMAIL && user.email === OWNER_EMAIL.trim().toLowerCase()) {
    return res.status(403).json({ error: 'The configured owner account cannot be deleted' });
  }
  if (user.role === 'admin' && await users.countDocuments({ role: 'admin' }) <= 1) {
    return res.status(409).json({ error: 'The last admin account cannot be deleted' });
  }

  const userChats = await chats.find({ members: userIdString }, { projection: { _id: 1, members: 1 } }).toArray();
  const chatIds = userChats.map(chat => String(chat._id));
  const sessions = await deviceSessions.find({ userId: userIdString }, { projection: { _id: 1 } }).toArray();
  const deviceIds = sessions.map(device => device._id);
  const posts = await activityPosts.find({ authorId: userIdString }, { projection: { attachments: 1 } }).toArray();
  const messages = chatIds.length
    ? await msgs.find({ chatId: { $in: chatIds } }, { projection: { attachments: 1 } }).toArray()
    : [];
  const mediaPrefixes = [
    `profile/${userIdString}/`,
    `activity/${userIdString}/`,
    ...userChats.flatMap(chat => (chat.members || []).map(memberId => `${chat._id}/${memberId}/`)),
  ];
  const mediaKeys = new Set([
    user.avatarKey,
    ...posts.flatMap(post => (post.attachments || []).map(item => item.key)),
    ...messages.flatMap(message => (message.attachments || []).map(item => item.key)),
  ].filter(key => typeof key === 'string' && mediaPrefixes.some(prefix => key.startsWith(prefix))));
  let objectKeys = [];
  if (r2Configured) {
    for (const prefix of mediaPrefixes) {
      let continuationToken;
      do {
        const page = await r2.send(new ListObjectsV2Command({
          Bucket: R2_BUCKET_NAME, Prefix: prefix, ContinuationToken: continuationToken,
        }));
        objectKeys.push(...(page.Contents || []).map(object => object.Key).filter(Boolean));
        continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
      } while (continuationToken);
    }
  }

  await Promise.all([
    msgs.deleteMany({ chatId: { $in: chatIds } }),
    chats.deleteMany({ members: userIdString }),
    activityPosts.deleteMany({ authorId: userIdString }),
    friendships.deleteMany({ $or: [{ fromId: userIdString }, { toId: userIdString }] }),
    calls.deleteMany({ participants: userIdString }),
    locationShares.deleteMany({
      $or: [{ ownerId: userIdString }, { peerId: userIdString }, { participants: userIdString }],
    }),
    pushSubs.deleteMany({ userId: userIdString }),
    deviceSessions.deleteMany({ userId: userIdString }),
    devicePairings.deleteMany({
      $or: [{ userId: userIdString }, ...(deviceIds.length ? [{ deviceId: { $in: deviceIds } }] : [])],
    }),
    pendingUsers.deleteMany({ email: user.email }),
  ]);
  await users.deleteOne({ _id: userId });
  io.to(`u:${userIdString}`).emit('account:deleted');
  for (const chat of userChats) {
    const remainingMembers = (chat.members || []).filter(id => id !== userIdString);
    io.to(remainingMembers.map(id => `u:${id}`)).emit('account:changed');
  }

  let cleanupFailures = 0;
  if (r2Configured) {
    const keys = [...new Set([...objectKeys, ...mediaKeys])];
    for (let offset = 0; offset < keys.length; offset += 1000) {
      try {
        const result = await r2.send(new DeleteObjectsCommand({
          Bucket: R2_BUCKET_NAME,
          Delete: { Objects: keys.slice(offset, offset + 1000).map(Key => ({ Key })), Quiet: true },
        }));
        if (result.Errors?.length) console.error(`Unable to remove ${result.Errors.length} R2 media object(s) for account ${userIdString}`);
        cleanupFailures += result.Errors?.length || 0;
      } catch (error) {
        console.error(`Unable to remove account media for ${userIdString}:`, error);
        cleanupFailures += keys.slice(offset).length;
        break;
      }
    }
  } else {
    for (const prefix of mediaPrefixes) {
      const directory = path.resolve(localUploadsDir, ...prefix.split('/'));
      if (!directory.startsWith(`${localUploadsDir}${path.sep}`)) {
        throw new Error('Refusing to remove account media outside the upload directory');
      }
      try {
        await fs.rm(directory, { recursive: true, force: true });
      } catch (error) {
        console.error(`Unable to remove account media for ${userIdString}:`, error);
        cleanupFailures += 1;
      }
    }
    for (const key of mediaKeys) {
      if (mediaPrefixes.some(prefix => key.startsWith(prefix))) continue;
      try {
        await removeStoredMedia(key);
      } catch (error) {
        console.error(`Unable to remove account media for ${userIdString}:`, error);
        cleanupFailures += 1;
      }
    }
  }
  res.json({
    ok: true,
    mediaCleanupWarning: cleanupFailures ? `${cleanupFailures} media cleanup operation(s) failed` : null,
  });
}));

app.get('/api/me', auth, wrap(async (req, res) => {
  const u = await users.findOne({ _id: oid(req.uid) });
  u ? res.json(accountView(u)) : res.status(401).json({ error: 'Unknown user' });
}));

app.patch('/api/me/profile', auth, wrap(async (req, res) => {
  const username = String(req.body.username || '').trim().toLowerCase().replace(/^@/, '');
  const email = String(req.body.email || '').trim().toLowerCase();
  const newPassword = String(req.body.newPassword || '');
  const current = await users.findOne({ _id: oid(req.uid) });
  if (!current) return res.status(404).json({ error: 'Account not found' });
  if (!/^[a-z0-9_]{3,20}$/.test(username)) return res.status(400).json({ error: 'Username must be 3-20 letters, numbers, or underscores' });
  if (!emailRx.test(email)) return res.status(400).json({ error: 'Enter a valid email address' });
  if (newPassword && newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });
  if (newPassword) {
    const currentPassword = String(req.body.currentPassword || '');
    if (!currentPassword || !await bcrypt.compare(currentPassword, current.hash)) return res.status(401).json({ error: 'Current password is incorrect' });
  }
  if ((username !== current.username || email !== current.email) && await users.findOne({
    _id: { $ne: current._id },
    $or: [{ username }, { email }],
  })) return res.status(409).json({ error: 'Username or email is already in use' });
  const changes = { username, email };
  if (newPassword) changes.hash = await bcrypt.hash(newPassword, 10);
  try {
    await users.updateOne({ _id: current._id }, { $set: changes });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'Username or email is already in use' });
    throw error;
  }
  const updated = { ...current, ...changes };
  res.json(accountView(updated));
}));

app.get('/api/users/:id/avatar', wrap(async (req, res) => {
  const id = oid(req.params.id);
  if (!id) return res.status(404).end();
  const user = await users.findOne({ _id: id }, { projection: { avatarKey: 1 } });
  if (!user?.avatarKey || !new RegExp(`^profile/${id}/[a-f0-9-]{36}\\.(?:jpg|png|webp|gif)$`).test(user.avatarKey)) return res.status(404).end();
  if (r2Configured) {
    const url = await getSignedUrl(r2, new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: user.avatarKey }), { expiresIn: 3600 });
    return res.redirect(302, url);
  }
  const file = path.resolve(localUploadsDir, user.avatarKey);
  if (!file.startsWith(`${localUploadsDir}${path.sep}`)) return res.status(404).end();
  res.sendFile(file);
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
  if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) return res.status(400).json({ error: 'Invalid push subscription' });
  await pushSubs.updateOne({ endpoint: subscription.endpoint }, { $set: { endpoint: subscription.endpoint, subscription, userId: req.uid, deviceId: req.deviceId, updatedAt: Date.now() } }, { upsert: true });
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

async function friendStateFor(userId) {
  const links = await friendships.find({ $or: [{ fromId: userId }, { toId: userId }] }).sort({ createdAt: -1 }).toArray();
  const friends = [], incoming = [], outgoing = [];
  await Promise.all(links.map(async link => {
    const otherId = link.fromId === userId ? link.toId : link.fromId;
    const user = await users.findOne({ _id: oid(otherId) });
    if (!user) return;
    const person = pub(user);
    if (link.status === 'accepted') friends.push(person);
    else if (link.toId === userId) incoming.push({ id: String(link._id), user: person, createdAt: link.createdAt });
    else outgoing.push({ id: String(link._id), user: person, createdAt: link.createdAt });
  }));
  return { friends, incoming, outgoing };
}

app.get('/api/friends', auth, wrap(async (req, res) => {
  res.json(await friendStateFor(req.uid));
}));

app.post('/api/friends/requests', auth, wrap(async (req, res) => {
  const query = String(req.body.to || '').trim().toLowerCase().replace(/^@/, '');
  if (!query) return res.status(400).json({ error: 'Enter a username or email address' });
  const target = await users.findOne(query.includes('@') ? { email: query } : { username: query });
  if (!target) return res.status(404).json({ error: 'No NepaChat user found' });
  const targetId = String(target._id);
  if (targetId === req.uid) return res.status(400).json({ error: 'You cannot send a friend request to yourself' });
  const pairKey = [req.uid, targetId].sort().join('~');
  const existing = await friendships.findOne({ pairKey });
  if (existing?.status === 'accepted') return res.status(409).json({ error: 'You are already friends' });
  if (existing?.status === 'pending') {
    return res.status(409).json({ error: existing.fromId === req.uid ? 'Friend request already sent' : 'This user already sent you a request. Accept it from your requests.' });
  }
  const request = { pairKey, fromId: req.uid, toId: targetId, status: 'pending', createdAt: Date.now() };
  let result;
  try {
    result = await friendships.insertOne(request);
  } catch (error) {
    if (error.code !== 11000) throw error;
    return res.status(409).json({ error: 'A friend request already exists for this user' });
  }
  const requester = await users.findOne({ _id: oid(req.uid) });
  io.to('u:' + targetId).emit('friend:request', {
    id: String(result.insertedId),
    username: requester?.username || 'Someone',
  });
  io.to('u:' + targetId).emit('friend:changed');
  io.to('u:' + req.uid).emit('friend:changed');
  await notifyUser(targetId, {
    title: 'New friend request',
    body: `${requester?.username || 'Someone'} wants to connect`,
    tag: `friend-request-${String(result.insertedId)}`,
    url: '/?notifications=friends',
  });
  res.status(201).json({ id: String(result.insertedId), user: pub(target), createdAt: request.createdAt });
}));

app.patch('/api/friends/requests/:id', auth, wrap(async (req, res) => {
  const id = oid(req.params.id);
  const action = String(req.body.action || '');
  if (!id || !['accept', 'reject'].includes(action)) return res.status(400).json({ error: 'Choose whether to accept or reject this request' });
  const request = await friendships.findOne({ _id: id, toId: req.uid, status: 'pending' });
  if (!request) return res.status(404).json({ error: 'Friend request not found' });
  if (action === 'accept') {
    await friendships.updateOne({ _id: id, toId: req.uid, status: 'pending' }, { $set: { status: 'accepted', acceptedAt: Date.now() } });
    const acceptingUser = await users.findOne({ _id: oid(req.uid) });
    const acceptedBy = acceptingUser ? pub(acceptingUser) : { id: req.uid, username: 'Someone', email: '' };
    io.to('u:' + request.fromId).emit('friend:accepted', acceptedBy);
    if (acceptingUser) {
      await notifyUser(request.fromId, {
        title: 'Friend request accepted',
        body: `${acceptingUser.username} accepted your request`,
        tag: `friend-accepted-${String(id)}`,
        url: '/?notifications=friends',
      });
    }
  } else {
    await friendships.deleteOne({ _id: id, toId: req.uid, status: 'pending' });
  }
  io.to(['u:' + request.fromId, 'u:' + request.toId]).emit('friend:changed');
  res.json({ ok: true });
}));

app.delete('/api/friends/:friendId', auth, wrap(async (req, res) => {
  const friendId = oid(req.params.friendId);
  if (!friendId) return res.status(400).json({ error: 'Invalid friend' });
  const otherId = String(friendId);
  const pairKey = [req.uid, otherId].sort().join('~');
  const result = await friendships.deleteOne({ pairKey, status: 'accepted' });
  if (!result.deletedCount) return res.status(404).json({ error: 'Friend not found' });
  io.to(['u:' + req.uid, 'u:' + otherId]).emit('friend:changed');
  res.json({ ok: true });
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
const mediaTypeFromName = name => {
  const extension = String(name || '').toLowerCase().split('.').pop();
  switch (extension) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'mp4':
      return 'video/mp4';
    case 'webm':
      return 'video/webm';
    default:
      return '';
  }
};
const extensionForMediaType = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
};
const fileMatchesMediaType = (buffer, type) => {
  if (!Buffer.isBuffer(buffer)) return false;
  switch (type) {
    case 'image/jpeg':
      return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    case 'image/png':
      return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case 'image/webp':
      return buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
    case 'image/gif':
      return buffer.length >= 6 && ['GIF87a', 'GIF89a'].includes(buffer.toString('ascii', 0, 6));
    case 'video/mp4':
      return buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp';
    case 'video/webm':
      return buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
    default:
      return false;
  }
};
const storeMedia = async (prefix, body, type) => {
  const key = `${prefix}/${randomUUID()}${extensionForMediaType[type]}`;
  if (r2Configured) {
    await r2.send(new PutObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key, Body: body, ContentType: type }));
  } else {
    const targetDir = path.join(localUploadsDir, ...prefix.split('/'));
    await fs.mkdir(targetDir, { recursive: true });
    await fs.writeFile(path.join(targetDir, path.basename(key)), body);
  }
  return key;
};
const removeStoredMedia = async key => {
  if (!key) return;
  if (r2Configured) {
    await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }));
    return;
  }
  const file = path.resolve(localUploadsDir, key);
  if (!file.startsWith(`${localUploadsDir}${path.sep}`)) throw new Error('Refusing to remove media outside the upload directory');
  await fs.rm(file, { force: true });
};

app.put('/api/chats/:id/uploads', auth, express.raw({ type: '*/*', limit: mediaLimit }), wrap(async (req, res) => {
  const chat = await member(req.params.id, req.uid);
  if (!chat) return res.status(404).json({ error: 'Chat not found' });
  let fileName;
  try {
    fileName = decodeURIComponent(String(req.get('x-file-name') || 'attachment')).replace(/[\r\n\\/]/g, '').slice(0, 120);
  } catch {
    return res.status(400).json({ error: 'Invalid file name' });
  }
  const declaredType = String(req.get('x-file-type') || req.get('content-type') || '').split(';')[0].toLowerCase();
  const type = mediaTypes.has(declaredType) ? declaredType : mediaTypeFromName(fileName) || declaredType;
  if (!mediaTypes.has(type) || !Buffer.isBuffer(req.body) || !req.body.length || req.body.length > mediaLimit || !fileMatchesMediaType(req.body, type)) {
    return res.status(400).json({ error: 'Upload a supported image or video under 25 MB' });
  }
  const name = fileName || 'attachment';
  const key = await storeMedia(`${req.params.id}/${req.uid}`, req.body, type);
  res.status(201).json({ attachment: { key, type, name: name || 'attachment', size: req.body.length } });
}));

app.put('/api/activity/uploads', auth, express.raw({ type: '*/*', limit: mediaLimit }), wrap(async (req, res) => {
  let fileName;
  try {
    fileName = decodeURIComponent(String(req.get('x-file-name') || 'activity')).replace(/[\r\n\\/]/g, '').slice(0, 120);
  } catch {
    return res.status(400).json({ error: 'Invalid file name' });
  }
  const declaredType = String(req.get('x-file-type') || req.get('content-type') || '').split(';')[0].toLowerCase();
  const type = mediaTypes.has(declaredType) ? declaredType : mediaTypeFromName(fileName) || declaredType;
  if (!mediaTypes.has(type) || !Buffer.isBuffer(req.body) || !req.body.length || req.body.length > mediaLimit || !fileMatchesMediaType(req.body, type)) {
    return res.status(400).json({ error: 'Upload a supported image or video under 25 MB' });
  }
  const key = await storeMedia(`activity/${req.uid}`, req.body, type);
  res.status(201).json({ attachment: { key, type, name: fileName || 'activity', size: req.body.length } });
}));

const avatarLimit = 5 * 1024 * 1024;
app.put('/api/me/avatar', auth, express.raw({ type: '*/*', limit: avatarLimit }), wrap(async (req, res) => {
  let fileName;
  try {
    fileName = decodeURIComponent(String(req.get('x-file-name') || 'profile')).replace(/[\r\n\\/]/g, '').slice(0, 120);
  } catch {
    return res.status(400).json({ error: 'Invalid file name' });
  }
  const declaredType = String(req.get('x-file-type') || req.get('content-type') || '').split(';')[0].toLowerCase();
  const type = mediaTypes.has(declaredType) ? declaredType : mediaTypeFromName(fileName) || declaredType;
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(type) ||
    !Buffer.isBuffer(req.body) || !req.body.length || req.body.length > avatarLimit || !fileMatchesMediaType(req.body, type)) {
    return res.status(400).json({ error: 'Choose a valid JPEG, PNG, WebP, or GIF image under 5 MB' });
  }
  const user = await users.findOne({ _id: oid(req.uid) });
  if (!user) return res.status(404).json({ error: 'Account not found' });
  const avatarKey = await storeMedia(`profile/${req.uid}`, req.body, type);
  await users.updateOne({ _id: user._id }, { $set: { avatarKey } });
  if (user.avatarKey) await removeStoredMedia(user.avatarKey).catch(error => console.error('Unable to remove previous profile picture:', error));
  res.json(accountView({ ...user, avatarKey }));
}));

async function activityPostView(post, req) {
  const author = await users.findOne({ _id: oid(post.authorId) });
  const attachments = await Promise.all((post.attachments || []).map(async attachment => ({
    ...attachment,
    url: r2Configured
      ? await getSignedUrl(r2, new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: attachment.key }), { expiresIn: 3600 })
      : attachmentUrlFromKey(req, attachment.key),
  })));
  return {
    id: String(post._id),
    text: post.text,
    createdAt: post.createdAt,
    author: author ? pub(author) : { id: post.authorId, username: 'unknown', email: '' },
    attachments,
  };
}

app.get('/api/activity/posts', auth, wrap(async (req, res) => {
  const accepted = await friendships.find({
    status: 'accepted',
    $or: [{ fromId: req.uid }, { toId: req.uid }],
  }, { projection: { fromId: 1, toId: 1 } }).toArray();
  const visibleAuthors = [req.uid, ...accepted.map(link => link.fromId === req.uid ? link.toId : link.fromId)];
  const list = await activityPosts.find({ authorId: { $in: visibleAuthors } }).sort({ createdAt: -1, _id: -1 }).limit(50).toArray();
  res.json(await Promise.all(list.map(post => activityPostView(post, req))));
}));

app.post('/api/activity/posts', auth, wrap(async (req, res) => {
  const text = String(req.body.text || '').trim().slice(0, 2000);
  const requested = Array.isArray(req.body.attachments) ? req.body.attachments : [];
  if ((!text && !requested.length) || requested.length > 5) return res.status(400).json({ error: 'Add a caption or at least one photo/video (up to 5 files)' });
  const attachments = [];
  for (const item of requested) {
    const validKey = typeof item.key === 'string' && new RegExp(`^activity/${req.uid}/[a-f0-9-]{36}\\.(?:jpg|png|webp|gif|mp4|webm)$`).test(item.key);
    if (!validKey || !mediaTypes.has(item.type) || path.posix.extname(item.key) !== extensionForMediaType[item.type] || !Number.isInteger(item.size) || item.size < 1 || item.size > mediaLimit) {
      return res.status(400).json({ error: 'Invalid activity attachment' });
    }
    if (r2Configured) {
      const object = await r2.send(new HeadObjectCommand({ Bucket: R2_BUCKET_NAME, Key: item.key }));
      if (object.ContentLength !== item.size || object.ContentType !== item.type) return res.status(400).json({ error: 'Attachment metadata did not match uploaded file' });
    } else {
      const localFile = path.resolve(localUploadsDir, item.key);
      if (!localFile.startsWith(`${localUploadsDir}${path.sep}`)) return res.status(400).json({ error: 'Invalid activity attachment' });
      try {
        await fs.access(localFile);
      } catch {
        return res.status(400).json({ error: 'Attachment file was not found' });
      }
    }
    attachments.push({ key: item.key, type: item.type, name: String(item.name || 'activity').slice(0, 120), size: item.size });
  }
  const post = { authorId: req.uid, text, attachments, createdAt: Date.now() };
  const result = await activityPosts.insertOne(post);
  const view = await activityPostView({ ...post, _id: result.insertedId }, req);
  const accepted = await friendships.find({
    status: 'accepted',
    $or: [{ fromId: req.uid }, { toId: req.uid }],
  }, { projection: { fromId: 1, toId: 1 } }).toArray();
  const recipients = [req.uid, ...accepted.map(link => link.fromId === req.uid ? link.toId : link.fromId)];
  io.to(recipients.map(userId => 'u:' + userId)).emit('activity:post', view);
  await Promise.all(recipients.filter(userId => userId !== req.uid).map(userId => notifyUser(userId, {
    title: `New activity from ${view.author.username}`,
    body: text || (attachments.length ? 'Shared a photo or video' : 'Shared a post'),
    tag: `activity-${String(result.insertedId)}`,
    url: '/?notifications=activity',
  })));
  res.status(201).json(view);
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
    ...await messageView(m, req),
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
  if (requestedAttachments.length && !mediaEnabled) return res.status(503).json({ error: 'Media storage is not configured' });
  const attachmentPrefix = `${req.params.id}/${req.uid}/`;
  const attachments = [];
  for (const item of requestedAttachments) {
    if (typeof item.key !== 'string' || !item.key.startsWith(attachmentPrefix) || !mediaTypes.has(item.type) || !Number.isInteger(item.size) || item.size < 1 || item.size > mediaLimit) {
      return res.status(400).json({ error: 'Invalid attachment' });
    }
    if (r2Configured) {
      const object = await r2.send(new HeadObjectCommand({ Bucket: R2_BUCKET_NAME, Key: item.key }));
      if (object.ContentLength !== item.size || object.ContentType !== item.type) return res.status(400).json({ error: 'Attachment metadata did not match uploaded file' });
    } else {
      const localFile = path.join(localUploadsDir, item.key);
      try {
        await fs.access(localFile);
      } catch {
        return res.status(400).json({ error: 'Attachment file was not found' });
      }
    }
    attachments.push({ key: item.key, type: item.type, name: String(item.name || 'attachment').slice(0, 120), size: item.size });
  }
  const m = { chatId: req.params.id, from: req.uid, text, attachments, ts: Date.now(), deliveredTo: [], readBy: [], replyTo: replyTo || null };
  const r = await msgs.insertOne(m);
  const preview = text || 'Shared media';
  await chats.updateOne({ _id: chat._id }, { $set: { last: preview.slice(0, 80), ts: m.ts, by: req.uid } });
  const message = { ...await messageView({ ...m, _id: r.insertedId }, req), status: 'sent' };
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
  let claims;
  try { claims = jwt.verify(s.handshake.auth.token, JWT_SECRET); } catch { return next(new Error('auth')); }
  s.uid = claims.id;
  s.deviceId = claims.did || null;
  if (!s.deviceId) return next();
  deviceSessions.findOne({ _id: s.deviceId, userId: s.uid, revokedAt: { $exists: false } }).then(device => {
    if (!device) return next(new Error('auth'));
    next();
  }).catch(error => {
    console.error('Unable to validate socket device session:', error);
    next(new Error('auth'));
  });
});
io.on('connection', s => {
  s.join('u:' + s.uid);
  if (s.deviceId) s.join('d:' + s.deviceId);
  let deviceCheck;
  if (s.deviceId) {
    const validateDevice = () => deviceSessions.findOne({
      _id: s.deviceId, userId: s.uid, revokedAt: { $exists: false },
    }).then(device => {
      if (!device) s.disconnect(true);
    }).catch(error => console.error('Unable to revalidate socket device session:', error));
    s.use((_, next) => {
      deviceSessions.findOne({ _id: s.deviceId, userId: s.uid, revokedAt: { $exists: false } })
        .then(device => next(device ? undefined : new Error('auth')))
        .catch(error => {
          console.error('Unable to validate socket device event:', error);
          next(new Error('auth'));
        });
    });
    deviceCheck = setInterval(validateDevice, 30_000);
  }
  s.on('disconnect', () => { if (deviceCheck) clearInterval(deviceCheck); });
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
    if (!peerId) return;
    if (signal.type === 'answer') {
      const accepted = await calls.updateOne(
        { callId, chatId, from: peerId, to: s.uid, status: 'ringing' },
        { $set: { status: 'active', connectedAt: Date.now(), answeredByDevice: s.deviceId } },
      );
      if (!accepted.modifiedCount) return;
      io.to('u:' + s.uid).emit('call:answered-elsewhere', { chatId, callId, acceptedDeviceId: s.deviceId });
    }
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
    if (s.uid !== record?.from) io.to('u:' + s.uid).emit('call:answered-elsewhere', { chatId, callId });
    if (peerId) io.to('u:' + peerId).emit('call:ended', { chatId, callId, reason: reason === 'declined' ? 'declined' : 'ended' });
  });
});

server.listen(PORT, '0.0.0.0', () => console.log('NepaChat API on :' + PORT));
