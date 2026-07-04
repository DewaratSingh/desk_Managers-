const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'deskmanager_secret_key_2026';

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  try {
    const hash = crypto.createHash('sha256').update(password).digest('hex');
    const result = await pool.query(
      'SELECT username, role FROM users WHERE username = $1 AND password_hash = $2',
      [username, hash]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const user = result.rows[0];
    const token = jwt.sign(
      { username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({ token, user });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.post('/change-password', async (req, res) => {
  const { username, previousPassword, newPassword } = req.body || {};
  if (!username || !previousPassword || !newPassword) {
    return res.status(400).json({ error: 'Username, previous password, and new password are required.' });
  }

  try {
    const oldHash = crypto.createHash('sha256').update(previousPassword).digest('hex');
    const result = await pool.query(
      'SELECT username FROM users WHERE username = $1 AND password_hash = $2',
      [username, oldHash]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or previous password.' });
    }

    const newHash = crypto.createHash('sha256').update(newPassword).digest('hex');
    await pool.query(
      'UPDATE users SET password_hash = $1 WHERE username = $2',
      [newHash, username]
    );

    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    console.error('Change password error:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
