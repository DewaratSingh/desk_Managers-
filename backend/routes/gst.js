const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Get GST rates (ordered by rate)
router.get('/', async (req, res) => {
  try {
    const { q } = req.query || {};
    const limit = req.query.limit ? parseInt(req.query.limit) : null;
    const offset = req.query.offset ? parseInt(req.query.offset) : 0;
    
    let query = 'SELECT id, type, rate, created_at FROM gst_rates';
    const params = [];
    
    if (q) {
      query += ' WHERE type ILIKE $1';
      params.push(`%${q}%`);
    }
    
    query += ' ORDER BY rate ASC';
    
    if (limit !== null) {
      const limitParamIdx = params.length + 1;
      const offsetParamIdx = params.length + 2;
      query += ` LIMIT $${limitParamIdx} OFFSET $${offsetParamIdx}`;
      params.push(limit, offset);
    }
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching gst_rates:', err.message);
    res.status(500).json({ error: 'Failed to fetch GST rates' });
  }
});

// Create a GST rate
router.post('/', async (req, res) => {
  const { type, rate } = req.body || {};
  if (!type || rate === undefined) return res.status(400).json({ error: 'type and rate required' });
  try {
    const result = await pool.query(
      'INSERT INTO gst_rates (type, rate) VALUES ($1, $2) ON CONFLICT (type) DO NOTHING RETURNING *',
      [type, parseFloat(rate)]
    );
    if (result.rows.length === 0) return res.status(400).json({ error: 'GST Type already exists' });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating gst_rate:', err.message);
    res.status(500).json({ error: 'Failed to create GST rate' });
  }
});

// Update a GST rate
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { type, rate } = req.body || {};
  if (!type || rate === undefined) return res.status(400).json({ error: 'type and rate required' });
  try {
    const result = await pool.query(
      'UPDATE gst_rates SET type = $1, rate = $2 WHERE id = $3 RETURNING *',
      [type, parseFloat(rate), id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'GST rate not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating gst_rate:', err.message);
    res.status(500).json({ error: 'Failed to update GST rate' });
  }
});

// Delete a GST rate
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM gst_rates WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'GST rate not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    console.error('Error deleting gst_rate:', err.message);
    res.status(500).json({ error: 'Failed to delete GST rate' });
  }
});

module.exports = router;
