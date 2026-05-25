const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const { hashPassword } = require('../middleware/auth');

const router = express.Router();

// Login Endpoint (mapped to /api/auth/login)
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const inputHash = hashPassword(password);
    const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username.trim()]);

    if (rows.length === 0 || rows[0].password_hash !== inputHash) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = rows[0];
    
    // Generate JWT token with user details and 10 hours expiration as requested
    const token = jwt.sign(
      { username: user.username, role: user.role },
      process.env.JWT_SECRET || 'desk-manager-super-secret-key-2026',
      { expiresIn: '10h' }
    );

    res.json({
      token,
      user: {
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: 'Server error during login authentication' });
  }
});

// Verify Session Endpoint (mapped to /api/auth/verify)
router.get('/verify', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'desk-manager-super-secret-key-2026');
    res.json({ valid: true, user: decoded });
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired session token' });
  }
});

module.exports = router;
