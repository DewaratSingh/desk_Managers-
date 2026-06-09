const express = require('express');
const { pool } = require('../db');

const router = express.Router();

// Get all received quotations
router.get('/', async (req, res) => {
  const { search } = req.query;
  const limit = parseInt(req.query.limit) || 20;
  const offset = parseInt(req.query.offset) || 0;

  try {
    let whereClause = '';
    let values = [limit, offset];

    if (search) {
      whereClause = `WHERE rq.received_quotation_no ILIKE $3 OR b.name ILIKE $3`;
      values = [limit, offset, `%${search}%`];
    }

    const queryText = `
      SELECT rq.*,
        b.name AS buyer_name, b.email AS buyer_email, b.phone AS buyer_phone,
        COALESCE(
          json_agg(
            json_build_object(
              'item_code', rqi.item_code,
              'description', i.description,
              'drawing_number', i.drawing_number,
              'long_description', i.long_description,
              'quantity', rqi.quantity,
              'unit_price', rqi.unit_price,
              'gst_type', rqi.gst_type,
              'gst_rate', rqi.gst_rate
            ) ORDER BY rqi.id
          ) FILTER (WHERE rqi.item_code IS NOT NULL),
          '[]'
        ) AS items
      FROM received_quotations rq
      LEFT JOIN received_quotation_items rqi ON rq.received_quotation_no = rqi.received_quotation_no
      LEFT JOIN items i ON rqi.item_code = i.item_code
      LEFT JOIN buyers b ON rq.buyer_id = b.id
      ${whereClause}
      GROUP BY rq.received_quotation_no, b.name, b.email, b.phone
      ORDER BY rq.created_at DESC
      LIMIT $1 OFFSET $2
    `;
    const { rows } = await pool.query(queryText, values);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching received quotations:', error);
    res.status(500).json({ error: 'Server error fetching received quotations' });
  }
});

// Get next auto-generated received quotation number
router.get('/next-no', async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    const prefix = `RQTN-${currentYear}-`;
    
    const queryText = `
      SELECT received_quotation_no FROM received_quotations 
      WHERE received_quotation_no LIKE $1 
      ORDER BY received_quotation_no DESC 
      LIMIT 1
    `;
    const { rows } = await pool.query(queryText, [`${prefix}%`]);
    
    let nextSeq = 1;
    if (rows.length > 0) {
      const lastNo = rows[0].received_quotation_no;
      const parts = lastNo.split('-');
      const lastSeq = parseInt(parts[parts.length - 1]);
      if (!isNaN(lastSeq)) {
        nextSeq = lastSeq + 1;
      }
    }
    
    const nextNo = `${prefix}${String(nextSeq).padStart(4, '0')}`;
    res.json({ next_no: nextNo });
  } catch (error) {
    console.error('Error generating next received quotation number:', error);
    res.status(500).json({ error: 'Server error generating next received quotation number' });
  }
});

