const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Get items (optional pagination & optional search)
router.get('/', async (req, res) => {
  const { q } = req.query || {};
  const limit = req.query.limit ? parseInt(req.query.limit) : null;
  const offset = req.query.offset ? parseInt(req.query.offset) : 0;
  try {
    let query = `SELECT item_code, description, drawing_number, long_description, created_at FROM items`;
    const params = [];
    
    if (q) {
      query += ` WHERE item_code ILIKE $1 OR description ILIKE $1 OR drawing_number ILIKE $1`;
      params.push(`%${q}%`);
    }
    
    query += ` ORDER BY created_at DESC`;
    
    if (limit !== null) {
      const limitParamIdx = params.length + 1;
      const offsetParamIdx = params.length + 2;
      query += ` LIMIT $${limitParamIdx} OFFSET $${offsetParamIdx}`;
      params.push(limit, offset);
    }
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching items:', err.message);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

// Create an item
router.post('/', async (req, res) => {
  const { item_code, description, drawing_number, long_description } = req.body || {};
  if (!item_code || !description) return res.status(400).json({ error: 'item_code and description required' });
  try {
    const result = await pool.query(
      'INSERT INTO items (item_code, description, drawing_number, long_description) VALUES ($1, $2, $3, $4) ON CONFLICT (item_code) DO NOTHING RETURNING *',
      [item_code, description, drawing_number, long_description]
    );
    if (result.rows.length === 0) return res.status(400).json({ error: 'Item code already exists' });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating item:', err.message);
    res.status(500).json({ error: 'Failed to create item' });
  }
});

// Update an item
router.put('/:item_code', async (req, res) => {
  const { item_code } = req.params;
  const { description, drawing_number, long_description } = req.body || {};
  if (!description) return res.status(400).json({ error: 'description required' });
  try {
    const result = await pool.query(
      'UPDATE items SET description = $1, drawing_number = $2, long_description = $3 WHERE item_code = $4 RETURNING *',
      [description, drawing_number, long_description, item_code]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Item not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating item:', err.message);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// Get history of an item (prices, dates, buyers, customers)
router.get('/:item_code/history', async (req, res) => {
  const { item_code } = req.params;
  const { exclude_rfq } = req.query || {};
  try {
    let query = `
      SELECT source, buyer_name, customer_id, date, status, unit_price, trade_type, trade_id
      FROM (
        SELECT 
          'Quotation' as source,
          b.name as buyer_name,
          r.customer_id,
          q.quotation_date as date,
          COALESCE(t.status, q.status) as status,
          qi.unit_price,
          COALESCE(t.trade_type, 'sell') as trade_type,
          r.trade_id
        FROM quotation_items qi
        JOIN quotations q ON qi.quotation_no = q.quotation_no
        JOIN rfqs r ON q.rfq_no = r.rfq_no
        LEFT JOIN buyers b ON r.buyer_id = b.id
        LEFT JOIN trades t ON r.trade_id = t.trade_id
        WHERE qi.item_code = $1
    `;
    const params = [item_code];
    if (exclude_rfq) {
      query += ` AND r.rfq_no <> $2`;
      params.push(exclude_rfq);
    }
    
    query += `
        UNION ALL

        SELECT 
          'Received Quotation' as source,
          b.name as buyer_name,
          rq.customer_id,
          rq.quotation_date as date,
          COALESCE(t.status, 'active') as status,
          rqi.unit_price,
          COALESCE(t.trade_type, 'buy') as trade_type,
          rq.trade_id
        FROM received_quotation_items rqi
        JOIN received_quotations rq ON rqi.received_quotation_no = rq.received_quotation_no
        LEFT JOIN buyers b ON rq.buyer_id = b.id
        LEFT JOIN trades t ON rq.trade_id = t.trade_id
        WHERE rqi.item_code = $1
      ) as history
      ORDER BY date DESC
      LIMIT 15
    `;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching item history:', err.message);
    res.status(500).json({ error: 'Failed to fetch item history' });
  }
});

module.exports = router;
