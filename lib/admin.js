const crypto = require('crypto');

const COOKIE = 'adc_admin';
const MAX_AGE = 60 * 60 * 24 * 7;
const MAX_IMAGE = 3.5 * 1024 * 1024;
const ALLOWED_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif'
};

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > 5 * 1024 * 1024) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); }
      catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function secret() {
  const pw = process.env.ADMIN_PASSWORD || '';
  const extra = process.env.ADMIN_SECRET || 'adc-admin';
  return crypto.createHash('sha256').update(pw + '::' + extra).digest();
}

function sign(exp) {
  const payload = Buffer.from(JSON.stringify({ exp }), 'utf8').toString('base64url');
  const mac = crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
  return payload + '.' + mac;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payload, mac] = parts;
  const expected = crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return Number(data.exp) > Date.now();
  } catch {
    return false;
  }
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  header.split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i === -1) return;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

function setSession(res, token) {
  const secure = process.env.NODE_ENV === 'production' || process.env.VERCEL ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; HttpOnly; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax${secure}`);
}

function clearSession(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);
}

function isAuthed(req) {
  if (!process.env.ADMIN_PASSWORD) return false;
  return verifyToken(parseCookies(req)[COOKIE]);
}

function requireAdmin(req, res) {
  if (!process.env.ADMIN_PASSWORD || !process.env.GITHUB_TOKEN) {
    json(res, 503, { error: 'Admin is not configured. Set ADMIN_PASSWORD and GITHUB_TOKEN in Vercel env vars.' });
    return false;
  }
  if (!isAuthed(req)) {
    json(res, 401, { error: 'Please log in.' });
    return false;
  }
  return true;
}

function checkPassword(password) {
  const expected = process.env.ADMIN_PASSWORD || '';
  if (!expected || typeof password !== 'string') return false;
  const a = crypto.createHash('sha256').update(password).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

function repo() {
  return process.env.GITHUB_REPO || 'ChurnInt/-atl-dart-club-site';
}

function branch() {
  return process.env.GITHUB_BRANCH || 'main';
}

async function githubGet(path) {
  const url = `https://api.github.com/repos/${repo()}/contents/${path}?ref=${encodeURIComponent(branch())}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'atl-dart-club-admin'
    }
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error('GitHub read failed: ' + res.status + ' ' + text.slice(0, 200));
  }
  return res.json();
}

async function githubPut(path, buffer, message, sha) {
  const body = {
    message,
    content: buffer.toString('base64'),
    branch: branch()
  };
  if (sha) body.sha = sha;
  const res = await fetch(`https://api.github.com/repos/${repo()}/contents/${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'atl-dart-club-admin',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error('GitHub save failed: ' + res.status + ' ' + text.slice(0, 300));
  }
  return res.json();
}

function cleanText(value, max) {
  return String(value || '').replace(/[<>]/g, '').trim().slice(0, max);
}

function normalizeContent(raw) {
  const events = Array.isArray(raw.events) ? raw.events : [];
  const battles = Array.isArray(raw.battles) ? raw.battles : [];
  const copy = raw.copy && typeof raw.copy === 'object' ? raw.copy : {};
  return {
    events: events.map((e) => ({
      id: cleanText(e.id, 80) || ('evt-' + Date.now()),
      title: cleanText(e.title, 120),
      date: cleanText(e.date, 20),
      time: cleanText(e.time, 40),
      location: cleanText(e.location, 160),
      type: cleanText(e.type, 80),
      blurb: cleanText(e.blurb, 400)
    })).filter((e) => e.title && e.date),
    battles: battles.map((b) => ({
      id: cleanText(b.id, 80) || ('battle-' + Date.now()),
      title: cleanText(b.title, 120),
      category: cleanText(b.category, 80),
      image: cleanText(b.image, 240)
    })).filter((b) => b.title),
    copy: {
      heroSub: cleanText(copy.heroSub, 500),
      battlesIntro: cleanText(copy.battlesIntro, 400),
      eventsHeroSub: cleanText(copy.eventsHeroSub, 500)
    }
  };
}

module.exports = {
  json,
  readBody,
  sign,
  setSession,
  clearSession,
  isAuthed,
  requireAdmin,
  checkPassword,
  githubGet,
  githubPut,
  cleanText,
  normalizeContent,
  MAX_IMAGE,
  ALLOWED_TYPES,
  MAX_AGE
};
