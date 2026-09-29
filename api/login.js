const { json, readBody, sign, setSession, checkPassword, MAX_AGE } = require('../lib/admin');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  if (!process.env.ADMIN_PASSWORD || !process.env.GITHUB_TOKEN) {
    return json(res, 503, { error: 'Admin is not configured yet. Add ADMIN_PASSWORD and GITHUB_TOKEN in Vercel.' });
  }
  try {
    const body = await readBody(req);
    if (!checkPassword(body.password)) {
      return json(res, 401, { error: 'Wrong password.' });
    }
    setSession(res, sign(Date.now() + MAX_AGE * 1000));
    return json(res, 200, { ok: true });
  } catch (err) {
    return json(res, 400, { error: err.message || 'Could not log in.' });
  }
};
