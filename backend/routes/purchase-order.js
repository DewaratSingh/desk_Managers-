const express = require('express');
const router = express.Router();
const { pool, appendDocToTrade } = require('../db');
const { updateTradeDeliveryStatus } = require('./delivery-note');
const { updateTradePaymentStatus } = require('./payment');


// Update a single PO item's status and vendor (inline edit)
router.put('/:po_no/items/:item_code', async (req, res) => {
  const { po_no, item_code } = req.params;   // Express already URL-decodes these
  const { status, vendor } = req.body || {};

  if (status === undefined && vendor === undefined) {
    return res.status(400).json({ error: 'Provide at least status or vendor to update' });
  }

  try {
    // Build SET clause dynamically for only the fields provided
    const fields = [];
    const values = [];
    if (status !== undefined) { fields.push(`status = $${fields.length + 1}`); values.push(status || null); }
    if (vendor !== undefined) { fields.push(`vendor = $${fields.length + 1}`); values.push(vendor || null); }

    values.push(po_no, item_code);

    const result = await pool.query(
      `UPDATE purchase_order_items
       SET ${fields.join(', ')}
       WHERE po_no = $${values.length - 1} AND item_code = $${values.length}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'PO item not found' });
    }

    // Return the full updated items list (with item description/drawing from items table)
    const items = await pool.query(
      `SELECT poi.*, i.description, i.drawing_number,
              COALESCE((
                SELECT SUM(dni.quantity)
                FROM delivery_note_items dni
                JOIN delivery_notes dn ON dni.delivery_note_no = dn.delivery_note_no
                WHERE dn.po_no = poi.po_no
                  AND dni.item_code = poi.item_code
              ), 0) as delivered_qty
       FROM purchase_order_items poi
       LEFT JOIN items i ON poi.item_code = i.item_code
       WHERE poi.po_no = $1
       ORDER BY poi.id`,
      [po_no]
    );
    res.json(items.rows);
  } catch (err) {
    console.error('Error updating PO item:', err.message);
    res.status(500).json({ error: 'Failed to update PO item' });
  }
});

// List all POs
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        po.po_no, po.quotation_no, po.po_date, po.delivery_date,
        po.gst, po.transport, po.other, po.basic_value, po.packing_forward,
        po.trade_id, po.created_at,
        t.trade_type,
        t.status AS trade_status,
        COALESCE(
          (SELECT r.customer_id FROM rfqs r WHERE r.trade_id = po.trade_id LIMIT 1),
          (SELECT rq.customer_id FROM received_quotations rq WHERE rq.trade_id = po.trade_id LIMIT 1),
          '—'
        ) AS party_id,
        (
          SELECT COALESCE(json_agg(json_build_object(
            'item_code', poi.item_code,
            'quantity', poi.quantity,
            'unit_price', poi.unit_price,
            'gst_rate', poi.gst_rate,
            'gst_type', poi.gst_type,
            'delivered_qty', COALESCE((
              SELECT SUM(dni.quantity)
              FROM delivery_note_items dni
              JOIN delivery_notes dn ON dni.delivery_note_no = dn.delivery_note_no
              WHERE dn.po_no = po.po_no
                AND dni.item_code = poi.item_code
            ), 0)
          )), '[]')
          FROM purchase_order_items poi
          WHERE poi.po_no = po.po_no
        ) as items
      FROM purchase_orders po
      LEFT JOIN trades t ON po.trade_id = t.trade_id
      ORDER BY po.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error listing POs:', err.message);
    res.status(500).json({ error: 'Failed to list purchase orders' });
  }
});

// Get next PO reference number
router.get('/next-no', async (req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(*) FROM purchase_orders');
    const count = parseInt(result.rows[0].count) || 0;
    const nextNo = `PO-${String(count + 1).padStart(4, '0')}`;
    res.json({ nextNo });
  } catch (err) {
    console.error('Error fetching next PO no:', err.message);
    res.status(500).json({ error: 'Failed to generate next PO number' });
  }
});

// Get a single PO
router.get('/:po_no', async (req, res) => {
  const { po_no } = req.params;
  try {
    const result = await pool.query(`
      SELECT
        po.po_no, po.quotation_no, po.po_date,
        po.gst, po.transport, po.other, po.basic_value, po.packing_forward,
        po.delivery_date, po.trade_id,
        (
          SELECT COALESCE(json_agg(json_build_object(
            'item_code', poi.item_code,
            'quantity', poi.quantity,
            'unit_price', poi.unit_price,
            'gst_type', poi.gst_type,
            'gst_rate', poi.gst_rate,
            'shipping_address', poi.shipping_address,
            'delivery_date', poi.delivery_date,
            'status', poi.status,
            'vendor', poi.vendor,
            'description', i.description,
            'drawing_number', i.drawing_number,
            'delivered_qty', COALESCE((
              SELECT SUM(dni.quantity)
              FROM delivery_note_items dni
              JOIN delivery_notes dn ON dni.delivery_note_no = dn.delivery_note_no
              WHERE dn.po_no = po.po_no
                AND dni.item_code = poi.item_code
            ), 0)
          ) ORDER BY poi.id), '[]')
          FROM purchase_order_items poi
          LEFT JOIN items i ON poi.item_code = i.item_code
          WHERE poi.po_no = po.po_no
        ) as items
      FROM purchase_orders po
      WHERE po.po_no = $1
    `, [po_no]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Purchase Order not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching PO:', err.message);
    res.status(500).json({ error: 'Failed to fetch purchase order' });
  }
});

// Create a PO
router.post('/', async (req, res) => {
  const {
    po_no, quotation_no, po_date,
    transport, other, basic_value, packing_forward,
    delivery_date, items
  } = req.body || {};

  if (!po_date) {
    return res.status(400).json({ error: 'po_date is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Resolve trade_id from the quotation
    let trade_id = null;
    if (quotation_no) {
      let qRes = await client.query('SELECT trade_id FROM quotations WHERE quotation_no = $1', [quotation_no]);
      if (qRes.rows.length > 0) {
        trade_id = qRes.rows[0].trade_id;
      } else {
        qRes = await client.query('SELECT trade_id FROM received_quotations WHERE received_quotation_no = $1', [quotation_no]);
        if (qRes.rows.length > 0) trade_id = qRes.rows[0].trade_id;
      }
    }

    // Check duplicate
    const dupCheck = await client.query('SELECT po_no FROM purchase_orders WHERE po_no = $1', [po_no]);
    if (dupCheck.rows.length > 0) throw new Error('Purchase Order number already exists');

    // Compute total GST from items
    const totalGst = Array.isArray(items)
      ? items.reduce((sum, item) => {
          const lineTotal = (parseFloat(item.unit_price) || 0) * (parseInt(item.quantity) || 0);
          const rate      = parseFloat(item.gst_rate) || 0;
          return sum + (lineTotal * rate) / 100;
        }, 0)
      : 0;

    // Insert PO header
    await client.query(
      `INSERT INTO purchase_orders
        (po_no, quotation_no, po_date, gst, transport, other, basic_value, packing_forward, delivery_date, trade_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        po_no,
        quotation_no || null,
        po_date,
        totalGst,
        parseFloat(transport)       || 0,
        parseFloat(other)           || 0,
        parseFloat(basic_value)     || 0,
        parseFloat(packing_forward) || 0,
        delivery_date || null,
        trade_id
      ]
    );

    // Insert items
    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        await client.query(
          `INSERT INTO purchase_order_items
            (po_no, item_code, quantity, unit_price, gst_type, gst_rate, shipping_address, delivery_date)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            po_no,
            item.item_code,
            parseInt(item.quantity)    || 1,
            parseFloat(item.unit_price) || 0,
            item.gst_type  || null,
            parseFloat(item.gst_rate)  || 0,
            item.shipping_address || null,
            item.delivery_date    || null
          ]
        );
      }
    }

    // Append to trade documents
    if (trade_id) {
      await appendDocToTrade(client, trade_id, 'PO', po_no);
      await client.query(
        "INSERT INTO status (name) VALUES ('ordered') ON CONFLICT (name) DO NOTHING"
      );
      await client.query(
        "UPDATE trades SET status = 'ordered' WHERE trade_id = $1",
        [trade_id]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ po_no });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating PO:', err.message);
    res.status(500).json({ error: err.message || 'Failed to create purchase order' });
  } finally {
    client.release();
  }
});

// Update a PO
router.put('/:po_no', async (req, res) => {
  const { po_no } = req.params;
  const {
    po_date, transport, other, basic_value, packing_forward,
    delivery_date, items
  } = req.body || {};

  if (!po_date) {
    return res.status(400).json({ error: 'po_date is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Compute total GST from items
    const totalGst = Array.isArray(items)
      ? items.reduce((sum, item) => {
          const lineTotal = (parseFloat(item.unit_price) || 0) * (parseInt(item.quantity) || 0);
          const rate      = parseFloat(item.gst_rate) || 0;
          return sum + (lineTotal * rate) / 100;
        }, 0)
      : 0;

    const updateResult = await client.query(
      `UPDATE purchase_orders
       SET po_date = $1, gst = $2, transport = $3, other = $4,
           basic_value = $5, packing_forward = $6, delivery_date = $7
       WHERE po_no = $8 RETURNING *`,
      [
        po_date,
        totalGst,
        parseFloat(transport)       || 0,
        parseFloat(other)           || 0,
        parseFloat(basic_value)     || 0,
        parseFloat(packing_forward) || 0,
        delivery_date || null,
        po_no
      ]
    );

    if (updateResult.rows.length === 0) throw new Error('Purchase Order not found');

    // Replace items
    await client.query('DELETE FROM purchase_order_items WHERE po_no = $1', [po_no]);
    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        await client.query(
          `INSERT INTO purchase_order_items
            (po_no, item_code, quantity, unit_price, gst_type, gst_rate, shipping_address, delivery_date)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            po_no,
            item.item_code,
            parseInt(item.quantity)    || 1,
            parseFloat(item.unit_price) || 0,
            item.gst_type  || null,
            parseFloat(item.gst_rate)  || 0,
            item.shipping_address || null,
            item.delivery_date    || null
          ]
        );
      }
    }

    // After updating items, recalculate delivery and payment statuses
    const tradeRes = await client.query(
      'SELECT trade_id FROM purchase_orders WHERE po_no = $1',
      [po_no]
    );
    const trade_id = tradeRes.rows.length > 0 ? tradeRes.rows[0].trade_id : null;
    if (trade_id) {
      await updateTradeDeliveryStatus(client, trade_id);
      await updateTradePaymentStatus(client, trade_id);
    }

    await client.query('COMMIT');
    res.json({ po_no });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating PO:', err.message);
    res.status(500).json({ error: err.message || 'Failed to update purchase order' });
  } finally {
    client.release();
  }
});

module.exports = router;
