const { json, clearSession } = require('../lib/admin');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  clearSession(res);
  return json(res, 200, { ok: true });
};
