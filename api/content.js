const { json, readBody, requireAdmin, githubGet, githubPut, normalizeContent } = require('../lib/admin');

const PATH = 'data/content.json';

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    if (!requireAdmin(req, res)) return;
    try {
      const file = await githubGet(PATH);
      if (!file || !file.content) {
        return json(res, 200, { events: [], battles: [], copy: {} });
      }
      const raw = JSON.parse(Buffer.from(file.content, 'base64').toString('utf8'));
      return json(res, 200, normalizeContent(raw));
    } catch (err) {
      return json(res, 500, { error: err.message || 'Could not load content.' });
    }
  }

  if (req.method === 'PUT') {
    if (!requireAdmin(req, res)) return;
    try {
      const body = normalizeContent(await readBody(req));
      const file = await githubGet(PATH);
      const next = Buffer.from(JSON.stringify(body, null, 2) + '\n', 'utf8');
      await githubPut(PATH, next, 'Update site content from the admin page.', file && file.sha);
      return json(res, 200, { ok: true, content: body });
    } catch (err) {
      return json(res, 500, { error: err.message || 'Could not save content.' });
    }
  }

  return json(res, 405, { error: 'Method not allowed' });
};
