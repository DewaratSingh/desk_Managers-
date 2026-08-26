const express = require('express');
const router = express.Router();
const { pool, appendDocToTrade } = require('../db');

// GET a single Delivery Note details by delivery_note_no
router.get('/:delivery_note_no', async (req, res) => {
  const { delivery_note_no } = req.params;
  try {
    const result = await pool.query(`
      SELECT
        dn.delivery_note_no, po.po_no, ro.ro_no, dn.delivery_date,
        dn.dispatch_doc_no, dn.dispatch_through, dn.motor_vehicle_no, t.trade_id,
        (
          SELECT COALESCE(json_agg(json_build_object(
            'item_code', i.item_code,
            'quantity', dni.quantity,
            'rate_per_piece', dni.rate_per_piece,
            'shipping_address', dni.shipping_address,
            'delivery_date', dni.delivery_date,
            'description', i.description,
            'drawing_number', i.drawing_number,
            'next_activity', dni.next_activity
          ) ORDER BY dni.id), '[]')
          FROM delivery_note_items dni
          LEFT JOIN items i ON dni.item_id = i.id AND i.company_id = dni.company_id
          WHERE dni.delivery_note_id = dn.id AND dni.company_id = dn.company_id
        ) as items
      FROM delivery_notes dn
      LEFT JOIN purchase_orders po ON dn.po_id = po.id
      LEFT JOIN release_orders ro ON dn.ro_id = ro.id
      LEFT JOIN trades t ON dn.trade_id = t.id
      WHERE dn.delivery_note_no = $1 AND dn.company_id = $2
    `, [delivery_note_no, req.user.company_id]);

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
  const { exclude_dn_no } = req.query || {};

  try {
    // 1. Get the trade documents
    const tradeRes = await pool.query('SELECT id, trade_type, documents FROM trades WHERE trade_id = $1 AND company_id = $2', [trade_id, req.user.company_id]);
    if (tradeRes.rows.length === 0) {
      return res.status(404).json({ error: 'Trade not found' });
    }
    const trade = tradeRes.rows[0];
    const tradeDbId = trade.id;
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
      const roRes = await pool.query('SELECT id FROM release_orders WHERE ro_no = $1 AND company_id = $2', [ro_no, req.user.company_id]);
      if (roRes.rows.length === 0) {
        return res.status(404).json({ error: 'Release Order not found' });
      }
      const roDbId = roRes.rows[0].id;

      const roItemsRes = await pool.query(
        `SELECT
          i.item_code,
          roi.quantity as original_qty,
          roi.unit_price as rate_per_piece,
          roi.shipping_address,
          roi.delivery_date,
          i.description,
          i.drawing_number,
          COALESCE((
            SELECT SUM(dni.quantity)
            FROM delivery_note_items dni
            JOIN delivery_notes dn ON dni.delivery_note_id = dn.id
            WHERE dn.trade_id = $1 AND dn.company_id = $4
              AND dni.item_id = roi.item_id
              AND ($3::varchar IS NULL OR dn.delivery_note_no != $3)
          ), 0) - COALESCE((
            SELECT SUM((elem->>'quantity')::numeric)
            FROM grns g
            CROSS JOIN LATERAL jsonb_array_elements(COALESCE(g.rejection_items, '[]'::jsonb)) AS elem
            WHERE g.trade_id = $1 AND g.company_id = $4
              AND elem->>'item_code' = i.item_code
              AND ($3::varchar IS NULL OR (SELECT delivery_note_no FROM delivery_notes WHERE id = g.delivery_note_id) != $3)
          ), 0) as delivered_qty
        FROM release_order_items roi
        LEFT JOIN items i ON roi.item_id = i.id AND i.company_id = roi.company_id
        WHERE roi.ro_id = $2 AND roi.company_id = $4
        ORDER BY roi.id`,
        [tradeDbId, roDbId, exclude_dn_no || null, req.user.company_id]
      );
      items = roItemsRes.rows;
    } else if (po_no) {
      const poRes = await pool.query('SELECT id FROM purchase_orders WHERE po_no = $1 AND company_id = $2', [po_no, req.user.company_id]);
      if (poRes.rows.length === 0) {
        return res.status(404).json({ error: 'Purchase Order not found' });
      }
      const poDbId = poRes.rows[0].id;

      const poItemsRes = await pool.query(
        `SELECT
          i.item_code,
          poi.quantity as original_qty,
          poi.unit_price as rate_per_piece,
          poi.shipping_address,
          poi.delivery_date,
          i.description,
          i.drawing_number,
          COALESCE((
            SELECT SUM(dni.quantity)
            FROM delivery_note_items dni
            JOIN delivery_notes dn ON dni.delivery_note_id = dn.id
            WHERE dn.trade_id = $1 AND dn.company_id = $4
              AND dni.item_id = poi.item_id
              AND ($3::varchar IS NULL OR dn.delivery_note_no != $3)
          ), 0) - COALESCE((
            SELECT SUM((elem->>'quantity')::numeric)
            FROM grns g
            CROSS JOIN LATERAL jsonb_array_elements(COALESCE(g.rejection_items, '[]'::jsonb)) AS elem
            WHERE g.trade_id = $1 AND g.company_id = $4
              AND elem->>'item_code' = i.item_code
              AND ($3::varchar IS NULL OR (SELECT delivery_note_no FROM delivery_notes WHERE id = g.delivery_note_id) != $3)
          ), 0) as delivered_qty
        FROM purchase_order_items poi
        LEFT JOIN items i ON poi.item_id = i.id AND i.company_id = poi.company_id
        WHERE poi.po_id = $2 AND poi.company_id = $4
        ORDER BY poi.id`,
        [tradeDbId, poDbId, exclude_dn_no || null, req.user.company_id]
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
    const dupCheck = await client.query('SELECT delivery_note_no FROM delivery_notes WHERE delivery_note_no = $1 AND company_id = $2', [delivery_note_no, req.user.company_id]);
    if (dupCheck.rows.length > 0) {
      throw new Error('Delivery Note number already exists');
    }

    // 2. Fetch trade details to resolve PO/RO
    const tradeRes = await client.query('SELECT id, trade_id, documents FROM trades WHERE trade_id = $1 AND company_id = $2', [trade_id, req.user.company_id]);
    if (tradeRes.rows.length === 0) {
      throw new Error('Trade not found');
    }
    const trade = tradeRes.rows[0];
    const tradeDbId = trade.id;
    const trade_code = trade.trade_id;
    const docs = trade.documents || [];

    const poDoc = docs.find(d => d.type === 'PO' || d.type === 'PURCHASE_ORDER');
    const roDoc = docs.find(d => d.type === 'RO');

    const po_no = poDoc ? poDoc.id : null;
    const ro_no = roDoc ? roDoc.id : null;

    let poDbId = null;
    let roDbId = null;

    if (po_no) {
      const poRes = await client.query('SELECT id FROM purchase_orders WHERE po_no = $1 AND company_id = $2', [po_no, req.user.company_id]);
      if (poRes.rows.length > 0) poDbId = poRes.rows[0].id;
    }
    if (ro_no) {
      const roRes = await client.query('SELECT id FROM release_orders WHERE ro_no = $1 AND company_id = $2', [ro_no, req.user.company_id]);
      if (roRes.rows.length > 0) roDbId = roRes.rows[0].id;
    }

    // 3. Insert Delivery Note header
    const dnRes = await client.query(
      `INSERT INTO delivery_notes (delivery_note_no, po_id, ro_id, delivery_date, dispatch_doc_no, dispatch_through, motor_vehicle_no, trade_id, company_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [
        delivery_note_no,
        poDbId,
        roDbId,
        delivery_date,
        dispatch_doc_no || null,
        dispatch_through,
        motor_vehicle_no,
        tradeDbId,
        req.user.company_id
      ]
    );
    const dnDbId = dnRes.rows[0].id;

    // 4. Insert items
    for (const item of items) {
      const itemRes = await client.query('SELECT id FROM items WHERE item_code = $1 AND company_id = $2', [item.item_code, req.user.company_id]);
      if (itemRes.rows.length === 0) {
        throw new Error(`Item ${item.item_code} not found`);
      }
      const itemDbId = itemRes.rows[0].id;

      let pItemId = null;
      if (item.inv_qty > 0) {
        // Insert into P_item
        const pRes = await client.query(
          `INSERT INTO P_item (item_code, process, message, quantity, price, company_id)
           VALUES ($1, ARRAY[$2]::INTEGER[], $3, $4, $5, $6) RETURNING id`,
          [
            itemDbId,
            tradeDbId,
            item.inv_details?.message || `Added from DN: ${delivery_note_no}`,
            parseInt(item.inv_qty) || 0,
            parseFloat(item.inv_details?.price || item.rate_per_piece) || 0.00,
            req.user.company_id
          ]
        );
        pItemId = pRes.rows[0].id;

        // Insert into inventory
        await client.query(
          `INSERT INTO inventory (item_code, quantity, price, rack, shelf_number, location, trade_id, message, company_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            itemDbId,
            parseInt(item.inv_qty) || 0,
            parseFloat(item.inv_details?.price || item.rate_per_piece) || 0.00,
            item.inv_details?.rack || null,
            item.inv_details?.shelf_number || null,
            item.inv_details?.location || null,
            tradeDbId,
            item.inv_details?.message || null,
            req.user.company_id
          ]
        );
      }

      const next_activity = {
        inventory: item.inv_qty > 0 ? { quantity: parseInt(item.inv_qty), P_item_id: pItemId } : null,
        sell: item.sell_qty > 0 ? { quantity: parseInt(item.sell_qty), tradeID: trade_code } : null,
        process: item.process_qty > 0 ? { quantity: parseInt(item.process_qty), tradeID: trade_code } : null
      };

      await client.query(
        `INSERT INTO delivery_note_items (delivery_note_id, item_id, quantity, rate_per_piece, shipping_address, delivery_date, company_id, next_activity)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          dnDbId,
          itemDbId,
          parseInt(item.quantity) || 0,
          parseFloat(item.rate_per_piece) || 0,
          item.shipping_address || null,
          item.delivery_date || null,
          req.user.company_id,
          JSON.stringify(next_activity)
        ]
      );
    }

    // 5. Append to trade documents
    await appendDocToTrade(client, trade_code, 'DN', delivery_note_no, req.user.company_id);

    // Update trade delivery status
    await updateTradeDeliveryStatus(client, tradeDbId, req.user.company_id);

    await client.query('COMMIT');
    res.status(201).json({ delivery_note_no, trade_id: trade_code });
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
       WHERE delivery_note_no = $5 AND company_id = $6 RETURNING id`,
      [delivery_date, dispatch_doc_no || null, dispatch_through, motor_vehicle_no, delivery_note_no, req.user.company_id]
    );

    if (updateHeader.rows.length === 0) {
      throw new Error('Delivery Note not found');
    }
    const dnDbId = updateHeader.rows[0].id;

    // 2. Resolve trade ID and trade code
    let tradeDbId = null;
    let trade_code = null;
    const tradeRes = await client.query('SELECT t.id, t.trade_id FROM delivery_notes dn JOIN trades t ON dn.trade_id = t.id WHERE dn.delivery_note_no = $1 AND dn.company_id = $2', [delivery_note_no, req.user.company_id]);
    if (tradeRes.rows.length > 0) {
      tradeDbId = tradeRes.rows[0].id;
      trade_code = tradeRes.rows[0].trade_id;
    }

    // 3. Rewrite items
    await client.query('DELETE FROM delivery_note_items WHERE delivery_note_id = $1 AND company_id = $2', [dnDbId, req.user.company_id]);

    for (const item of items) {
      const itemRes = await client.query('SELECT id FROM items WHERE item_code = $1 AND company_id = $2', [item.item_code, req.user.company_id]);
      if (itemRes.rows.length === 0) {
        throw new Error(`Item ${item.item_code} not found`);
      }
      const itemDbId = itemRes.rows[0].id;

      let pItemId = null;
      if (item.inv_qty > 0) {
        // Insert into P_item
        const pRes = await client.query(
          `INSERT INTO P_item (item_code, process, message, quantity, price, company_id)
           VALUES ($1, ARRAY[$2]::INTEGER[], $3, $4, $5, $6) RETURNING id`,
          [
            itemDbId,
            tradeDbId,
            item.inv_details?.message || `Updated from DN: ${delivery_note_no}`,
            parseInt(item.inv_qty) || 0,
            parseFloat(item.inv_details?.price || item.rate_per_piece) || 0.00,
            req.user.company_id
          ]
        );
        pItemId = pRes.rows[0].id;

        // Insert into inventory
        await client.query(
          `INSERT INTO inventory (item_code, quantity, price, rack, shelf_number, location, trade_id, message, company_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            itemDbId,
            parseInt(item.inv_qty) || 0,
            parseFloat(item.inv_details?.price || item.rate_per_piece) || 0.00,
            item.inv_details?.rack || null,
            item.inv_details?.shelf_number || null,
            item.inv_details?.location || null,
            tradeDbId,
            item.inv_details?.message || null,
            req.user.company_id
          ]
        );
      }

      const next_activity = {
        inventory: item.inv_qty > 0 ? { quantity: parseInt(item.inv_qty), P_item_id: pItemId } : null,
        sell: item.sell_qty > 0 ? { quantity: parseInt(item.sell_qty), tradeID: trade_code } : null,
        process: item.process_qty > 0 ? { quantity: parseInt(item.process_qty), tradeID: trade_code } : null
      };

      await client.query(
        `INSERT INTO delivery_note_items (delivery_note_id, item_id, quantity, rate_per_piece, shipping_address, delivery_date, company_id, next_activity)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          dnDbId,
          itemDbId,
          parseInt(item.quantity) || 0,
          parseFloat(item.rate_per_piece) || 0,
          item.shipping_address || null,
          item.delivery_date || null,
          req.user.company_id,
          JSON.stringify(next_activity)
        ]
      );
    }

    // Resolve trade_id and update trade delivery status
    if (tradeDbId) {
      await updateTradeDeliveryStatus(client, tradeDbId, req.user.company_id);
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

async function updateTradeDeliveryStatus(client, trade_id, company_id) {
  if (!trade_id) return;

  const pctRes = await client.query(`
    SELECT 
      CASE WHEN ordered_val > 0 THEN (delivered_val / ordered_val) * 100 ELSE 0.0 END AS pct
    FROM (
      SELECT
        COALESCE(
          (SELECT SUM(poi.quantity * poi.unit_price) FROM purchase_orders po JOIN purchase_order_items poi ON po.id = poi.po_id WHERE po.trade_id = $1 AND po.company_id = $2),
          (SELECT SUM(roi.quantity * roi.unit_price) FROM release_orders ro JOIN release_order_items roi ON ro.id = roi.ro_id WHERE ro.trade_id = $1 AND ro.company_id = $2),
          0
        )::numeric AS ordered_val,
        COALESCE(
          (
            SELECT SUM(
              (
                dni.quantity - COALESCE((
                  SELECT SUM((elem->>'quantity')::numeric)
                  FROM grns g
                  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(g.rejection_items, '[]'::jsonb)) AS elem
                  WHERE g.delivery_note_id = dn.id
                    AND elem->>'item_code' = i.item_code
                    AND g.company_id = $2
                ), 0)
              ) * poi.unit_price
            )
            FROM delivery_notes dn
            JOIN delivery_note_items dni ON dn.id = dni.delivery_note_id
            JOIN purchase_order_items poi ON dn.po_id = poi.po_id AND dni.item_id = poi.item_id
            JOIN items i ON dni.item_id = i.id
            WHERE dn.trade_id = $1 AND dn.company_id = $2
          ),
          (
            SELECT SUM(
              (
                dni.quantity - COALESCE((
                  SELECT SUM((elem->>'quantity')::numeric)
                  FROM grns g
                  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(g.rejection_items, '[]'::jsonb)) AS elem
                  WHERE g.delivery_note_id = dn.id
                    AND elem->>'item_code' = i.item_code
                    AND g.company_id = $2
                ), 0)
              ) * roi.unit_price
            )
            FROM delivery_notes dn
            JOIN delivery_note_items dni ON dn.id = dni.delivery_note_id
            JOIN release_order_items roi ON dn.ro_id = roi.ro_id AND dni.item_id = roi.item_id
            JOIN items i ON dni.item_id = i.id
            WHERE dn.trade_id = $1 AND dn.company_id = $2
          ),
          0
        )::numeric AS delivered_val
    ) val_sub
  `, [trade_id, company_id]);

  const pct = pctRes.rows.length > 0 ? parseFloat(pctRes.rows[0].pct) : 0;
  
  let statusName = 'ordered';
  if (pct >= 99.9) {
    statusName = 'delivered';
  } else if (pct > 0) {
    statusName = 'partially delivered';
  }

  await client.query(
    "INSERT INTO status (name, company_id) VALUES ($1, $2) ON CONFLICT (name, company_id) DO NOTHING",
    [statusName, company_id]
  );
  await client.query(
    "UPDATE trades SET status = $1 WHERE id = $2 AND company_id = $3",
    [statusName, trade_id, company_id]
  );
}

module.exports = router;
