const express = require('express');
const router = express.Router();
const { pool, appendDocToTrade } = require('../db');

// GET a single Payment by payment_no
router.get('/:payment_no', async (req, res) => {
  const { payment_no } = req.params;
  try {
    const result = await pool.query(
      `SELECT p.payment_no, dn.delivery_note_no, t.trade_id, p.payment_date, p.total_amount, po.po_no, ro.ro_no, p.note, p.created_at
       FROM payments p
       LEFT JOIN delivery_notes dn ON p.delivery_note_id = dn.id
       LEFT JOIN trades t ON p.trade_id = t.id
       LEFT JOIN purchase_orders po ON p.po_id = po.id
       LEFT JOIN release_orders ro ON p.ro_id = ro.id
       WHERE p.payment_no = $1 AND p.company_id = $2`,
      [payment_no, req.user.company_id]
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

// CREATE a Payment
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
    const dup = await client.query('SELECT payment_no FROM payments WHERE payment_no = $1 AND company_id = $2', [payment_no, req.user.company_id]);
    if (dup.rows.length > 0) throw new Error('Payment number already exists');

    // Resolve trade details
    const tradeRes = await client.query('SELECT id, trade_id FROM trades WHERE trade_id = $1 AND company_id = $2', [trade_id, req.user.company_id]);
    if (tradeRes.rows.length === 0) {
      throw new Error('Trade not found');
    }
    const tradeDbId = tradeRes.rows[0].id;
    const trade_code = tradeRes.rows[0].trade_id;

    // Resolve po_id / ro_id from delivery note or trade directly checking company_id
    let poDbId = null;
    let roDbId = null;
    let dnDbId = null;
    if (delivery_note_no) {
      const dnRes = await client.query('SELECT id, po_id, ro_id FROM delivery_notes WHERE delivery_note_no = $1 AND company_id = $2', [delivery_note_no, req.user.company_id]);
      if (dnRes.rows.length > 0) {
        dnDbId = dnRes.rows[0].id;
        poDbId = dnRes.rows[0].po_id;
        roDbId = dnRes.rows[0].ro_id;
      }
    }
    if (!poDbId && !roDbId) {
      const poRes = await client.query('SELECT id FROM purchase_orders WHERE trade_id = $1 AND company_id = $2 LIMIT 1', [tradeDbId, req.user.company_id]);
      if (poRes.rows.length > 0) {
        poDbId = poRes.rows[0].id;
      } else {
        const roRes = await client.query('SELECT id FROM release_orders WHERE trade_id = $1 AND company_id = $2 LIMIT 1', [tradeDbId, req.user.company_id]);
        if (roRes.rows.length > 0) {
          roDbId = roRes.rows[0].id;
        }
      }
    }

    // Insert
    await client.query(
      `INSERT INTO payments (payment_no, delivery_note_id, trade_id, payment_date, total_amount, po_id, ro_id, note, company_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [payment_no, dnDbId, tradeDbId, payment_date, parseFloat(total_amount) || 0, poDbId, roDbId, note || null, req.user.company_id]
    );

    // Append to trade documents
    await appendDocToTrade(client, trade_code, 'PAYMENT', payment_no, req.user.company_id);

    // Update trade payment status based on whether it is fully paid
    await updateTradePaymentStatus(client, tradeDbId, req.user.company_id);

    await client.query('COMMIT');
    res.status(201).json({ payment_no, trade_id: trade_code });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating Payment:', err.message);
    res.status(500).json({ error: err.message || 'Failed to create Payment' });
  } finally {
    client.release();
  }
});

// UPDATE a Payment
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
      `UPDATE payments SET payment_date = $1, total_amount = $2, note = $3 WHERE payment_no = $4 AND company_id = $5 RETURNING trade_id`,
      [payment_date, parseFloat(total_amount) || 0, note || null, payment_no, req.user.company_id]
    );
    if (result.rows.length === 0) throw new Error('Payment not found');

    // Update trade payment status based on whether it is fully paid
    const tradeDbId = result.rows[0].trade_id;
    if (tradeDbId) {
      await updateTradePaymentStatus(client, tradeDbId, req.user.company_id);
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

async function updateTradePaymentStatus(client, trade_id, company_id) {
  if (!trade_id) return;

  const res = await client.query(`
    SELECT 
      COALESCE(
        (SELECT (basic_value + packing_forward + transport + other + gst + COALESCE((SELECT SUM(quantity * unit_price) FROM purchase_order_items WHERE po_id = po.id AND company_id = po.company_id), 0)) FROM purchase_orders po WHERE po.trade_id = $1 AND po.company_id = $2 LIMIT 1),
        (SELECT (basic_value + packing_forward + transport + other + gst + COALESCE((SELECT SUM(quantity * unit_price) FROM release_order_items WHERE ro_id = ro.id AND company_id = ro.company_id), 0)) FROM release_orders ro WHERE ro.trade_id = $1 AND ro.company_id = $2 LIMIT 1),
        0
      )::numeric AS expected_total,
      COALESCE(
        (SELECT SUM(total_amount) FROM payments WHERE trade_id = $1 AND company_id = $2),
        0
      )::numeric AS paid_total
  `, [trade_id, company_id]);

  if (res.rows.length > 0) {
    const expected = parseFloat(res.rows[0].expected_total) || 0;
    const paid = parseFloat(res.rows[0].paid_total) || 0;

    if (expected > 0 && paid >= expected - 0.01) {
      await client.query(
        "INSERT INTO status (name, company_id) VALUES ('payed', $1) ON CONFLICT (name, company_id) DO NOTHING",
        [company_id]
      );
      await client.query(
        "UPDATE trades SET status = 'payed' WHERE id = $1 AND company_id = $2",
        [trade_id, company_id]
      );
    }
  }
}

module.exports = router;
