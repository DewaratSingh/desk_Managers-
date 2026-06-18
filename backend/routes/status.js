const express = require('express');
const { pool } = require('../db');
const router = express.Router();

// Get all unique status suggestions
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT name FROM status ORDER BY name ASC');
    res.json(rows.map(r => r.name));
  } catch (error) {
    console.error('Error fetching statuses:', error);
    res.status(500).json({ error: 'Server error fetching status list' });
  }
});

module.exports = router;
