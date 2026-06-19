const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Get all received quotations or search them
router.get('/', async (req, res) => {
  const { q } = req.query;
  try {
    let query = `
      SELECT rq.received_quotation_no, rq.buyer_id, rq.customer_id, rq.quotation_date, rq.terms_and_conditions, rq.trade_id, rq.created_at,
             b.name as buyer_name, c.name as customer_name,
             (
               SELECT COALESCE(json_agg(json_build_object(
                 'item_code', rqi.item_code,
                 'quantity', rqi.quantity,
                 'unit_price', rqi.unit_price,
                 'description', i.description,
                 'drawing_number', i.drawing_number
               )), '[]')
               FROM received_quotation_items rqi
               LEFT JOIN items i ON rqi.item_code = i.item_code
               WHERE rqi.received_quotation_no = rq.received_quotation_no
             ) as items
      FROM received_quotations rq
      LEFT JOIN buyers b ON rq.buyer_id = b.id
      LEFT JOIN customers c ON rq.customer_id = c.id
    `;
    const params = [];
    if (q) {
      query += ` WHERE rq.received_quotation_no ILIKE $1 OR b.name ILIKE $1 OR c.name ILIKE $1`;
      params.push(`%${q}%`);
    }
    query += ` ORDER BY rq.created_at DESC LIMIT 50`;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching received quotations:', err.message);
    res.status(500).json({ error: 'Failed to fetch received quotations' });
  }
});

// Get a single received quotation
router.get('/:received_quotation_no', async (req, res) => {
  const { received_quotation_no } = req.params;
  try {
    const query = `
      SELECT rq.received_quotation_no, rq.buyer_id, rq.customer_id, rq.quotation_date, rq.terms_and_conditions, rq.trade_id, rq.created_at,
             b.name as buyer_name, b.email as buyer_email, b.phone as buyer_phone,
             c.name as customer_name,
             (
               SELECT COALESCE(json_agg(json_build_object(
                 'item_code', rqi.item_code,
                 'quantity', rqi.quantity,
                 'unit_price', rqi.unit_price,
                 'description', i.description,
                 'drawing_number', i.drawing_number
               )), '[]')
               FROM received_quotation_items rqi
               LEFT JOIN items i ON rqi.item_code = i.item_code
               WHERE rqi.received_quotation_no = rq.received_quotation_no
             ) as items
      FROM received_quotations rq
      LEFT JOIN buyers b ON rq.buyer_id = b.id
      LEFT JOIN customers c ON rq.customer_id = c.id
      WHERE rq.received_quotation_no = $1
    `;
    const result = await pool.query(query, [received_quotation_no]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Received quotation not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching received quotation:', err.message);
    res.status(500).json({ error: 'Failed to fetch received quotation' });
  }
});

// Create a new received quotation
router.post('/', async (req, res) => {
  const { received_quotation_no, buyer_id, customer_id, quotation_date, terms_and_conditions, items } = req.body || {};
  if (!received_quotation_no || !buyer_id || !customer_id || !quotation_date) {
    return res.status(400).json({ error: 'received_quotation_no, buyer_id, customer_id and quotation_date are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const final_rq_no = received_quotation_no;

    // Check duplicate received_quotation_no
    const dupCheck = await client.query('SELECT received_quotation_no FROM received_quotations WHERE received_quotation_no = $1', [final_rq_no]);
    if (dupCheck.rows.length > 0) {
      throw new Error('Received Quotation number already exists');
    }

    // Generate trade_id
    const trade_id = 'TRD-' + final_rq_no.replace(/\s+/g, '-');

    // Check duplicate trade_id
    const tradeDupCheck = await client.query('SELECT trade_id FROM trades WHERE trade_id = $1', [trade_id]);
    if (tradeDupCheck.rows.length > 0) {
      throw new Error('Trade ID already exists for this quotation');
    }

    // Insert trade document
    await client.query(
      "INSERT INTO trades (trade_id, status, trade_type, documents) VALUES ($1, 'quotation', 'buy', $2)",
      [trade_id, JSON.stringify([{ type: 'RECEIVED_QUOTATION', id: final_rq_no }])]
    );

    // Insert Received Quotation
    await client.query(
      'INSERT INTO received_quotations (received_quotation_no, buyer_id, customer_id, quotation_date, terms_and_conditions, trade_id) VALUES ($1, $2, $3, $4, $5, $6)',
      [final_rq_no, buyer_id, customer_id, quotation_date, terms_and_conditions, trade_id]
    );

    // Insert Items
    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        await client.query(
          'INSERT INTO received_quotation_items (received_quotation_no, item_code, quantity, unit_price) VALUES ($1, $2, $3, $4)',
          [final_rq_no, item.item_code, parseInt(item.quantity) || 1, parseFloat(item.unit_price) || 0]
        );
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ received_quotation_no: final_rq_no, trade_id });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating received quotation:', err.message);
    res.status(500).json({ error: err.message || 'Failed to create received quotation' });
  } finally {
    client.release();
  }
});

// Update a received quotation
router.put('/:received_quotation_no', async (req, res) => {
  const { received_quotation_no } = req.params;
  const { buyer_id, customer_id, quotation_date, terms_and_conditions, items } = req.body || {};
  if (!buyer_id || !customer_id || !quotation_date) {
    return res.status(400).json({ error: 'buyer_id, customer_id and quotation_date are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Update received quotation
    const updateResult = await client.query(
      'UPDATE received_quotations SET buyer_id = $1, customer_id = $2, quotation_date = $3, terms_and_conditions = $4 WHERE received_quotation_no = $5 RETURNING *',
      [buyer_id, customer_id, quotation_date, terms_and_conditions, received_quotation_no]
    );
    if (updateResult.rows.length === 0) {
      throw new Error('Received quotation not found');
    }

    // Delete existing items
    await client.query('DELETE FROM received_quotation_items WHERE received_quotation_no = $1', [received_quotation_no]);

    // Insert new items
    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        await client.query(
          'INSERT INTO received_quotation_items (received_quotation_no, item_code, quantity, unit_price) VALUES ($1, $2, $3, $4)',
          [received_quotation_no, item.item_code, parseInt(item.quantity) || 1, parseFloat(item.unit_price) || 0]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ received_quotation_no });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating received quotation:', err.message);
    res.status(500).json({ error: err.message || 'Failed to update received quotation' });
  } finally {
    client.release();
  }
});

module.exports = router;
