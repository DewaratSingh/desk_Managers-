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
        dn.dispatch_doc_no, dn.dispatch_through, dn.motor_vehicle_no, t.trade_id, t.trade_type,
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
    const tradeRes = await pool.query('SELECT id, trade_type, documents FROM trades WHERE trade_id = $1 AND company_id = $2', [trade_id, req.user.company_id]);
    if (tradeRes.rows.length === 0) return res.status(404).json({ error: 'Trade not found' });
    
    const trade = tradeRes.rows[0];
    const tradeDbId = trade.id;
    const docs = trade.documents || [];

    const poDoc = docs.find(d => d.type === 'PO' || d.type === 'PURCHASE_ORDER');
    const roDoc = docs.find(d => d.type === 'RO');

    const po_no = poDoc ? poDoc.id : null;
    const ro_no = roDoc ? roDoc.id : null;

    if (!po_no && !ro_no) return res.status(400).json({ error: 'No Purchase Order or Release Order found for this trade' });

    let items = [];
    if (ro_no) {
      const roRes = await pool.query('SELECT id FROM release_orders WHERE ro_no = $1 AND company_id = $2', [ro_no, req.user.company_id]);
      if (roRes.rows.length === 0) return res.status(404).json({ error: 'Release Order not found' });
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
      if (po_no.startsWith('PPO-')) {
        const ppoRes = await pool.query('SELECT id FROM process_po WHERE po_no = $1 AND company_id = $2', [po_no, req.user.company_id]);
        if (ppoRes.rows.length === 0) return res.status(404).json({ error: 'Process Purchase Order not found' });
        const ppoDbId = ppoRes.rows[0].id;

        const ppoItemsRes = await pool.query(
          `SELECT
            poi.id as process_po_item_id,
            poi.target_item_id,
            i.item_code,
            COALESCE(poi.target_qty, 0) as original_qty,
            COALESCE(poi.price, 0) as rate_per_piece,
            i.description,
            i.drawing_number,
            poi.target_trace_id_array as target_item_traceid_array,
            COALESCE((
              SELECT SUM(dni.quantity)
              FROM delivery_note_items dni
              JOIN delivery_notes dn ON dni.delivery_note_id = dn.id
              WHERE dn.trade_id = $1 AND dn.company_id = $4
                AND dni.item_id = poi.target_item_id
                AND ($3::varchar IS NULL OR dn.delivery_note_no != $3)
            ), 0) as delivered_qty
          FROM process_po_item poi
          LEFT JOIN items i ON poi.target_item_id = i.id AND i.company_id = poi.company_id
          WHERE poi.process_po_id = $2 AND poi.company_id = $4
          ORDER BY poi.id`,
          [tradeDbId, ppoDbId, exclude_dn_no || null, req.user.company_id]
        );

        items = ppoItemsRes.rows.map(row => {
          const tgtArray = row.target_item_traceid_array || [];
          const targetTraceId = tgtArray.length > 0 ? (tgtArray[0].traceid || tgtArray[0].trace_id) : null;
          return {
            ...row,
            process_target_trace_item_id: targetTraceId,
            linked_trace_item_id: targetTraceId
          };
        });
      } else {
        const poRes = await pool.query('SELECT id FROM purchase_orders WHERE po_no = $1 AND company_id = $2', [po_no, req.user.company_id]);
        if (poRes.rows.length === 0) return res.status(404).json({ error: 'Purchase Order not found' });
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
    }

    const mappedItems = items.map(item => {
      const original = parseFloat(item.original_qty) || 0;
      const delivered = parseFloat(item.delivered_qty) || 0;
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
      trade_type: trade.trade_type,
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
    const companyId = req.user.company_id;

    // 1. Check duplicate delivery_note_no
    const dupCheck = await client.query('SELECT delivery_note_no FROM delivery_notes WHERE delivery_note_no = $1 AND company_id = $2', [delivery_note_no, companyId]);
    if (dupCheck.rows.length > 0) throw new Error('Delivery Note number already exists');

    // 2. Fetch trade details to resolve PO/RO
    const tradeRes = await client.query('SELECT id, trade_id, documents, trade_type FROM trades WHERE trade_id = $1 AND company_id = $2', [trade_id, companyId]);
    if (tradeRes.rows.length === 0) throw new Error('Trade not found');
    const trade = tradeRes.rows[0];
    const tradeDbId = trade.id;
    const trade_code = trade.trade_id;
    const isBuyTrade = (trade.trade_type || 'sell').toLowerCase() === 'buy';

    const docs = trade.documents || [];
    const poDoc = docs.find(d => d.type === 'PO' || d.type === 'PURCHASE_ORDER');
    const roDoc = docs.find(d => d.type === 'RO');

    const po_no = poDoc ? poDoc.id : null;
    const ro_no = roDoc ? roDoc.id : null;

    let poDbId = null, ppoDbId = null, roDbId = null;

    if (po_no) {
      if (po_no.startsWith('PPO-')) {
        const ppoRes = await client.query('SELECT id FROM process_po WHERE po_no = $1 AND company_id = $2', [po_no, companyId]);
        if (ppoRes.rows.length > 0) ppoDbId = ppoRes.rows[0].id;
      } else {
        const poRes = await client.query('SELECT id FROM purchase_orders WHERE po_no = $1 AND company_id = $2', [po_no, companyId]);
        if (poRes.rows.length > 0) {
          poDbId = poRes.rows[0].id;
        } else {
          const ppoRes = await client.query('SELECT id FROM process_po WHERE po_no = $1 AND company_id = $2', [po_no, companyId]);
          if (ppoRes.rows.length > 0) ppoDbId = ppoRes.rows[0].id;
        }
      }
    }

    if (!ppoDbId && tradeDbId) {
      const ppoCheck = await client.query('SELECT id FROM process_po WHERE trade_id = $1 AND company_id = $2', [tradeDbId, companyId]);
      if (ppoCheck.rows.length > 0) ppoDbId = ppoCheck.rows[0].id;
    }

    if (ro_no) {
      const roRes = await client.query('SELECT id FROM release_orders WHERE ro_no = $1 AND company_id = $2', [ro_no, companyId]);
      if (roRes.rows.length > 0) roDbId = roRes.rows[0].id;
    }

    // 3. Insert Delivery Note header
    const dnRes = await client.query(
      `INSERT INTO delivery_notes (delivery_note_no, po_id, ro_id, delivery_date, dispatch_doc_no, dispatch_through, motor_vehicle_no, trade_id, company_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [delivery_note_no, poDbId, roDbId, delivery_date, dispatch_doc_no || null, dispatch_through, motor_vehicle_no, tradeDbId, companyId]
    );
    const dnDbId = dnRes.rows[0].id;

    // 4. Insert items
    for (const item of items) {
      const itemRes = await client.query('SELECT id FROM items WHERE item_code = $1 AND company_id = $2', [item.item_code, companyId]);
      if (itemRes.rows.length === 0) throw new Error(`Item ${item.item_code} not found`);
      const itemDbId = itemRes.rows[0].id;

      let traceIdForNextActivity = null;

      if (!isBuyTrade) {
        // SELL / ARC TRADE: deduct from existing trace rows
        const allocations = Array.isArray(item.stock_allocations) ? item.stock_allocations : [];
        for (const alloc of allocations) {
          const allocQty = parseFloat(alloc.qty) || 0;
          const targetTraceId = parseInt(alloc.trace_id);

          if (targetTraceId && allocQty > 0) {
            const traceUpdate = await client.query(
              `UPDATE trace SET qty = GREATEST(qty - $1, 0) WHERE id = $2 AND company_id = $3 RETURNING qty`,
              [allocQty, targetTraceId, companyId]
            );
            
            // Clean up empty trace rows
            if (traceUpdate.rows.length > 0 && parseFloat(traceUpdate.rows[0].qty) <= 0) {
              await client.query('DELETE FROM trace WHERE id = $1 AND company_id = $2', [targetTraceId, companyId]);
            }
          }
        }
      } else {
        // BUY TRADE: create or merge trace row in an inventory location
        const invQty = parseFloat(item.inv_qty) || 0;
        if (invQty > 0 && item.inv_details) {
          const location = item.inv_details.location || 'Default Location';
          let targetInvId = item.inv_details.inventory_id ? parseInt(item.inv_details.inventory_id) : null;

          if (!targetInvId) {
            const invCheck = await client.query(
              'SELECT id FROM inventory WHERE LOWER(location) = LOWER($1) AND company_id = $2',
              [location, companyId]
            );
            if (invCheck.rows.length > 0) {
              targetInvId = invCheck.rows[0].id;
            } else {
              const invInsert = await client.query(
                'INSERT INTO inventory (location, company_id) VALUES ($1, $2) RETURNING id',
                [location, companyId]
              );
              targetInvId = invInsert.rows[0].id;
            }
          }

          const targetStatus = item.inv_details.status || 'In Inventory';
          const buyUnitPrice = parseFloat(item.inv_details.cost_price || item.rate_per_piece) || 0;
          const stepObj = { type: 'BUY', id: trade_code, DeliveryNoteID: dnDbId, BuyPrice: buyUnitPrice };

          let targetTraceId = item.inv_details.trace_id ? parseInt(item.inv_details.trace_id) : null;
          
          if (!targetTraceId) {
            // Find an existing trace row to merge if it exactly matches
            const traceCheck = await client.query(
              `SELECT id, qty, cost_price, history FROM trace 
               WHERE item_code = $1 AND inventory_id = $2 AND LOWER(status) = LOWER($3) AND company_id = $4`,
              [itemDbId, targetInvId, targetStatus, companyId]
            );
            if (traceCheck.rows.length > 0) {
              targetTraceId = traceCheck.rows[0].id;
            }
          }

          if (targetTraceId) {
            const tr = await client.query('SELECT qty, cost_price, history FROM trace WHERE id = $1 AND company_id = $2', [targetTraceId, companyId]);
            if (tr.rows.length > 0) {
              const exQty = parseFloat(tr.rows[0].qty) || 0;
              const exPrice = parseFloat(tr.rows[0].cost_price) || 0;
              const newQty = exQty + invQty;
              const newPrice = newQty > 0 ? ((exQty * exPrice) + (invQty * buyUnitPrice)) / newQty : buyUnitPrice;
              
              let histArray = Array.isArray(tr.rows[0].history) ? tr.rows[0].history : [];
              histArray.push(stepObj);

              await client.query(
                `UPDATE trace SET qty = $1, cost_price = $2, history = $3::jsonb WHERE id = $4 AND company_id = $5`,
                [newQty, newPrice, JSON.stringify(histArray), targetTraceId, companyId]
              );
              traceIdForNextActivity = targetTraceId;
            }
          } else {
            const trIns = await client.query(
              `INSERT INTO trace (item_code, qty, cost_price, inventory_id, status, history, company_id) 
               VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7) RETURNING id`,
              [itemDbId, invQty, buyUnitPrice, targetInvId, targetStatus, JSON.stringify([stepObj]), companyId]
            );
            traceIdForNextActivity = trIns.rows[0].id;
          }
        }
      }

      const next_activity = {
        inventory: item.inv_qty > 0 ? { quantity: parseFloat(item.inv_qty), trace_id: traceIdForNextActivity } : null
      };

      const targetTraceRef = item.process_target_trace_item_id || null;

      await client.query(
        `INSERT INTO delivery_note_items (delivery_note_id, item_id, quantity, rate_per_piece, shipping_address, delivery_date, company_id, next_activity, process_target_trace_item_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          dnDbId,
          itemDbId,
          parseFloat(item.quantity) || 0,
          parseFloat(item.rate_per_piece) || 0,
          item.shipping_address || null,
          item.delivery_date || null,
          companyId,
          JSON.stringify(next_activity),
          targetTraceRef
        ]
      );

      // Process PO delivery trace conversion if applicable
      if (targetTraceRef) {
        const sumRes = await client.query(
          `SELECT COALESCE(SUM(quantity), 0) AS total_delivered
           FROM delivery_note_items
           WHERE process_target_trace_item_id = $1 AND company_id = $2`,
          [targetTraceRef, companyId]
        );
        const delQty = parseFloat(sumRes.rows[0].total_delivered) || 0;
        if (ppoDbId && delQty > 0) {
          await processPoDeliveryTraceConversion(client, ppoDbId, itemDbId, delQty, companyId, delivery_note_no);
        }
      }
    }

    // 5. Append to trade documents
    await appendDocToTrade(client, trade_code, 'DN', delivery_note_no, companyId);

    // Update trade delivery status
    await updateTradeDeliveryStatus(client, tradeDbId, companyId);

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
    const companyId = req.user.company_id;

    // 1. Update header
    const updateHeader = await client.query(
      `UPDATE delivery_notes
       SET delivery_date = $1, dispatch_doc_no = $2, dispatch_through = $3, motor_vehicle_no = $4
       WHERE delivery_note_no = $5 AND company_id = $6 RETURNING id`,
      [delivery_date, dispatch_doc_no || null, dispatch_through, motor_vehicle_no, delivery_note_no, companyId]
    );

    if (updateHeader.rows.length === 0) throw new Error('Delivery Note not found');
    const dnDbId = updateHeader.rows[0].id;

    // 2. Resolve trade ID and trade code
    let tradeDbId = null;
    let trade_code = null;
    const tradeRes = await client.query('SELECT t.id, t.trade_id, t.trade_type FROM delivery_notes dn JOIN trades t ON dn.trade_id = t.id WHERE dn.delivery_note_no = $1 AND dn.company_id = $2', [delivery_note_no, companyId]);
    if (tradeRes.rows.length > 0) {
      tradeDbId = tradeRes.rows[0].id;
      trade_code = tradeRes.rows[0].trade_id;
    }
    const isBuyTrade = (tradeRes.rows[0]?.trade_type || 'sell').toLowerCase() === 'buy';

    // 3. Rewrite items
    await client.query('DELETE FROM delivery_note_items WHERE delivery_note_id = $1 AND company_id = $2', [dnDbId, companyId]);

    for (const item of items) {
      const itemRes = await client.query('SELECT id FROM items WHERE item_code = $1 AND company_id = $2', [item.item_code, companyId]);
      if (itemRes.rows.length === 0) throw new Error(`Item ${item.item_code} not found`);
      const itemDbId = itemRes.rows[0].id;

      let traceIdForNextActivity = null;

      if (!isBuyTrade) {
        // SELL / ARC TRADE
        const allocations = Array.isArray(item.stock_allocations) ? item.stock_allocations : [];
        for (const alloc of allocations) {
          const allocQty = parseFloat(alloc.qty) || 0;
          const targetTraceId = parseInt(alloc.trace_id);
          if (targetTraceId && allocQty > 0) {
            const traceUpdate = await client.query(
              `UPDATE trace SET qty = GREATEST(qty - $1, 0) WHERE id = $2 AND company_id = $3 RETURNING qty`,
              [allocQty, targetTraceId, companyId]
            );
            if (traceUpdate.rows.length > 0 && parseFloat(traceUpdate.rows[0].qty) <= 0) {
              await client.query('DELETE FROM trace WHERE id = $1 AND company_id = $2', [targetTraceId, companyId]);
            }
          }
        }
      } else {
        // BUY TRADE
        const invQty = parseFloat(item.inv_qty) || 0;
        if (invQty > 0 && item.inv_details) {
          const location = item.inv_details.location || 'Default Location';
          let targetInvId = item.inv_details.inventory_id ? parseInt(item.inv_details.inventory_id) : null;

          if (!targetInvId) {
            const invCheck = await client.query(
              'SELECT id FROM inventory WHERE LOWER(location) = LOWER($1) AND company_id = $2',
              [location, companyId]
            );
            if (invCheck.rows.length > 0) {
              targetInvId = invCheck.rows[0].id;
            } else {
              const invInsert = await client.query(
                'INSERT INTO inventory (location, company_id) VALUES ($1, $2) RETURNING id',
                [location, companyId]
              );
              targetInvId = invInsert.rows[0].id;
            }
          }

          const targetStatus = item.inv_details.status || 'In Inventory';
          const buyUnitPrice = parseFloat(item.inv_details.cost_price || item.rate_per_piece) || 0;
          const stepObj = { type: 'BUY', id: trade_code, DeliveryNoteID: dnDbId, BuyPrice: buyUnitPrice };

          let targetTraceId = item.inv_details.trace_id ? parseInt(item.inv_details.trace_id) : null;
          
          if (!targetTraceId) {
            const traceCheck = await client.query(
              `SELECT id, qty, cost_price, history FROM trace 
               WHERE item_code = $1 AND inventory_id = $2 AND LOWER(status) = LOWER($3) AND company_id = $4`,
              [itemDbId, targetInvId, targetStatus, companyId]
            );
            if (traceCheck.rows.length > 0) targetTraceId = traceCheck.rows[0].id;
          }

          if (targetTraceId) {
            const tr = await client.query('SELECT qty, cost_price, history FROM trace WHERE id = $1 AND company_id = $2', [targetTraceId, companyId]);
            if (tr.rows.length > 0) {
              const exQty = parseFloat(tr.rows[0].qty) || 0;
              const exPrice = parseFloat(tr.rows[0].cost_price) || 0;
              const newQty = exQty + invQty;
              const newPrice = newQty > 0 ? ((exQty * exPrice) + (invQty * buyUnitPrice)) / newQty : buyUnitPrice;
              
              let histArray = Array.isArray(tr.rows[0].history) ? tr.rows[0].history : [];
              if (!histArray.some(h => h.DeliveryNoteID === dnDbId && h.id === trade_code)) {
                histArray.push(stepObj);
              }

              await client.query(
                `UPDATE trace SET qty = $1, cost_price = $2, history = $3::jsonb WHERE id = $4 AND company_id = $5`,
                [newQty, newPrice, JSON.stringify(histArray), targetTraceId, companyId]
              );
              traceIdForNextActivity = targetTraceId;
            }
          } else {
            const trIns = await client.query(
              `INSERT INTO trace (item_code, qty, cost_price, inventory_id, status, history, company_id) 
               VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7) RETURNING id`,
              [itemDbId, invQty, buyUnitPrice, targetInvId, targetStatus, JSON.stringify([stepObj]), companyId]
            );
            traceIdForNextActivity = trIns.rows[0].id;
          }
        }
      }

      const next_activity = {
        inventory: item.inv_qty > 0 ? { quantity: parseFloat(item.inv_qty), trace_id: traceIdForNextActivity } : null
      };

      const targetTraceRef = item.process_target_trace_item_id || null;

      await client.query(
        `INSERT INTO delivery_note_items (delivery_note_id, item_id, quantity, rate_per_piece, shipping_address, delivery_date, company_id, next_activity, process_target_trace_item_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          dnDbId,
          itemDbId,
          parseFloat(item.quantity) || 0,
          parseFloat(item.rate_per_piece) || 0,
          item.shipping_address || null,
          item.delivery_date || null,
          companyId,
          JSON.stringify(next_activity),
          targetTraceRef
        ]
      );

      if (tradeDbId) {
        const ppoRes = await client.query('SELECT pp.id FROM process_po pp WHERE pp.trade_id = $1 AND pp.company_id = $2', [tradeDbId, companyId]);
        if (ppoRes.rows.length > 0) {
          const ppoDbId = ppoRes.rows[0].id;
          const delQty = parseFloat(item.quantity) || 0;
          if (delQty > 0) {
            await processPoDeliveryTraceConversion(client, ppoDbId, itemDbId, delQty, companyId, delivery_note_no);
          }
        }
      }
    }

    if (tradeDbId) {
      await updateTradeDeliveryStatus(client, tradeDbId, companyId);
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
          (SELECT SUM(ppi.target_item_quantity * ppi.price) FROM process_po pp JOIN po_process_item ppi ON pp.id = ppi.process_po_id WHERE pp.trade_id = $1 AND pp.company_id = $2),
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
          (
            SELECT SUM(dni.quantity * ppi.price)
            FROM delivery_notes dn
            JOIN delivery_note_items dni ON dn.id = dni.delivery_note_id
            JOIN process_po pp ON dn.trade_id = pp.trade_id
            JOIN process_po_item ppi ON pp.id = ppi.process_po_id AND dni.item_id = ppi.target_item_id
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

async function processPoDeliveryTraceConversion(client, processPoId, targetItemId, deliveredQty, companyId, deliveryNoteNo) {
  const inputMfgQty = parseFloat(deliveredQty);
  if (isNaN(inputMfgQty) || inputMfgQty <= 0) return;

  const poiRes = await client.query(
    'SELECT * FROM process_po_item WHERE process_po_id = $1 AND target_item_id = $2 AND company_id = $3 ORDER BY id ASC LIMIT 1',
    [processPoId, targetItemId, companyId]
  );
  if (poiRes.rows.length === 0) return;

  const poiRow = poiRes.rows[0];
  const rawTargetTraceArray = Array.isArray(poiRow.target_trace_id_array) ? poiRow.target_trace_id_array : [];
  if (rawTargetTraceArray.length === 0) return;

  const target_trace_item_array = [];
  for (const tObj of rawTargetTraceArray) {
    const tId = parseInt(tObj.traceid || tObj.trace_id);
    if (tId && !isNaN(tId)) {
      const tRes = await client.query('SELECT * FROM trace WHERE id = $1 AND company_id = $2', [tId, companyId]);
      if (tRes.rows.length > 0) {
        target_trace_item_array.push({
          traceId: tId,
          Qty: parseFloat(tRes.rows[0].qty) || 0,
          traceRow: tRes.rows[0],
          rawObj: tObj
        });
      }
    }
  }

  if (target_trace_item_array.length === 0) return;

  let ProcessedQty = inputMfgQty;
  let i = 0;
  let updatedTargetTraceArray = [...rawTargetTraceArray];

  while (ProcessedQty >= 0 && i < target_trace_item_array.length) {
    const currentItem = target_trace_item_array[i];
    const prevQty = ProcessedQty;
    ProcessedQty = ProcessedQty - currentItem.Qty;

    if (ProcessedQty >= 0) {
      await client.query(
        "UPDATE trace SET status = 'In Inventory', qty = 0 WHERE id = $1 AND company_id = $2",
        [currentItem.traceId, companyId]
      );
      updatedTargetTraceArray = updatedTargetTraceArray.filter(
        x => parseInt(x.traceid || x.trace_id) !== currentItem.traceId
      );
    }

    if (ProcessedQty < 0) {
      const producedQty = prevQty;
      const traceRow = currentItem.traceRow;
      const processJson = typeof traceRow.history === 'string' 
        ? traceRow.history 
        : JSON.stringify(traceRow.history || []);

      let targetInvId = traceRow.inventory_id;
      if (!targetInvId) {
        const invIns = await client.query('INSERT INTO inventory (location, company_id) VALUES ($1, $2) RETURNING id', ['In Inventory Store', companyId]);
        targetInvId = invIns.rows[0].id;
      }

      await client.query(
        `INSERT INTO trace (item_code, history, qty, cost_price, status, inventory_id, company_id)
         VALUES ($1, $2::jsonb, $3, $4, 'In Inventory', $5, $6)`,
        [
          traceRow.item_code,
          processJson,
          producedQty,
          traceRow.cost_price,
          targetInvId,
          companyId
        ]
      );

      const remainingTraceQty = ProcessedQty * -1;
      await client.query(
        'UPDATE trace SET qty = $1 WHERE id = $2 AND company_id = $3',
        [remainingTraceQty, currentItem.traceId, companyId]
      );
    }
    i++;
  }

  await client.query(
    'UPDATE process_po_item SET target_trace_id_array = $1::jsonb WHERE id = $2 AND company_id = $3',
    [JSON.stringify(updatedTargetTraceArray), poiRow.id, companyId]
  );
}

module.exports = router;
