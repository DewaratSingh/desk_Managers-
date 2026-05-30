const express = require('express');
const { pool } = require('../db');

const router = express.Router();

// Get all RFQs — each row includes an `items` array
router.get('/', async (req, res) => {
  const { search } = req.query;
  const limit = parseInt(req.query.limit) || 20;
  const offset = parseInt(req.query.offset) || 0;

  try {
    let whereClause = '';
    let values = [limit, offset];

    if (search) {
      whereClause = `WHERE r.rfq_no ILIKE $3 OR b.name ILIKE $3 OR r.customer_id ILIKE $3`;
      values = [limit, offset, `%${search}%`];
    }

    const queryText = `
      SELECT r.*,
        b.name AS buyer_name, b.email AS buyer_email, b.phone AS buyer_phone,
        c.name AS customer_name, c.address AS customer_address,
        COALESCE(
          json_agg(
            json_build_object(
              'item_code', ri.item_code,
              'description', i.description,
              'drawing_number', i.drawing_number,
              'quantity', ri.quantity
            ) ORDER BY ri.id
          ) FILTER (WHERE ri.item_code IS NOT NULL),
          '[]'
        ) AS items
      FROM rfqs r
      LEFT JOIN buyers b ON r.buyer_id = b.id
      LEFT JOIN customers c ON r.customer_id = c.id
      LEFT JOIN rfq_items ri ON r.rfq_no = ri.rfq_no
      LEFT JOIN items i ON ri.item_code = i.item_code
      ${whereClause}
      GROUP BY r.rfq_no, b.name, b.email, b.phone, c.name, c.address
      ORDER BY r.created_at DESC
      LIMIT $1 OFFSET $2
    `;
    const { rows } = await pool.query(queryText, values);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching RFQs:', error);
    res.status(500).json({ error: 'Server error fetching RFQs' });
  }
});

// Add new RFQ — inserts RFQ then rfq_items in a single transaction
router.post('/', async (req, res) => {
  const {
    rfq_no, rfq_date, commercial_bid_due_date, technical_bid_due_date,
    buyer_id, buyer_name, buyer_email, buyer_phone, customer_id,
    items = []
  } = req.body;

  if (!rfq_no || !rfq_date || !commercial_bid_due_date || !technical_bid_due_date) {
    return res.status(400).json({ error: 'RFQ No., RFQ Date, Commercial Bid Due Date, and Technical Bid Due Date are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const rfqResult = await client.query(`
      INSERT INTO rfqs (rfq_no, rfq_date, commercial_bid_due_date, technical_bid_due_date,
        buyer_id, customer_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      rfq_no.trim(), rfq_date, commercial_bid_due_date, technical_bid_due_date,
      buyer_id || null, customer_id || null
    ]);

    // Validate and insert associated items
    for (const item of items) {
      const qty = parseInt(item.quantity);
      if (isNaN(qty) || qty <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Quantity is compulsory and must be greater than 0 for item ${item.item_code}` });
      }

      await client.query(`
        INSERT INTO rfq_items (rfq_no, item_code, quantity)
        VALUES ($1, $2, $3)
        ON CONFLICT (rfq_no, item_code) DO NOTHING
      `, [rfq_no.trim(), item.item_code, qty]);
    }

    await client.query('COMMIT');

    // Return RFQ with items array
    const { rows } = await pool.query(`
      SELECT r.*,
        b.name AS buyer_name, b.email AS buyer_email, b.phone AS buyer_phone,
        COALESCE(
          json_agg(json_build_object('item_code', ri.item_code, 'description', i.description, 'drawing_number', i.drawing_number, 'quantity', ri.quantity) ORDER BY ri.id)
          FILTER (WHERE ri.item_code IS NOT NULL), '[]'
        ) AS items
      FROM rfqs r
      LEFT JOIN buyers b ON r.buyer_id = b.id
      LEFT JOIN customers c ON r.customer_id = c.id
      LEFT JOIN rfq_items ri ON r.rfq_no = ri.rfq_no
      LEFT JOIN items i ON ri.item_code = i.item_code
      WHERE r.rfq_no = $1 GROUP BY r.rfq_no, b.name, b.email, b.phone, c.name, c.address
    `, [rfq_no.trim()]);

    res.status(201).json(rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating RFQ:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'An RFQ with this RFQ No. already exists' });
    }
    res.status(500).json({ error: 'Server error creating RFQ' });
  } finally {
    client.release();
  }
});

// Update RFQ — replaces rfq_items entirely in a transaction
router.put('/:rfq_no', async (req, res) => {
  const { rfq_no } = req.params;
  const {
    rfq_date, commercial_bid_due_date, technical_bid_due_date,
    buyer_id, buyer_name, buyer_email, buyer_phone, customer_id,
    items = []
  } = req.body;

  if (!rfq_date || !commercial_bid_due_date || !technical_bid_due_date) {
    return res.status(400).json({ error: 'RFQ Date, Commercial Bid Due Date, and Technical Bid Due Date are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const rfqResult = await client.query(`
      UPDATE rfqs SET
        rfq_date = $1, commercial_bid_due_date = $2, technical_bid_due_date = $3,
        buyer_id = $4, customer_id = $5
      WHERE rfq_no = $6 RETURNING *
    `, [
      rfq_date, commercial_bid_due_date, technical_bid_due_date,
      buyer_id || null, customer_id || null, rfq_no
    ]);

    if (rfqResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'RFQ not found' });
    }

    // Validate and replace all items
    await client.query('DELETE FROM rfq_items WHERE rfq_no = $1', [rfq_no]);
    for (const item of items) {
      const qty = parseInt(item.quantity);
      if (isNaN(qty) || qty <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Quantity is compulsory and must be greater than 0 for item ${item.item_code}` });
      }

      await client.query(`
        INSERT INTO rfq_items (rfq_no, item_code, quantity)
        VALUES ($1, $2, $3)
      `, [rfq_no, item.item_code, qty]);
    }

    await client.query('COMMIT');

    // Return updated RFQ with items
    const { rows } = await pool.query(`
      SELECT r.*,
        b.name AS buyer_name, b.email AS buyer_email, b.phone AS buyer_phone,
        c.name AS customer_name, c.address AS customer_address,
        COALESCE(
          json_agg(json_build_object('item_code', ri.item_code, 'description', i.description, 'drawing_number', i.drawing_number, 'quantity', ri.quantity) ORDER BY ri.id)
          FILTER (WHERE ri.item_code IS NOT NULL), '[]'
        ) AS items
      FROM rfqs r
      LEFT JOIN buyers b ON r.buyer_id = b.id
      LEFT JOIN customers c ON r.customer_id = c.id
      LEFT JOIN rfq_items ri ON r.rfq_no = ri.rfq_no
      LEFT JOIN items i ON ri.item_code = i.item_code
      WHERE r.rfq_no = $1 GROUP BY r.rfq_no, b.name, b.email, b.phone, c.name, c.address
    `, [rfq_no]);

    res.json(rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating RFQ:', error);
    res.status(500).json({ error: 'Server error updating RFQ' });
  } finally {
    client.release();
  }
});

module.exports = router;
