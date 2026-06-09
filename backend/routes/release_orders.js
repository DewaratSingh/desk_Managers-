const express = require('express');
const { pool } = require('../db');

const router = express.Router();

// Get all release orders
router.get('/', async (req, res) => {
  const { search } = req.query;
  const limit = parseInt(req.query.limit) || 20;
  const offset = parseInt(req.query.offset) || 0;

  try {
    let whereClause = '';
    let values = [limit, offset];

    if (search) {
      whereClause = `
        WHERE ro.ro_no ILIKE $3 
           OR ro.customer_id ILIKE $3 
           OR c.name ILIKE $3 
           OR b.name ILIKE $3 
           OR EXISTS (
             SELECT 1 FROM release_order_items roi2 
             WHERE roi2.ro_no = ro.ro_no AND roi2.item_code ILIKE $3
           )
      `;
      values = [limit, offset, `%${search}%`];
    }

    const queryText = `
      SELECT ro.*,
        c.name AS customer_name, c.address AS customer_address,
        b.name AS buyer_name, b.email AS buyer_email, b.phone AS buyer_phone,
        COALESCE(
          json_agg(
            json_build_object(
              'item_code', roi.item_code,
              'description', i.description,
              'drawing_number', i.drawing_number,
              'quantity', roi.quantity,
              'unit_price', roi.unit_price,
              'shipping_address', roi.shipping_address,
              'delivery_date', roi.delivery_date,
              'gst_type', roi.gst_type,
              'gst_rate', roi.gst_rate
            ) ORDER BY roi.id
          ) FILTER (WHERE roi.item_code IS NOT NULL),
          '[]'
        ) AS items
      FROM release_orders ro
      LEFT JOIN release_order_items roi ON ro.ro_no = roi.ro_no
      LEFT JOIN items i ON roi.item_code = i.item_code
      LEFT JOIN customers c ON ro.customer_id = c.id
      LEFT JOIN buyers b ON ro.buyer_id = b.id
      ${whereClause}
      GROUP BY ro.ro_no, c.name, c.address, b.name, b.email, b.phone
      ORDER BY ro.created_at DESC
      LIMIT $1 OFFSET $2
    `;
    const { rows } = await pool.query(queryText, values);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching release orders:', error);
    res.status(500).json({ error: 'Server error fetching release orders' });
  }
});

