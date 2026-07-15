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
      'SELECT username, role, name, email, permissions, company_id FROM users WHERE username = $1 AND password_hash = $2',
      [username, hash]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const user = result.rows[0];
    const token = jwt.sign(
      { username: user.username, role: user.role, permissions: user.permissions || [], company_id: user.company_id },
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

router.post('/signup', async (req, res) => {
  const { username, password, ownerName, companyName, phone, email } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  try {
    // Check if username is already taken
    const existing = await pool.query('SELECT username FROM users WHERE username = $1', [username]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Username is already taken.' });
    }

    // 1. Create the company first
    const targetCompanyName = companyName && companyName.trim() ? companyName.trim() : `${username}'s Company`;
    const companyResult = await pool.query(
      'INSERT INTO companies (name) VALUES ($1) RETURNING id',
      [targetCompanyName]
    );
    const companyId = companyResult.rows[0].id;

    // 2. Hash password and insert user linked to the company (Owner gets admin role and empty permissions array)
    const hash = crypto.createHash('sha256').update(password).digest('hex');
    const role = 'admin'; 

    const result = await pool.query(
      `INSERT INTO users (username, password_hash, role, name, owner_name, company_name, phone, email, permissions, company_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10) 
       RETURNING username, role, name, owner_name, company_name, phone, email, permissions, company_id`,
      [username, hash, role, ownerName || null, ownerName || null, targetCompanyName, phone || null, email || null, '[]', companyId]
    );

    const user = result.rows[0];
    const token = jwt.sign(
      { username: user.username, role: user.role, permissions: user.permissions || [], company_id: user.company_id },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.status(201).json({ token, user, message: 'User registered successfully.' });
  } catch (err) {
    console.error('Signup error:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
