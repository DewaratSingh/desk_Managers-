const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Get all RFQs
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.rfq_no, r.rfq_date, r.commercial_bid_due_date, r.technical_bid_due_date, r.buyer_id, b.name as buyer_name, b.email as buyer_email, b.phone as buyer_phone, r.customer_id, c.name as customer_name, r.status, r.trade_id, r.created_at,
             COALESCE(
               (
                 SELECT json_agg(
                   json_build_object(
                     'item_code', ri.item_code,
                     'quantity', ri.quantity,
                     'unit', ri.unit,
                     'description', i.description,
                     'drawing_number', i.drawing_number
                   )
                 )
                 FROM rfq_items ri
                 LEFT JOIN items i ON ri.item_code = i.item_code
                 WHERE ri.rfq_no = r.rfq_no
               ),
               '[]'
             ) as items
      FROM rfqs r
      LEFT JOIN buyers b ON r.buyer_id = b.id
      LEFT JOIN customers c ON r.customer_id = c.id
      ORDER BY r.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching rfqs:', err.message);
    res.status(500).json({ error: 'Failed to fetch RFQs' });
  }
});

// Create an RFQ
router.post('/', async (req, res) => {
  const { rfq_no, rfq_date, commercial_bid_due_date, technical_bid_due_date, buyer_id, customer_id, items } = req.body || {};
  if (!rfq_no || !rfq_date || !commercial_bid_due_date || !technical_bid_due_date || !buyer_id || !customer_id) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Check duplicate rfq_no
    const dupCheck = await client.query('SELECT rfq_no FROM rfqs WHERE rfq_no = $1', [rfq_no]);
    if (dupCheck.rows.length > 0) {
      throw new Error('RFQ number already exists');
    }

    // Generate trade_id
    const trade_id = 'TRD-' + rfq_no.replace(/\s+/g, '-');

    // Check duplicate trade_id
    const tradeDupCheck = await client.query('SELECT trade_id FROM trades WHERE trade_id = $1', [trade_id]);
    if (tradeDupCheck.rows.length > 0) {
      throw new Error('Trade ID already exists for this RFQ');
    }

    // Insert trade document
    await client.query(
      "INSERT INTO trades (trade_id, status, trade_type, documents) VALUES ($1, 'rfq', 'sell', $2)",
      [trade_id, JSON.stringify([{ type: 'RFQ', id: rfq_no }])]
    );

    // Insert RFQ
    await client.query(
      'INSERT INTO rfqs (rfq_no, rfq_date, commercial_bid_due_date, technical_bid_due_date, buyer_id, customer_id, status, trade_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [rfq_no, rfq_date, commercial_bid_due_date, technical_bid_due_date, buyer_id, customer_id, 'rfq', trade_id]
    );

    // Insert RFQ Items
    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        await client.query(
          'INSERT INTO rfq_items (rfq_no, item_code, quantity, unit) VALUES ($1, $2, $3, $4)',
          [rfq_no, item.item_code, parseInt(item.quantity) || 1, item.unit || 'Piece']
        );
      }
    }

    await client.query('COMMIT');

    res.status(201).json({ rfq_no, trade_id });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating RFQ:', err.message);
    res.status(500).json({ error: err.message || 'Failed to create RFQ' });
  } finally {
    client.release();
  }
});

// Get a single RFQ
router.get('/:rfq_no', async (req, res) => {
  const { rfq_no } = req.params;
  try {
    const result = await pool.query(`
      SELECT r.rfq_no, r.rfq_date, r.commercial_bid_due_date, r.technical_bid_due_date, r.buyer_id, b.name as buyer_name, b.email as buyer_email, b.phone as buyer_phone, r.customer_id, c.name as customer_name, r.status, r.trade_id, r.created_at,
             COALESCE(
               json_agg(
                 json_build_object(
                   'item_code', ri.item_code,
                   'quantity', ri.quantity,
                   'unit', ri.unit,
                   'description', i.description,
                   'drawing_number', i.drawing_number
                 )
               ) FILTER (WHERE ri.item_code IS NOT NULL),
               '[]'
             ) as items
      FROM rfqs r
      LEFT JOIN buyers b ON r.buyer_id = b.id
      LEFT JOIN customers c ON r.customer_id = c.id
      LEFT JOIN rfq_items ri ON r.rfq_no = ri.rfq_no
      LEFT JOIN items i ON ri.item_code = i.item_code
      WHERE r.rfq_no = $1
      GROUP BY r.rfq_no, b.name, b.email, b.phone, c.name
    `, [rfq_no]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'RFQ not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching rfq:', err.message);
    res.status(500).json({ error: 'Failed to fetch RFQ' });
  }
});

// Update an RFQ
router.put('/:rfq_no', async (req, res) => {
  const { rfq_no } = req.params;
  const { rfq_date, commercial_bid_due_date, technical_bid_due_date, buyer_id, customer_id, items } = req.body || {};
  if (!rfq_date || !commercial_bid_due_date || !technical_bid_due_date || !buyer_id || !customer_id) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Update RFQ
    const updateResult = await client.query(
      'UPDATE rfqs SET rfq_date = $1, commercial_bid_due_date = $2, technical_bid_due_date = $3, buyer_id = $4, customer_id = $5 WHERE rfq_no = $6 RETURNING *',
      [rfq_date, commercial_bid_due_date, technical_bid_due_date, buyer_id, customer_id, rfq_no]
    );
    if (updateResult.rows.length === 0) {
      throw new Error('RFQ not found');
    }

    // Delete items
    await client.query('DELETE FROM rfq_items WHERE rfq_no = $1', [rfq_no]);

    // Insert new items
    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        await client.query(
          'INSERT INTO rfq_items (rfq_no, item_code, quantity, unit) VALUES ($1, $2, $3, $4)',
          [rfq_no, item.item_code, parseInt(item.quantity) || 1, item.unit || 'Piece']
        );
      }
    }

    await client.query('COMMIT');

    res.json({ rfq_no });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating RFQ:', err.message);
    res.status(500).json({ error: err.message || 'Failed to update RFQ' });
  } finally {
    client.release();
  }
});

module.exports = router;
