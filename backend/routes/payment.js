const express = require('express');
const router = express.Router();
const { pool, appendDocToTrade } = require('../db');

// ─── GET a single Payment by payment_no ───────────────────────────────────────
router.get('/:payment_no', async (req, res) => {
  const { payment_no } = req.params;
  try {
    const result = await pool.query(
      `SELECT payment_no, delivery_note_no, trade_id, payment_date, total_amount, po_no, ro_no, note, created_at
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
    total_amount,
    note
  } = req.body || {};

  if (!payment_no || !trade_id || !payment_date || total_amount === undefined) {
    return res.status(400).json({ error: 'Missing required fields: payment_no, trade_id, payment_date, total_amount' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check duplicate
    const dup = await client.query('SELECT payment_no FROM payments WHERE payment_no = $1', [payment_no]);
    if (dup.rows.length > 0) throw new Error('Payment number already exists');

    // Resolve po_no / ro_no from delivery note or trade directly
    let po_no = null;
    let ro_no = null;
    if (delivery_note_no) {
      const dnRes = await client.query('SELECT po_no, ro_no FROM delivery_notes WHERE delivery_note_no = $1', [delivery_note_no]);
      if (dnRes.rows.length > 0) {
        po_no = dnRes.rows[0].po_no;
        ro_no = dnRes.rows[0].ro_no;
      }
    }
    if (!po_no && !ro_no) {
      const poRes = await client.query('SELECT po_no FROM purchase_orders WHERE trade_id = $1 LIMIT 1', [trade_id]);
      if (poRes.rows.length > 0) {
        po_no = poRes.rows[0].po_no;
      } else {
        const roRes = await client.query('SELECT ro_no FROM release_orders WHERE trade_id = $1 LIMIT 1', [trade_id]);
        if (roRes.rows.length > 0) {
          ro_no = roRes.rows[0].ro_no;
        }
      }
    }

    // Insert
    await client.query(
      `INSERT INTO payments (payment_no, delivery_note_no, trade_id, payment_date, total_amount, po_no, ro_no, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [payment_no, delivery_note_no || null, trade_id, payment_date, parseFloat(total_amount) || 0, po_no || null, ro_no || null, note || null]
    );

    // Append to trade documents
    await appendDocToTrade(client, trade_id, 'PAYMENT', payment_no);

    // Update trade payment status based on whether it is fully paid
    await updateTradePaymentStatus(client, trade_id);

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
  const { payment_date, total_amount, note } = req.body || {};

  if (!payment_date || total_amount === undefined) {
    return res.status(400).json({ error: 'payment_date and total_amount are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE payments SET payment_date = $1, total_amount = $2, note = $3 WHERE payment_no = $4 RETURNING *`,
      [payment_date, parseFloat(total_amount) || 0, note || null, payment_no]
    );
    if (result.rows.length === 0) throw new Error('Payment not found');

    // Update trade payment status based on whether it is fully paid
    const updatedPayment = result.rows[0];
    if (updatedPayment.trade_id) {
      await updateTradePaymentStatus(client, updatedPayment.trade_id);
    }

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

async function updateTradePaymentStatus(client, trade_id) {
  if (!trade_id) return;

  const res = await client.query(`
    SELECT 
      COALESCE(
        (SELECT (basic_value + packing_forward + transport + other + gst + COALESCE((SELECT SUM(quantity * unit_price) FROM purchase_order_items WHERE po_no = po.po_no), 0)) FROM purchase_orders po WHERE po.trade_id = $1 LIMIT 1),
        (SELECT (basic_value + packing_forward + transport + other + gst + COALESCE((SELECT SUM(quantity * unit_price) FROM release_order_items WHERE ro_no = ro.ro_no), 0)) FROM release_orders ro WHERE ro.trade_id = $1 LIMIT 1),
        0
      )::numeric AS expected_total,
      COALESCE(
        (SELECT SUM(total_amount) FROM payments WHERE trade_id = $1),
        0
      )::numeric AS paid_total
  `, [trade_id]);

  if (res.rows.length > 0) {
    const expected = parseFloat(res.rows[0].expected_total) || 0;
    const paid = parseFloat(res.rows[0].paid_total) || 0;

    if (expected > 0 && paid >= expected - 0.01) {
      await client.query(
        "INSERT INTO status (name) VALUES ('payed') ON CONFLICT (name) DO NOTHING"
      );
      await client.query(
        "UPDATE trades SET status = 'payed' WHERE trade_id = $1",
        [trade_id]
      );
    }
  }
}

module.exports = router;
