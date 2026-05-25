const express = require('express');
const { pool } = require('../db');

const router = express.Router();

// Get all RFQs — each row includes an `items` array
router.get('/', async (req, res) => {
  const { search } = req.query;
  try {
    let whereClause = '';
    let values = [];

    if (search) {
      whereClause = `WHERE r.rfq_no ILIKE $1 OR r.buyer_name ILIKE $1 OR r.customer_id ILIKE $1`;
      values = [`%${search}%`];
    }

    const queryText = `
      SELECT r.*,
        COALESCE(
          json_agg(
            json_build_object(
              'item_code', ri.item_code,
              'description', ri.description,
              'drawing_number', ri.drawing_number,
              'quantity', ri.quantity
            ) ORDER BY ri.id
          ) FILTER (WHERE ri.item_code IS NOT NULL),
          '[]'
        ) AS items
      FROM rfqs r
      LEFT JOIN rfq_items ri ON r.rfq_no = ri.rfq_no
      ${whereClause}
      GROUP BY r.rfq_no
      ORDER BY r.created_at DESC
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
        buyer_id, buyer_name, buyer_email, buyer_phone, customer_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      rfq_no.trim(), rfq_date, commercial_bid_due_date, technical_bid_due_date,
      buyer_id || null, buyer_name || null, buyer_email || null,
      buyer_phone || null, customer_id || null
    ]);

    // Validate and insert associated items
    for (const item of items) {
      const qty = parseInt(item.quantity);
      if (isNaN(qty) || qty <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Quantity is compulsory and must be greater than 0 for item ${item.item_code}` });
      }

      await client.query(`
        INSERT INTO rfq_items (rfq_no, item_code, description, drawing_number, quantity)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (rfq_no, item_code) DO NOTHING
      `, [rfq_no.trim(), item.item_code, item.description || null, item.drawing_number || null, qty]);
    }

    await client.query('COMMIT');

    // Return RFQ with items array
    const { rows } = await pool.query(`
      SELECT r.*,
        COALESCE(
          json_agg(json_build_object('item_code', ri.item_code, 'description', ri.description, 'drawing_number', ri.drawing_number, 'quantity', ri.quantity) ORDER BY ri.id)
          FILTER (WHERE ri.item_code IS NOT NULL), '[]'
        ) AS items
      FROM rfqs r LEFT JOIN rfq_items ri ON r.rfq_no = ri.rfq_no
      WHERE r.rfq_no = $1 GROUP BY r.rfq_no
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
        buyer_id = $4, buyer_name = $5, buyer_email = $6,
        buyer_phone = $7, customer_id = $8
      WHERE rfq_no = $9 RETURNING *
    `, [
      rfq_date, commercial_bid_due_date, technical_bid_due_date,
      buyer_id || null, buyer_name || null, buyer_email || null,
      buyer_phone || null, customer_id || null, rfq_no
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
        INSERT INTO rfq_items (rfq_no, item_code, description, drawing_number, quantity)
        VALUES ($1, $2, $3, $4, $5)
      `, [rfq_no, item.item_code, item.description || null, item.drawing_number || null, qty]);
    }

    await client.query('COMMIT');

    // Return updated RFQ with items
    const { rows } = await pool.query(`
      SELECT r.*,
        COALESCE(
          json_agg(json_build_object('item_code', ri.item_code, 'description', ri.description, 'drawing_number', ri.drawing_number, 'quantity', ri.quantity) ORDER BY ri.id)
          FILTER (WHERE ri.item_code IS NOT NULL), '[]'
        ) AS items
      FROM rfqs r LEFT JOIN rfq_items ri ON r.rfq_no = ri.rfq_no
      WHERE r.rfq_no = $1 GROUP BY r.rfq_no
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