// Add new received quotation
router.post('/', async (req, res) => {
  const {
    quotation_date, buyer_id, terms_and_conditions, items = []
  } = req.body;

  if (!quotation_date) {
    return res.status(400).json({ error: 'Quotation Date is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const currentYear = new Date(quotation_date).getFullYear();
    const prefix = `RQTN-${currentYear}-`;
    const nextNumResult = await client.query(`
      SELECT received_quotation_no FROM received_quotations 
      WHERE received_quotation_no LIKE $1 
      ORDER BY received_quotation_no DESC 
      LIMIT 1
    `, [`${prefix}%`]);

    let nextSeq = 1;
    if (nextNumResult.rows.length > 0) {
      const lastNo = nextNumResult.rows[0].received_quotation_no;
      const parts = lastNo.split('-');
      const lastSeq = parseInt(parts[parts.length - 1]);
      if (!isNaN(lastSeq)) {
        nextSeq = lastSeq + 1;
      }
    }
    const received_quotation_no = `${prefix}${String(nextSeq).padStart(4, '0')}`;

    // Insert received quotation
    await client.query(`
      INSERT INTO received_quotations (received_quotation_no, buyer_id, quotation_date, terms_and_conditions)
      VALUES ($1, $2, $3, $4)
    `, [received_quotation_no, buyer_id || null, quotation_date, terms_and_conditions || null]);

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
        INSERT INTO received_quotation_items (received_quotation_no, item_code, quantity, unit_price, gst_type, gst_rate)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (received_quotation_no, item_code) DO NOTHING
      `, [received_quotation_no, item.item_code, qty, price, item.gst_type || 'CGST/UGST', parseFloat(item.gst_rate) || 0.00]);
    }

    await client.query('COMMIT');

    const { rows } = await pool.query(`
      SELECT rq.*,
        b.name AS buyer_name, b.email AS buyer_email, b.phone AS buyer_phone,
        COALESCE(
          json_agg(
            json_build_object(
              'item_code', rqi.item_code,
              'description', i.description,
              'drawing_number', i.drawing_number,
              'long_description', i.long_description,
              'quantity', rqi.quantity,
              'unit_price', rqi.unit_price,
              'gst_type', rqi.gst_type,
              'gst_rate', rqi.gst_rate
            ) ORDER BY rqi.id
          ) FILTER (WHERE rqi.item_code IS NOT NULL),
          '[]'
        ) AS items
      FROM received_quotations rq
      LEFT JOIN received_quotation_items rqi ON rq.received_quotation_no = rqi.received_quotation_no
      LEFT JOIN items i ON rqi.item_code = i.item_code
      LEFT JOIN buyers b ON rq.buyer_id = b.id
      WHERE rq.received_quotation_no = $1
      GROUP BY rq.received_quotation_no, b.name, b.email, b.phone
    `, [received_quotation_no]);

    res.status(201).json(rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating received quotation:', error);
    res.status(500).json({ error: 'Server error creating received quotation' });
  } finally {
    client.release();
  }
});

// Update received quotation
router.put('/:received_quotation_no', async (req, res) => {
  const { received_quotation_no } = req.params;
  const {
    buyer_id, quotation_date, terms_and_conditions, items = []
  } = req.body;

  if (!quotation_date) {
    return res.status(400).json({ error: 'Quotation Date is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const updateResult = await client.query(`
      UPDATE received_quotations 
      SET buyer_id = $1, quotation_date = $2, terms_and_conditions = $3
      WHERE received_quotation_no = $4
      RETURNING *
    `, [buyer_id || null, quotation_date, terms_and_conditions || null, received_quotation_no]);

    if (updateResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Received quotation not found' });
    }

    // Replace items
    await client.query('DELETE FROM received_quotation_items WHERE received_quotation_no = $1', [received_quotation_no]);
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
        INSERT INTO received_quotation_items (received_quotation_no, item_code, quantity, unit_price, gst_type, gst_rate)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [received_quotation_no, item.item_code, qty, price, item.gst_type || 'CGST/UGST', parseFloat(item.gst_rate) || 0.00]);
    }

    await client.query('COMMIT');

    const { rows } = await pool.query(`
      SELECT rq.*,
        b.name AS buyer_name, b.email AS buyer_email, b.phone AS buyer_phone,
        COALESCE(
          json_agg(
            json_build_object(
              'item_code', rqi.item_code,
              'description', i.description,
              'drawing_number', i.drawing_number,
              'long_description', i.long_description,
              'quantity', rqi.quantity,
              'unit_price', rqi.unit_price,
              'gst_type', rqi.gst_type,
              'gst_rate', rqi.gst_rate
            ) ORDER BY rqi.id
          ) FILTER (WHERE rqi.item_code IS NOT NULL),
          '[]'
        ) AS items
      FROM received_quotations rq
      LEFT JOIN received_quotation_items rqi ON rq.received_quotation_no = rqi.received_quotation_no
      LEFT JOIN items i ON rqi.item_code = i.item_code
      LEFT JOIN buyers b ON rq.buyer_id = b.id
      WHERE rq.received_quotation_no = $1
      GROUP BY rq.received_quotation_no, b.name, b.email, b.phone
    `, [received_quotation_no]);

    res.json(rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating received quotation:', error);
    res.status(500).json({ error: 'Server error updating received quotation' });
  } finally {
    client.release();
  }
});

// Delete received quotation
router.delete('/:received_quotation_no', async (req, res) => {
  const { received_quotation_no } = req.params;
  try {
    const { rowCount } = await pool.query('DELETE FROM received_quotations WHERE received_quotation_no = $1', [received_quotation_no]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Received quotation not found' });
    }
    res.json({ success: true, message: 'Received quotation successfully deleted' });
  } catch (error) {
    console.error('Error deleting received quotation:', error);
    res.status(500).json({ error: 'Server error deleting received quotation' });
  }
});

module.exports = router;
