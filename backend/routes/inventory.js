const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Get inventory items (with optional search, limit & offset)
router.get('/', async (req, res) => {
  const { q } = req.query || {};
  const limit = req.query.limit ? parseInt(req.query.limit) : null;
  const offset = req.query.offset ? parseInt(req.query.offset) : 0;
  try {
    let queryText = `
      SELECT inv.id, it.item_code, inv.quantity, inv.price, inv.rack, inv.shelf_number,
             inv.location, t.trade_id, inv.message, inv.trace_item_id,
             p.status AS trace_status, p.process AS trace_process,
             COALESCE((
               SELECT SUM((elem->>'unit_price')::numeric)
               FROM jsonb_array_elements(
                 CASE 
                   WHEN jsonb_typeof(p.process) = 'array' THEN p.process 
                   ELSE '[]'::jsonb 
                 END
               ) elem
               WHERE elem->>'unit_price' IS NOT NULL AND (elem->>'unit_price')::numeric > 0
             ), inv.price) AS calculated_price,
             inv.company_id, inv.created_at, inv.updated_at,
             it.description, it.drawing_number,
             m.completed_quantity AS mfg_completed_qty,
             m.expected_quantity AS mfg_expected_qty,
             m.completed AS mfg_is_completed
      FROM inventory inv
      LEFT JOIN items it ON inv.item_code = it.id
      LEFT JOIN trades t ON inv.trade_id = t.id
      LEFT JOIN trace_item p ON inv.trace_item_id = p.id
      LEFT JOIN manufacture m ON inv.trace_item_id = m.target_trace_item_id AND m.company_id = inv.company_id
      WHERE inv.company_id = $1
    `;
    const params = [req.user.company_id];
    if (q) {
      queryText += `
        AND (it.item_code ILIKE $2 
           OR inv.location ILIKE $2 
           OR inv.rack ILIKE $2 
           OR inv.shelf_number ILIKE $2
           OR it.description ILIKE $2
           OR t.trade_id ILIKE $2)
      `;
      params.push(`%${q}%`);
    }
    queryText += ` ORDER BY inv.created_at DESC`;

    if (limit !== null) {
      const limitParamIdx = params.length + 1;
      const offsetParamIdx = params.length + 2;
      queryText += ` LIMIT $${limitParamIdx} OFFSET $${offsetParamIdx}`;
      params.push(limit, offset);
    } else if (q) {
      queryText += ` LIMIT 5`; // Default to 5 when searching
    }

    const result = await pool.query(queryText, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching inventory:', err.message);
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});

// Create inventory entry
router.post('/', async (req, res) => {
  const {
    item_code,
    quantity,
    price,
    rack,
    shelf_number,
    location,
    trade_id,
    message,
    trace_item_id
  } = req.body || {};

  if (!item_code) {
    return res.status(400).json({ error: 'item_code is required' });
  }

  try {
    // Resolve itemDbId
    const itemRes = await pool.query('SELECT id FROM items WHERE item_code = $1 AND company_id = $2', [item_code, req.user.company_id]);
    if (itemRes.rows.length === 0) {
      return res.status(400).json({ error: `Item ${item_code} not found` });
    }
    const itemDbId = itemRes.rows[0].id;

    // Resolve tradeDbId
    let tradeDbId = null;
    if (trade_id) {
      const tradeRes = await pool.query('SELECT id FROM trades WHERE trade_id = $1 AND company_id = $2', [trade_id, req.user.company_id]);
      if (tradeRes.rows.length > 0) {
        tradeDbId = tradeRes.rows[0].id;
      }
    }

    const result = await pool.query(
      `INSERT INTO inventory (
        item_code, quantity, price, rack, shelf_number, location, trade_id, message, company_id, trace_item_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [
        itemDbId,
        parseInt(quantity) || 0,
        parseFloat(price) || 0.00,
        rack || null,
        shelf_number || null,
        location || null,
        tradeDbId,
        message || null,
        req.user.company_id,
        trace_item_id ? parseInt(trace_item_id) : null
      ]
    );

    // Fetch the inserted record with joined details
    const joinedRes = await pool.query(
      `SELECT inv.id, it.item_code, inv.quantity, inv.price, inv.rack, inv.shelf_number,
             inv.location, t.trade_id, inv.message, inv.trace_item_id,
             p.status AS trace_status, p.process AS trace_process,
             COALESCE((
               SELECT SUM((elem->>'unit_price')::numeric)
               FROM jsonb_array_elements(
                 CASE 
                   WHEN jsonb_typeof(p.process) = 'array' THEN p.process 
                   ELSE '[]'::jsonb 
                 END
               ) elem
               WHERE elem->>'unit_price' IS NOT NULL AND (elem->>'unit_price')::numeric > 0
             ), inv.price) AS calculated_price,
             inv.company_id, inv.created_at, inv.updated_at,
             it.description, it.drawing_number,
             m.completed_quantity AS mfg_completed_qty,
             m.expected_quantity AS mfg_expected_qty,
             m.completed AS mfg_is_completed
      FROM inventory inv
      LEFT JOIN items it ON inv.item_code = it.id
      LEFT JOIN trades t ON inv.trade_id = t.id
      LEFT JOIN trace_item p ON inv.trace_item_id = p.id
      LEFT JOIN manufacture m ON inv.trace_item_id = m.target_trace_item_id AND m.company_id = inv.company_id
       WHERE inv.id = $1 AND inv.company_id = $2`,
      [result.rows[0].id, req.user.company_id]
    );

    res.status(201).json(joinedRes.rows[0]);
  } catch (err) {
    console.error('Error creating inventory entry:', err.message);
    res.status(500).json({ error: 'Failed to create inventory entry' });
  }
});

// GET eligible trades for sell
router.get('/sell/eligible-trades', async (req, res) => {
  const { item_code, q } = req.query || {};
  if (!item_code) {
    return res.status(400).json({ error: 'item_code is required' });
  }

  try {
    let queryText = `
      SELECT 
        t.id AS trade_db_id,
        t.trade_id,
        t.trade_type,
        COALESCE(po.po_no, ro.ro_no) AS po_no,
        po.id AS po_id,
        ro.id AS ro_id,
        COALESCE(poi.quantity, roi.quantity) AS order_qty,
        COALESCE(poi.unit_price, roi.unit_price) AS po_price,
        COALESCE(poi.shipping_address, roi.shipping_address) AS shipping_address,
        COALESCE(poi.delivery_date, roi.delivery_date) AS delivery_date,
        COALESCE(poi.item_id, roi.item_id) AS item_id,
        -- Calculate delivered quantity
        COALESCE((
          SELECT SUM(dni.quantity)
          FROM delivery_note_items dni
          JOIN delivery_notes dn ON dni.delivery_note_id = dn.id
          WHERE dn.trade_id = t.id 
            AND dni.item_id = COALESCE(poi.item_id, roi.item_id) 
            AND dn.company_id = t.company_id
        ), 0) AS delivered_qty
      FROM trades t
      LEFT JOIN purchase_orders po ON po.trade_id = t.id AND po.company_id = t.company_id
      LEFT JOIN purchase_order_items poi ON poi.po_id = po.id AND poi.company_id = t.company_id AND poi.item_id = (SELECT id FROM items WHERE item_code = $1 AND company_id = $2)
      LEFT JOIN release_orders ro ON ro.trade_id = t.id AND ro.company_id = t.company_id
      LEFT JOIN release_order_items roi ON roi.ro_id = ro.id AND roi.company_id = t.company_id AND roi.item_id = (SELECT id FROM items WHERE item_code = $1 AND company_id = $2)
      WHERE t.company_id = $2
        AND LOWER(t.trade_type) IN ('sell', 'arc')
        AND (poi.item_id IS NOT NULL OR roi.item_id IS NOT NULL)
        AND COALESCE(poi.quantity, roi.quantity) > COALESCE((
          SELECT SUM(dni.quantity)
          FROM delivery_note_items dni
          JOIN delivery_notes dn ON dni.delivery_note_id = dn.id
          WHERE dn.trade_id = t.id AND dni.item_id = COALESCE(poi.item_id, roi.item_id) AND dn.company_id = t.company_id
        ), 0)
    `;

    const params = [item_code.trim(), req.user.company_id];
    if (q) {
      queryText += ` AND t.trade_id ILIKE $3`;
      params.push(`%${q}%`);
    }

    queryText += ` ORDER BY t.created_at DESC LIMIT 10`;

    const result = await pool.query(queryText, params);
    
    // Map items to calculate remaining_qty
    const mapped = result.rows.map(row => {
      const orderQty = parseInt(row.order_qty) || 0;
      const deliveredQty = parseInt(row.delivered_qty) || 0;
      const remainingQty = Math.max(0, orderQty - deliveredQty);
      return {
        ...row,
        order_qty: orderQty,
        delivered_qty: deliveredQty,
        remaining_qty: remainingQty
      };
    });

    res.json(mapped);
  } catch (err) {
    console.error('Error fetching eligible trades:', err.message);
    res.status(500).json({ error: 'Failed to fetch eligible trades' });
  }
});

// GET inventory availability for a specific item code
router.get('/item/:item_code/availability', async (req, res) => {
  const { item_code } = req.params;
  try {
    const itemRes = await pool.query('SELECT id FROM items WHERE item_code = $1 AND company_id = $2', [item_code, req.user.company_id]);
    if (itemRes.rows.length === 0) {
      return res.json({ available_qty: 0, price: 0 });
    }
    const itemDbId = itemRes.rows[0].id;
    const invRes = await pool.query(
      `SELECT COALESCE(SUM(quantity), 0) AS total_qty, 
              COALESCE(AVG(price), 0.00) AS avg_price 
       FROM inventory 
       WHERE item_code = $1 AND company_id = $2`,
      [itemDbId, req.user.company_id]
    );
    res.json({
      available_qty: parseInt(invRes.rows[0].total_qty) || 0,
      price: parseFloat(invRes.rows[0].avg_price) || 0.00
    });
  } catch (err) {
    console.error('Error fetching inventory availability:', err.message);
    res.status(500).json({ error: 'Failed to fetch inventory availability' });
  }
});

// Update inventory entry
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const {
    item_code,
    quantity,
    price,
    rack,
    shelf_number,
    location,
    trade_id,
    message,
    trace_item_id
  } = req.body || {};

  if (!item_code) {
    return res.status(400).json({ error: 'item_code is required' });
  }

  try {
    // Resolve itemDbId
    const itemRes = await pool.query('SELECT id FROM items WHERE item_code = $1 AND company_id = $2', [item_code, req.user.company_id]);
    if (itemRes.rows.length === 0) {
      return res.status(400).json({ error: `Item ${item_code} not found` });
    }
    const itemDbId = itemRes.rows[0].id;

    // Resolve tradeDbId
    let tradeDbId = null;
    if (trade_id) {
      const tradeRes = await pool.query('SELECT id FROM trades WHERE trade_id = $1 AND company_id = $2', [trade_id, req.user.company_id]);
      if (tradeRes.rows.length > 0) {
        tradeDbId = tradeRes.rows[0].id;
      }
    }

    const result = await pool.query(
      `UPDATE inventory 
       SET item_code = $1, 
           quantity = $2, 
           price = $3,
           rack = $4, 
           shelf_number = $5, 
           location = $6, 
           trade_id = $7, 
           message = $8,
           trace_item_id = $9,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $10 AND company_id = $11 
       RETURNING id`,
      [
        itemDbId,
        parseInt(quantity) || 0,
        parseFloat(price) || 0.00,
        rack || null,
        shelf_number || null,
        location || null,
        tradeDbId,
        message || null,
        trace_item_id ? parseInt(trace_item_id) : null,
        id,
        req.user.company_id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Inventory record not found' });
    }

    // Fetch updated record with joined details
    const joinedRes = await pool.query(
      `SELECT inv.id, it.item_code, inv.quantity, inv.price, inv.rack, inv.shelf_number,
             inv.location, t.trade_id, inv.message, inv.trace_item_id,
             p.status AS trace_status, p.process AS trace_process,
             COALESCE((
               SELECT SUM((elem->>'unit_price')::numeric)
               FROM jsonb_array_elements(
                 CASE 
                   WHEN jsonb_typeof(p.process) = 'array' THEN p.process 
                   ELSE '[]'::jsonb 
                 END
               ) elem
               WHERE elem->>'unit_price' IS NOT NULL AND (elem->>'unit_price')::numeric > 0
             ), inv.price) AS calculated_price,
             inv.company_id, inv.created_at, inv.updated_at,
             it.description, it.drawing_number,
             m.completed_quantity AS mfg_completed_qty,
             m.expected_quantity AS mfg_expected_qty,
             m.completed AS mfg_is_completed
      FROM inventory inv
      LEFT JOIN items it ON inv.item_code = it.id
      LEFT JOIN trades t ON inv.trade_id = t.id
      LEFT JOIN trace_item p ON inv.trace_item_id = p.id
      LEFT JOIN manufacture m ON inv.trace_item_id = m.target_trace_item_id AND m.company_id = inv.company_id
       WHERE inv.id = $1 AND inv.company_id = $2`,
      [id, req.user.company_id]
    );

    res.json(joinedRes.rows[0]);
  } catch (err) {
    console.error('Error updating inventory entry:', err.message);
    res.status(500).json({ error: 'Failed to update inventory entry' });
  }
});

// Delete inventory entry
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM inventory WHERE id = $1 AND company_id = $2 RETURNING id', [id, req.user.company_id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Inventory record not found' });
    }
    res.json({ message: 'Inventory record deleted successfully', id });
  } catch (err) {
    console.error('Error deleting inventory entry:', err.message);
    res.status(500).json({ error: 'Failed to delete inventory entry' });
  }
});

module.exports = router;
