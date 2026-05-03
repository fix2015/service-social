const API_KEY = process.env.SERVICE_API_KEY || 'dev-key-change-me';

function serviceAuth(req, res, next) {
  const key = req.headers['x-service-key'];
  if (!key || key !== API_KEY) {
    return res.status(401).json({ error: 'Invalid or missing service API key' });
  }
  next();
}

module.exports = { serviceAuth };
