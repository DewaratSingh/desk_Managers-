const jwt = require('jsonwebtoken');
const { pool } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'deskmanager_secret_key_2026';

module.exports = async (req, res, next) => {
  let token = null;
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  // Parse Cookie header if token not found in Authorization header
  if (!token && req.headers.cookie) {
    const cookies = req.headers.cookie.split(';').reduce((acc, cookie) => {
      const [name, ...value] = cookie.trim().split('=');
      acc[name] = value.join('=');
      return acc;
    }, {});
    token = cookies['token'];
  }

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Check if the user company exists in the database
    if (decoded.company_id) {
      const companyCheck = await pool.query('SELECT id FROM companies WHERE id = $1', [decoded.company_id]);
      if (companyCheck.rows.length === 0) {
        return res.status(401).json({ error: 'Company tenant no longer exists. Please re-authenticate.' });
      }
    }
    
    req.user = {
      username: decoded.user_id,
      user_id: decoded.user_id,
      company_id: decoded.company_id
    };
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token.' });
  }
};
