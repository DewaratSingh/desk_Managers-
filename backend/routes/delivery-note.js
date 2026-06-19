const express = require('express');
const router = express.Router();
const { pool, appendDocToTrade } = require('../db');

// GET a single Delivery Note details by delivery_note_no
router.get('/:delivery_note_no', async (req, res) => {
  const { delivery_note_no } = req.params;
  try {
    const result = await pool.query(`
      SELECT
        dn.delivery_note_no, dn.po_no, dn.ro_no, dn.delivery_date,
        dn.dispatch_doc_no, dn.dispatch_through, dn.motor_vehicle_no, dn.trade_id,
        (
          SELECT COALESCE(json_agg(json_build_object(
            'item_code', dni.item_code,
            'quantity', dni.quantity,
            'rate_per_piece', dni.rate_per_piece,
            'shipping_address', dni.shipping_address,
            'delivery_date', dni.delivery_date,
            'description', i.description,
            'drawing_number', i.drawing_number
          ) ORDER BY dni.id), '[]')
          FROM delivery_note_items dni
          LEFT JOIN items i ON dni.item_code = i.item_code
          WHERE dni.delivery_note_no = dn.delivery_note_no
        ) as items
      FROM delivery_notes dn
      WHERE dn.delivery_note_no = $1
    `, [delivery_note_no]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Delivery Note not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching Delivery Note:', err.message);
    res.status(500).json({ error: 'Failed to fetch Delivery Note' });
  }
});

// GET items from linked PO/RO to deliver, computing remaining quantities
router.get('/items-lookup/:trade_id', async (req, res) => {
  const { trade_id } = req.params;
  const { exclude_dn_no } = req.query;

  try {
    // 1. Get the trade documents
    const tradeRes = await pool.query('SELECT trade_type, documents FROM trades WHERE trade_id = $1', [trade_id]);
    if (tradeRes.rows.length === 0) {
      return res.status(404).json({ error: 'Trade not found' });
    }
    const trade = tradeRes.rows[0];
    const docs = trade.documents || [];

    const poDoc = docs.find(d => d.type === 'PO' || d.type === 'PURCHASE_ORDER');
    const roDoc = docs.find(d => d.type === 'RO');

    const po_no = poDoc ? poDoc.id : null;
    const ro_no = roDoc ? roDoc.id : null;

    if (!po_no && !ro_no) {
      return res.status(400).json({ error: 'No Purchase Order or Release Order found for this trade' });
    }

    let items = [];
    if (ro_no) {
      const roItemsRes = await pool.query(
        `SELECT
          roi.item_code,
          roi.quantity as original_qty,
          roi.unit_price as rate_per_piece,
          roi.shipping_address,
          roi.delivery_date,
          i.description,
          i.drawing_number,
          COALESCE((
            SELECT SUM(dni.quantity)
            FROM delivery_note_items dni
            JOIN delivery_notes dn ON dni.delivery_note_no = dn.delivery_note_no
            WHERE dn.trade_id = $1
              AND dni.item_code = roi.item_code
              AND ($3::varchar IS NULL OR dn.delivery_note_no != $3)
          ), 0) as delivered_qty
        FROM release_order_items roi
        LEFT JOIN items i ON roi.item_code = i.item_code
        WHERE roi.ro_no = $2
        ORDER BY roi.id`,
        [trade_id, ro_no, exclude_dn_no || null]
      );
      items = roItemsRes.rows;
    } else if (po_no) {
      const poItemsRes = await pool.query(
        `SELECT
          poi.item_code,
          poi.quantity as original_qty,
          poi.unit_price as rate_per_piece,
          poi.shipping_address,
          poi.delivery_date,
          i.description,
          i.drawing_number,
          COALESCE((
            SELECT SUM(dni.quantity)
            FROM delivery_note_items dni
            JOIN delivery_notes dn ON dni.delivery_note_no = dn.delivery_note_no
            WHERE dn.trade_id = $1
              AND dni.item_code = poi.item_code
              AND ($3::varchar IS NULL OR dn.delivery_note_no != $3)
          ), 0) as delivered_qty
        FROM purchase_order_items poi
        LEFT JOIN items i ON poi.item_code = i.item_code
        WHERE poi.po_no = $2
        ORDER BY poi.id`,
        [trade_id, po_no, exclude_dn_no || null]
      );
      items = poItemsRes.rows;
    }

    // Map remaining quantities
    const mappedItems = items.map(item => {
      const original = parseInt(item.original_qty) || 0;
      const delivered = parseInt(item.delivered_qty) || 0;
      const remaining = Math.max(0, original - delivered);
      return {
        ...item,
        original_qty: original,
        delivered_qty: delivered,
        remaining_qty: remaining
      };
    });

    res.json({
      po_no,
      ro_no,
      items: mappedItems
    });
  } catch (err) {
    console.error('Error in items-lookup:', err.message);
    res.status(500).json({ error: 'Failed to look up deliverable items' });
  }
});

// CREATE a custom Delivery Note
router.post('/', async (req, res) => {
  const {
    delivery_note_no,
    delivery_date,
    dispatch_through,
    dispatch_doc_no,
    motor_vehicle_no,
    trade_id,
    items
  } = req.body || {};

  if (!delivery_note_no || !delivery_date || !dispatch_through || !motor_vehicle_no || !trade_id) {
    return res.status(400).json({ error: 'Missing required Delivery Note fields' });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'At least one item must be included in the delivery note' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Check duplicate delivery_note_no
    const dupCheck = await client.query('SELECT delivery_note_no FROM delivery_notes WHERE delivery_note_no = $1', [delivery_note_no]);
    if (dupCheck.rows.length > 0) {
      throw new Error('Delivery Note number already exists');
    }

    // 2. Fetch trade details to resolve PO/RO
    const tradeRes = await client.query('SELECT documents FROM trades WHERE trade_id = $1', [trade_id]);
    if (tradeRes.rows.length === 0) {
      throw new Error('Trade not found');
    }
    const trade = tradeRes.rows[0];
    const docs = trade.documents || [];

    const poDoc = docs.find(d => d.type === 'PO' || d.type === 'PURCHASE_ORDER');
    const roDoc = docs.find(d => d.type === 'RO');

    const po_no = poDoc ? poDoc.id : null;
    const ro_no = roDoc ? roDoc.id : null;

    // 3. Insert Delivery Note header
    await client.query(
      `INSERT INTO delivery_notes (delivery_note_no, po_no, ro_no, delivery_date, dispatch_doc_no, dispatch_through, motor_vehicle_no, trade_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        delivery_note_no,
        po_no,
        ro_no,
        delivery_date,
        dispatch_doc_no || null,
        dispatch_through,
        motor_vehicle_no,
        trade_id
      ]
    );

    // 4. Insert items
    for (const item of items) {
      await client.query(
        `INSERT INTO delivery_note_items (delivery_note_no, item_code, quantity, rate_per_piece, shipping_address, delivery_date)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          delivery_note_no,
          item.item_code,
          parseInt(item.quantity) || 0,
          parseFloat(item.rate_per_piece) || 0,
          item.shipping_address || null,
          item.delivery_date || null
        ]
      );
    }

    // 5. Append to trade documents (which calculates trade status to 'dn')
    await appendDocToTrade(client, trade_id, 'DN', delivery_note_no);

    await client.query('COMMIT');
    res.status(201).json({ delivery_note_no, trade_id });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating Delivery Note:', err.message);
    res.status(500).json({ error: err.message || 'Failed to create Delivery Note' });
  } finally {
    client.release();
  }
});

