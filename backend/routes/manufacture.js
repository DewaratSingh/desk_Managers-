const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// GET all manufacturing jobs with multiple source_items & target_items + legacy support
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
         m.id, 
         m.process_name, 
         m.date_of_start, 
         m.date_of_end, 
         m.message, 
         COALESCE(m.status, 'in_progress') AS status,
         m.created_at,
         COALESCE(
           (
             SELECT json_agg(
               json_build_object(
                 'id', si.id,
                 'item_code_id', si.item_code,
                 'item_code', src.item_code,
                 'description', src.description,
                 'trace_item_id', si.trace_item_id,
                 'qty', si.qty
               )
             )
             FROM source_item si
             LEFT JOIN items src ON si.item_code = src.id
             WHERE si.manufacture_id = m.id AND si.company_id = m.company_id
           ), '[]'::json
         ) AS source_items,
         COALESCE(
           (
             SELECT json_agg(
               json_build_object(
                 'id', ti.id,
                 'item_code_id', ti.item_code,
                 'item_code', tgt.item_code,
                 'description', tgt.description,
                 'qty', ti.qty,
                 'delivered_qty', COALESCE(ti.delivered_qty, 0),
                 'price', ti.price
               )
             )
             FROM target_item ti
             LEFT JOIN items tgt ON ti.item_code = tgt.id
             WHERE ti.manufacture_id = m.id AND ti.company_id = m.company_id
           ), '[]'::json
         ) AS target_items,
         COALESCE(
           json_agg(
             json_build_object(
               'id', mi.id,
               'source_item_id', mi.source_item_id,
               'source_item_code', lsrc.item_code,
               'source_item_description', lsrc.description,
               'target_item_id', mi.target_item_id,
               'target_item_code', ltgt.item_code,
               'target_item_description', ltgt.description,
               'source_trace_id_array', mi.source_trace_id_array,
               'price', mi.price,
               'source_qty', mi.source_qty,
               'target_qty', mi.target_qty,
               'target_trace_id_array', mi.target_trace_id_array
             )
           ) FILTER (WHERE mi.id IS NOT NULL), '[]'::json
         ) AS legacy_items
       FROM manufacture m
       LEFT JOIN manufacture_item mi ON mi.manufacture_id = m.id AND mi.company_id = m.company_id
       LEFT JOIN items lsrc ON mi.source_item_id = lsrc.id
       LEFT JOIN items ltgt ON mi.target_item_id = ltgt.id
       WHERE m.company_id = $1
       GROUP BY m.id
       ORDER BY m.created_at DESC`,
      [req.user.company_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching manufacture list:', err.message);
    res.status(500).json({ error: 'Failed to fetch manufacture list' });
  }
});

// GET trace items from inventory for a specific source item code (or all items)
router.get('/trace-items', async (req, res) => {
  const { item_code } = req.query || {};

  try {
    let queryStr = `SELECT 
         inv.id AS inventory_id,
         inv.trace_item_id,
         COALESCE(ti.id, inv.trace_item_id) AS trace_id,
         it.item_code,
         it.description,
         inv.quantity AS available_qty,
         inv.price,
         inv.location,
         inv.rack,
         inv.shelf_number,
         COALESCE(ti.status, 'In Inventory') AS status
       FROM inventory inv
       JOIN items it ON inv.item_code = it.id
       LEFT JOIN trace_item ti ON inv.trace_item_id = ti.id
       WHERE inv.company_id = $1 
         AND inv.quantity > 0 
         AND LOWER(COALESCE(ti.status, 'in inventory')) = 'in inventory'`;

    const queryParams = [req.user.company_id];

    if (item_code && item_code.trim()) {
      queryStr += ` AND it.item_code = $2`;
      queryParams.push(item_code.trim());
    }

    queryStr += ` ORDER BY inv.created_at ASC`;

    const result = await pool.query(queryStr, queryParams);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching trace items:', err.message);
    res.status(500).json({ error: 'Failed to fetch trace items' });
  }
});

// POST Create a new Manufacturing Job supporting multiple source items & target items
router.post('/', async (req, res) => {
  const { process_name, date_of_start, date_of_end, message, source_items, target_items, source_item, target_item, items } = req.body || {};

  if (!process_name || !process_name.trim()) {
    return res.status(400).json({ error: 'Process Name is required' });
  }

  // Normalize source items array
  let cleanSourceItems = [];
  if (Array.isArray(source_items) && source_items.length > 0) {
    cleanSourceItems = source_items;
  } else if (source_item && source_item.item_code) {
    cleanSourceItems = [source_item];
  } else if (Array.isArray(items) && items.length > 0) {
    cleanSourceItems = items.map(it => ({
      item_code: it.source_item_code,
      qty: it.source_qty,
      trace_item_id: Array.isArray(it.source_trace_id_array) && it.source_trace_id_array.length > 0
        ? it.source_trace_id_array[0].trace_id
        : null
    }));
  }

  // Normalize target items array
  let cleanTargetItems = [];
  if (Array.isArray(target_items) && target_items.length > 0) {
    cleanTargetItems = target_items;
  } else if (target_item && target_item.item_code) {
    cleanTargetItems = [target_item];
  } else if (Array.isArray(items) && items.length > 0) {
    cleanTargetItems = items.map(it => ({
      item_code: it.target_item_code,
      qty: it.target_qty,
      price: it.price
    }));
  }

  if (cleanSourceItems.length === 0) {
    return res.status(400).json({ error: 'At least one Source Item is required' });
  }
  if (cleanTargetItems.length === 0) {
    return res.status(400).json({ error: 'At least one Target Item is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const companyId = req.user.company_id;

    // 1. Insert into manufacture table
    const mfgRes = await client.query(
      `INSERT INTO manufacture (process_name, date_of_start, date_of_end, message, status, company_id)
       VALUES ($1, $2, $3, $4, 'in_progress', $5) RETURNING id, created_at`,
      [
        process_name.trim(),
        date_of_start || null,
        date_of_end || null,
        message || null,
        companyId
      ]
    );
    const mfgId = mfgRes.rows[0].id;

    // 2. Process each source item
    for (const src of cleanSourceItems) {
      if (!src.item_code) continue;

      const srcCodeRes = await client.query(
        'SELECT id FROM items WHERE item_code = $1 AND company_id = $2',
        [src.item_code.trim(), companyId]
      );
      if (srcCodeRes.rows.length === 0) {
        throw new Error(`Source Item Code '${src.item_code}' not found in Catalog`);
      }
      const sourceDbId = srcCodeRes.rows[0].id;
      const parsedSourceQty = parseFloat(src.qty) || 0;
      const traceItemId = src.trace_item_id || src.trace_id ? parseInt(src.trace_item_id || src.trace_id) : null;

      // Deduct consumed qty from inventory/trace item
      if (parsedSourceQty > 0) {
        if (traceItemId) {
          await client.query(
            'UPDATE inventory SET quantity = GREATEST(0, quantity - $1), updated_at = CURRENT_TIMESTAMP WHERE trace_item_id = $2 AND company_id = $3',
            [parsedSourceQty, traceItemId, companyId]
          );
          await client.query(
            'UPDATE trace_item SET quantity = GREATEST(0, quantity - $1) WHERE id = $2 AND company_id = $3',
            [parsedSourceQty, traceItemId, companyId]
          );
        } else {
          await client.query(
            'UPDATE inventory SET quantity = GREATEST(0, quantity - $1), updated_at = CURRENT_TIMESTAMP WHERE item_code = $2 AND company_id = $3',
            [parsedSourceQty, sourceDbId, companyId]
          );
        }
      }

      // Insert into source_item table
      await client.query(
        `INSERT INTO source_item (manufacture_id, item_code, trace_item_id, qty, company_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [mfgId, sourceDbId, traceItemId, parsedSourceQty, companyId]
      );
    }

    // 3. Process each target item
    for (const tgt of cleanTargetItems) {
      if (!tgt.item_code) continue;

      const tgtCodeRes = await client.query(
        'SELECT id FROM items WHERE item_code = $1 AND company_id = $2',
        [tgt.item_code.trim(), companyId]
      );
      if (tgtCodeRes.rows.length === 0) {
        throw new Error(`Target Item Code '${tgt.item_code}' not found in Catalog`);
      }
      const targetDbId = tgtCodeRes.rows[0].id;
      const parsedTargetQty = parseFloat(tgt.qty) || 0;
      const parsedTargetPrice = parseFloat(tgt.price) || 0.00;

      // Create Target Trace Item with status 'under Manufacture'
      const processHistory = [{
        type: 'MANUFACTURE',
        process_name: process_name,
        manufacture_id: mfgId,
        target_item_code: tgt.item_code,
        unit_price: parsedTargetPrice
      }];

      const newTraceRes = await client.query(
        `INSERT INTO trace_item (item_code, process, message, quantity, price, status, company_id)
         VALUES ($1, $2::jsonb, $3, $4, $5, 'under Manufacture', $6) RETURNING id`,
        [
          targetDbId,
          JSON.stringify(processHistory),
          `Manufactured via Process: ${process_name}`,
          parsedTargetQty,
          parsedTargetPrice,
          companyId
        ]
      );
      const newTargetTraceId = newTraceRes.rows[0].id;

      // Insert into target_item table
      await client.query(
        `INSERT INTO target_item (manufacture_id, item_code, qty, price, company_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [mfgId, targetDbId, parsedTargetQty, parsedTargetPrice, companyId]
      );

      // Insert fallback row into manufacture_item for legacy compatibility
      await client.query(
        `INSERT INTO manufacture_item (
           manufacture_id, target_item_id,
           price, target_qty, target_trace_id_array, company_id
         ) VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
        [
          mfgId,
          targetDbId,
          parsedTargetPrice,
          parsedTargetQty,
          JSON.stringify([{ traceid: newTargetTraceId, Qty: parsedTargetQty }]),
          companyId
        ]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ message: 'Manufacture job created successfully', id: mfgId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating manufacture job:', err.message);
    res.status(500).json({ error: err.message || 'Failed to create manufacture job' });
  } finally {
    client.release();
  }
});

