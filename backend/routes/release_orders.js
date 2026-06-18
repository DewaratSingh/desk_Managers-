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
        COALESCE(EXISTS (SELECT 1 FROM grns WHERE grns.trade_id = ro.trade_id), false) AS has_grn,
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
              'gst_rate', roi.gst_rate,
              'status', roi.status,
              'vendor', roi.vendor
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
    ro_no, contract_ref, buyer_id, customer_id, ro_date, delivery_date, gst, transport, other, basic_value, packing_forward, items = [], trade_id
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

    // Auto-generate trade_id and insert a trade if not passed
    let activeTradeId = trade_id;
    if (!activeTradeId || !activeTradeId.trim()) {
      const year = new Date().getFullYear();
      const prefix = `TRADE-${year}-`;
      const lastTrade = await client.query(
        'SELECT trade_id FROM trades WHERE trade_id LIKE $1 ORDER BY trade_id DESC LIMIT 1 FOR UPDATE',
        [`${prefix}%`]
      );
      let nextSeq = 1;
      if (lastTrade.rows.length > 0) {
        const lastId = lastTrade.rows[0].trade_id;
        const parts = lastId.split('-');
        if (parts.length === 3) {
          const lastSeq = parseInt(parts[2], 10);
          if (!isNaN(lastSeq)) {
            nextSeq = lastSeq + 1;
          }
        }
      }
      activeTradeId = `${prefix}${String(nextSeq).padStart(4, '0')}`;
      
      const docs = [{ id: ro_no, type: 'RO' }];
      await client.query(
        'INSERT INTO trades (trade_id, documents, status, trade_type) VALUES ($1, $2, $3, $4)',
        [activeTradeId, JSON.stringify(docs), 'ro', 'ARC']
      );
    }

    // Insert release order
    await client.query(`
      INSERT INTO release_orders (ro_no, contract_ref, buyer_id, customer_id, ro_date, delivery_date, gst, transport, other, basic_value, packing_forward, trade_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `, [
      ro_no, 
      contract_ref || null,
      buyer_id || null,
      customer_id || null,
      ro_date, 
      delivery_date || null,
      parseFloat(gst) || 0.00, 
      parseFloat(transport) || 0.00, 
      parseFloat(other) || 0.00, 
      parseFloat(basic_value) || 0.00, 
      parseFloat(packing_forward) || 0.00,
      activeTradeId
    ]);

    // Link document in trades table
    if (activeTradeId) {
      const { appendDocToTrade } = require('../db');
      await appendDocToTrade(client, activeTradeId, 'RO', ro_no);
    }

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
      `, [ro_no, item.item_code, qty, price, item.shipping_address || null, item.delivery_date || null, item.gst_type || 'CGST/SGST', parseFloat(item.gst_rate) || 0.00]);
    }

    await client.query('COMMIT');

    // Fetch and return the newly created release order
    const { rows } = await pool.query(`
      SELECT ro.*,
        c.name AS customer_name, c.address AS customer_address,
        b.name AS buyer_name, b.email AS buyer_email, b.phone AS buyer_phone,
        COALESCE(EXISTS (SELECT 1 FROM grns WHERE grns.trade_id = ro.trade_id), false) AS has_grn,
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
              'gst_rate', roi.gst_rate,
              'status', roi.status,
              'vendor', roi.vendor
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
    contract_ref, buyer_id, customer_id, ro_date, delivery_date, gst, transport, other, basic_value, packing_forward, items = []
  } = req.body;

  if (!ro_date) {
    return res.status(400).json({ error: 'Release Order Date is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const updateResult = await client.query(`
      UPDATE release_orders 
      SET contract_ref = $1, buyer_id = $2, customer_id = $3, ro_date = $4, delivery_date = $5, gst = $6, transport = $7, other = $8, basic_value = $9, packing_forward = $10
      WHERE ro_no = $11
      RETURNING *
    `, [
      contract_ref || null,
      buyer_id || null,
      customer_id || null,
      ro_date, 
      delivery_date || null,
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
      `, [ro_no, item.item_code, qty, price, item.shipping_address || null, item.delivery_date || null, item.gst_type || 'CGST/SGST', parseFloat(item.gst_rate) || 0.00]);
    }

    await client.query('COMMIT');

    const { rows } = await pool.query(`
      SELECT ro.*,
        c.name AS customer_name, c.address AS customer_address,
        b.name AS buyer_name, b.email AS buyer_email, b.phone AS buyer_phone,
        COALESCE(EXISTS (SELECT 1 FROM grns WHERE grns.trade_id = ro.trade_id), false) AS has_grn,
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
              'gst_rate', roi.gst_rate,
              'status', roi.status,
              'vendor', roi.vendor
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

// Update status and vendor of a specific item in a release order
router.put('/:ro_no/items/:item_code', async (req, res) => {
  const { ro_no, item_code } = req.params;
  const { status, vendor } = req.body;

  try {
    const grnCheck = await pool.query(
      'SELECT 1 FROM grns WHERE trade_id = (SELECT trade_id FROM release_orders WHERE ro_no = $1) LIMIT 1',
      [ro_no]
    );
    if (grnCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Cannot edit Release Order items because a Goods Receipt Note (GRN) has already been generated.' });
    }
  } catch (error) {
    console.error('Error checking GRN status for RO item edit:', error);
    return res.status(500).json({ error: 'Server error checking GRN status' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Update release_order_items
    const updateRes = await client.query(`
      UPDATE release_order_items
      SET status = $1, vendor = $2
      WHERE ro_no = $3 AND item_code = $4
      RETURNING *
    `, [status || 'pending', vendor || '', ro_no, item_code]);

    if (updateRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Release Order Item not found' });
    }

    // 2. Insert the status into status lookup table if it's new
    if (status && status.trim() !== '') {
      await client.query(`
        INSERT INTO status (name)
        VALUES ($1)
        ON CONFLICT (name) DO NOTHING
      `, [status.trim()]);
    }

    await client.query('COMMIT');

    // 3. Query the updated items list for the RO and return them
    const itemsRes = await pool.query(`
      SELECT roi.*, i.description, i.drawing_number
      FROM release_order_items roi
      LEFT JOIN items i ON roi.item_code = i.item_code
      WHERE roi.ro_no = $1
      ORDER BY roi.id
    `, [ro_no]);

    res.json(itemsRes.rows);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating release order item:', error);
    res.status(500).json({ error: 'Server error updating release order item' });
  } finally {
    client.release();
  }
});

module.exports = router;
