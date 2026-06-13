const express = require('express');
const { pool } = require('../db');

const router = express.Router();

// Get all purchase orders
router.get('/', async (req, res) => {
  const { search } = req.query;
  const limit = parseInt(req.query.limit) || 20;
  const offset = parseInt(req.query.offset) || 0;

  try {
    let whereClause = '';
    let values = [limit, offset];

    if (search) {
      whereClause = `
        WHERE po.po_no ILIKE $3 
           OR po.quotation_no ILIKE $3 
           OR r.customer_id ILIKE $3 
           OR b.name ILIKE $3 
           OR EXISTS (
             SELECT 1 FROM purchase_order_items poi2 
             WHERE poi2.po_no = po.po_no AND poi2.item_code ILIKE $3
           )
      `;
      values = [limit, offset, `%${search}%`];
    }

    const queryText = `
      SELECT po.*,
        q.quotation_date,
        r.rfq_no, r.customer_id, c.name AS customer_name, c.address AS customer_address,
        b.name AS buyer_name, b.email AS buyer_email, b.phone AS buyer_phone,
        COALESCE(
          json_agg(
            json_build_object(
              'item_code', poi.item_code,
              'description', i.description,
              'drawing_number', i.drawing_number,
              'quantity', poi.quantity,
              'unit_price', poi.unit_price,
              'shipping_address', poi.shipping_address,
              'delivery_date', poi.delivery_date,
              'gst_type', poi.gst_type,
              'gst_rate', poi.gst_rate
            ) ORDER BY poi.id
          ) FILTER (WHERE poi.item_code IS NOT NULL),
          '[]'
        ) AS items
      FROM purchase_orders po
      LEFT JOIN purchase_order_items poi ON po.po_no = poi.po_no
      LEFT JOIN items i ON poi.item_code = i.item_code
      LEFT JOIN quotations q ON po.quotation_no = q.quotation_no
      LEFT JOIN rfqs r ON q.rfq_no = r.rfq_no
      LEFT JOIN customers c ON r.customer_id = c.id
      LEFT JOIN buyers b ON r.buyer_id = b.id
      ${whereClause}
      GROUP BY po.po_no, q.quotation_date, r.rfq_no, r.customer_id, c.name, c.address, b.name, b.email, b.phone
      ORDER BY po.created_at DESC
      LIMIT $1 OFFSET $2
    `;
    const { rows } = await pool.query(queryText, values);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching purchase orders:', error);
    res.status(500).json({ error: 'Server error fetching purchase orders' });
  }
});