// Add new release order
router.post('/', async (req, res) => {
  const {
    ro_no, contract_ref, buyer_id, customer_id, ro_date, gst, transport, other, basic_value, packing_forward, items = []
  } = req.body;

  if (!ro_no) {
    return res.status(400).json({ error: 'Release Order Number is required' });
  }

  if (!ro_date) {
    return res.status(400).json({ error: 'Release Order Date is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check if RO Number already exists
    const checkRo = await client.query('SELECT ro_no FROM release_orders WHERE ro_no = $1', [ro_no]);
    if (checkRo.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'A Release Order with this number already exists' });
    }

    // Insert release order
    await client.query(`
      INSERT INTO release_orders (ro_no, contract_ref, buyer_id, customer_id, ro_date, gst, transport, other, basic_value, packing_forward)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
      ro_no, 
      contract_ref || null,
      buyer_id || null,
      customer_id || null,
      ro_date, 
      parseFloat(gst) || 0.00, 
      parseFloat(transport) || 0.00, 
      parseFloat(other) || 0.00, 
      parseFloat(basic_value) || 0.00, 
      parseFloat(packing_forward) || 0.00
    ]);

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
        INSERT INTO release_order_items (ro_no, item_code, quantity, unit_price, shipping_address, delivery_date, gst_type, gst_rate)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [ro_no, item.item_code, qty, price, item.shipping_address || null, item.delivery_date || null, item.gst_type || 'CGST/UGST', parseFloat(item.gst_rate) || 0.00]);
    }

    await client.query('COMMIT');

    // Fetch and return the newly created release order
    const { rows } = await pool.query(`
      SELECT ro.*,
        c.name AS customer_name, c.address AS customer_address,
        b.name AS buyer_name, b.email AS buyer_email, b.phone AS buyer_phone,
        COALESCE(
          json_agg(
            json_build_object(
              'item_code', roi.item_code,
              'description', i.description,
              'drawing_number', i.drawing_number,
              'quantity', roi.quantity,
              'unit_price', roi.unit_price,
              'shipping_address', roi.shipping_address,
              'delivery_date', roi.delivery_date,
              'gst_type', roi.gst_type,
              'gst_rate', roi.gst_rate
            ) ORDER BY roi.id
          ) FILTER (WHERE roi.item_code IS NOT NULL),
          '[]'
        ) AS items
      FROM release_orders ro
      LEFT JOIN release_order_items roi ON ro.ro_no = roi.ro_no
      LEFT JOIN items i ON roi.item_code = i.item_code
      LEFT JOIN customers c ON ro.customer_id = c.id
      LEFT JOIN buyers b ON ro.buyer_id = b.id
      WHERE ro.ro_no = $1
      GROUP BY ro.ro_no, c.name, c.address, b.name, b.email, b.phone
    `, [ro_no]);

    res.status(201).json(rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating release order:', error);
    res.status(500).json({ error: 'Server error creating release order' });
  } finally {
    client.release();
  }
});

// Update release order
router.put('/:ro_no', async (req, res) => {
  const { ro_no } = req.params;
  const {
    contract_ref, buyer_id, customer_id, ro_date, gst, transport, other, basic_value, packing_forward, items = []
  } = req.body;

  if (!ro_date) {
    return res.status(400).json({ error: 'Release Order Date is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const updateResult = await client.query(`
      UPDATE release_orders 
      SET contract_ref = $1, buyer_id = $2, customer_id = $3, ro_date = $4, gst = $5, transport = $6, other = $7, basic_value = $8, packing_forward = $9
      WHERE ro_no = $10
      RETURNING *
    `, [
      contract_ref || null,
      buyer_id || null,
      customer_id || null,
      ro_date, 
      parseFloat(gst) || 0.00, 
      parseFloat(transport) || 0.00, 
      parseFloat(other) || 0.00, 
      parseFloat(basic_value) || 0.00, 
      parseFloat(packing_forward) || 0.00, 
      ro_no
    ]);

    if (updateResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Release Order not found' });
    }

    // Replace items
    await client.query('DELETE FROM release_order_items WHERE ro_no = $1', [ro_no]);
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
        INSERT INTO release_order_items (ro_no, item_code, quantity, unit_price, shipping_address, delivery_date, gst_type, gst_rate)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [ro_no, item.item_code, qty, price, item.shipping_address || null, item.delivery_date || null, item.gst_type || 'CGST/UGST', parseFloat(item.gst_rate) || 0.00]);
    }

    await client.query('COMMIT');

    const { rows } = await pool.query(`
      SELECT ro.*,
        c.name AS customer_name, c.address AS customer_address,
        b.name AS buyer_name, b.email AS buyer_email, b.phone AS buyer_phone,
        COALESCE(
          json_agg(
            json_build_object(
              'item_code', roi.item_code,
              'description', i.description,
              'drawing_number', i.drawing_number,
              'quantity', roi.quantity,
              'unit_price', roi.unit_price,
              'shipping_address', roi.shipping_address,
              'delivery_date', roi.delivery_date,
              'gst_type', roi.gst_type,
              'gst_rate', roi.gst_rate
            ) ORDER BY roi.id
          ) FILTER (WHERE roi.item_code IS NOT NULL),
          '[]'
        ) AS items
      FROM release_orders ro
      LEFT JOIN release_order_items roi ON ro.ro_no = roi.ro_no
      LEFT JOIN items i ON roi.item_code = i.item_code
      LEFT JOIN customers c ON ro.customer_id = c.id
      LEFT JOIN buyers b ON ro.buyer_id = b.id
      WHERE ro.ro_no = $1
      GROUP BY ro.ro_no, c.name, c.address, b.name, b.email, b.phone
    `, [ro_no]);

    res.json(rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating release order:', error);
    res.status(500).json({ error: 'Server error updating release order' });
  } finally {
    client.release();
  }
});

// Delete release order
router.delete('/:ro_no', async (req, res) => {
  const { ro_no } = req.params;
  try {
    const result = await pool.query('DELETE FROM release_orders WHERE ro_no = $1 RETURNING *', [ro_no]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Release Order not found' });
    }
    res.json({ message: 'Release Order deleted successfully' });
  } catch (error) {
    console.error('Error deleting release order:', error);
    res.status(500).json({ error: 'Server error deleting release order' });
  }
});

module.exports = router;
