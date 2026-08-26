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
      'SELECT username, role, name, surname, email, phone, permissions, company_id FROM users WHERE username = $1 AND password_hash = $2',
      [username, hash]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const user = result.rows[0];
    if (!user.company_id) {
      return res.status(400).json({ error: 'no company enrolled' });
    }

    const companyResult = await pool.query('SELECT name FROM companies WHERE id = $1', [user.company_id]);
    if (companyResult.rows.length > 0) {
      user.company_name = companyResult.rows[0].name;
    }
    const token = jwt.sign(
      { user_id: user.username, company_id: user.company_id },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.cookie('token', token, {
      maxAge: 8 * 60 * 60 * 1000,
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/'
    });

    res.json({ token, user });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token', { path: '/' });
  res.json({ message: 'Logged out successfully.' });
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
  const {
    username,
    password,
    name,
    surname,
    phone,
    email,
    openCompany,
    companyName,
    companyEmail,
    companyAddress,
    companyPhone,
    companyOwnerName
  } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  try {
    // Check if username is already taken
    const existing = await pool.query('SELECT username FROM users WHERE username = $1', [username]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Username is already taken.' });
    }

    let companyId = null;
    let targetCompanyName = null;
    let targetOwnerName = null;
    let role = 'operator';

    if (openCompany) {
      if (!companyName || !companyName.trim()) {
        return res.status(400).json({ error: 'Company name is required to open a company.' });
      }

      targetCompanyName = companyName.trim();
      targetOwnerName = companyOwnerName && companyOwnerName.trim() ? companyOwnerName.trim() : username;
      role = 'admin';

      // 1. Create the company
      const companyResult = await pool.query(
        'INSERT INTO companies (name, owner_name, owner_username, phone, email, address) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
        [
          targetCompanyName,
          targetOwnerName,
          username,
          companyPhone ? companyPhone.trim() : null,
          companyEmail ? companyEmail.trim() : null,
          companyAddress ? companyAddress.trim() : null
        ]
      );
      companyId = companyResult.rows[0].id;
    }

    // 2. Hash password and insert user (linked to the company if openCompany was checked)
    const hash = crypto.createHash('sha256').update(password).digest('hex');

    const result = await pool.query(
      `INSERT INTO users (username, password_hash, role, name, surname, owner_name, company_name, phone, email, permissions, company_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11) 
       RETURNING username, role, name, surname, owner_name, company_name, phone, email, permissions, company_id`,
      [
        username,
        hash,
        role,
        name ? name.trim() : null,
        surname ? surname.trim() : null,
        targetOwnerName,
        targetCompanyName,
        phone ? phone.trim() : null,
        email ? email.trim() : null,
        '[]',
        companyId
      ]
    );

    res.status(201).json({ message: 'User registered successfully.' });
  } catch (err) {
    console.error('Signup error:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
