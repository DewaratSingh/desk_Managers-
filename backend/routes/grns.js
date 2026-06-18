const express = require('express');
const { pool } = require('../db');

const router = express.Router();

// Get all GRNs
router.get('/', async (req, res) => {
  const { search } = req.query;
  const limit = parseInt(req.query.limit) || 20;
  const offset = parseInt(req.query.offset) || 0;

  try {
    let queryText = 'SELECT * FROM grns';
    let values = [limit, offset];

    if (search) {
      queryText += ' WHERE grn_no ILIKE $3';
      values = [limit, offset, `%${search}%`];
    }

    queryText += ' ORDER BY created_at DESC LIMIT $1 OFFSET $2';
    const { rows } = await pool.query(queryText, values);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching GRNs:', error);
    res.status(500).json({ error: 'Server error fetching GRNs' });
  }
});

// Add a new GRN
router.post('/', async (req, res) => {
  const { grn_no, trade_id } = req.body;

  if (!grn_no || !grn_no.trim()) {
    return res.status(400).json({ error: 'GRN Number is required' });
  }

  const client = await pool.connect();
  try {
    // Check if duplicate
    const checkDup = await client.query('SELECT grn_no FROM grns WHERE grn_no = $1', [grn_no.trim()]);
    if (checkDup.rows.length > 0) {
      return res.status(400).json({ error: 'GRN Number already exists' });
    }

    await client.query('BEGIN');

    const { rows } = await client.query(
      'INSERT INTO grns (grn_no, trade_id) VALUES ($1, $2) RETURNING *',
      [grn_no.trim(), trade_id || null]
    );

    // Link document in trades table
    if (trade_id) {
      const { appendDocToTrade } = require('../db');
      await appendDocToTrade(client, trade_id, 'GRN', grn_no.trim());
    }

    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating GRN:', error);
    res.status(500).json({ error: 'Server error creating GRN' });
  } finally {
    client.release();
  }
});

// Delete a GRN
router.delete('/:grn_no', async (req, res) => {
  const { grn_no } = req.params;

  try {
    const { rowCount } = await pool.query('DELETE FROM grns WHERE grn_no = $1', [grn_no]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'GRN not found' });
    }
    res.json({ success: true, message: 'GRN successfully deleted' });
  } catch (error) {
    console.error('Error deleting GRN:', error);
    res.status(500).json({ error: 'Server error deleting GRN' });
  }
});

module.exports = router;