// UPDATE an existing Delivery Note
router.put('/:delivery_note_no', async (req, res) => {
  const { delivery_note_no } = req.params;
  const {
    delivery_date,
    dispatch_through,
    dispatch_doc_no,
    motor_vehicle_no,
    items
  } = req.body || {};

  if (!delivery_date || !dispatch_through || !motor_vehicle_no) {
    return res.status(400).json({ error: 'Missing required Delivery Note fields' });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'At least one item must be included in the delivery note' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Update header
    const updateHeader = await client.query(
      `UPDATE delivery_notes
       SET delivery_date = $1, dispatch_doc_no = $2, dispatch_through = $3, motor_vehicle_no = $4
       WHERE delivery_note_no = $5 RETURNING *`,
      [delivery_date, dispatch_doc_no || null, dispatch_through, motor_vehicle_no, delivery_note_no]
    );

    if (updateHeader.rows.length === 0) {
      throw new Error('Delivery Note not found');
    }

    // 2. Rewrite items
    await client.query('DELETE FROM delivery_note_items WHERE delivery_note_no = $1', [delivery_note_no]);

    for (const item of items) {
      await client.query(
        `INSERT INTO delivery_note_items (delivery_note_no, item_code, quantity, rate_per_piece, shipping_address, delivery_date)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          delivery_note_no,
          item.item_code,
          parseInt(item.quantity) || 0,
          parseFloat(item.rate_per_piece) || 0,
          item.shipping_address || null,
          item.delivery_date || null
        ]
      );
    }

    await client.query('COMMIT');
    res.json({ delivery_note_no });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating Delivery Note:', err.message);
    res.status(500).json({ error: err.message || 'Failed to update Delivery Note' });
  } finally {
    client.release();
  }
});

module.exports = router;
