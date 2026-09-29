const { json, isAuthed } = require('../lib/admin');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
  if (!process.env.ADMIN_PASSWORD || !process.env.GITHUB_TOKEN) {
    return json(res, 503, { configured: false, authed: false });
  }
  return json(res, 200, { configured: true, authed: isAuthed(req) });
};