// PUT /api/manufacture/:id/complete-production
// Transactionally commits production completion for target items with configured warehouse positions
router.put('/:id/complete-production', async (req, res) => {
  const { id } = req.params;
  const { target_items, completed_qty, location, rack, shelf_number, target_status, remarks } = req.body || {};

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const companyId = req.user.company_id;

    // Normalize target items list to complete
    let itemsToComplete = [];
    if (Array.isArray(target_items) && target_items.length > 0) {
      itemsToComplete = target_items;
    } else {
      // Fallback single completion
      const inputMfgQty = parseFloat(completed_qty) || 0;
      if (inputMfgQty <= 0) {
        throw new Error('completed_qty must be a valid positive number');
      }

      // Fetch target item from DB
      const dbTargetRes = await client.query(
        `SELECT ti.*, it.item_code AS item_code_str
         FROM target_item ti
         JOIN items it ON ti.item_code = it.id
         WHERE ti.manufacture_id = $1 AND ti.company_id = $2 LIMIT 1`,
        [id, companyId]
      );

      if (dbTargetRes.rows.length > 0) {
        itemsToComplete = [{
          item_code: dbTargetRes.rows[0].item_code_str,
          item_db_id: dbTargetRes.rows[0].item_code,
          completed_qty: inputMfgQty,
          location: location || 'Warehouse A',
          rack: rack || null,
          shelf_number: shelf_number || null,
          target_status: target_status || 'In Inventory',
          price: parseFloat(dbTargetRes.rows[0].price) || 0
        }];
      }
    }

    if (itemsToComplete.length === 0) {
      throw new Error('No target items specified to complete production');
    }

    for (const tgtItem of itemsToComplete) {
      const { item_code, completed_qty: itemQtyVal, location: locVal, rack: rackVal, shelf_number: shelfVal, target_status: statusVal, price: priceVal } = tgtItem;
      const completionQty = parseFloat(itemQtyVal) || 0;

      if (completionQty <= 0) continue;

      // Resolve item DB ID
      let targetDbId = tgtItem.item_db_id;
      if (!targetDbId && item_code) {
        const itemRes = await client.query('SELECT id FROM items WHERE item_code = $1 AND company_id = $2', [item_code, companyId]);
        if (itemRes.rows.length > 0) {
          targetDbId = itemRes.rows[0].id;
        }
      }

      if (!targetDbId) continue;

      const finalStatus = statusVal || 'In Inventory';
      const warehouseLocation = locVal || 'Warehouse A';
      const targetPrice = parseFloat(priceVal) || 0.00;

      // Find trace item currently 'under Manufacture'
      const traceRes = await client.query(
        `SELECT * FROM trace_item
         WHERE item_code = $1 AND company_id = $2 AND LOWER(status) = 'under manufacture'
         ORDER BY id DESC LIMIT 1`,
        [targetDbId, companyId]
      );

      let targetTraceId = null;
      if (traceRes.rows.length > 0) {
        targetTraceId = traceRes.rows[0].id;
        await client.query(
          'UPDATE trace_item SET status = $1, quantity = $2 WHERE id = $3 AND company_id = $4',
          [finalStatus, completionQty, targetTraceId, companyId]
        );
      } else {
        const newTrace = await client.query(
          `INSERT INTO trace_item (item_code, process, message, quantity, price, status, company_id)
           VALUES ($1, $2::jsonb, $3, $4, $5, $6, $7) RETURNING id`,
          [
            targetDbId,
            JSON.stringify([{ type: 'MANUFACTURE', manufacture_id: id }]),
            remarks || `Manufactured Job #${id} Completed`,
            completionQty,
            targetPrice,
            finalStatus,
            companyId
          ]
        );
        targetTraceId = newTrace.rows[0].id;
      }

      // Add to inventory with location position
      await client.query(
        `INSERT INTO inventory (item_code, quantity, price, location, rack, shelf_number, message, company_id, trace_item_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          targetDbId,
          completionQty,
          targetPrice,
          warehouseLocation,
          rackVal || null,
          shelfVal || null,
          remarks || `Manufactured Stock Completed - Job #${id}`,
          companyId,
          targetTraceId
        ]
      );

      // Increment delivered_qty on target_item table
      await client.query(
        `UPDATE target_item
         SET delivered_qty = COALESCE(delivered_qty, 0) + $1
         WHERE manufacture_id = $2 AND item_code = $3 AND company_id = $4`,
        [completionQty, id, targetDbId, companyId]
      );
    }

    // Check if all target items for this job are completed
    const statusCheckRes = await client.query(
      `SELECT SUM(GREATEST(0, qty - COALESCE(delivered_qty, 0))) AS total_remaining
       FROM target_item
       WHERE manufacture_id = $1 AND company_id = $2`,
      [id, companyId]
    );

    const totalRemaining = parseFloat(statusCheckRes.rows[0]?.total_remaining) || 0;
    const newStatus = totalRemaining <= 0 ? 'completed' : 'in_progress';

    await client.query(
      `UPDATE manufacture
       SET status = $1::varchar, date_of_end = CASE WHEN $1::varchar = 'completed' THEN CURRENT_DATE ELSE date_of_end END
       WHERE id = $2 AND company_id = $3`,
      [newStatus, id, companyId]
    );

    await client.query('COMMIT');
    res.json({ message: 'Manufacturing Job Production Completed successfully', id });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error completing production:', err.message);
    res.status(500).json({ error: err.message || 'Failed to complete production' });
  } finally {
    client.release();
  }
});

module.exports = router;
