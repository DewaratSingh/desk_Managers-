const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { pool } = require('../db');

// GET /api/users - Get all users belonging to the company of the logged in user
router.get('/', async (req, res) => {
  const companyId = req.user.company_id;
  if (!companyId) {
    return res.status(400).json({ error: 'Company ID not found in session.' });
  }

  try {
    const result = await pool.query(
      'SELECT username, role, name, email, phone, permissions, company_id, created_at FROM users WHERE company_id = $1 ORDER BY username ASC',
      [companyId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Fetch users error:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/users - Create a new user in the company
router.post('/', async (req, res) => {
  const companyId = req.user.company_id;
  if (!companyId) {
    return res.status(400).json({ error: 'Company ID not found in session.' });
  }

  const { username, password, name, email, phone, role, permissions } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  try {
    // Check if user already exists
    const existing = await pool.query('SELECT username FROM users WHERE username = $1', [username]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Username is already taken.' });
    }

    const hash = crypto.createHash('sha256').update(password).digest('hex');
    const userRole = role || 'operator';
    const userPerms = Array.isArray(permissions) ? JSON.stringify(permissions) : '[]';

    const result = await pool.query(
      `INSERT INTO users (username, password_hash, role, name, email, phone, permissions, company_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8) 
       RETURNING username, role, name, email, phone, permissions, company_id, created_at`,
      [username, hash, userRole, name || null, email || null, phone || null, userPerms, companyId]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create user error:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PUT /api/users/:username - Update user details
router.put('/:username', async (req, res) => {
  const companyId = req.user.company_id;
  const targetUsername = req.params.username;

  if (!companyId) {
    return res.status(400).json({ error: 'Company ID not found in session.' });
  }

  const { password, name, email, phone, role, permissions } = req.body || {};

  try {
    // Verify target user is in the same company
    const existing = await pool.query('SELECT username, password_hash FROM users WHERE username = $1 AND company_id = $2', [targetUsername, companyId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'User not found in your company.' });
    }

    let passwordHash = existing.rows[0].password_hash;
    if (password && password.trim() !== '') {
      passwordHash = crypto.createHash('sha256').update(password).digest('hex');
    }

    const userRole = role || 'operator';
    const userPerms = Array.isArray(permissions) ? JSON.stringify(permissions) : '[]';

    const result = await pool.query(
      `UPDATE users 
       SET password_hash = $1, role = $2, name = $3, email = $4, phone = $5, permissions = $6::jsonb 
       WHERE username = $7 AND company_id = $8 
       RETURNING username, role, name, email, phone, permissions, company_id, created_at`,
      [passwordHash, userRole, name || null, email || null, phone || null, userPerms, targetUsername, companyId]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update user error:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// DELETE /api/users/:username - Delete user from company
router.delete('/:username', async (req, res) => {
  const companyId = req.user.company_id;
  const targetUsername = req.params.username;

  if (!companyId) {
    return res.status(400).json({ error: 'Company ID not found in session.' });
  }

  // Prevent users from deleting themselves
  if (targetUsername === req.user.username) {
    return res.status(400).json({ error: 'You cannot delete your own user account.' });
  }

  try {
    const result = await pool.query(
      'DELETE FROM users WHERE username = $1 AND company_id = $2 RETURNING username',
      [targetUsername, companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found in your company.' });
    }

    res.json({ message: 'User deleted successfully.', username: targetUsername });
  } catch (err) {
    console.error('Delete user error:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
