const express = require('express');
const { pool } = require('../db');

const router = express.Router();

// Get all quotations
router.get('/', async (req, res) => {
  const { search } = req.query;
  try {
    let whereClause = '';
    let values = [];

    if (search) {
      whereClause = `WHERE q.quotation_no ILIKE $1 OR q.rfq_no ILIKE $1`;
      values = [`%${search}%`];
    }

    const queryText = `
      SELECT q.*,
        COALESCE(
          json_agg(
            json_build_object(
              'item_code', qi.item_code,
              'description', qi.description,
              'drawing_number', qi.drawing_number,
              'quantity', qi.quantity,
              'unit_price', qi.unit_price
            ) ORDER BY qi.id
          ) FILTER (WHERE qi.item_code IS NOT NULL),
          '[]'
        ) AS items
      FROM quotations q
      LEFT JOIN quotation_items qi ON q.quotation_no = qi.quotation_no
      ${whereClause}
      GROUP BY q.quotation_no
      ORDER BY q.created_at DESC
    `;
    const { rows } = await pool.query(queryText, values);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching quotations:', error);
    res.status(500).json({ error: 'Server error fetching quotations' });
  }
});

// Get next auto-generated quotation number
router.get('/next-no', async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    const prefix = `QTN-${currentYear}-`;
    
    const queryText = `
      SELECT quotation_no FROM quotations 
      WHERE quotation_no LIKE $1 
      ORDER BY quotation_no DESC 
      LIMIT 1
    `;
    const { rows } = await pool.query(queryText, [`${prefix}%`]);
    
    let nextSeq = 1;
    if (rows.length > 0) {
      const lastNo = rows[0].quotation_no;
      const parts = lastNo.split('-');
      const lastSeq = parseInt(parts[parts.length - 1]);
      if (!isNaN(lastSeq)) {
        nextSeq = lastSeq + 1;
      }
    }
    
    const nextNo = `${prefix}${String(nextSeq).padStart(4, '0')}`;
    res.json({ next_no: nextNo });
  } catch (error) {
    console.error('Error generating next quotation number:', error);
    res.status(500).json({ error: 'Server error generating next quotation number' });
  }
});

// Add new quotation
router.post('/', async (req, res) => {
  const {
    rfq_no, quotation_date, terms_and_conditions, items = []
  } = req.body;

  if (!rfq_no || !quotation_date) {
    return res.status(400).json({ error: 'RFQ No. and Quotation Date are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const currentYear = new Date(quotation_date).getFullYear();
    const prefix = `QTN-${currentYear}-`;
    const nextNumResult = await client.query(`
      SELECT quotation_no FROM quotations 
      WHERE quotation_no LIKE $1 
      ORDER BY quotation_no DESC 
      LIMIT 1
    `, [`${prefix}%`]);

    let nextSeq = 1;
    if (nextNumResult.rows.length > 0) {
      const lastNo = nextNumResult.rows[0].quotation_no;
      const parts = lastNo.split('-');
      const lastSeq = parseInt(parts[parts.length - 1]);
      if (!isNaN(lastSeq)) {
        nextSeq = lastSeq + 1;
      }
    }
    const quotation_no = `${prefix}${String(nextSeq).padStart(4, '0')}`;

    // Insert quotation
    await client.query(`
      INSERT INTO quotations (quotation_no, rfq_no, quotation_date, terms_and_conditions)
      VALUES ($1, $2, $3, $4)
    `, [quotation_no, rfq_no, quotation_date, terms_and_conditions || null]);

    // Insert items
    for (const item of items) {
      const price = parseFloat(item.unit_price);
      if (isNaN(price) || price < 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Unit price is required and must be at least 0 for item ${item.item_code}` });
      }
      
      const qty = parseInt(item.quantity);
      if (isNaN(qty) || qty <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Quantity must be greater than 0 for item ${item.item_code}` });
      }

      await client.query(`
        INSERT INTO quotation_items (quotation_no, item_code, description, drawing_number, quantity, unit_price)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (quotation_no, item_code) DO NOTHING
      `, [quotation_no, item.item_code, item.description || null, item.drawing_number || null, qty, price]);
    }

    await client.query('COMMIT');

    const { rows } = await pool.query(`
      SELECT q.*,
        COALESCE(
          json_agg(
            json_build_object(
              'item_code', qi.item_code,
              'description', qi.description,
              'drawing_number', qi.drawing_number,
              'quantity', qi.quantity,
              'unit_price', qi.unit_price
            ) ORDER BY qi.id
          ) FILTER (WHERE qi.item_code IS NOT NULL),
          '[]'
        ) AS items
      FROM quotations q
      LEFT JOIN quotation_items qi ON q.quotation_no = qi.quotation_no
      WHERE q.quotation_no = $1
      GROUP BY q.quotation_no
    `, [quotation_no]);

    res.status(201).json(rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating quotation:', error);
    res.status(500).json({ error: 'Server error creating quotation' });
  } finally {
    client.release();
  }
});

// Update quotation
router.put('/:quotation_no', async (req, res) => {
  const { quotation_no } = req.params;
  const {
    quotation_date, terms_and_conditions, items = []
  } = req.body;

  if (!quotation_date) {
    return res.status(400).json({ error: 'Quotation Date is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const updateResult = await client.query(`
      UPDATE quotations 
      SET quotation_date = $1, terms_and_conditions = $2
      WHERE quotation_no = $3
      RETURNING *
    `, [quotation_date, terms_and_conditions || null, quotation_no]);

    if (updateResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Quotation not found' });
    }

    // Replace items
    await client.query('DELETE FROM quotation_items WHERE quotation_no = $1', [quotation_no]);
    for (const item of items) {
      const price = parseFloat(item.unit_price);
      if (isNaN(price) || price < 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Unit price is required and must be at least 0 for item ${item.item_code}` });
      }
      
      const qty = parseInt(item.quantity);
      if (isNaN(qty) || qty <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Quantity must be greater than 0 for item ${item.item_code}` });
      }

      await client.query(`
        INSERT INTO quotation_items (quotation_no, item_code, description, drawing_number, quantity, unit_price)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [quotation_no, item.item_code, item.description || null, item.drawing_number || null, qty, price]);
    }

    await client.query('COMMIT');

    const { rows } = await pool.query(`
      SELECT q.*,
        COALESCE(
          json_agg(
            json_build_object(
              'item_code', qi.item_code,
              'description', qi.description,
              'drawing_number', qi.drawing_number,
              'quantity', qi.quantity,
              'unit_price', qi.unit_price
            ) ORDER BY qi.id
          ) FILTER (WHERE qi.item_code IS NOT NULL),
          '[]'
        ) AS items
      FROM quotations q
      LEFT JOIN quotation_items qi ON q.quotation_no = qi.quotation_no
      WHERE q.quotation_no = $1
      GROUP BY q.quotation_no
    `, [quotation_no]);

    res.json(rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating quotation:', error);
    res.status(500).json({ error: 'Server error updating quotation' });
  } finally {
    client.release();
  }
});

module.exports = router;
