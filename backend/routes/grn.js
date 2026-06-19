const express = require('express');
const router = express.Router();
const { pool, appendDocToTrade } = require('../db');

// ─── GET a single GRN by grn_no ───────────────────────────────────────────────
router.get('/:grn_no', async (req, res) => {
  const { grn_no } = req.params;
  try {
    const result = await pool.query(
      `SELECT grn_no, delivery_note_no, trade_id, grn_date, has_rejection, rejection_items, created_at
       FROM grns WHERE grn_no = $1`,
      [grn_no]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'GRN not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching GRN:', err.message);
    res.status(500).json({ error: 'Failed to fetch GRN' });
  }
});

// ─── GET items from a Delivery Note for GRN (with item descriptions) ───────────
router.get('/items-lookup/:delivery_note_no', async (req, res) => {
  const { delivery_note_no } = req.params;
  try {
    const result = await pool.query(
      `SELECT
         dni.item_code,
         dni.quantity,
         dni.rate_per_piece,
         i.description,
         i.drawing_number
       FROM delivery_note_items dni
       LEFT JOIN items i ON dni.item_code = i.item_code
       WHERE dni.delivery_note_no = $1
       ORDER BY dni.id`,
      [delivery_note_no]
    );
    res.json({ items: result.rows });
  } catch (err) {
    console.error('Error fetching GRN items lookup:', err.message);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

// ─── CREATE a GRN ─────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const {
    grn_no,
    delivery_note_no,
    trade_id,
    grn_date,
    has_rejection,
    rejection_items
  } = req.body || {};

  if (!grn_no || !delivery_note_no || !trade_id || !grn_date) {
    return res.status(400).json({ error: 'Missing required GRN fields: grn_no, delivery_note_no, trade_id, grn_date' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Check duplicate
    const dup = await client.query('SELECT grn_no FROM grns WHERE grn_no = $1', [grn_no]);
    if (dup.rows.length > 0) {
      throw new Error('GRN number already exists');
    }

    // 2. Verify delivery note exists
    const dnCheck = await client.query('SELECT delivery_note_no FROM delivery_notes WHERE delivery_note_no = $1', [delivery_note_no]);
    if (dnCheck.rows.length === 0) {
      throw new Error('Delivery Note not found');
    }

    // 3. Insert GRN
    await client.query(
      `INSERT INTO grns (grn_no, delivery_note_no, trade_id, grn_date, has_rejection, rejection_items)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        grn_no,
        delivery_note_no,
        trade_id,
        grn_date,
        has_rejection || false,
        JSON.stringify(rejection_items || [])
      ]
    );

    // 4. Append to trade documents
    await appendDocToTrade(client, trade_id, 'GRN', grn_no);

    await client.query('COMMIT');
    res.status(201).json({ grn_no, trade_id });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating GRN:', err.message);
    res.status(500).json({ error: err.message || 'Failed to create GRN' });
  } finally {
    client.release();
  }
});

// ─── UPDATE an existing GRN ───────────────────────────────────────────────────
router.put('/:grn_no', async (req, res) => {
  const { grn_no } = req.params;
  const { grn_date, has_rejection, rejection_items } = req.body || {};

  if (!grn_date) {
    return res.status(400).json({ error: 'grn_date is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `UPDATE grns
       SET grn_date = $1, has_rejection = $2, rejection_items = $3
       WHERE grn_no = $4 RETURNING *`,
      [grn_date, has_rejection || false, JSON.stringify(rejection_items || []), grn_no]
    );

    if (result.rows.length === 0) {
      throw new Error('GRN not found');
    }

    await client.query('COMMIT');
    res.json({ grn_no });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating GRN:', err.message);
    res.status(500).json({ error: err.message || 'Failed to update GRN' });
  } finally {
    client.release();
  }
});

module.exports = router;
