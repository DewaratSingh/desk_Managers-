const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Get all trades (limit 100)
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT trade_id, status, trade_type, created_at, documents FROM trades ORDER BY created_at DESC LIMIT 100');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching trades:', err.message);
    res.status(500).json({ error: 'Failed to fetch trades' });
  }
});

// Get a single trade by trade_id
router.get('/:trade_id', async (req, res) => {
  const { trade_id } = req.params;
  try {
    const result = await pool.query('SELECT trade_id, documents, status, trade_type, created_at FROM trades WHERE trade_id = $1', [trade_id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Trade not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching trade:', err.message);
    res.status(500).json({ error: 'Failed to fetch trade' });
  }
});

module.exports = router;
