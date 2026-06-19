const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Get buyers (limit 100)
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, email, phone, created_at FROM buyers ORDER BY created_at DESC LIMIT 100');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching buyers:', err.message);
    res.status(500).json({ error: 'Failed to fetch buyers' });
  }
});

// Create a buyer
router.post('/', async (req, res) => {
  const { name, email, phone } = req.body || {};
  if (!name || !email || !phone) return res.status(400).json({ error: 'name, email and phone required' });
  try {
    const result = await pool.query('INSERT INTO buyers (name, email, phone) VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING RETURNING *', [name, email, phone]);
    if (result.rows.length === 0) return res.status(400).json({ error: 'Buyer already exists with this email' });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating buyer:', err.message);
    res.status(500).json({ error: 'Failed to create buyer' });
  }
});

// Update a buyer
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, email, phone } = req.body || {};
  if (!name || !email || !phone) return res.status(400).json({ error: 'name, email and phone required' });
  try {
    const result = await pool.query('UPDATE buyers SET name = $1, email = $2, phone = $3 WHERE id = $4 RETURNING *', [name, email, phone, id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Buyer not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating buyer:', err.message);
    res.status(500).json({ error: 'Failed to update buyer' });
  }
});

module.exports = router;
