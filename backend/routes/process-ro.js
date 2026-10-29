const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { requirePermission } = require('../middleware/auth');

// Ensure status column exists in process_ro on module load
pool.query("ALTER TABLE process_ro ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'RO'").catch(() => {});
pool.query("ALTER TABLE process_ro_source_item ADD COLUMN IF NOT EXISTS history JSONB").catch(() => {});

// GET next auto-generated Process RO No
router.get('/next-no', requirePermission(['process_order:create', 'process_order:read', 'manage_orders', 'manage_manufacture']), async (req, res) => {
  try {
    const countRes = await pool.query('SELECT COUNT(*) FROM process_ro WHERE company_id = $1', [req.user.company_id]);
    const count = parseInt(countRes.rows[0].count) || 0;
    const ro_no = `PRO-${String(count + 1).padStart(4, '0')}`;
    res.json({ ro_no });
  } catch (err) {
    console.error('Error fetching next PRO number:', err.message);
    res.status(500).json({ error: 'Failed to fetch next PRO number' });
  }
});

// GET all Process RO records (optional trade_id filter)
router.get('/', requirePermission(['process_order:read', 'manage_orders', 'manage_manufacture']), async (req, res) => {
  const { trade_id } = req.query || {};
  let whereClause = 'pro.company_id = $1';
  const params = [req.user.company_id];

  if (trade_id) {
    const isNum = /^\d+$/.test(trade_id);
    params.push(trade_id);
    if (isNum) {
      whereClause += ` AND (pro.trade_id = $2 OR pro.trade_id = (SELECT id FROM trades WHERE trade_id = $2 AND company_id = $1 LIMIT 1))`;
    } else {
      whereClause += ` AND (pro.trade_id = (SELECT id FROM trades WHERE trade_id = $2 AND company_id = $1 LIMIT 1))`;
    }
  }

  try {
    const result = await pool.query(
      `SELECT 
         pro.*,
         COALESCE(
           (SELECT json_agg(json_build_object(
              'id', psi.id,
              'item_id', psi.item_id,
              'item_code', psi.item_code,
              'trace_item_id', psi.trace_item_id,
              'qty', psi.qty,
              'description', psi.description,
              'available_qty', (COALESCE(tr.qty, 0) + COALESCE(psi.qty, 0)),
              'history', psi.history
            ))
            FROM process_ro_source_item psi
            LEFT JOIN trace tr ON psi.trace_item_id = tr.id AND tr.company_id = psi.company_id
            WHERE psi.process_ro_id = pro.id AND psi.company_id = pro.company_id
           ), '[]'::json
         ) AS source_items,
         COALESCE(
           (SELECT json_agg(json_build_object(
              'id', pti.id,
              'item_id', pti.item_id,
              'item_code', pti.item_code,
              'description', pti.description,
              'drawing_number', pti.drawing_number,
              'process_name', pti.process_name,
              'qty', pti.qty,
              'delivered_qty', COALESCE((
                 SELECT SUM(dni.quantity)
                 FROM delivery_notes dn
                 JOIN delivery_note_items dni ON dn.id = dni.delivery_note_id
                 LEFT JOIN items di ON dni.item_id = di.id
                 WHERE dn.trade_id = pro.trade_id 
                   AND (dni.item_id = pti.item_id OR di.item_code = pti.item_code)
                   AND dn.company_id = pro.company_id
              ), 0),
              'price', pti.price,
              'gst_type', pti.gst_type,
              'gst_rate', pti.gst_rate,
              'shipping_address', pti.shipping_address,
              'delivery_date', pti.delivery_date
            ))
            FROM process_ro_target_item pti
            WHERE pti.process_ro_id = pro.id AND pti.company_id = pro.company_id
           ), '[]'::json
         ) AS target_items
       FROM process_ro pro
       WHERE ${whereClause}
       ORDER BY pro.created_at DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching process RO list:', err.message);
    res.status(500).json({ error: 'Failed to fetch process RO list' });
  }
});

// GET a single Process RO by ID or RO Number or Trade ID
router.get('/:id', requirePermission(['process_order:read', 'manage_orders', 'manage_manufacture']), async (req, res) => {
  const { id } = req.params;
  const isNum = /^\d+$/.test(id);
  const whereClause = isNum
    ? `(pro.id = $1 OR pro.ro_no = $2 OR pro.trade_id = $1) AND pro.company_id = $3`
    : `(pro.ro_no = $1 OR pro.trade_id = (SELECT id FROM trades WHERE trade_id = $1 AND company_id = $2 LIMIT 1)) AND pro.company_id = $2`;
  const params = isNum
    ? [parseInt(id), id, req.user.company_id]
    : [id, req.user.company_id];

  try {
    const result = await pool.query(
      `SELECT 
         pro.*,
         COALESCE(
           (SELECT json_agg(json_build_object(
              'id', psi.id,
              'item_id', psi.item_id,
              'item_code', psi.item_code,
              'trace_item_id', psi.trace_item_id,
              'qty', psi.qty,
              'description', psi.description,
              'available_qty', (COALESCE(tr.qty, 0) + COALESCE(psi.qty, 0)),
              'history', psi.history
            ))
            FROM process_ro_source_item psi
            LEFT JOIN trace tr ON psi.trace_item_id = tr.id AND tr.company_id = psi.company_id
            WHERE psi.process_ro_id = pro.id AND psi.company_id = pro.company_id
           ), '[]'::json
         ) AS source_items,
         COALESCE(
           (SELECT json_agg(json_build_object(
              'id', pti.id,
              'item_id', pti.item_id,
              'item_code', pti.item_code,
              'description', pti.description,
              'drawing_number', pti.drawing_number,
              'process_name', pti.process_name,
              'qty', pti.qty,
              'delivered_qty', COALESCE((
                 SELECT SUM(dni.quantity)
                 FROM delivery_notes dn
                 JOIN delivery_note_items dni ON dn.id = dni.delivery_note_id
                 LEFT JOIN items di ON dni.item_id = di.id
                 WHERE dn.trade_id = pro.trade_id 
                   AND (dni.item_id = pti.item_id OR di.item_code = pti.item_code)
                   AND dn.company_id = pro.company_id
              ), 0),
              'price', pti.price,
              'gst_type', pti.gst_type,
              'gst_rate', pti.gst_rate,
              'shipping_address', pti.shipping_address,
              'delivery_date', pti.delivery_date
            ))
            FROM process_ro_target_item pti
            WHERE pti.process_ro_id = pro.id AND pti.company_id = pro.company_id
           ), '[]'::json
         ) AS target_items
       FROM process_ro pro
       WHERE ${whereClause}`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Process Release Order not found' });
    }

    const pro = result.rows[0];
    pro._is_process_ro = true;
    pro.items = (pro.target_items || []).map(ti => ({
      ...ti,
      quantity: ti.qty,
      unit_price: ti.price,
    }));
    pro.customer_name = pro.party;
    pro.buyer_name = pro.seller;
    pro.ro_date = pro.date_of_start;
    pro.delivery_date = pro.date_of_end;
    res.json(pro);
  } catch (err) {
    console.error('Error fetching process RO by ID:', err.message);
    res.status(500).json({ error: 'Failed to fetch process RO' });
  }
});

// POST Create a new Process RO, push trade, and insert items
router.post('/', requirePermission(['process_order:create', 'manage_orders', 'manage_manufacture']), async (req, res) => {
  let {
    ro_no,
    contract_id,
    contract_ref,
    date_of_start,
    date_of_end,
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
    target_items
  } = req.body || {};

  // Validate compulsory fields
  if (!seller || !seller.trim()) {
    return res.status(400).json({ error: 'Seller / Processor Vendor is required' });
  }

  if (!party || !party.trim()) {
    return res.status(400).json({ error: 'Party / Client Customer is required' });
  }

  const normalizedSourceItems = Array.isArray(source_items) ? [...source_items] : [];
  const normalizedTargetItems = Array.isArray(target_items) ? [...target_items] : [];

  if (normalizedSourceItems.length === 0) {
    return res.status(400).json({ error: 'At least one source item is required from inventory trace' });
  }

  if (normalizedTargetItems.length === 0) {
    return res.status(400).json({ error: 'At least one target output product is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const companyId = req.user.company_id;

    if (!ro_no || !ro_no.trim()) {
      const countRes = await client.query('SELECT COUNT(*) FROM process_ro WHERE company_id = $1', [companyId]);
      const count = parseInt(countRes.rows[0].count) || 0;
      ro_no = `PRO-${String(count + 1).padStart(4, '0')}`;
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

    // Auto-create Trade in trades table
    if (!tradeDbId) {
      tradeCodeStr = 'TRD-' + ro_no.trim().replace(/[\s/]+/g, '-');
      const dupCheck = await client.query(
        'SELECT id FROM trades WHERE trade_id = $1 AND company_id = $2',
        [tradeCodeStr, companyId]
      );
      if (dupCheck.rows.length > 0) {
        tradeCodeStr = `${tradeCodeStr}-${Date.now().toString().slice(-4)}`;
      }

      const tradeInsertRes = await client.query(
        `INSERT INTO trades (trade_id, status, trade_type, documents, company_id)
         VALUES ($1, 'RO', 'BUY_PROCESS', $2::jsonb, $3)
         RETURNING id, trade_id`,
        [
          tradeCodeStr,
          JSON.stringify([{ type: 'RO', id: ro_no.trim(), title: 'Process Release Order' }]),
          companyId
        ]
      );
      tradeDbId = tradeInsertRes.rows[0].id;
      tradeCodeStr = tradeInsertRes.rows[0].trade_id;
    } else {
      await client.query(
        `UPDATE trades SET status = 'RO' WHERE id = $1 AND company_id = $2`,
        [tradeDbId, companyId]
      );
    }

    // Ensure 'RO' status exists in status lookup table and status column exists in process_ro
    await client.query(
      `ALTER TABLE process_ro ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'RO'`
    ).catch(() => {});
    await client.query(
      `INSERT INTO status (name, company_id) VALUES ('RO', $1) ON CONFLICT (name, company_id) DO NOTHING`,
      [companyId]
    );

    // Insert into process_ro
    const insertRes = await client.query(
      `INSERT INTO process_ro (
         ro_no, contract_id, contract_ref, date_of_start, date_of_end,
         seller, party, gst_type, gst_rate, gst, transport,
         packing_forward, other, basic_value, delivery_date,
         shipping_address, message, trade_id, company_id, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, 'RO')
       RETURNING id, created_at`,
      [
        ro_no.trim(),
        contract_id ? parseInt(contract_id) : null,
        contract_ref ? String(contract_ref).trim() : null,
        date_of_start || new Date().toISOString().split('T')[0],
        date_of_end || delivery_date || null,
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
        tradeDbId,
        companyId
      ]
    );

    const proId = insertRes.rows[0].id;

    // Helper to resolve items.id
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
        if (res.rows.length > 0) return res.rows[0].id;
      } else {
        const res = await client.query(
          `SELECT id FROM items WHERE item_code = $1 AND company_id = $2 LIMIT 1`,
          [strVal, companyId]
        );
        if (res.rows.length > 0) return res.rows[0].id;
      }
      return null;
    };

    // Insert Target Items
    for (const tgt of normalizedTargetItems) {
      const resolvedId = await resolveItemId(tgt.item_code);
      await client.query(
        `INSERT INTO process_ro_target_item (
           process_ro_id, item_id, item_code, description, drawing_number,
           process_name, qty, price, gst_type, gst_rate, shipping_address,
           delivery_date, company_id
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          proId,
          resolvedId,
          tgt.item_code || '',
          tgt.description || null,
          tgt.drawing_number || null,
          tgt.process_name || null,
          parseFloat(tgt.qty) || 1,
          parseFloat(tgt.price) || 0,
          tgt.gst_type || gst_type || null,
          tgt.gst_rate !== undefined && tgt.gst_rate !== '' ? parseFloat(tgt.gst_rate) : (parseFloat(gst_rate) || 0),
          tgt.shipping_address || shipping_address || null,
          tgt.delivery_date || delivery_date || date_of_end || null,
          companyId
        ]
      );
    }

    // Ensure column history exists in process_ro_source_item
    await client.query("ALTER TABLE process_ro_source_item ADD COLUMN IF NOT EXISTS history JSONB").catch(() => {});

    // Insert Source Items, snapshot history, and deduct from inventory trace (matching manufacturing jobs)
    for (const src of normalizedSourceItems) {
      const resolvedId = await resolveItemId(src.item_code);
      const traceId = src.trace_item_id ? parseInt(src.trace_item_id) : (src.trace_id ? parseInt(src.trace_id) : null);
      const consumedQty = parseFloat(src.qty) || 0;

      let sourceTraceHistory = [];
      if (traceId) {
        const traceFetch = await client.query(
          'SELECT id, qty, cost_price, history FROM trace WHERE id = $1 AND company_id = $2 FOR UPDATE',
          [traceId, companyId]
        );
        if (traceFetch.rows.length > 0) {
          const row = traceFetch.rows[0];
          if (Array.isArray(row.history)) {
            sourceTraceHistory = row.history;
          } else if (typeof row.history === 'string') {
            try { sourceTraceHistory = JSON.parse(row.history); } catch (e) { sourceTraceHistory = []; }
          }

          // Deduct consumed raw material from inventory trace table
          if (consumedQty > 0) {
            await client.query(
              'UPDATE trace SET qty = GREATEST(qty - $1, 0) WHERE id = $2 AND company_id = $3',
              [consumedQty, traceId, companyId]
            );
          }
        }
      }

      await client.query(
        `INSERT INTO process_ro_source_item (
           process_ro_id, item_id, item_code, trace_item_id, qty, description, company_id, history
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
        [
          proId,
          resolvedId,
          src.item_code || '',
          traceId,
          consumedQty || 1,
          src.description || null,
          companyId,
          JSON.stringify(sourceTraceHistory)
        ]
      );
    }

    await client.query('COMMIT');

    res.status(201).json({
      id: proId,
      ro_no: ro_no.trim(),
      trade_id: tradeCodeStr,
      created_at: insertRes.rows[0].created_at
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating process RO:', err.message);
    res.status(500).json({ error: 'Failed to create Process Release Order: ' + err.message });
  } finally {
    client.release();
  }
});

// PUT Update Process RO (Contract Order)
router.put('/:id', requirePermission(['process_order:update', 'manage_orders', 'manage_manufacture']), async (req, res) => {
  const { id } = req.params;
  const {
    date_of_start,
    date_of_end,
    seller,
    party,
    gst_type,
    gst_rate,
    gst,
    transport,
    packing_forward,
    other,
    basic_value,
    shipping_address,
    message,
    source_items,
    target_items
  } = req.body || {};

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const companyId = req.user.company_id;
    const isNum = /^\d+$/.test(id);
    const existingRes = await client.query(
      `SELECT * FROM process_ro WHERE (${isNum ? 'id = $1 OR ' : ''}ro_no = ${isNum ? '$2' : '$1'}) AND company_id = ${isNum ? '$3' : '$2'} LIMIT 1`,
      isNum ? [parseInt(id), id, companyId] : [id, companyId]
    );

    if (existingRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Process Contract Order not found' });
    }

    const currentPro = existingRes.rows[0];
    const proId = currentPro.id;

    // Update header
    await client.query(
      `UPDATE process_ro SET
         date_of_start = COALESCE($1, date_of_start),
         date_of_end = COALESCE($2, date_of_end),
         seller = COALESCE($3, seller),
         party = COALESCE($4, party),
         gst_type = $5,
         gst_rate = $6,
         gst = $7,
         transport = $8,
         packing_forward = $9,
         other = $10,
         basic_value = $11,
         shipping_address = $12,
         message = $13
       WHERE id = $14 AND company_id = $15`,
      [
        date_of_start || null,
        date_of_end || null,
        seller ? seller.trim() : null,
        party ? party.trim() : null,
        gst_type || null,
        gst_rate !== undefined ? parseFloat(gst_rate) : currentPro.gst_rate,
        gst !== undefined ? parseFloat(gst) : currentPro.gst,
        transport !== undefined ? parseFloat(transport) : currentPro.transport,
        packing_forward !== undefined ? parseFloat(packing_forward) : currentPro.packing_forward,
        other !== undefined ? parseFloat(other) : currentPro.other,
        basic_value !== undefined ? parseFloat(basic_value) : currentPro.basic_value,
        shipping_address || null,
        message || null,
        proId,
        companyId
      ]
    );

    // Update source items and adjust inventory traces
    if (Array.isArray(source_items)) {
      // 1. Restore previous allocated trace quantities to inventory
      const prevSourceRes = await client.query(
        'SELECT trace_item_id, qty FROM process_ro_source_item WHERE process_ro_id = $1 AND company_id = $2',
        [proId, companyId]
      );
      for (const prev of prevSourceRes.rows) {
        const prevTraceId = prev.trace_item_id ? parseInt(prev.trace_item_id) : null;
        const prevQty = parseFloat(prev.qty) || 0;
        if (prevTraceId && prevQty > 0) {
          await client.query(
            'UPDATE trace SET qty = qty + $1 WHERE id = $2 AND company_id = $3',
            [prevQty, prevTraceId, companyId]
          );
        }
      }

      // 2. Delete old records
      await client.query('DELETE FROM process_ro_source_item WHERE process_ro_id = $1 AND company_id = $2', [proId, companyId]);

      // 3. Insert new records and deduct from inventory
      for (const src of source_items) {
        const traceId = src.trace_item_id ? parseInt(src.trace_item_id) : (src.trace_id ? parseInt(src.trace_id) : null);
        const consumedQty = parseFloat(src.qty) || 0;
        let resolvedId = null;

        if (src.item_code) {
          const itmRes = await client.query(
            'SELECT id FROM items WHERE (item_code = $1 OR id = $2) AND company_id = $3 LIMIT 1',
            [String(src.item_code).trim(), parseInt(src.item_code) || 0, companyId]
          );
          if (itmRes.rows.length > 0) resolvedId = itmRes.rows[0].id;
        }

        if (traceId && consumedQty > 0) {
          await client.query(
            'UPDATE trace SET qty = GREATEST(qty - $1, 0) WHERE id = $2 AND company_id = $3',
            [consumedQty, traceId, companyId]
          );
        }

        await client.query(
          `INSERT INTO process_ro_source_item (
             process_ro_id, item_id, item_code, trace_item_id, qty, description, company_id, history
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
          [
            proId,
            resolvedId,
            src.item_code || '',
            traceId,
            consumedQty,
            src.description || null,
            companyId,
            JSON.stringify([])
          ]
        );
      }
    }

    // Update target items
    if (Array.isArray(target_items)) {
      await client.query('DELETE FROM process_ro_target_item WHERE process_ro_id = $1 AND company_id = $2', [proId, companyId]);
      for (const tgt of target_items) {
        let resolvedId = null;
        if (tgt.item_code) {
          const itmRes = await client.query(
            'SELECT id, description, drawing_number FROM items WHERE (item_code = $1 OR id = $2) AND company_id = $3 LIMIT 1',
            [String(tgt.item_code).trim(), parseInt(tgt.item_code) || 0, companyId]
          );
          if (itmRes.rows.length > 0) resolvedId = itmRes.rows[0].id;
        }

        await client.query(
          `INSERT INTO process_ro_target_item (
             process_ro_id, item_id, item_code, description, drawing_number,
             process_name, qty, price, gst_type, gst_rate, shipping_address, delivery_date, company_id
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [
            proId,
            resolvedId,
            tgt.item_code || '',
            tgt.description || null,
            tgt.drawing_number || null,
            tgt.process_name || null,
            parseFloat(tgt.qty) || 0,
            parseFloat(tgt.price) || 0,
            tgt.gst_type || gst_type || null,
            tgt.gst_rate !== undefined ? parseFloat(tgt.gst_rate) : (gst_rate ? parseFloat(gst_rate) : 0),
            tgt.shipping_address || shipping_address || null,
            tgt.delivery_date || date_of_end || null,
            companyId
          ]
        );
      }
    }

    await client.query('COMMIT');
    res.json({
      message: 'Process Contract Order updated successfully',
      id: proId,
      ro_no: currentPro.ro_no,
      trade_id: currentPro.trade_id
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating Process Contract Order:', err.message);
    res.status(500).json({ error: err.message || 'Failed to update Process Contract Order' });
  } finally {
    client.release();
  }
});

// DELETE Process RO and restore raw material inventory
router.delete('/:id', requirePermission(['process_order:delete', 'manage_orders', 'manage_manufacture']), async (req, res) => {
  const { id } = req.params;
  const companyId = req.user.company_id;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const isNum = /^\d+$/.test(id);
    const existingRes = await client.query(
      `SELECT * FROM process_ro WHERE (${isNum ? 'id = $1 OR ' : ''}ro_no = ${isNum ? '$2' : '$1'}) AND company_id = ${isNum ? '$3' : '$2'} LIMIT 1`,
      isNum ? [parseInt(id), id, companyId] : [id, companyId]
    );

    if (existingRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Process Contract Order not found' });
    }

    const proId = existingRes.rows[0].id;

    // Restore trace quantities for source items
    const prevSourceRes = await client.query(
      'SELECT trace_item_id, qty FROM process_ro_source_item WHERE process_ro_id = $1 AND company_id = $2',
      [proId, companyId]
    );
    for (const prev of prevSourceRes.rows) {
      const prevTraceId = prev.trace_item_id ? parseInt(prev.trace_item_id) : null;
      const prevQty = parseFloat(prev.qty) || 0;
      if (prevTraceId && prevQty > 0) {
        await client.query(
          'UPDATE trace SET qty = qty + $1 WHERE id = $2 AND company_id = $3',
          [prevQty, prevTraceId, companyId]
        );
      }
    }

    await client.query('DELETE FROM process_ro_source_item WHERE process_ro_id = $1 AND company_id = $2', [proId, companyId]);
    await client.query('DELETE FROM process_ro_target_item WHERE process_ro_id = $1 AND company_id = $2', [proId, companyId]);
    await client.query('DELETE FROM process_ro WHERE id = $1 AND company_id = $2', [proId, companyId]);

    await client.query('COMMIT');
    res.json({ message: 'Process Contract Order deleted successfully and inventory restored', id: proId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error deleting Process Contract Order:', err.message);
    res.status(500).json({ error: err.message || 'Failed to delete Process Contract Order' });
  } finally {
    client.release();
  }
});

module.exports = router;
