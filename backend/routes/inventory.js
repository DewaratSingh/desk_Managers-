const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { requirePermission, sanitizePrices } = require('../middleware/auth');

// GET inventory items (joined from trace and inventory)
router.get('/', requirePermission('manage_inventory'), async (req, res) => {
  const { q } = req.query || {};
  const limit = req.query.limit ? parseInt(req.query.limit) : null;
  const offset = req.query.offset ? parseInt(req.query.offset) : 0;
  
  try {
    let queryText = `
      SELECT t.id, t.qty, t.cost_price, t.history, t.status, t.created_at,
             inv.location, inv.id AS inventory_id,
             it.item_code, it.drawing_number,
             t.company_id
      FROM trace t
      JOIN inventory inv ON t.inventory_id = inv.id
      JOIN items it ON t.item_code = it.id
      WHERE t.company_id = $1 AND t.qty > 0
    `;
    const params = [req.user.company_id];

    if (q) {
      queryText += `
        AND (it.item_code ILIKE $2 
           OR inv.location ILIKE $2 
           OR it.description ILIKE $2)
      `;
      params.push(`%${q}%`);
    }
    
    queryText += ` ORDER BY t.created_at DESC`;

    if (limit !== null) {
      queryText += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);
    } else if (q) {
      queryText += ` LIMIT 5`; 
    }

    const result = await pool.query(queryText, params);
    res.json(sanitizePrices(result.rows, req.user));
  } catch (err) {
    console.error('Error fetching inventory:', err.message);
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});

