const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Get all statuses
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT name FROM status ORDER BY name ASC');
    res.json(result.rows.map(r => r.name));
  } catch (err) {
    console.error('Error fetching statuses:', err.message);
    res.status(500).json({ error: 'Failed to fetch statuses' });
  }
});

// Add a new status
router.post('/', async (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    await pool.query('INSERT INTO status (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [name.trim().toLowerCase()]);
    res.status(201).json({ name: name.trim().toLowerCase() });
  } catch (err) {
    console.error('Error adding status:', err.message);
    res.status(500).json({ error: 'Failed to add status' });
  }
});

module.exports = router;
