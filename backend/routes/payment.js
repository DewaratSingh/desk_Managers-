const express = require('express');
const router = express.Router();
const { pool, appendDocToTrade } = require('../db');

// ─── GET a single Payment by payment_no ───────────────────────────────────────
router.get('/:payment_no', async (req, res) => {
  const { payment_no } = req.params;
  try {
    const result = await pool.query(
      `SELECT payment_no, delivery_note_no, trade_id, payment_date, total_amount, po_no, ro_no, created_at
       FROM payments WHERE payment_no = $1`,
      [payment_no]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching Payment:', err.message);
    res.status(500).json({ error: 'Failed to fetch Payment' });
  }
});

// ─── CREATE a Payment ─────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const {
    payment_no,
    delivery_note_no,
    trade_id,
    payment_date,
    total_amount
  } = req.body || {};

  if (!payment_no || !delivery_note_no || !trade_id || !payment_date || total_amount === undefined) {
    return res.status(400).json({ error: 'Missing required fields: payment_no, delivery_note_no, trade_id, payment_date, total_amount' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check duplicate
    const dup = await client.query('SELECT payment_no FROM payments WHERE payment_no = $1', [payment_no]);
    if (dup.rows.length > 0) throw new Error('Payment number already exists');

    // Resolve po_no / ro_no from delivery note
    const dnRes = await client.query('SELECT po_no, ro_no FROM delivery_notes WHERE delivery_note_no = $1', [delivery_note_no]);
    if (dnRes.rows.length === 0) throw new Error('Delivery Note not found');
    const { po_no, ro_no } = dnRes.rows[0];

    // Insert
    await client.query(
      `INSERT INTO payments (payment_no, delivery_note_no, trade_id, payment_date, total_amount, po_no, ro_no)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [payment_no, delivery_note_no, trade_id, payment_date, parseFloat(total_amount) || 0, po_no || null, ro_no || null]
    );

    // Append to trade documents
    await appendDocToTrade(client, trade_id, 'PAYMENT', payment_no);

    await client.query('COMMIT');
    res.status(201).json({ payment_no, trade_id });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating Payment:', err.message);
    res.status(500).json({ error: err.message || 'Failed to create Payment' });
  } finally {
    client.release();
  }
});

// ─── UPDATE a Payment ─────────────────────────────────────────────────────────
router.put('/:payment_no', async (req, res) => {
  const { payment_no } = req.params;
  const { payment_date, total_amount } = req.body || {};

  if (!payment_date || total_amount === undefined) {
    return res.status(400).json({ error: 'payment_date and total_amount are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE payments SET payment_date = $1, total_amount = $2 WHERE payment_no = $3 RETURNING *`,
      [payment_date, parseFloat(total_amount) || 0, payment_no]
    );
    if (result.rows.length === 0) throw new Error('Payment not found');
    await client.query('COMMIT');
    res.json({ payment_no });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating Payment:', err.message);
    res.status(500).json({ error: err.message || 'Failed to update Payment' });
  } finally {
    client.release();
  }
});

module.exports = router;