// Add new purchase order
router.post('/', async (req, res) => {
  const {
    po_no, contract_ref, quotation_no, po_date, delivery_date, gst, transport, other, basic_value, packing_forward, items = []
  } = req.body;

  if (!po_no) {
    return res.status(400).json({ error: 'PO Number is required' });
  }

  if (!po_date) {
    return res.status(400).json({ error: 'PO Date is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check if PO Number already exists
    const checkPo = await client.query('SELECT po_no FROM purchase_orders WHERE po_no = $1', [po_no]);
    if (checkPo.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'A Purchase Order with this number already exists' });
    }

    // Insert purchase order
    await client.query(`
      INSERT INTO purchase_orders (po_no, contract_ref, quotation_no, po_date, delivery_date, gst, transport, other, basic_value, packing_forward)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
      po_no, 
      contract_ref || null,
      quotation_no || null, 
      po_date, 
      delivery_date || null,
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
        INSERT INTO purchase_order_items (po_no, item_code, quantity, unit_price, shipping_address, delivery_date, gst_type, gst_rate)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [po_no, item.item_code, qty, price, item.shipping_address || null, item.delivery_date || null, item.gst_type || 'CGST/SGST', parseFloat(item.gst_rate) || 0.00]);
    }

    // Update linked RFQ status to 'ordered'
    if (quotation_no) {
      await client.query(`
        UPDATE rfqs 
        SET status = 'ordered' 
        WHERE rfq_no = (SELECT rfq_no FROM quotations WHERE quotation_no = $1)
      `, [quotation_no]);
    }

    await client.query('COMMIT');

    // Fetch and return the newly created purchase order
    const { rows } = await pool.query(`
      SELECT po.*,
        q.quotation_date,
        r.rfq_no, r.customer_id, c.name AS customer_name, c.address AS customer_address,
        b.name AS buyer_name, b.email AS buyer_email, b.phone AS buyer_phone,
        COALESCE(
          json_agg(
            json_build_object(
              'item_code', poi.item_code,
              'description', i.description,
              'drawing_number', i.drawing_number,
              'quantity', poi.quantity,
              'unit_price', poi.unit_price,
              'shipping_address', poi.shipping_address,
              'delivery_date', poi.delivery_date,
              'gst_type', poi.gst_type,
              'gst_rate', poi.gst_rate
            ) ORDER BY poi.id
          ) FILTER (WHERE poi.item_code IS NOT NULL),
          '[]'
        ) AS items
      FROM purchase_orders po
      LEFT JOIN purchase_order_items poi ON po.po_no = poi.po_no
      LEFT JOIN items i ON poi.item_code = i.item_code
      LEFT JOIN quotations q ON po.quotation_no = q.quotation_no
      LEFT JOIN rfqs r ON q.rfq_no = r.rfq_no
      LEFT JOIN customers c ON r.customer_id = c.id
      LEFT JOIN buyers b ON r.buyer_id = b.id
      WHERE po.po_no = $1
      GROUP BY po.po_no, q.quotation_date, r.rfq_no, r.customer_id, c.name, c.address, b.name, b.email, b.phone
    `, [po_no]);

    res.status(201).json(rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating purchase order:', error);
    res.status(500).json({ error: 'Server error creating purchase order' });
  } finally {
    client.release();
  }
});

// Update purchase order
router.put('/:po_no', async (req, res) => {
  const { po_no } = req.params;
  const {
    contract_ref, quotation_no, po_date, delivery_date, gst, transport, other, basic_value, packing_forward, items = []
  } = req.body;

  if (!po_date) {
    return res.status(400).json({ error: 'PO Date is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const updateResult = await client.query(`
      UPDATE purchase_orders 
      SET contract_ref = $1, quotation_no = $2, po_date = $3, delivery_date = $4, gst = $5, transport = $6, other = $7, basic_value = $8, packing_forward = $9
      WHERE po_no = $10
      RETURNING *
    `, [
      contract_ref || null,
      quotation_no || null, 
      po_date, 
      delivery_date || null,
      parseFloat(gst) || 0.00, 
      parseFloat(transport) || 0.00, 
      parseFloat(other) || 0.00, 
      parseFloat(basic_value) || 0.00, 
      parseFloat(packing_forward) || 0.00, 
      po_no
    ]);

    if (updateResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Purchase Order not found' });
    }

    // Replace items
    await client.query('DELETE FROM purchase_order_items WHERE po_no = $1', [po_no]);
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
        INSERT INTO purchase_order_items (po_no, item_code, quantity, unit_price, shipping_address, delivery_date, gst_type, gst_rate)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [po_no, item.item_code, qty, price, item.shipping_address || null, item.delivery_date || null, item.gst_type || 'CGST/SGST', parseFloat(item.gst_rate) || 0.00]);
    }

    await client.query('COMMIT');

    const { rows } = await pool.query(`
      SELECT po.*,
        q.quotation_date,
        r.rfq_no, r.customer_id, c.name AS customer_name, c.address AS customer_address,
        b.name AS buyer_name, b.email AS buyer_email, b.phone AS buyer_phone,
        COALESCE(
          json_agg(
            json_build_object(
              'item_code', poi.item_code,
              'description', i.description,
              'drawing_number', i.drawing_number,
              'quantity', poi.quantity,
              'unit_price', poi.unit_price,
              'shipping_address', poi.shipping_address,
              'delivery_date', poi.delivery_date,
              'gst_type', poi.gst_type,
              'gst_rate', poi.gst_rate
            ) ORDER BY poi.id
          ) FILTER (WHERE poi.item_code IS NOT NULL),
          '[]'
        ) AS items
      FROM purchase_orders po
      LEFT JOIN purchase_order_items poi ON po.po_no = poi.po_no
      LEFT JOIN items i ON poi.item_code = i.item_code
      LEFT JOIN quotations q ON po.quotation_no = q.quotation_no
      LEFT JOIN rfqs r ON q.rfq_no = r.rfq_no
      LEFT JOIN customers c ON r.customer_id = c.id
      LEFT JOIN buyers b ON r.buyer_id = b.id
      WHERE po.po_no = $1
      GROUP BY po.po_no, q.quotation_date, r.rfq_no, r.customer_id, c.name, c.address, b.name, b.email, b.phone
    `, [po_no]);

    res.json(rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating purchase order:', error);
    res.status(500).json({ error: 'Server error updating purchase order' });
  } finally {
    client.release();
  }
});

// Delete purchase order
router.delete('/:po_no', async (req, res) => {
  const { po_no } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Find the linked quotation_no before deleting
    const poCheck = await client.query('SELECT quotation_no FROM purchase_orders WHERE po_no = $1', [po_no]);
    if (poCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Purchase Order not found' });
    }
    const qtnNo = poCheck.rows[0].quotation_no;

    // Delete PO
    await client.query('DELETE FROM purchase_orders WHERE po_no = $1', [po_no]);

    // Update RFQ status back to 'quotated'
    if (qtnNo) {
      await client.query(`
        UPDATE rfqs 
        SET status = 'quotated' 
        WHERE rfq_no = (SELECT rfq_no FROM quotations WHERE quotation_no = $1)
      `, [qtnNo]);
    }

    await client.query('COMMIT');
    res.json({ message: 'Purchase Order deleted successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting purchase order:', error);
    res.status(500).json({ error: 'Server error deleting purchase order' });
  } finally {
    client.release();
  }
});

module.exports = router;
