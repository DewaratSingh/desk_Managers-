const express = require('express');
const router = express.Router();
const { pool, appendDocToTrade } = require('../db');

/**
 * Computes margin for a sold item based on selling price and inventory cost price,
 * averages it with the existing margin in items table, and updates items.margin.
 */
async function updateItemMarginOnDelivery(client, itemDbId, sellPrice, costPrice, companyId) {
  try {
    if (sellPrice <= 0 && costPrice <= 0) return;

    // Calculate current margin percentage
    let currentMargin = 0;
    if (costPrice > 0) {
      currentMargin = ((sellPrice - costPrice) / costPrice) * 100;
    } else if (sellPrice > 0) {
      currentMargin = 100; // 100% margin when cost is zero
    }

    // Retrieve existing margin from items table
    const itemRes = await client.query(
      'SELECT margin FROM items WHERE id = $1 AND company_id = $2',
      [itemDbId, companyId]
    );

    let newMargin = currentMargin;
    if (itemRes.rows.length > 0 && itemRes.rows[0].margin !== null) {
      const existingMargin = parseFloat(itemRes.rows[0].margin);
      // Average with existing margin if an existing non-zero margin is present
      if (!isNaN(existingMargin) && existingMargin !== 0) {
        newMargin = (existingMargin + currentMargin) / 2;
      } else {
        newMargin = currentMargin;
      }
    }

    newMargin = parseFloat(newMargin.toFixed(2));

    await client.query(
      'UPDATE items SET margin = $1 WHERE id = $2 AND company_id = $3',
      [newMargin, itemDbId, companyId]
    );
  } catch (err) {
    console.error(`Failed to update item margin for item ID ${itemDbId}:`, err.message);
  }
}

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
            'next_activity', dni.next_activity,
            'history_id', dni.history_id
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
    const roDoc = docs.find(d => d.type === 'RO' || d.type === 'PROCESS_RO');

    const po_no = poDoc ? poDoc.id : null;
    const ro_no = roDoc ? roDoc.id : null;

    let effectivePpoNo = (po_no && po_no.startsWith('PPO-')) ? po_no : null;
    if (!effectivePpoNo && tradeDbId) {
      const ppoCheck = await pool.query('SELECT po_no FROM process_po WHERE trade_id = $1 AND company_id = $2 LIMIT 1', [tradeDbId, req.user.company_id]);
      if (ppoCheck.rows.length > 0) {
        effectivePpoNo = ppoCheck.rows[0].po_no;
      }
    }

    let effectiveProNo = (ro_no && ro_no.startsWith('PRO-')) ? ro_no : null;
    if (!effectiveProNo && tradeDbId) {
      const proCheck = await pool.query('SELECT ro_no FROM process_ro WHERE trade_id = $1 AND company_id = $2 LIMIT 1', [tradeDbId, req.user.company_id]);
      if (proCheck.rows.length > 0) {
        effectiveProNo = proCheck.rows[0].ro_no;
      }
    }

    if (!po_no && !ro_no && !effectivePpoNo && !effectiveProNo) return res.status(400).json({ error: 'No Purchase Order or Release Order found for this trade' });

    let items = [];
    let sourceItemsForTrade = [];

    if (effectiveProNo) {
      const proRes = await pool.query('SELECT id, ro_no FROM process_ro WHERE (ro_no = $1 OR id::text = $1) AND company_id = $2', [effectiveProNo, req.user.company_id]);
      if (proRes.rows.length > 0) {
        const proDbId = proRes.rows[0].id;

        const proItemsRes = await pool.query(
          `SELECT
            pti.id as process_ro_target_item_id,
            pti.item_id,
            COALESCE(pti.item_code, i.item_code) as item_code,
            pti.qty as original_qty,
            pti.price as rate_per_piece,
            pti.shipping_address,
            pti.delivery_date,
            COALESCE(pti.description, i.description) as description,
            COALESCE(pti.drawing_number, i.drawing_number) as drawing_number,
            pti.process_name,
            COALESCE((
              SELECT SUM(dni.quantity)
              FROM delivery_note_items dni
              JOIN delivery_notes dn ON dni.delivery_note_id = dn.id
              LEFT JOIN items di ON dni.item_id = di.id
              WHERE dn.trade_id = $1 AND dn.company_id = $4
                AND (dni.item_id = pti.item_id OR di.item_code = pti.item_code)
                AND ($3::varchar IS NULL OR dn.delivery_note_no != $3)
            ), 0) - COALESCE((
              SELECT SUM((elem->>'quantity')::numeric)
              FROM grns g
              CROSS JOIN LATERAL jsonb_array_elements(COALESCE(g.rejection_items, '[]'::jsonb)) AS elem
              WHERE g.trade_id = $1 AND g.company_id = $4
                AND elem->>'item_code' = COALESCE(pti.item_code, i.item_code)
                AND ($3::varchar IS NULL OR (SELECT delivery_note_no FROM delivery_notes WHERE id = g.delivery_note_id) != $3)
            ), 0) as delivered_qty
          FROM process_ro_target_item pti
          LEFT JOIN items i ON pti.item_id = i.id AND i.company_id = pti.company_id
          WHERE pti.process_ro_id = $2 AND pti.company_id = $4
          ORDER BY pti.id`,
          [tradeDbId, proDbId, exclude_dn_no || null, req.user.company_id]
        );
        items = proItemsRes.rows;

        const srcRes = await pool.query(
          `SELECT
             psi.id,
             COALESCE(psi.item_code, i.item_code) as item_code,
             psi.qty,
             COALESCE(t.cost_price, 0) as unit_price
           FROM process_ro_source_item psi
           LEFT JOIN items i ON psi.item_id = i.id AND i.company_id = psi.company_id
           LEFT JOIN trace t ON psi.trace_item_id = t.id AND t.company_id = psi.company_id
           WHERE psi.process_ro_id = $1 AND psi.company_id = $2
           ORDER BY psi.id`,
          [proDbId, req.user.company_id]
        );
        sourceItemsForTrade = srcRes.rows;
      }
    } else if (ro_no) {
      const roRes = await pool.query('SELECT id FROM release_orders WHERE ro_no = $1 AND company_id = $2', [ro_no, req.user.company_id]);
      if (roRes.rows.length === 0) return res.status(404).json({ error: 'Release Order not found' });
      const roDbId = roRes.rows[0].id;

      const roItemsRes = await pool.query(
        `SELECT
          COALESCE(roi.item_code, i.item_code) as item_code,
          roi.quantity as original_qty,
          roi.unit_price as rate_per_piece,
          roi.shipping_address,
          roi.delivery_date,
          COALESCE(roi.description, i.description) as description,
          COALESCE(roi.drawing_number, i.drawing_number) as drawing_number,
          roi.process_name,
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
              AND elem->>'item_code' = COALESCE(roi.item_code, i.item_code)
              AND ($3::varchar IS NULL OR (SELECT delivery_note_no FROM delivery_notes WHERE id = g.delivery_note_id) != $3)
          ), 0) as delivered_qty
        FROM release_order_items roi
        LEFT JOIN items i ON roi.item_id = i.id AND i.company_id = roi.company_id
        WHERE roi.ro_id = $2 AND roi.company_id = $4
        ORDER BY roi.id`,
        [tradeDbId, roDbId, exclude_dn_no || null, req.user.company_id]
      );
      items = roItemsRes.rows;
    } else if (effectivePpoNo) {
      const ppoRes = await pool.query('SELECT id, job_ids FROM process_po WHERE po_no = $1 AND company_id = $2', [effectivePpoNo, req.user.company_id]);
      if (ppoRes.rows.length === 0) return res.status(404).json({ error: 'Process Purchase Order not found' });
      const ppoDbId = ppoRes.rows[0].id;
      
      let jobIdsArray = [];
      try {
          if (typeof ppoRes.rows[0].job_ids === 'string') {
             jobIdsArray = JSON.parse(ppoRes.rows[0].job_ids);
          } else if (Array.isArray(ppoRes.rows[0].job_ids)) {
             jobIdsArray = ppoRes.rows[0].job_ids;
          }
      } catch(e) {}
      
      let processNameMap = {};
      if (jobIdsArray && jobIdsArray.length > 0) {
         const jobsResult = await pool.query(
           `SELECT j.process_name, (SELECT json_agg(ti.*) FROM target_item ti WHERE ti.job_id = j.id) as target_items 
            FROM job j 
            WHERE j.id IN (SELECT jsonb_array_elements_text($1::jsonb)::int) AND j.company_id = $2`,
           [JSON.stringify(jobIdsArray), req.user.company_id]
         );
         jobsResult.rows.forEach(job => {
             const tgtGroups = job.target_items || [];
             tgtGroups.forEach(ti => {
                if (Array.isArray(ti.items)) {
                    ti.items.forEach(t => {
                        processNameMap[t.item_code] = job.process_name;
                    });
                }
             });
         });
      }

      // Check process_po_target_item first
      const ptiRes = await pool.query(
        `SELECT
          pti.id as process_po_target_item_id,
          pti.item_code as target_item_id,
          pti.process_name,
          i.item_code,
          COALESCE(pti.qty, 0) as original_qty,
          COALESCE(pti.price, 0) as rate_per_piece,
          i.description,
          i.drawing_number,
          COALESCE((
            SELECT SUM(dni.quantity)
            FROM delivery_note_items dni
            JOIN delivery_notes dn ON dni.delivery_note_id = dn.id
            WHERE dn.trade_id = $1 AND dn.company_id = $4
              AND dni.item_id = pti.item_code
              AND ($3::varchar IS NULL OR dn.delivery_note_no != $3)
          ), 0) as delivered_qty
        FROM process_po_target_item pti
        LEFT JOIN items i ON pti.item_code = i.id AND i.company_id = pti.company_id
        WHERE pti.process_po_id = $2 AND pti.company_id = $4
        ORDER BY pti.id`,
        [tradeDbId, ppoDbId, exclude_dn_no || null, req.user.company_id]
      );

      if (ptiRes.rows.length > 0) {
        items = ptiRes.rows.map(row => ({
          ...row,
          process_name: processNameMap[row.item_code] || row.process_name || null
        }));
      } else {
        const ppoItemsRes = await pool.query(
          `SELECT
            poi.id as process_po_item_id,
            poi.target_item_id,
            poi.process_name,
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
            process_name: processNameMap[row.item_code] || row.process_name || null,
            process_target_trace_item_id: targetTraceId,
            linked_trace_item_id: targetTraceId
          };
        });
      }

      // Query source items used in that trade (showing item_code, qty, and unit_price)
      const srcRes = await pool.query(
        `SELECT
           psi.id,
           i.item_code,
           psi.qty,
           COALESCE(t.cost_price, 0) as unit_price
         FROM process_po_source_item psi
         LEFT JOIN items i ON psi.item_code = i.id AND i.company_id = psi.company_id
         LEFT JOIN trace t ON psi.trace_item_id = t.id AND t.company_id = psi.company_id
         WHERE psi.process_po_id = $1 AND psi.company_id = $2
         ORDER BY psi.id`,
        [ppoDbId, req.user.company_id]
      );

      if (srcRes.rows.length > 0) {
        sourceItemsForTrade = srcRes.rows;
      } else {
        const legacySrcRes = await pool.query(
          `SELECT
             poi.id,
             i.item_code,
             poi.source_qty as qty,
             COALESCE((
               SELECT cost_price FROM trace 
               WHERE id = ((poi.source_trace_id_array->0->>'trace_id')::int)
                 AND company_id = $2 LIMIT 1
             ), 0) as unit_price
           FROM process_po_item poi
           LEFT JOIN items i ON poi.source_item_id = i.id AND i.company_id = poi.company_id
           WHERE poi.process_po_id = $1 AND poi.company_id = $2`,
          [ppoDbId, req.user.company_id]
        );
        sourceItemsForTrade = legacySrcRes.rows;
      }
    } else if (po_no) {
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
      po_no: po_no || effectivePpoNo,
      ro_no: effectiveProNo || ro_no,
      trade_type: trade.trade_type || 'BUY_PROCESS',
      items: mappedItems,
      source_items: sourceItemsForTrade
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
    const rawTradeType = (trade.trade_type || 'sell').toLowerCase().replace(/\s+/g, '');
    const isBuyTrade = rawTradeType === 'buy' || rawTradeType === 'process' || rawTradeType === 'buyarc' || rawTradeType === 'buy_process' || rawTradeType.includes('process');

    const docs = trade.documents || [];
    const poDoc = docs.find(d => d.type === 'PO' || d.type === 'PURCHASE_ORDER');
    const roDoc = docs.find(d => d.type === 'RO');

    const po_no = poDoc ? poDoc.id : null;
    const ro_no = roDoc ? roDoc.id : null;

    let poDbId = null, ppoDbId = null, roDbId = null;
    let ppoMessage = null, ppoNo = null, ppoJobIds = null;

    if (po_no) {
      if (po_no.startsWith('PPO-')) {
        const ppoRes = await client.query('SELECT id, message, po_no, job_ids FROM process_po WHERE po_no = $1 AND company_id = $2', [po_no, companyId]);
        if (ppoRes.rows.length > 0) {
          ppoDbId = ppoRes.rows[0].id;
          ppoMessage = ppoRes.rows[0].message;
          ppoNo = ppoRes.rows[0].po_no;
          ppoJobIds = ppoRes.rows[0].job_ids;
        }
      } else {
        const poRes = await client.query('SELECT id FROM purchase_orders WHERE po_no = $1 AND company_id = $2', [po_no, companyId]);
        if (poRes.rows.length > 0) {
          poDbId = poRes.rows[0].id;
        } else {
          const ppoRes = await client.query('SELECT id, message, po_no, job_ids FROM process_po WHERE po_no = $1 AND company_id = $2', [po_no, companyId]);
          if (ppoRes.rows.length > 0) {
            ppoDbId = ppoRes.rows[0].id;
            ppoMessage = ppoRes.rows[0].message;
            ppoNo = ppoRes.rows[0].po_no;
            ppoJobIds = ppoRes.rows[0].job_ids;
          }
        }
      }
    }

    if (!ppoDbId && tradeDbId) {
      const ppoCheck = await client.query('SELECT id, message, po_no, job_ids FROM process_po WHERE trade_id = $1 AND company_id = $2', [tradeDbId, companyId]);
      if (ppoCheck.rows.length > 0) {
        ppoDbId = ppoCheck.rows[0].id;
        ppoMessage = ppoCheck.rows[0].message;
        ppoNo = ppoCheck.rows[0].po_no;
        ppoJobIds = ppoCheck.rows[0].job_ids;
      }
    }

    let proDbId = null;
    if (ro_no) {
      const roRes = await client.query('SELECT id FROM release_orders WHERE ro_no = $1 AND company_id = $2', [ro_no, companyId]);
      if (roRes.rows.length > 0) roDbId = roRes.rows[0].id;

      const proRes = await client.query('SELECT id FROM process_ro WHERE ro_no = $1 AND company_id = $2', [ro_no, companyId]);
      if (proRes.rows.length > 0) proDbId = proRes.rows[0].id;
    }

    if (!proDbId && tradeDbId) {
      const proCheck = await client.query('SELECT id, ro_no FROM process_ro WHERE trade_id = $1 AND company_id = $2', [tradeDbId, companyId]);
      if (proCheck.rows.length > 0) {
        proDbId = proCheck.rows[0].id;
        if (!ro_no) ro_no = proCheck.rows[0].ro_no;
      }
    }

    // 3. Insert Delivery Note header
    const dnRes = await client.query(
      `INSERT INTO delivery_notes (delivery_note_no, po_id, ro_id, process_ro_id, delivery_date, dispatch_doc_no, dispatch_through, motor_vehicle_no, trade_id, company_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [delivery_note_no, poDbId, roDbId, proDbId, delivery_date, dispatch_doc_no || null, dispatch_through, motor_vehicle_no, tradeDbId, companyId]
    );
    const dnDbId = dnRes.rows[0].id;

    // 4. Insert items
    for (const item of items) {
      const itemRes = await client.query('SELECT id FROM items WHERE item_code = $1 AND company_id = $2', [item.item_code, companyId]);
      if (itemRes.rows.length === 0) throw new Error(`Item ${item.item_code} not found`);
      const itemDbId = itemRes.rows[0].id;

      let traceIdForNextActivity = null;
      let historyId = null;

      if (!isBuyTrade) {
        // SELL / ARC TRADE: deduct from existing trace rows
        const allocations = Array.isArray(item.stock_allocations) ? item.stock_allocations : [];
        let totalAllocCost = 0;
        let totalAllocQty = 0;
        let collectedHistories = [];

        for (const alloc of allocations) {
          const allocQty = parseFloat(alloc.qty) || 0;
          const targetTraceId = parseInt(alloc.trace_id);

          if (targetTraceId && allocQty > 0) {
            // Retrieve cost price and history from trace before updating or deleting
            const traceFetch = await client.query(
              'SELECT cost_price, history FROM trace WHERE id = $1 AND company_id = $2',
              [targetTraceId, companyId]
            );
            if (traceFetch.rows.length > 0) {
              const row = traceFetch.rows[0];
              totalAllocCost += allocQty * (parseFloat(row.cost_price) || 0);
              totalAllocQty += allocQty;
              if (Array.isArray(row.history) && row.history.length > 0) {
                collectedHistories.push(row.history);
              }
            } else {
              totalAllocCost += allocQty * (parseFloat(alloc.cost_price) || 0);
              totalAllocQty += allocQty;
            }

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

        // Determine cost price
        let costPrice = 0;
        if (totalAllocQty > 0) {
          costPrice = totalAllocCost / totalAllocQty;
        } else if (item.inv_details && item.inv_details.cost_price) {
          costPrice = parseFloat(item.inv_details.cost_price) || 0;
        } else {
          const avgTraceRes = await client.query(
            'SELECT COALESCE(AVG(cost_price), 0.00) AS avg_cost FROM trace WHERE item_code = $1 AND company_id = $2',
            [itemDbId, companyId]
          );
          if (avgTraceRes.rows.length > 0) {
            costPrice = parseFloat(avgTraceRes.rows[0].avg_cost) || 0;
          }
        }

        // Determine sell price
        let sellPrice = parseFloat(item.rate_per_piece) || 0;
        if (sellPrice <= 0 && proDbId) {
          const proPriceRes = await client.query(
            'SELECT price FROM process_ro_target_item WHERE process_ro_id = $1 AND (item_id = $2 OR item_code = $3) AND company_id = $4 LIMIT 1',
            [proDbId, itemDbId, item.item_code, companyId]
          );
          if (proPriceRes.rows.length > 0) sellPrice = parseFloat(proPriceRes.rows[0].price) || 0;
        }
        if (sellPrice <= 0 && roDbId) {
          const roPriceRes = await client.query(
            'SELECT unit_price FROM release_order_items WHERE ro_id = $1 AND item_id = $2 AND company_id = $3 LIMIT 1',
            [roDbId, itemDbId, companyId]
          );
          if (roPriceRes.rows.length > 0) sellPrice = parseFloat(roPriceRes.rows[0].unit_price) || 0;
        }
        if (sellPrice <= 0 && poDbId) {
          const poPriceRes = await client.query(
            'SELECT unit_price FROM purchase_order_items WHERE po_id = $1 AND item_id = $2 AND company_id = $3 LIMIT 1',
            [poDbId, itemDbId, companyId]
          );
          if (poPriceRes.rows.length > 0) sellPrice = parseFloat(poPriceRes.rows[0].unit_price) || 0;
        }

        // If no stock allocations were chosen, check trace for this item
        if (collectedHistories.length === 0) {
          const fallbackTrace = await client.query(
            'SELECT history FROM trace WHERE item_code = $1 AND company_id = $2 ORDER BY id DESC LIMIT 1',
            [itemDbId, companyId]
          );
          if (fallbackTrace.rows.length > 0 && Array.isArray(fallbackTrace.rows[0].history) && fallbackTrace.rows[0].history.length > 0) {
            collectedHistories.push(fallbackTrace.rows[0].history);
          }
        }

        const sellStep = {
          trace: 'Sell Delivery',
          type: 'SELL',
          action: 'Delivery Dispatch',
          delivery_note_no: delivery_note_no,
          trade_id: trade_code,
          price: sellPrice,
          sell_price: sellPrice,
          cost_price: costPrice,
          quantity: parseFloat(item.quantity) || 0,
          date: delivery_date || new Date().toISOString().split('T')[0]
        };

        let finalHistoryArray = [];
        if (collectedHistories.length === 1) {
          finalHistoryArray = [...collectedHistories[0], sellStep];
        } else if (collectedHistories.length > 1) {
          finalHistoryArray = [
            {
              trace: 'Stock Allocation',
              type: 'MERGED_STOCK',
              action: 'Multiple Stock Batches',
              sources: collectedHistories,
              date: delivery_date || new Date().toISOString().split('T')[0]
            },
            sellStep
          ];
        } else {
          finalHistoryArray = [sellStep];
        }

        // Insert into history table
        const histRes = await client.query(
          `INSERT INTO history (item_id, item_code, delivery_note_id, price, history, company_id)
           VALUES ($1, $2, $3, $4, $5::jsonb, $6) RETURNING id`,
          [itemDbId, item.item_code, dnDbId, sellPrice, JSON.stringify(finalHistoryArray), companyId]
        );
        if (histRes.rows.length > 0) {
          historyId = histRes.rows[0].id;
        }

        // Update item margin in items table
        await updateItemMarginOnDelivery(client, itemDbId, sellPrice, costPrice, companyId);
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
          let stepObj = {
            buyprice:    buyUnitPrice,
            trace:       'buy',
            trade_id:    trade_code,
            delivery_no: delivery_note_no
          };
          let initialHistory = [stepObj];

          if (ppoDbId) {
             let ppoItemProcessName = null;
             let ppoItemId = null;

             if (ppoJobIds && ppoJobIds.length > 0) {
               const jobFetchRes = await client.query(`
                 SELECT j.process_name 
                 FROM target_item ti
                 JOIN job j ON ti.job_id = j.id
                 WHERE ti.job_id = ANY($1::int[]) 
                   AND ti.company_id = $2 
                   AND EXISTS (
                     SELECT 1 FROM jsonb_array_elements(ti.items) AS elem 
                     WHERE (elem->>'item_code') = $3 
                        OR (elem->>'item_code') = $4::text
                        OR (elem->>'itemcode') = $3
                        OR (elem->>'item_code_id') = $4::text
                   )
                 LIMIT 1
               `, [ppoJobIds, companyId, item.item_code, itemDbId]);
               if (jobFetchRes.rows.length > 0 && jobFetchRes.rows[0].process_name) {
                 ppoItemProcessName = jobFetchRes.rows[0].process_name;
               }
             }

             if (!ppoItemProcessName) {
               const targetItemsRes = await client.query(
                 'SELECT process_name FROM process_po_target_item WHERE process_po_id = $1 AND item_code = $2 AND company_id = $3',
                 [ppoDbId, itemDbId, companyId]
               );
               if (targetItemsRes.rows.length > 0 && targetItemsRes.rows[0].process_name) {
                 ppoItemProcessName = targetItemsRes.rows[0].process_name;
               }
             }

             const sourceItemsRes = await client.query(
               'SELECT id, source_trace_id_array, process_name FROM process_po_item WHERE process_po_id = $1 AND target_item_id = $2 AND company_id = $3',
               [ppoDbId, itemDbId, companyId]
             );
             
             if (sourceItemsRes.rows.length > 0) {
                if (!ppoItemProcessName) ppoItemProcessName = sourceItemsRes.rows[0].process_name;
                ppoItemId = sourceItemsRes.rows[0].id;
             }
             
             stepObj = {
               'trade id': trade_code,
               'process price': buyUnitPrice,
               'delivery note id': dnDbId,
               'trace': item.process_name ? item.process_name : (ppoItemProcessName ? ppoItemProcessName : (ppoMessage ? ppoMessage : `Process ${ppoNo || ''}`.trim()))
             };
             initialHistory = [stepObj];

             if (ppoItemId) {
                const deliveredQty = invQty;
                const deliveredPrice = deliveredQty * buyUnitPrice;
                await client.query(
                  `UPDATE process_po_item 
                   SET delivered_qty = COALESCE(delivered_qty, 0) + $1,
                       delivered_price = COALESCE(delivered_price, 0) + $2,
                       remaining_price = COALESCE(remaining_price, 0) - $2
                   WHERE id = $3`,
                  [deliveredQty, deliveredPrice, ppoItemId]
                );
             }

             if (sourceItemsRes.rows.length > 0) {
                const srcArray = sourceItemsRes.rows[0].source_trace_id_array || [];
                const srcTraceIds = srcArray.map(s => s.trace_id || s.traceid).filter(Boolean);
                
                if (srcTraceIds.length > 0) {
                   const tracesRes = await client.query(
                     'SELECT history FROM trace WHERE id = ANY($1::int[]) AND company_id = $2',
                     [srcTraceIds, companyId]
                   );
                   
                   let sourceHistories = [];
                   for (const r of tracesRes.rows) {
                      if (Array.isArray(r.history)) {
                         sourceHistories.push(r.history);
                      }
                   }
                   if (sourceHistories.length > 0) {
                      stepObj.sources = sourceHistories;
                   }
                   initialHistory = [stepObj];
                }
             }
          }

          if (proDbId) {
             let proItemProcessName = null;
             let proNo = null;

             const proFetchRes = await client.query(
               'SELECT ro_no, message FROM process_ro WHERE id = $1 AND company_id = $2 LIMIT 1',
               [proDbId, companyId]
             );
             if (proFetchRes.rows.length > 0) {
               proNo = proFetchRes.rows[0].ro_no;
             }

             const targetItemsRes = await client.query(
               'SELECT process_name FROM process_ro_target_item WHERE process_ro_id = $1 AND (item_id = $2 OR item_code = $3) AND company_id = $4 LIMIT 1',
               [proDbId, itemDbId, item.item_code, companyId]
             );
             if (targetItemsRes.rows.length > 0 && targetItemsRes.rows[0].process_name) {
               proItemProcessName = targetItemsRes.rows[0].process_name;
             }

             stepObj = {
               type: 'PROCESS_RO',
               action: 'Process RO Delivery',
               'trade id': trade_code,
               'process price': buyUnitPrice,
               'delivery note id': dnDbId,
               ro_no: proNo,
               trace: item.process_name ? item.process_name : (proItemProcessName ? proItemProcessName : `Process RO ${proNo || ''}`.trim()),
               date: delivery_date || new Date().toISOString().split('T')[0]
             };
             initialHistory = [stepObj];

             // Fetch source items and their trace histories for this Process RO
             const sourceItemsRes = await client.query(
               'SELECT trace_item_id, history, item_code, qty FROM process_ro_source_item WHERE process_ro_id = $1 AND company_id = $2',
               [proDbId, companyId]
             );

             let sourceHistories = [];
             for (const src of sourceItemsRes.rows) {
               let hArray = [];
               if (Array.isArray(src.history) && src.history.length > 0) {
                 hArray = src.history;
               } else if (typeof src.history === 'string' && src.history.trim()) {
                 try { hArray = JSON.parse(src.history); } catch (e) { hArray = []; }
               } else if (src.trace_item_id) {
                 const fallbackTrace = await client.query(
                   'SELECT history FROM trace WHERE id = $1 AND company_id = $2',
                   [src.trace_item_id, companyId]
                 );
                 if (fallbackTrace.rows.length > 0) {
                   const trRow = fallbackTrace.rows[0];
                   if (Array.isArray(trRow.history)) hArray = trRow.history;
                   else if (typeof trRow.history === 'string') {
                     try { hArray = JSON.parse(trRow.history); } catch (e) { hArray = []; }
                   }
                 }
               }
               if (hArray.length > 0) {
                 sourceHistories.push(hArray);
               }
             }

             if (sourceHistories.length > 0) {
               stepObj.sources = sourceHistories;
             }
             initialHistory = [stepObj];
          }

          const trIns = await client.query(
            `INSERT INTO trace (item_code, qty, cost_price, inventory_id, status, history, company_id) 
             VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7) RETURNING id`,
            [itemDbId, invQty, buyUnitPrice, targetInvId, targetStatus, JSON.stringify(initialHistory), companyId]
          );
          traceIdForNextActivity = trIns.rows[0].id;
        }
      }

      const next_activity = {
        inventory: item.inv_qty > 0 ? { quantity: parseFloat(item.inv_qty), trace_id: traceIdForNextActivity } : null
      };

      const targetTraceRef = ppoDbId ? (traceIdForNextActivity || null) : null;
      require('fs').appendFileSync('debug.txt', `\\nDEBUG DN POST item=${item.item_code}: ppoDbId=${ppoDbId}, process_target_trace_item_id=${item.process_target_trace_item_id}, traceIdForNextActivity=${traceIdForNextActivity}, targetTraceRef=${targetTraceRef}\\n`);

      await client.query(
        `INSERT INTO delivery_note_items (delivery_note_id, item_id, quantity, rate_per_piece, shipping_address, delivery_date, company_id, next_activity, process_target_trace_item_id, history_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          dnDbId,
          itemDbId,
          parseFloat(item.quantity) || 0,
          parseFloat(item.rate_per_piece) || 0,
          item.shipping_address || null,
          item.delivery_date || null,
          companyId,
          JSON.stringify(next_activity),
          targetTraceRef,
          historyId
        ]
      );

      // Link trace into process_po_item target_trace_id_array if applicable so PO Panel sees delivered items
      if (ppoDbId && traceIdForNextActivity) {
         const poiRes = await client.query(
           'SELECT id, target_trace_id_array FROM process_po_item WHERE process_po_id = $1 AND target_item_id = $2 AND company_id = $3',
           [ppoDbId, itemDbId, companyId]
         );
         if (poiRes.rows.length > 0) {
           const poiRow = poiRes.rows[0];
           const currentArray = Array.isArray(poiRow.target_trace_id_array) ? poiRow.target_trace_id_array : [];
           const existing = currentArray.find(x => parseInt(x.trace_id || x.traceid) === parseInt(traceIdForNextActivity));
           if (existing) {
              existing.qty = (parseFloat(existing.qty) || 0) + parseFloat(item.inv_qty || 0);
              existing.Qty = existing.qty; // ensure Qty works for PoPanel backward compat
           } else {
              currentArray.push({
                 trace_id: traceIdForNextActivity,
                 qty: parseFloat(item.inv_qty || 0),
                 Qty: parseFloat(item.inv_qty || 0),
                 status: 'In Inventory'
              });
           }
           await client.query(
             'UPDATE process_po_item SET target_trace_id_array = $1::jsonb WHERE id = $2 AND company_id = $3',
             [JSON.stringify(currentArray), poiRow.id, companyId]
           );
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
    require('fs').appendFileSync('debug.txt', `\nERROR in DN POST: ${err.message}\n`);
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
    let ppoDbId = null;
    let ppoMessage = null, ppoNo = null, ppoJobIds = null;
    let poDbId = null, roDbId = null, proDbId = null;
    const tradeRes = await client.query('SELECT t.id, t.trade_id, t.trade_type, dn.po_id, dn.ro_id, dn.process_ro_id FROM delivery_notes dn JOIN trades t ON dn.trade_id = t.id WHERE dn.delivery_note_no = $1 AND dn.company_id = $2', [delivery_note_no, companyId]);
    if (tradeRes.rows.length > 0) {
      tradeDbId = tradeRes.rows[0].id;
      trade_code = tradeRes.rows[0].trade_id;
      poDbId = tradeRes.rows[0].po_id;
      roDbId = tradeRes.rows[0].ro_id;
      proDbId = tradeRes.rows[0].process_ro_id;
      const ppoRes = await client.query('SELECT pp.id, pp.message, pp.po_no, pp.job_ids FROM process_po pp WHERE pp.trade_id = $1 AND pp.company_id = $2', [tradeDbId, companyId]);
      if (ppoRes.rows.length > 0) {
        ppoDbId = ppoRes.rows[0].id;
        ppoMessage = ppoRes.rows[0].message;
        ppoNo = ppoRes.rows[0].po_no;
        ppoJobIds = ppoRes.rows[0].job_ids;
      }
      if (!proDbId) {
        const proCheck = await client.query('SELECT id FROM process_ro WHERE trade_id = $1 AND company_id = $2', [tradeDbId, companyId]);
        if (proCheck.rows.length > 0) proDbId = proCheck.rows[0].id;
      }
    }
    const rawTradeType = (tradeRes.rows[0]?.trade_type || 'sell').toLowerCase().replace(/\s+/g, '');
    const isBuyTrade = rawTradeType === 'buy' || rawTradeType === 'process' || rawTradeType === 'buyarc' || rawTradeType === 'buy_process' || rawTradeType.includes('process');

    // 3. Rewrite items
    await client.query('DELETE FROM delivery_note_items WHERE delivery_note_id = $1 AND company_id = $2', [dnDbId, companyId]);

    for (const item of items) {
      const itemRes = await client.query('SELECT id FROM items WHERE item_code = $1 AND company_id = $2', [item.item_code, companyId]);
      if (itemRes.rows.length === 0) throw new Error(`Item ${item.item_code} not found`);
      const itemDbId = itemRes.rows[0].id;

      let traceIdForNextActivity = null;
      let historyId = null;

      if (!isBuyTrade) {
        // SELL / ARC TRADE
        const allocations = Array.isArray(item.stock_allocations) ? item.stock_allocations : [];
        let totalAllocCost = 0;
        let totalAllocQty = 0;
        let collectedHistories = [];

        for (const alloc of allocations) {
          const allocQty = parseFloat(alloc.qty) || 0;
          const targetTraceId = parseInt(alloc.trace_id);
          if (targetTraceId && allocQty > 0) {
            // Retrieve cost price and history from trace before updating or deleting
            const traceFetch = await client.query(
              'SELECT cost_price, history FROM trace WHERE id = $1 AND company_id = $2',
              [targetTraceId, companyId]
            );
            if (traceFetch.rows.length > 0) {
              const row = traceFetch.rows[0];
              totalAllocCost += allocQty * (parseFloat(row.cost_price) || 0);
              totalAllocQty += allocQty;
              if (Array.isArray(row.history) && row.history.length > 0) {
                collectedHistories.push(row.history);
              }
            } else {
              totalAllocCost += allocQty * (parseFloat(alloc.cost_price) || 0);
              totalAllocQty += allocQty;
            }

            const traceUpdate = await client.query(
              `UPDATE trace SET qty = GREATEST(qty - $1, 0) WHERE id = $2 AND company_id = $3 RETURNING qty`,
              [allocQty, targetTraceId, companyId]
            );
            if (traceUpdate.rows.length > 0 && parseFloat(traceUpdate.rows[0].qty) <= 0) {
              await client.query('DELETE FROM trace WHERE id = $1 AND company_id = $2', [targetTraceId, companyId]);
            }
          }
        }

        // Determine cost price
        let costPrice = 0;
        if (totalAllocQty > 0) {
          costPrice = totalAllocCost / totalAllocQty;
        } else if (item.inv_details && item.inv_details.cost_price) {
          costPrice = parseFloat(item.inv_details.cost_price) || 0;
        } else {
          const avgTraceRes = await client.query(
            'SELECT COALESCE(AVG(cost_price), 0.00) AS avg_cost FROM trace WHERE item_code = $1 AND company_id = $2',
            [itemDbId, companyId]
          );
          if (avgTraceRes.rows.length > 0) {
            costPrice = parseFloat(avgTraceRes.rows[0].avg_cost) || 0;
          }
        }

        // Determine sell price
        let sellPrice = parseFloat(item.rate_per_piece) || 0;
        if (sellPrice <= 0 && proDbId) {
          const proPriceRes = await client.query(
            'SELECT price FROM process_ro_target_item WHERE process_ro_id = $1 AND (item_id = $2 OR item_code = $3) AND company_id = $4 LIMIT 1',
            [proDbId, itemDbId, item.item_code, companyId]
          );
          if (proPriceRes.rows.length > 0) sellPrice = parseFloat(proPriceRes.rows[0].price) || 0;
        }
        if (sellPrice <= 0 && roDbId) {
          const roPriceRes = await client.query(
            'SELECT unit_price FROM release_order_items WHERE ro_id = $1 AND item_id = $2 AND company_id = $3 LIMIT 1',
            [roDbId, itemDbId, companyId]
          );
          if (roPriceRes.rows.length > 0) sellPrice = parseFloat(roPriceRes.rows[0].unit_price) || 0;
        }
        if (sellPrice <= 0 && poDbId) {
          const poPriceRes = await client.query(
            'SELECT unit_price FROM purchase_order_items WHERE po_id = $1 AND item_id = $2 AND company_id = $3 LIMIT 1',
            [poDbId, itemDbId, companyId]
          );
          if (poPriceRes.rows.length > 0) sellPrice = parseFloat(poPriceRes.rows[0].unit_price) || 0;
        }

        // If no stock allocations were chosen, check trace for this item
        if (collectedHistories.length === 0) {
          const fallbackTrace = await client.query(
            'SELECT history FROM trace WHERE item_code = $1 AND company_id = $2 ORDER BY id DESC LIMIT 1',
            [itemDbId, companyId]
          );
          if (fallbackTrace.rows.length > 0 && Array.isArray(fallbackTrace.rows[0].history) && fallbackTrace.rows[0].history.length > 0) {
            collectedHistories.push(fallbackTrace.rows[0].history);
          }
        }

        const sellStep = {
          trace: 'Sell Delivery',
          type: 'SELL',
          action: 'Delivery Dispatch',
          delivery_note_no: delivery_note_no,
          trade_id: trade_code,
          price: sellPrice,
          sell_price: sellPrice,
          cost_price: costPrice,
          quantity: parseFloat(item.quantity) || 0,
          date: delivery_date || new Date().toISOString().split('T')[0]
        };

        let finalHistoryArray = [];
        if (collectedHistories.length === 1) {
          finalHistoryArray = [...collectedHistories[0], sellStep];
        } else if (collectedHistories.length > 1) {
          finalHistoryArray = [
            {
              trace: 'Stock Allocation',
              type: 'MERGED_STOCK',
              action: 'Multiple Stock Batches',
              sources: collectedHistories,
              date: delivery_date || new Date().toISOString().split('T')[0]
            },
            sellStep
          ];
        } else {
          finalHistoryArray = [sellStep];
        }

        // Insert into history table
        const histRes = await client.query(
          `INSERT INTO history (item_id, item_code, delivery_note_id, price, history, company_id)
           VALUES ($1, $2, $3, $4, $5::jsonb, $6) RETURNING id`,
          [itemDbId, item.item_code, dnDbId, sellPrice, JSON.stringify(finalHistoryArray), companyId]
        );
        if (histRes.rows.length > 0) {
          historyId = histRes.rows[0].id;
        }

        // Update item margin in items table
        await updateItemMarginOnDelivery(client, itemDbId, sellPrice, costPrice, companyId);
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
          let stepObj = {
            buyprice:    buyUnitPrice,
            trace:       'buy',
            trade_id:    trade_code,
            delivery_no: delivery_note_no
          };
          let initialHistory = [stepObj];

          if (ppoDbId) {
             let ppoItemProcessName = null;

             if (ppoJobIds && ppoJobIds.length > 0) {
               const jobFetchRes = await client.query(`
                 SELECT j.process_name 
                 FROM target_item ti
                 JOIN job j ON ti.job_id = j.id
                 WHERE ti.job_id = ANY($1::int[]) 
                   AND ti.company_id = $2 
                   AND EXISTS (
                     SELECT 1 FROM jsonb_array_elements(ti.items) AS elem 
                     WHERE (elem->>'item_code') = $3 
                        OR (elem->>'item_code') = $4::text
                        OR (elem->>'itemcode') = $3
                        OR (elem->>'item_code_id') = $4::text
                   )
                 LIMIT 1
               `, [ppoJobIds, companyId, item.item_code, itemDbId]);
               if (jobFetchRes.rows.length > 0 && jobFetchRes.rows[0].process_name) {
                 ppoItemProcessName = jobFetchRes.rows[0].process_name;
               }
             }

             if (!ppoItemProcessName) {
               const targetItemsRes = await client.query(
                 'SELECT process_name FROM process_po_target_item WHERE process_po_id = $1 AND item_code = $2 AND company_id = $3',
                 [ppoDbId, itemDbId, companyId]
               );
               if (targetItemsRes.rows.length > 0 && targetItemsRes.rows[0].process_name) {
                 ppoItemProcessName = targetItemsRes.rows[0].process_name;
               }
             }

             const sourceItemsRes = await client.query(
               'SELECT id, source_trace_id_array, process_name FROM process_po_item WHERE process_po_id = $1 AND target_item_id = $2 AND company_id = $3',
               [ppoDbId, itemDbId, companyId]
             );
             
             if (sourceItemsRes.rows.length > 0) {
                if (!ppoItemProcessName) ppoItemProcessName = sourceItemsRes.rows[0].process_name;
             }
             
             stepObj = {
               'trade id': trade_code,
               'process price': buyUnitPrice,
               'delivery note id': dnDbId,
               'trace': ppoItemProcessName ? ppoItemProcessName : (ppoMessage ? ppoMessage : `Process ${ppoNo || ''}`.trim())
             };
             initialHistory = [stepObj];

             if (sourceItemsRes.rows.length > 0) {
                const srcArray = sourceItemsRes.rows[0].source_trace_id_array || [];
                const srcTraceIds = srcArray.map(s => s.trace_id || s.traceid).filter(Boolean);
                
                if (srcTraceIds.length > 0) {
                   const tracesRes = await client.query(
                     'SELECT history FROM trace WHERE id = ANY($1::int[]) AND company_id = $2',
                     [srcTraceIds, companyId]
                   );
                   
                   let mergedHistory = [];
                   for (const r of tracesRes.rows) {
                      if (Array.isArray(r.history)) {
                         mergedHistory.push(...r.history);
                      }
                   }
                   
                   const uniqueHist = [];
                   const seen = new Set();
                   for (const h of mergedHistory) {
                      const str = JSON.stringify(h);
                      if (!seen.has(str)) {
                         seen.add(str);
                         uniqueHist.push(h);
                      }
                   }
                   initialHistory = [...uniqueHist, stepObj];
                }
             }
          }

          if (proDbId) {
             let proItemProcessName = null;
             let proNo = null;

             const proFetchRes = await client.query(
               'SELECT ro_no, message FROM process_ro WHERE id = $1 AND company_id = $2 LIMIT 1',
               [proDbId, companyId]
             );
             if (proFetchRes.rows.length > 0) {
               proNo = proFetchRes.rows[0].ro_no;
             }

             const targetItemsRes = await client.query(
               'SELECT process_name FROM process_ro_target_item WHERE process_ro_id = $1 AND (item_id = $2 OR item_code = $3) AND company_id = $4 LIMIT 1',
               [proDbId, itemDbId, item.item_code, companyId]
             );
             if (targetItemsRes.rows.length > 0 && targetItemsRes.rows[0].process_name) {
               proItemProcessName = targetItemsRes.rows[0].process_name;
             }

             stepObj = {
               type: 'PROCESS_RO',
               action: 'Process RO Delivery',
               'trade id': trade_code,
               'process price': buyUnitPrice,
               'delivery note id': dnDbId,
               ro_no: proNo,
               trace: item.process_name ? item.process_name : (proItemProcessName ? proItemProcessName : `Process RO ${proNo || ''}`.trim()),
               date: delivery_date || new Date().toISOString().split('T')[0]
             };
             initialHistory = [stepObj];

             // Fetch source items and their trace histories for this Process RO
             const sourceItemsRes = await client.query(
               'SELECT trace_item_id, history, item_code, qty FROM process_ro_source_item WHERE process_ro_id = $1 AND company_id = $2',
               [proDbId, companyId]
             );

             let sourceHistories = [];
             for (const src of sourceItemsRes.rows) {
               let hArray = [];
               if (Array.isArray(src.history) && src.history.length > 0) {
                 hArray = src.history;
               } else if (typeof src.history === 'string' && src.history.trim()) {
                 try { hArray = JSON.parse(src.history); } catch (e) { hArray = []; }
               } else if (src.trace_item_id) {
                 const fallbackTrace = await client.query(
                   'SELECT history FROM trace WHERE id = $1 AND company_id = $2',
                   [src.trace_item_id, companyId]
                 );
                 if (fallbackTrace.rows.length > 0) {
                   const trRow = fallbackTrace.rows[0];
                   if (Array.isArray(trRow.history)) hArray = trRow.history;
                   else if (typeof trRow.history === 'string') {
                     try { hArray = JSON.parse(trRow.history); } catch (e) { hArray = []; }
                   }
                 }
               }
               if (hArray.length > 0) {
                 sourceHistories.push(hArray);
               }
             }

             if (sourceHistories.length > 0) {
               stepObj.sources = sourceHistories;
             }
             initialHistory = [stepObj];
          }

          const trIns = await client.query(
            `INSERT INTO trace (item_code, qty, cost_price, inventory_id, status, history, company_id) 
             VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7) RETURNING id`,
            [itemDbId, invQty, buyUnitPrice, targetInvId, targetStatus, JSON.stringify(initialHistory), companyId]
          );
          traceIdForNextActivity = trIns.rows[0].id;
        }
      }

      const next_activity = {
        inventory: item.inv_qty > 0 ? { quantity: parseFloat(item.inv_qty), trace_id: traceIdForNextActivity } : null
      };

      const targetTraceRef = ppoDbId ? (traceIdForNextActivity || null) : null;

      await client.query(
        `INSERT INTO delivery_note_items (delivery_note_id, item_id, quantity, rate_per_piece, shipping_address, delivery_date, company_id, next_activity, process_target_trace_item_id, history_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          dnDbId,
          itemDbId,
          parseFloat(item.quantity) || 0,
          parseFloat(item.rate_per_piece) || 0,
          item.shipping_address || null,
          item.delivery_date || null,
          companyId,
          JSON.stringify(next_activity),
          targetTraceRef,
          historyId
        ]
      );

      // Link trace into process_po_item target_trace_id_array if applicable so PO Panel sees delivered items
      if (ppoDbId && traceIdForNextActivity) {
         const poiRes = await client.query(
           'SELECT id, target_trace_id_array FROM process_po_item WHERE process_po_id = $1 AND target_item_id = $2 AND company_id = $3',
           [ppoDbId, itemDbId, companyId]
         );
         if (poiRes.rows.length > 0) {
           const poiRow = poiRes.rows[0];
           const currentArray = Array.isArray(poiRow.target_trace_id_array) ? poiRow.target_trace_id_array : [];
           const existing = currentArray.find(x => parseInt(x.trace_id || x.traceid) === parseInt(traceIdForNextActivity));
           if (existing) {
              // Wait, since PUT recalculates quantities, we shouldn't keep adding invQty over and over.
              // In PUT, we probably just want to ensure it is in the array.
              existing.qty = Math.max(parseFloat(existing.qty) || 0, parseFloat(item.inv_qty || 0));
              existing.Qty = existing.qty; // ensure Qty works for PoPanel backward compat
           } else {
              currentArray.push({
                 trace_id: traceIdForNextActivity,
                 qty: parseFloat(item.inv_qty || 0),
                 Qty: parseFloat(item.inv_qty || 0),
                 status: 'In Inventory'
              });
           }
           await client.query(
             'UPDATE process_po_item SET target_trace_id_array = $1::jsonb WHERE id = $2 AND company_id = $3',
             [JSON.stringify(currentArray), poiRow.id, companyId]
           );
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
          (SELECT SUM(ppi.target_qty * ppi.price) FROM process_po pp JOIN process_po_item ppi ON pp.id = ppi.process_po_id WHERE pp.trade_id = $1 AND pp.company_id = $2),
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
    "UPDATE trades SET status = $1, delivery_percentage = $2 WHERE id = $3 AND company_id = $4",
    [statusName, pct, trade_id, company_id]
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
