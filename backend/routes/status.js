const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Get statuses (supports searching and limit of 5 if q is provided)
router.get('/', async (req, res) => {
  const { q } = req.query || {};
  try {
    let queryText = 'SELECT name FROM status';
    let params = [];
    if (q !== undefined) {
      queryText += ' WHERE name ILIKE $1';
      params.push(`%${q}%`);
      queryText += ' ORDER BY name ASC LIMIT 5';
    } else {
      queryText += ' ORDER BY name ASC';
    }
    const result = await pool.query(queryText, params);
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
