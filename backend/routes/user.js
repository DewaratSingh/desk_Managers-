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

// POST /api/users - Create a new user or link an existing one to the company
router.post('/', async (req, res) => {
  const companyId = req.user.company_id;
  if (!companyId) {
    return res.status(400).json({ error: 'Company ID not found in session.' });
  }

  const { username, password, name, email, phone, role, permissions } = req.body || {};
  if (!username) {
    return res.status(400).json({ error: 'Username is required.' });
  }

  try {
    // Fetch company name of the logged-in user's company
    const companyRes = await pool.query('SELECT name FROM companies WHERE id = $1', [companyId]);
    const companyName = companyRes.rows.length > 0 ? companyRes.rows[0].name : null;

    // Check if user already exists in the system
    const existing = await pool.query('SELECT username, company_id FROM users WHERE username = $1', [username]);
    const userPerms = Array.isArray(permissions) ? JSON.stringify(permissions) : '[]';

    if (existing.rows.length > 0) {
      const existingUser = existing.rows[0];
      if (existingUser.company_id === companyId) {
        return res.status(400).json({ error: 'User is already enrolled in your company.' });
      }
      if (existingUser.company_id !== null) {
        return res.status(400).json({ error: 'Username is already taken.' });
      }

      // Link the existing user to this company and set permissions
      const result = await pool.query(
        `UPDATE users 
         SET company_id = $1, company_name = $2, permissions = $3::jsonb 
         WHERE username = $4 
         RETURNING username, role, name, email, phone, permissions, company_id, company_name, created_at`,
        [companyId, companyName, userPerms, username]
      );
      return res.status(200).json(result.rows[0]);
    }

    // Otherwise, create a brand-new user (default password = username)
    const userPassword = password || username;
    const hash = crypto.createHash('sha256').update(userPassword).digest('hex');
    const userRole = role || 'operator';

    const result = await pool.query(
      `INSERT INTO users (username, password_hash, role, name, email, phone, permissions, company_id, company_name) 
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9) 
       RETURNING username, role, name, email, phone, permissions, company_id, company_name, created_at`,
      [username, hash, userRole, name || null, email || null, phone || null, userPerms, companyId, companyName]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Add user error:', err.message);
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

  const { permissions } = req.body || {};

  try {
    // Verify target user is in the same company
    const existing = await pool.query('SELECT username FROM users WHERE username = $1 AND company_id = $2', [targetUsername, companyId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'User not found in your company.' });
    }

    const userPerms = Array.isArray(permissions) ? JSON.stringify(permissions) : '[]';

    const result = await pool.query(
      `UPDATE users 
       SET permissions = $1::jsonb 
       WHERE username = $2 AND company_id = $3 
       RETURNING username, role, name, email, phone, permissions, company_id, company_name, created_at`,
      [userPerms, targetUsername, companyId]
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
      `UPDATE users 
       SET company_id = NULL, company_name = NULL, permissions = '[]'::jsonb 
       WHERE username = $1 AND company_id = $2 
       RETURNING username`,
      [targetUsername, companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found in your company.' });
    }

    res.json({ message: 'User removed from company successfully.', username: targetUsername });
  } catch (err) {
    console.error('Delete user error:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