// GET inventory positions for a specific item code
router.get('/locations-by-item', async (req, res) => {
  const { item_code } = req.query || {};
  if (!item_code) return res.status(400).json({ error: 'item_code is required' });

  try {
    const itemRes = await pool.query(
      'SELECT id FROM items WHERE item_code = $1 AND company_id = $2',
      [item_code.trim(), req.user.company_id]
    );

    if (itemRes.rows.length === 0) return res.json([]);
    const itemDbId = itemRes.rows[0].id;

    const result = await pool.query(
      `SELECT t.id, t.qty, t.cost_price, t.history, t.status, t.created_at,
              inv.location, inv.id AS inventory_id,
              it.item_code, it.drawing_number
       FROM trace t
       JOIN inventory inv ON t.inventory_id = inv.id
       JOIN items it ON t.item_code = it.id
       WHERE t.item_code = $1 AND t.company_id = $2 AND t.qty > 0
       ORDER BY t.created_at DESC`,
      [itemDbId, req.user.company_id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching locations:', err.message);
    res.status(500).json({ error: 'Failed to fetch locations' });
  }
});

// GET stock for item (specifically 'In Inventory' status for selling)
router.get('/stock-by-item', async (req, res) => {
  const { item_code } = req.query || {};
  if (!item_code) return res.status(400).json({ error: 'item_code is required' });

  try {
    const itemRes = await pool.query(
      'SELECT id FROM items WHERE item_code = $1 AND company_id = $2',
      [item_code.trim(), req.user.company_id]
    );
    if (itemRes.rows.length === 0) return res.json([]);
    
    const itemDbId = itemRes.rows[0].id;
    const result = await pool.query(
      `SELECT t.id, t.qty, t.cost_price, t.history, t.status, t.created_at,
              inv.location, inv.id AS inventory_id,
              it.item_code
       FROM trace t
       JOIN inventory inv ON t.inventory_id = inv.id
       JOIN items it ON t.item_code = it.id
       WHERE t.item_code = $1 AND t.company_id = $2 AND t.qty > 0
       ORDER BY t.created_at ASC`,
      [itemDbId, req.user.company_id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching stock:', err.message);
    res.status(500).json({ error: 'Failed to fetch stock' });
  }
});

// GET eligible trades for sell (legacy route preserved for Delivery Note usage)
router.get('/sell/eligible-trades', async (req, res) => {
  const { item_code, q } = req.query || {};
  if (!item_code) return res.status(400).json({ error: 'item_code is required' });

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
    const mapped = result.rows.map(row => {
      const orderQty = parseInt(row.order_qty) || 0;
      const deliveredQty = parseInt(row.delivered_qty) || 0;
      return {
        ...row,
        order_qty: orderQty,
        delivered_qty: deliveredQty,
        remaining_qty: Math.max(0, orderQty - deliveredQty)
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
    if (itemRes.rows.length === 0) return res.json({ available_qty: 0, price: 0 });
    
    const itemDbId = itemRes.rows[0].id;
    const result = await pool.query(
      `SELECT COALESCE(SUM(qty), 0) AS total_qty, 
              COALESCE(AVG(cost_price), 0.00) AS avg_price 
       FROM trace 
       WHERE item_code = $1 AND company_id = $2`,
      [itemDbId, req.user.company_id]
    );
    res.json({
      available_qty: parseInt(result.rows[0].total_qty) || 0,
      price: parseFloat(result.rows[0].avg_price) || 0.00
    });
  } catch (err) {
    console.error('Error fetching availability:', err.message);
    res.status(500).json({ error: 'Failed to fetch availability' });
  }
});

// POST Create or merge inventory entry
router.post('/', async (req, res) => {
  const {
    item_code,
    qty,
    cost_price,
    location,
    status,
    history,
    selected_inventory_id // if merging into existing bin
  } = req.body || {};

  if (!item_code) return res.status(400).json({ error: 'item_code is required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const companyId = req.user.company_id;

    const itemRes = await client.query('SELECT id FROM items WHERE item_code = $1 AND company_id = $2', [item_code, companyId]);
    if (itemRes.rows.length === 0) throw new Error(`Item ${item_code} not found`);
    const itemDbId = itemRes.rows[0].id;

    let targetInvId = selected_inventory_id ? parseInt(selected_inventory_id) : null;
    const targetLocation = location || 'Default Location';
    
    // Find or create inventory bin
    if (!targetInvId) {
      const invCheck = await client.query(
        'SELECT id FROM inventory WHERE LOWER(location) = LOWER($1) AND company_id = $2',
        [targetLocation, companyId]
      );
      if (invCheck.rows.length > 0) {
        targetInvId = invCheck.rows[0].id;
      } else {
        const invInsert = await client.query(
          'INSERT INTO inventory (location, company_id) VALUES ($1, $2) RETURNING id',
          [targetLocation, companyId]
        );
        targetInvId = invInsert.rows[0].id;
      }
    }

    const addedQty = parseFloat(qty) || 0;
    const addedPrice = parseFloat(cost_price) || 0.00;
    const targetStatus = status || 'In Inventory';
    const traceHistory = history || [];

    // Check if we can merge into an existing trace row in that bin
    const traceCheck = await client.query(
      `SELECT id, qty, cost_price FROM trace 
       WHERE item_code = $1 AND inventory_id = $2 AND LOWER(status) = LOWER($3) AND company_id = $4`,
      [itemDbId, targetInvId, targetStatus, companyId]
    );

    let finalTraceId = null;
    if (traceCheck.rows.length > 0) {
      // Merge
      const exRow = traceCheck.rows[0];
      const exQty = parseFloat(exRow.qty) || 0;
      const exPrice = parseFloat(exRow.cost_price) || 0;
      const newQty = exQty + addedQty;
      const newPrice = newQty > 0 ? ((exQty * exPrice) + (addedQty * addedPrice)) / newQty : addedPrice;

      await client.query(
        `UPDATE trace 
         SET qty = $1, cost_price = $2 
         WHERE id = $3 AND company_id = $4`,
        [newQty, newPrice, exRow.id, companyId]
      );
      finalTraceId = exRow.id;
    } else {
      // Insert new trace row
      const traceInsert = await client.query(
        `INSERT INTO trace (item_code, qty, cost_price, inventory_id, history, status, company_id)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7) RETURNING id`,
        [itemDbId, addedQty, addedPrice, targetInvId, JSON.stringify(traceHistory), targetStatus, companyId]
      );
      finalTraceId = traceInsert.rows[0].id;
    }

    await client.query('COMMIT');
    
    // Fetch result
    const joinedRes = await pool.query(
      `SELECT t.id, t.qty, t.cost_price, t.history, t.status, t.created_at,
              inv.location, inv.id AS inventory_id,
              it.item_code, it.description, it.drawing_number
       FROM trace t
       JOIN inventory inv ON t.inventory_id = inv.id
       JOIN items it ON t.item_code = it.id
       WHERE t.id = $1 AND t.company_id = $2`,
      [finalTraceId, companyId]
    );
    res.status(201).json(joinedRes.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating inventory:', err.message);
    res.status(500).json({ error: err.message || 'Failed to save inventory entry' });
  } finally {
    client.release();
  }
});

// GET single trace entry with full joined info and history
router.get('/trace/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT t.id, t.qty, t.cost_price, t.history, t.status, t.created_at,
              inv.location, inv.id AS inventory_id,
              it.item_code, it.drawing_number,
              t.company_id
       FROM trace t
       JOIN inventory inv ON t.inventory_id = inv.id
       JOIN items it ON t.item_code = it.id
       WHERE t.id = $1 AND t.company_id = $2`,
      [id, req.user.company_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Trace entry not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching trace history:', err.message);
    res.status(500).json({ error: 'Failed to fetch trace history' });
  }
});

// PUT Update inventory (updates trace row, might move to new inventory bin)
router.put('/:id', async (req, res) => {
  const { id } = req.params; // Trace ID
  const {
    item_code,
    qty,
    cost_price,
    location,
    status,
    history
  } = req.body || {};

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const companyId = req.user.company_id;

    const traceRes = await client.query('SELECT * FROM trace WHERE id = $1 AND company_id = $2', [id, companyId]);
    if (traceRes.rows.length === 0) throw new Error('Record not found');
    const oldTrace = traceRes.rows[0];

    // Find or create inventory bin for the location
    const targetLocation = location || 'Default Location';
    let targetInvId = oldTrace.inventory_id;
    
    const invCheck = await client.query(
      'SELECT id FROM inventory WHERE LOWER(location) = LOWER($1) AND company_id = $2',
      [targetLocation, companyId]
    );
    if (invCheck.rows.length > 0) {
      targetInvId = invCheck.rows[0].id;
    } else {
      const invInsert = await client.query(
        'INSERT INTO inventory (location, company_id) VALUES ($1, $2) RETURNING id',
        [targetLocation, companyId]
      );
      targetInvId = invInsert.rows[0].id;
    }

    let itemDbId = oldTrace.item_code;
    if (item_code) {
      const itemRes = await client.query('SELECT id FROM items WHERE item_code = $1 AND company_id = $2', [item_code, companyId]);
      if (itemRes.rows.length > 0) itemDbId = itemRes.rows[0].id;
    }

    await client.query(
      `UPDATE trace 
       SET item_code = $1, qty = $2, cost_price = $3, inventory_id = $4, status = $5,
           history = COALESCE($6::jsonb, history)
       WHERE id = $7 AND company_id = $8`,
      [
        itemDbId,
        parseFloat(qty) || 0,
        parseFloat(cost_price) || 0,
        targetInvId,
        status || oldTrace.status,
        history ? JSON.stringify(history) : null,
        id,
        companyId
      ]
    );

    await client.query('COMMIT');
    
    const joinedRes = await pool.query(
      `SELECT t.id, t.qty, t.cost_price, t.history, t.status, t.created_at,
              inv.location, inv.id AS inventory_id,
              it.item_code, it.description, it.drawing_number
       FROM trace t
       JOIN inventory inv ON t.inventory_id = inv.id
       JOIN items it ON t.item_code = it.id
       WHERE t.id = $1 AND t.company_id = $2`,
      [id, companyId]
    );
    res.json(joinedRes.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating inventory:', err.message);
    res.status(500).json({ error: err.message || 'Failed to update inventory entry' });
  } finally {
    client.release();
  }
});

// DELETE trace entry
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM trace WHERE id = $1 AND company_id = $2 RETURNING id', [id, req.user.company_id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Record not found' });
    res.json({ message: 'Record deleted successfully', id });
  } catch (err) {
    console.error('Error deleting inventory entry:', err.message);
    res.status(500).json({ error: 'Failed to delete entry' });
  }
});

module.exports = router;
