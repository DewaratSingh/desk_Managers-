const express = require('express');
const router = express.Router();
const { pool, appendDocToTrade } = require('../db');

// GET next auto-generated Process PO No
router.get('/next-no', async (req, res) => {
  try {
    const countRes = await pool.query('SELECT COUNT(*) FROM process_po WHERE company_id = $1', [req.user.company_id]);
    const count = parseInt(countRes.rows[0].count) || 0;
    const po_no = `PPO-${String(count + 1).padStart(4, '0')}`;
    res.json({ po_no });
  } catch (err) {
    console.error('Error fetching next PPO number:', err.message);
    res.status(500).json({ error: 'Failed to fetch next PPO number' });
  }
});

// GET trace items from inventory for specific source item codes or linked RQ process
router.get('/trace-items', async (req, res) => {
  const { item_code, allowed_item_codes, rq_id, rq_process_no } = req.query || {};

  try {
    let allowedCodes = [];

    if (item_code && item_code.trim()) {
      allowedCodes.push(item_code.trim());
    } else if (allowed_item_codes) {
      if (Array.isArray(allowed_item_codes)) {
        allowedCodes = allowed_item_codes.map(c => String(c).trim()).filter(Boolean);
      } else if (typeof allowed_item_codes === 'string') {
        allowedCodes = allowed_item_codes.split(',').map(c => c.trim()).filter(Boolean);
      }
    } else if (rq_id || rq_process_no) {
      const rqIdentifier = String(rq_id || rq_process_no).trim();
      const rqRes = await pool.query(
        `SELECT rp.id, '[]'::json AS source_codes, NULL AS legacy_source_code
         FROM rq_process rp
         WHERE (rp.number = $1 OR rp.id::text = $1) AND rp.company_id = $2`,
        [rqIdentifier, req.user.company_id]
      );
      if (rqRes.rows.length > 0) {
        const row = rqRes.rows[0];
        const srcCodes = Array.isArray(row.source_codes) ? row.source_codes : [];
        if (srcCodes.length > 0) {
          allowedCodes = srcCodes;
        } else if (row.legacy_source_code) {
          allowedCodes = [row.legacy_source_code];
        }
      }
    }

    let queryText = `
      SELECT 
         inv.id AS inventory_id,
         t.id AS trace_id,
         it.item_code,
         it.description,
         t.qty AS available_qty,
         t.cost_price AS price,
         inv.location
       FROM trace t
       JOIN inventory inv ON t.inventory_id = inv.id
       JOIN items it ON t.item_code = it.id
       WHERE t.company_id = $1 AND t.qty > 0
    `;
    const params = [req.user.company_id];

    if (allowedCodes.length > 0) {
      queryText += ` AND (it.item_code = ANY($2) OR CAST(it.id AS VARCHAR) = ANY($2))`;
      params.push(allowedCodes);
    }

    queryText += ` ORDER BY inv.created_at ASC`;

    const result = await pool.query(queryText, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching trace items for Process PO:', err.message);
    res.status(500).json({ error: 'Failed to fetch trace items' });
  }
});

// GET all Process PO jobs with their multi-table details
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
         ppo.id, 
         ppo.po_no, 
         ppo.date_of_start, 
         ppo.date_of_end, 
         ppo.received_q_id,
         ppo.trade_id,
         ppo.seller,
         ppo.party,
         ppo.gst_type,
         ppo.gst_rate,
         ppo.gst,
         ppo.transport,
         ppo.packing_forward,
         ppo.other,
         ppo.basic_value,
         ppo.delivery_date,
         ppo.shipping_address,
         ppo.message, 
         ppo.created_at,
         COALESCE(
           (SELECT json_agg(json_build_object(
              'id', psi.id,
              'item_code_id', psi.item_code,
              'item_code', sit.item_code,
              'trace_item_id', psi.trace_item_id,
              'qty', psi.qty,
              'description', sit.description
            ))
            FROM process_po_source_item psi
            LEFT JOIN items sit ON psi.item_code = sit.id AND sit.company_id = psi.company_id
            WHERE psi.process_po_id = ppo.id AND psi.company_id = ppo.company_id
           ), '[]'::json
         ) AS source_items,
         COALESCE(
           (SELECT json_agg(json_build_object(
              'id', pti.id,
              'item_code_id', pti.item_code,
              'item_code', tit.item_code,
              'qty', pti.qty,
              'delivered_qty', COALESCE((
                 SELECT SUM(dni.quantity)
                 FROM delivery_notes dn
                 JOIN delivery_note_items dni ON dn.id = dni.delivery_note_id
                 WHERE dn.trade_id = ppo.trade_id AND dni.item_id = pti.item_code AND dn.company_id = ppo.company_id
              ), 0),
              'price', pti.price,
              'gst_type', pti.gst_type,
              'gst_rate', pti.gst_rate,
              'shipping_address', pti.shipping_address,
              'delivery_date', pti.delivery_date,
              'status', pti.status,
              'description', tit.description
            ))
            FROM process_po_target_item pti
            LEFT JOIN items tit ON pti.item_code = tit.id AND tit.company_id = pti.company_id
            WHERE pti.process_po_id = ppo.id AND pti.company_id = ppo.company_id
           ), '[]'::json
         ) AS target_items,
         COALESCE(
           (SELECT json_agg(json_build_object(
              'id', poi.id,
              'source_item_id', poi.source_item_id,
              'source_item_code', src.item_code,
              'source_item_description', src.description,
              'target_item_id', poi.target_item_id,
              'target_item_code', tgt.item_code,
              'target_item_description', tgt.description,
              'source_trace_id_array', poi.source_trace_id_array,
              'price', poi.price,
              'source_qty', poi.source_qty,
              'target_qty', poi.target_qty,
              'target_trace_id_array', poi.target_trace_id_array
            ))
            FROM process_po_item poi
            LEFT JOIN items src ON poi.source_item_id = src.id
            LEFT JOIN items tgt ON poi.target_item_id = tgt.id
            WHERE poi.process_po_id = ppo.id AND poi.company_id = ppo.company_id
           ), '[]'::json
         ) AS items
       FROM process_po ppo
       WHERE ppo.company_id = $1
       ORDER BY ppo.created_at DESC`,
      [req.user.company_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching process PO list:', err.message);
    res.status(500).json({ error: 'Failed to fetch process PO list' });
  }
});

// GET a single Process PO by ID or PO Number
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const isNum = /^\d+$/.test(id);
    const whereClause = isNum
      ? `(ppo.id = $1 OR ppo.po_no = $2) AND ppo.company_id = $3`
      : `ppo.po_no = $1 AND ppo.company_id = $2`;
    const params = isNum
      ? [parseInt(id), id, req.user.company_id]
      : [id, req.user.company_id];

    const result = await pool.query(
      `SELECT 
         ppo.id, 
         ppo.po_no, 
         ppo.date_of_start AS date, 
         ppo.date_of_start,
         ppo.date_of_end AS delivery_date, 
         ppo.date_of_end,
         ppo.received_q_id,
         ppo.trade_id,
         ppo.seller,
         ppo.party,
         ppo.gst_type,
         ppo.gst_rate,
         ppo.gst,
         ppo.transport,
         ppo.packing_forward,
         ppo.other,
         ppo.basic_value,
         ppo.shipping_address,
         ppo.message, 
         ppo.created_at,
         COALESCE(
           (SELECT json_agg(json_build_object(
              'id', psi.id,
              'item_code_id', psi.item_code,
              'item_code', sit.item_code,
              'trace_item_id', psi.trace_item_id,
              'qty', psi.qty,
              'description', sit.description
            ))
            FROM process_po_source_item psi
            LEFT JOIN items sit ON psi.item_code = sit.id AND sit.company_id = psi.company_id
            WHERE psi.process_po_id = ppo.id AND psi.company_id = ppo.company_id
           ), '[]'::json
         ) AS source_items,
         COALESCE(
           (SELECT json_agg(json_build_object(
              'id', pti.id,
              'item_code_id', pti.item_code,
              'item_code', tit.item_code,
              'qty', pti.qty,
              'delivered_qty', COALESCE((
                 SELECT SUM(dni.quantity)
                 FROM delivery_notes dn
                 JOIN delivery_note_items dni ON dn.id = dni.delivery_note_id
                 WHERE dn.trade_id = ppo.trade_id AND dni.item_id = pti.item_code AND dn.company_id = ppo.company_id
              ), 0),
              'price', pti.price,
              'gst_type', pti.gst_type,
              'gst_rate', pti.gst_rate,
              'shipping_address', pti.shipping_address,
              'delivery_date', pti.delivery_date,
              'status', pti.status,
              'description', tit.description
            ))
            FROM process_po_target_item pti
            LEFT JOIN items tit ON pti.item_code = tit.id AND tit.company_id = pti.company_id
            WHERE pti.process_po_id = ppo.id AND pti.company_id = ppo.company_id
           ), '[]'::json
         ) AS target_items,
         COALESCE(
           (SELECT json_agg(json_build_object(
              'id', poi.id,
              'source_item_id', poi.source_item_id,
              'source_item_code', src.item_code,
              'source_description', src.description,
              'target_item_id', poi.target_item_id,
              'target_item_code', tgt.item_code,
              'target_description', tgt.description,
              'source_item_traceid_array', poi.source_trace_id_array,
              'price', poi.price,
              'source_item_quantity', poi.source_qty,
              'target_item_quantity', poi.target_qty,
              'target_trace_id_array', poi.target_trace_id_array
            ))
            FROM process_po_item poi
            LEFT JOIN items src ON poi.source_item_id = src.id
            LEFT JOIN items tgt ON poi.target_item_id = tgt.id
            WHERE poi.process_po_id = ppo.id AND poi.company_id = ppo.company_id
           ), '[]'::json
         ) AS items
       FROM process_po ppo
       WHERE ${whereClause}`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Process PO not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching process PO by ID:', err.message);
    res.status(500).json({ error: 'Failed to fetch process PO' });
  }
});

// POST Create a new Process PO Job and its multi-table items
router.post('/', async (req, res) => {
  let {
    po_no,
    date_of_start,
    date_of_end,
    received_q_id,
    trade_id,
    seller,
    party,
    gst_type,
    gst_rate,
    gst,
    transport,
    packing_forward,
    other,
    basic_value,
    delivery_date,
    shipping_address,
    message,
    source_items,
    target_items,
    items
  } = req.body || {};

  // Validate compulsory fields
  if (!seller || !seller.trim()) {
    return res.status(400).json({ error: 'Seller / Processor Vendor is required' });
  }

  if (!party || !party.trim()) {
    return res.status(400).json({ error: 'Party / Client Customer is required' });
  }

  const hasMultiTables = Array.isArray(source_items) && source_items.length > 0 && Array.isArray(target_items) && target_items.length > 0;
  const hasLegacyItems = Array.isArray(items) && items.length > 0;

  if (!hasMultiTables && !hasLegacyItems) {
    return res.status(400).json({ error: 'At least one source item and target item are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const companyId = req.user.company_id;

    if (!po_no || !po_no.trim()) {
      const countRes = await client.query('SELECT COUNT(*) FROM process_po WHERE company_id = $1', [companyId]);
      const count = parseInt(countRes.rows[0].count) || 0;
      po_no = `PPO-${String(count + 1).padStart(4, '0')}`;
    }

    let tradeDbId = null;
    let tradeCodeStr = trade_id ? String(trade_id).trim() : null;

    if (tradeCodeStr) {
      const isNum = /^\d+$/.test(tradeCodeStr);
      let tRes;
      if (isNum) {
        tRes = await client.query(
          `SELECT id, trade_id FROM trades WHERE (trade_id = $1 OR id = $2) AND company_id = $3 LIMIT 1`,
          [tradeCodeStr, parseInt(tradeCodeStr), companyId]
        );
      } else {
        tRes = await client.query(
          `SELECT id, trade_id FROM trades WHERE trade_id = $1 AND company_id = $2 LIMIT 1`,
          [tradeCodeStr, companyId]
        );
      }
      if (tRes.rows.length > 0) {
        tradeDbId = tRes.rows[0].id;
        tradeCodeStr = tRes.rows[0].trade_id;
      }
    }

    const insertRes = await client.query(
      `INSERT INTO process_po (
         po_no, date_of_start, date_of_end, received_q_id, trade_id,
         seller, party, gst_type, gst_rate, gst, transport,
         packing_forward, other, basic_value, delivery_date,
         shipping_address, message, company_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
       RETURNING id, created_at`,
      [
        po_no.trim(),
        date_of_start || new Date().toISOString().split('T')[0],
        date_of_end || delivery_date || null,
        received_q_id ? parseInt(received_q_id) : null,
        tradeDbId,
        seller.trim(),
        party.trim(),
        gst_type || null,
        gst_rate ? parseFloat(gst_rate) : 0,
        gst ? parseFloat(gst) : 0,
        transport ? parseFloat(transport) : 0,
        packing_forward ? parseFloat(packing_forward) : 0,
        other ? parseFloat(other) : 0,
        basic_value ? parseFloat(basic_value) : 0,
        delivery_date || date_of_end || null,
        shipping_address || null,
        message || null,
        companyId
      ]
    );

    const ppoId = insertRes.rows[0].id;

    const normalizedSourceItems = Array.isArray(source_items) ? source_items : [];
    const normalizedTargetItems = Array.isArray(target_items) ? target_items : [];

    if (hasLegacyItems && normalizedSourceItems.length === 0) {
      items.forEach(it => {
        if (it.source_item_code) {
          normalizedSourceItems.push({
            item_code: it.source_item_code,
            qty: it.source_qty,
            trace_item_id: it.source_trace_id_array && it.source_trace_id_array[0] ? it.source_trace_id_array[0].trace_id : null
          });
        }
      });
    }

    if (hasLegacyItems && normalizedTargetItems.length === 0) {
      items.forEach(it => {
        if (it.target_item_code) {
          normalizedTargetItems.push({
            item_code: it.target_item_code,
            qty: it.target_qty,
            price: it.price
          });
        }
      });
    }

    // Helper to resolve items.id integer from item_code string or ID
    const resolveItemId = async (codeOrId) => {
      if (!codeOrId) return null;
      const strVal = String(codeOrId).trim();
      const numVal = parseInt(strVal);
      const isNum = !isNaN(numVal);

      if (isNum) {
        const res = await client.query(
          `SELECT id FROM items WHERE (item_code = $1 OR id = $2) AND company_id = $3 LIMIT 1`,
          [strVal, numVal, companyId]
        );
        return res.rows.length > 0 ? res.rows[0].id : null;
      } else {
        const res = await client.query(
          `SELECT id FROM items WHERE item_code = $1 AND company_id = $2 LIMIT 1`,
          [strVal, companyId]
        );
        return res.rows.length > 0 ? res.rows[0].id : null;
      }
    };

    // 1. Process Multi-Source Items
    for (const src of normalizedSourceItems) {
      const srcItemId = await resolveItemId(src.item_code);
      await client.query(
        `INSERT INTO process_po_source_item (process_po_id, item_code, trace_item_id, qty, company_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          ppoId,
          srcItemId,
          src.trace_item_id ? parseInt(src.trace_item_id) : null,
          parseFloat(src.qty) || 0,
          companyId
        ]
      );
    }

    // 2. Process Multi-Target Items
    for (const tgt of normalizedTargetItems) {
      const tgtItemId = await resolveItemId(tgt.item_code);
      const tgtPrice = parseFloat(tgt.price) || 0;
      const tgtQty = parseFloat(tgt.qty) || 0;

      await client.query(
        `INSERT INTO process_po_target_item (
           process_po_id, item_code, qty, delivered_qty, price,
           gst_type, gst_rate, shipping_address, delivery_date, status, company_id
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          ppoId,
          tgtItemId,
          tgtQty,
          0,
          tgtPrice,
          tgt.gst_type || gst_type || null,
          tgt.gst_rate !== undefined ? parseFloat(tgt.gst_rate) : (gst_rate ? parseFloat(gst_rate) : 0),
          tgt.shipping_address || shipping_address || null,
          tgt.delivery_date || delivery_date || date_of_end || null,
          'under Process PO',
          companyId
        ]
      );
    }

    // 3. Process trace deduction and process_po_item mapping
    const legacyItemRows = hasLegacyItems ? items : (
      normalizedSourceItems.length > 0 && normalizedTargetItems.length > 0 ? [
        {
          source_item_code: normalizedSourceItems[0].item_code,
          target_item_code: normalizedTargetItems[0].item_code,
          source_qty: normalizedSourceItems.reduce((acc, s) => acc + (parseFloat(s.qty) || 0), 0),
          target_qty: normalizedTargetItems.reduce((acc, t) => acc + (parseFloat(t.qty) || 0), 0),
          price: normalizedTargetItems[0].price || 0,
          source_trace_id_array: normalizedSourceItems.filter(s => s.trace_item_id).map(s => ({ trace_id: s.trace_item_id, Qty: parseFloat(s.qty) || 0 }))
        }
      ] : []
    );

    for (const item of legacyItemRows) {
      const {
        source_item_code,
        target_item_code,
        source_qty,
        target_qty,
        price,
        source_trace_id_array
      } = item;

      const sourceDbId = await resolveItemId(source_item_code);
      const targetDbId = await resolveItemId(target_item_code);

      const parsedSourceQty = parseFloat(source_qty) || 0;
      const parsedTargetQty = parseFloat(target_qty) || 0;
      const parsedPrice = parseFloat(price) || 0.00;
      const cleanSourceTraceArray = Array.isArray(source_trace_id_array) ? source_trace_id_array : [];
      const targetTraceIdArray = [];

      await client.query(
        `INSERT INTO process_po_item (
           process_po_id, source_item_id, target_item_id,
           source_trace_id_array, price, source_qty, target_qty,
           target_trace_id_array, company_id
         ) VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8::jsonb, $9)`,
        [
          ppoId,
          sourceDbId,
          targetDbId,
          JSON.stringify(cleanSourceTraceArray),
          parsedPrice,
          parsedSourceQty,
          parsedTargetQty,
          JSON.stringify(targetTraceIdArray),
          companyId
        ]
      );
    }

    // 4. If trade_id is provided, append PO document to the trade record and update trade status
    if (tradeCodeStr || tradeDbId) {
      const cleanTradeId = tradeCodeStr || String(tradeDbId);
      await appendDocToTrade(client, cleanTradeId, 'PO', po_no.trim(), companyId);
      await appendDocToTrade(client, cleanTradeId, 'PURCHASE_ORDER', po_no.trim(), companyId);
      await client.query(
        "INSERT INTO status (name, company_id) VALUES ('ordered', $1) ON CONFLICT (name, company_id) DO NOTHING",
        [companyId]
      );
      if (tradeDbId) {
        await client.query(
          "UPDATE trades SET status = 'ordered' WHERE id = $1 AND company_id = $2",
          [tradeDbId, companyId]
        );
      } else {
        await client.query(
          "UPDATE trades SET status = 'ordered' WHERE trade_id = $1 AND company_id = $2",
          [cleanTradeId, companyId]
        );
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ message: 'Process PO job created successfully', id: ppoId, po_no: po_no.trim(), trade_id: trade_id || null });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating Process PO job:', err.message);
    res.status(500).json({ error: err.message || 'Failed to create Process PO job' });
  } finally {
    client.release();
  }
});

// PUT /api/process-po/:id/complete-production
router.put('/:id/complete-production', async (req, res) => {
  const { id } = req.params;
  const { process_po_item_id, completed_qty } = req.body || {};

  const inputMfgQty = parseFloat(completed_qty);
  if (isNaN(inputMfgQty) || inputMfgQty <= 0) {
    return res.status(400).json({ error: 'completed_qty must be a valid positive number' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const companyId = req.user.company_id;

    let poiRes;
    if (process_po_item_id) {
      poiRes = await client.query(
        'SELECT * FROM process_po_item WHERE id = $1 AND (process_po_id = $2 OR $2 IS NULL) AND company_id = $3',
        [process_po_item_id, id, companyId]
      );
    } else {
      poiRes = await client.query(
        'SELECT * FROM process_po_item WHERE (process_po_id = $1 OR id = $1) AND company_id = $2 ORDER BY id ASC LIMIT 1',
        [id, companyId]
      );
    }

    if (poiRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Process PO item record not found for this job' });
    }

    const poiRow = poiRes.rows[0];
    let currentTargetQty = parseFloat(poiRow.target_qty) || 0;
    const rawTargetTraceArray = Array.isArray(poiRow.target_trace_id_array) ? poiRow.target_trace_id_array : [];

    const target_trace_item_array = [];
    for (const tObj of rawTargetTraceArray) {
      const tId = parseInt(tObj.traceid || tObj.trace_id);
      if (tId && !isNaN(tId)) {
        const tRes = await client.query(
          'SELECT * FROM trace WHERE id = $1 AND company_id = $2',
          [tId, companyId]
        );
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

    if (target_trace_item_array.length === 0) {
      // Fallback for missing or legacy trace array: Create inventory & trace item directly
      const targetItemId = poiRow.target_item_id;
      const targetPrice = parseFloat(poiRow.price) || 0;

      if (targetItemId) {
        const invIns = await client.query('INSERT INTO inventory (location, company_id) VALUES ($1, $2) RETURNING id', ['Process PO Store', companyId]);
        const targetInvId = invIns.rows[0].id;

        const newTraceRes = await client.query(
          `INSERT INTO trace (item_code, history, qty, cost_price, status, inventory_id, company_id)
           VALUES ($1, $2::jsonb, $3, $4, 'In Inventory', $5, $6) RETURNING id`,
          [
            targetItemId,
            JSON.stringify([{ type: 'PROCESS_PO_COMPLETED', process_po_id: id, message: `Process PO Production Completed - Job #${id}` }]),
            inputMfgQty,
            targetPrice,
            targetInvId,
            companyId
          ]
        );
      }

      currentTargetQty = Math.max(0, currentTargetQty - inputMfgQty);
      await client.query(
        'UPDATE process_po_item SET target_qty = $1 WHERE id = $2 AND company_id = $3',
        [currentTargetQty, poiRow.id, companyId]
      );

      await client.query('COMMIT');
      return res.json({ message: 'Completed production processed successfully for Process PO', id });
    }

    let manufacturedQty = inputMfgQty;
    let i = 0;
    let updatedTargetTraceArray = [...rawTargetTraceArray];

    while (manufacturedQty >= 0 && i < target_trace_item_array.length) {
      const currentItem = target_trace_item_array[i];
      const prevMfgQty = manufacturedQty;

      manufacturedQty = manufacturedQty - currentItem.Qty;

      if (manufacturedQty >= 0) {
        await client.query(
          "UPDATE trace SET status = 'In Inventory', qty = 0 WHERE id = $1 AND company_id = $2",
          [currentItem.traceId, companyId]
        );

        updatedTargetTraceArray = updatedTargetTraceArray.filter(
          x => parseInt(x.traceid || x.trace_id) !== currentItem.traceId
        );
      }

      if (manufacturedQty < 0) {
        const producedQty = prevMfgQty;
        const traceRow = currentItem.traceRow;
        const processJson = typeof traceRow.history === 'string' 
          ? traceRow.history 
          : JSON.stringify(traceRow.history || []);

        let targetInvId = traceRow.inventory_id;
        if (!targetInvId) {
          const invIns = await client.query('INSERT INTO inventory (location, company_id) VALUES ($1, $2) RETURNING id', ['Process PO Store', companyId]);
          targetInvId = invIns.rows[0].id;
        }

        const newTraceRes = await client.query(
          `INSERT INTO trace (item_code, history, qty, cost_price, status, inventory_id, company_id)
           VALUES ($1, $2::jsonb, $3, $4, 'In Inventory', $5, $6) RETURNING id`,
          [
            traceRow.item_code,
            processJson,
            producedQty,
            traceRow.cost_price || traceRow.price || 0,
            targetInvId,
            companyId
          ]
        );

        const remainingTraceQty = manufacturedQty * -1;
        await client.query(
          'UPDATE trace SET qty = $1 WHERE id = $2 AND company_id = $3',
          [remainingTraceQty, currentItem.traceId, companyId]
        );
      }

      i++;
    }

    currentTargetQty = Math.max(0, currentTargetQty - inputMfgQty);
    await client.query(
      'UPDATE process_po_item SET target_qty = $1, target_trace_id_array = $2::jsonb WHERE id = $3 AND company_id = $4',
      [currentTargetQty, JSON.stringify(updatedTargetTraceArray), poiRow.id, companyId]
    );

    await client.query('COMMIT');
    res.json({ message: 'Completed production processed successfully for Process PO', id });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error processing completed production for Process PO:', err.message);
    res.status(500).json({ error: err.message || 'Failed to process completed production for Process PO' });
  } finally {
    client.release();
  }
});

module.exports = router;
