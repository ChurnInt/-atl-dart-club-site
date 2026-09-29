const crypto = require('crypto');
const { json, readBody, requireAdmin, githubGet, githubPut, MAX_IMAGE, ALLOWED_TYPES } = require('../lib/admin');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  if (!requireAdmin(req, res)) return;
  try {
    const body = await readBody(req);
    const type = String(body.type || '');
    const ext = ALLOWED_TYPES[type];
    if (!ext) return json(res, 400, { error: 'Use a JPG, PNG, WEBP, or GIF.' });
    const raw = String(body.data || '').replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(raw, 'base64');
    if (!buffer.length) return json(res, 400, { error: 'No image data.' });
    if (buffer.length > MAX_IMAGE) return json(res, 400, { error: 'Image must be under 3.5 MB.' });
    const id = String(body.id || crypto.randomBytes(6).toString('hex')).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 60);
    const path = `assets/gallery/${id}.${ext}`;
    const existing = await githubGet(path);
    await githubPut(path, buffer, `Add gallery photo ${path} from the admin page.`, existing && existing.sha);
    return json(res, 200, { ok: true, path: '/' + path + '?v=' + Date.now() });
  } catch (err) {
    return json(res, 500, { error: err.message || 'Could not upload image.' });
  }
};
