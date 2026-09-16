const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// GET all Process PO jobs with their item details
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
         ppo.id, 
         ppo.po_no, 
         ppo.date_of_start, 
         ppo.date_of_end, 
         ppo.received_q_id,
         ppo.message, 
         ppo.created_at,
         COALESCE(
           json_agg(
             json_build_object(
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
             )
           ) FILTER (WHERE poi.id IS NOT NULL), '[]'::json
         ) AS items
       FROM process_po ppo
       LEFT JOIN process_po_item poi ON poi.process_po_id = ppo.id AND poi.company_id = ppo.company_id
       LEFT JOIN items src ON poi.source_item_id = src.id
       LEFT JOIN items tgt ON poi.target_item_id = tgt.id
       WHERE ppo.company_id = $1
       GROUP BY ppo.id
       ORDER BY ppo.created_at DESC`,
      [req.user.company_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching process PO list:', err.message);
    res.status(500).json({ error: 'Failed to fetch process PO list' });
  }
});

// GET trace items from inventory for a specific source item code
router.get('/trace-items', async (req, res) => {
  const { item_code } = req.query || {};
  if (!item_code) {
    return res.status(400).json({ error: 'item_code is required' });
  }

  try {
    const result = await pool.query(
      `SELECT 
         inv.id AS inventory_id,
         inv.trace_item_id,
         COALESCE(ti.id, inv.trace_item_id) AS trace_id,
         it.item_code,
         it.description,
         inv.quantity AS available_qty,
         inv.price,
         inv.location,
         inv.rack,
         inv.shelf_number
       FROM inventory inv
       JOIN items it ON inv.item_code = it.id
       LEFT JOIN trace_item ti ON inv.trace_item_id = ti.id
       WHERE it.item_code = $1 AND inv.company_id = $2 AND inv.quantity > 0
       ORDER BY inv.created_at ASC`,
      [item_code.trim(), req.user.company_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching trace items for Process PO:', err.message);
    res.status(500).json({ error: 'Failed to fetch trace items' });
  }
});

// POST Create a new Process PO Job and its items
router.post('/', async (req, res) => {
  const { po_no, date_of_start, date_of_end, received_q_id, message, items } = req.body || {};

  if (!po_no) {
    return res.status(400).json({ error: 'po_no (Process PO Number/Name) is required' });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'At least one item row is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const companyId = req.user.company_id;

    // 1. Insert into process_po table
    const ppoRes = await client.query(
      `INSERT INTO process_po (po_no, date_of_start, date_of_end, received_q_id, message, company_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, created_at`,
      [
        po_no.trim(),
        date_of_start || null,
        date_of_end || null,
        received_q_id ? parseInt(received_q_id) : null,
        message || null,
        companyId
      ]
    );
    const ppoId = ppoRes.rows[0].id;

    // 2. Process each item row
    for (const item of items) {
      const {
        source_item_code,
        target_item_code,
        source_qty,
        target_qty,
        price,
        source_trace_id_array
      } = item;

      // Resolve source_item_id
      let sourceDbId = null;
      if (source_item_code) {
        const srcRes = await client.query(
          'SELECT id FROM items WHERE item_code = $1 AND company_id = $2',
          [source_item_code.trim(), companyId]
        );
        if (srcRes.rows.length > 0) {
          sourceDbId = srcRes.rows[0].id;
        }
      }

      // Resolve target_item_id
      let targetDbId = null;
      if (target_item_code) {
        const tgtRes = await client.query(
          'SELECT id FROM items WHERE item_code = $1 AND company_id = $2',
          [target_item_code.trim(), companyId]
        );
        if (tgtRes.rows.length > 0) {
          targetDbId = tgtRes.rows[0].id;
        } else {
          throw new Error(`Target Item Code '${target_item_code}' not found in Items catalog`);
        }
      }

      const parsedSourceQty = parseFloat(source_qty) || 0;
      const parsedTargetQty = parseFloat(target_qty) || 0;
      const parsedPrice = parseFloat(price) || 0.00;
      const cleanSourceTraceArray = Array.isArray(source_trace_id_array) ? source_trace_id_array : [];

      // Deduct quantity from inventory & trace_item for selected source trace items
      for (const st of cleanSourceTraceArray) {
        const traceId = st.trace_id || st.traceid;
        const consumeQty = parseFloat(st.Qty) || 0;
        if (consumeQty > 0) {
          if (st.inventory_id) {
            await client.query(
              'UPDATE inventory SET quantity = GREATEST(0, quantity - $1), updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND company_id = $3',
              [consumeQty, st.inventory_id, companyId]
            );
          } else if (traceId) {
            await client.query(
              'UPDATE inventory SET quantity = GREATEST(0, quantity - $1), updated_at = CURRENT_TIMESTAMP WHERE trace_item_id = $2 AND company_id = $3',
              [consumeQty, traceId, companyId]
            );
          }
          if (traceId) {
            await client.query(
              'UPDATE trace_item SET quantity = GREATEST(0, quantity - $1) WHERE id = $2 AND company_id = $3',
              [consumeQty, traceId, companyId]
            );
          }
        }
      }

      // Accumulate previous process histories from selected source trace items
      const accumulatedProcessHistory = [];

      for (const st of cleanSourceTraceArray) {
        const traceId = st.trace_id || st.traceid;
        if (traceId) {
          const srcTraceRes = await client.query(
            'SELECT process FROM trace_item WHERE id = $1 AND company_id = $2',
            [traceId, companyId]
          );
          if (srcTraceRes.rows.length > 0 && srcTraceRes.rows[0].process) {
            let srcProc = srcTraceRes.rows[0].process;
            if (typeof srcProc === 'string') {
              try { srcProc = JSON.parse(srcProc); } catch (e) { srcProc = []; }
            }
            if (Array.isArray(srcProc)) {
              accumulatedProcessHistory.push(...srcProc);
            }
          }
        }
      }

      // Append new PROCESS_PO step
      accumulatedProcessHistory.push({
        type: 'PROCESS_PO',
        po_no: po_no,
        process_po_id: ppoId,
        unit_price: parsedPrice,
        source_traces: cleanSourceTraceArray
      });

      const newTraceRes = await client.query(
        `INSERT INTO trace_item (item_code, process, message, quantity, price, status, company_id)
         VALUES ($1, $2::jsonb, $3, $4, $5, 'under Process PO', $6) RETURNING id`,
        [
          targetDbId,
          JSON.stringify(accumulatedProcessHistory),
          `Process PO: ${po_no}`,
          parsedTargetQty,
          parsedPrice,
          companyId
        ]
      );
      const newTraceId = newTraceRes.rows[0].id;
      const targetTraceIdArray = [{ traceid: newTraceId }];

      // Insert new stock into inventory table
      await client.query(
        `INSERT INTO inventory (item_code, quantity, price, location, message, company_id, trace_item_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          targetDbId,
          parsedTargetQty,
          parsedPrice,
          'Process PO Store',
          `Process PO Job #${ppoId} (${po_no})`,
          companyId,
          newTraceId
        ]
      );

      // Insert row into process_po_item
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

    await client.query('COMMIT');
    res.status(201).json({ message: 'Process PO job created successfully', id: ppoId });
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

    // 1. Fetch process_po_item record
    let poiRes;
    if (process_po_item_id) {
      poiRes = await client.query(
        'SELECT * FROM process_po_item WHERE id = $1 AND process_po_id = $2 AND company_id = $3',
        [process_po_item_id, id, companyId]
      );
    } else {
      poiRes = await client.query(
        'SELECT * FROM process_po_item WHERE process_po_id = $1 AND company_id = $2 ORDER BY id ASC LIMIT 1',
        [id, companyId]
      );
    }

    if (poiRes.rows.length === 0) {
      throw new Error('Process PO item record not found for this job');
    }

    const poiRow = poiRes.rows[0];
    let currentTargetQty = parseFloat(poiRow.target_qty) || 0;
    const rawTargetTraceArray = Array.isArray(poiRow.target_trace_id_array) ? poiRow.target_trace_id_array : [];

    if (rawTargetTraceArray.length === 0) {
      throw new Error('No target trace item found in target_trace_id_array for this Process PO item');
    }

    // Build target_trace_item_array from database quantities
    const target_trace_item_array = [];
    for (const tObj of rawTargetTraceArray) {
      const tId = parseInt(tObj.traceid || tObj.trace_id);
      if (tId && !isNaN(tId)) {
        const tRes = await client.query(
          'SELECT * FROM trace_item WHERE id = $1 AND company_id = $2',
          [tId, companyId]
        );
        if (tRes.rows.length > 0) {
          target_trace_item_array.push({
            traceId: tId,
            Qty: parseFloat(tRes.rows[0].quantity) || 0,
            traceRow: tRes.rows[0],
            rawObj: tObj
          });
        }
      }
    }

    if (target_trace_item_array.length === 0) {
      throw new Error('No trace items found in database for the given target_trace_id_array');
    }

    let manufacturedQty = inputMfgQty;
    let i = 0;
    let updatedTargetTraceArray = [...rawTargetTraceArray];

    while (manufacturedQty >= 0 && i < target_trace_item_array.length) {
      const currentItem = target_trace_item_array[i];
      const prevMfgQty = manufacturedQty;

      manufacturedQty = manufacturedQty - currentItem.Qty;

      if (manufacturedQty >= 0) {
        // manufactured Qty is positive / zero remaining: update status to 'in inventory' via SQL
        await client.query(
          "UPDATE trace_item SET status = 'in inventory', quantity = 0 WHERE id = $1 AND company_id = $2",
          [currentItem.traceId, companyId]
        );

        // Remove fully converted trace ID from target_trace_id_array
        updatedTargetTraceArray = updatedTargetTraceArray.filter(
          x => parseInt(x.traceid || x.trace_id) !== currentItem.traceId
        );
      }

      if (manufacturedQty < 0) {
        // manufactured Qty is negative:
        // Create new trace id and add in inventory with Qty = prevMfgQty (portion manufactured)
        const producedQty = prevMfgQty;
        const traceRow = currentItem.traceRow;
        const processJson = typeof traceRow.process === 'string' 
          ? traceRow.process 
          : JSON.stringify(traceRow.process || []);

        const newTraceRes = await client.query(
          `INSERT INTO trace_item (item_code, process, message, quantity, price, status, company_id)
           VALUES ($1, $2::jsonb, $3, $4, $5, 'in inventory', $6) RETURNING id`,
          [
            traceRow.item_code,
            processJson,
            traceRow.message || 'Process PO Item - Completed',
            producedQty,
            traceRow.price,
            companyId
          ]
        );
        const newTraceId = newTraceRes.rows[0].id;

        // Insert new stock record into inventory table for newTraceId
        await client.query(
          `INSERT INTO inventory (item_code, quantity, price, location, message, company_id, trace_item_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            traceRow.item_code,
            producedQty,
            traceRow.price,
            'Process PO Store',
            `Process PO Stock Completed - Job #${id}`,
            companyId,
            newTraceId
          ]
        );

        // target_trace_item_array[i].traceid.Qty = manufactured Qty * -1
        const remainingTraceQty = manufacturedQty * -1;
        await client.query(
          'UPDATE trace_item SET quantity = $1 WHERE id = $2 AND company_id = $3',
          [remainingTraceQty, currentItem.traceId, companyId]
        );
        await client.query(
          'UPDATE inventory SET quantity = $1 WHERE trace_item_id = $2 AND company_id = $3',
          [remainingTraceQty, currentItem.traceId, companyId]
        );
      }

      i++;
    }

    // Update target_qty and target_trace_id_array on process_po_item
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
