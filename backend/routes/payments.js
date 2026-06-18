const express = require('express');
const { pool } = require('../db');

const router = express.Router();

// Get all payments
router.get('/', async (req, res) => {
  const { search } = req.query;
  const limit = parseInt(req.query.limit) || 20;
  const offset = parseInt(req.query.offset) || 0;

  try {
    let queryText = 'SELECT * FROM payments';
    let values = [limit, offset];

    if (search) {
      queryText += ' WHERE payment_no ILIKE $3 OR po_no ILIKE $3 OR ro_no ILIKE $3';
      values = [limit, offset, `%${search}%`];
    }

    queryText += ' ORDER BY created_at DESC LIMIT $1 OFFSET $2';
    const { rows } = await pool.query(queryText, values);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ error: 'Server error fetching payments' });
  }
});

// Add a new payment
router.post('/', async (req, res) => {
  const { payment_no, po_no, ro_no, total_amount, trade_id: bodyTradeId } = req.body;

  if (!payment_no || !payment_no.trim()) {
    return res.status(400).json({ error: 'Payment Number is required' });
  }

  const amt = parseFloat(total_amount);
  if (isNaN(amt) || amt < 0) {
    return res.status(400).json({ error: 'Total Amount is required and must be at least 0' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Auto-resolve trade_id from po_no or ro_no if not passed
    let trade_id = bodyTradeId;
    if (!trade_id) {
      if (po_no) {
        const poRes = await client.query('SELECT trade_id FROM purchase_orders WHERE po_no = $1', [po_no]);
        if (poRes.rows.length > 0) {
          trade_id = poRes.rows[0].trade_id;
        }
      } else if (ro_no) {
        const roRes = await client.query('SELECT trade_id FROM release_orders WHERE ro_no = $1', [ro_no]);
        if (roRes.rows.length > 0) {
          trade_id = roRes.rows[0].trade_id;
        }
      }
    }

    // Check if duplicate
    const checkDup = await client.query('SELECT payment_no FROM payments WHERE payment_no = $1', [payment_no.trim()]);
    if (checkDup.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Payment Number already exists' });
    }

    const { rows } = await client.query(
      'INSERT INTO payments (payment_no, po_no, ro_no, total_amount, trade_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [payment_no.trim(), po_no || null, ro_no || null, amt, trade_id || null]
    );

    // Link document in trades table
    if (trade_id) {
      const { appendDocToTrade } = require('../db');
      await appendDocToTrade(client, trade_id, 'PAYMENT', payment_no.trim());
    }

    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating payment:', error);
    res.status(500).json({ error: 'Server error creating payment' });
  } finally {
    client.release();
  }
});

// Delete a payment
router.delete('/:payment_no', async (req, res) => {
  const { payment_no } = req.params;

  try {
    const { rowCount } = await pool.query('DELETE FROM payments WHERE payment_no = $1', [payment_no]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    res.json({ success: true, message: 'Payment successfully deleted' });
  } catch (error) {
    console.error('Error deleting payment:', error);
    res.status(500).json({ error: 'Server error deleting payment' });
  }
});

module.exports = router;
