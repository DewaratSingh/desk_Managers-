const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// GET all manufacturing jobs with their item details
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
         m.id, 
         m.process_name, 
         m.date_of_start, 
         m.date_of_end, 
         m.message, 
         m.created_at,
         COALESCE(
           json_agg(
             json_build_object(
               'id', mi.id,
               'source_item_id', mi.source_item_id,
               'source_item_code', src.item_code,
               'source_item_description', src.description,
               'target_item_id', mi.target_item_id,
               'target_item_code', tgt.item_code,
               'target_item_description', tgt.description,
               'source_trace_id_array', mi.source_trace_id_array,
               'price', mi.price,
               'source_qty', mi.source_qty,
               'target_qty', mi.target_qty,
               'target_trace_id_array', mi.target_trace_id_array
             )
           ) FILTER (WHERE mi.id IS NOT NULL), '[]'::json
         ) AS items
       FROM manufacture m
       LEFT JOIN manufacture_item mi ON mi.manufacture_id = m.id AND mi.company_id = m.company_id
       LEFT JOIN items src ON mi.source_item_id = src.id
       LEFT JOIN items tgt ON mi.target_item_id = tgt.id
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
    console.error('Error fetching trace items:', err.message);
    res.status(500).json({ error: 'Failed to fetch trace items' });
  }
});

// POST Create a new Manufacturing Job and its items
router.post('/', async (req, res) => {
  const { process_name, date_of_start, date_of_end, message, items } = req.body || {};

  if (!process_name) {
    return res.status(400).json({ error: 'process_name is required' });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'At least one manufacture item row is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const companyId = req.user.company_id;

    // 1. Insert into manufacture table
    const mfgRes = await client.query(
      `INSERT INTO manufacture (process_name, date_of_start, date_of_end, message, company_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at`,
      [
        process_name.trim(),
        date_of_start || null,
        date_of_end || null,
        message || null,
        companyId
      ]
    );
    const mfgId = mfgRes.rows[0].id;

    // 2. Process each manufacture item row
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

      const targetTraceIdArray = [];

      if (cleanSourceTraceArray.length > 0) {
        const totalSourceQty = cleanSourceTraceArray.reduce((sum, st) => sum + (parseFloat(st.Qty) || 0), 0);
        const sourceBaseQty = parsedSourceQty > 0 ? parsedSourceQty : totalSourceQty;
        const ratio = sourceBaseQty > 0 ? (parsedTargetQty / sourceBaseQty) : 1;
        const priceRatio = (sourceBaseQty > 0 && parsedTargetQty > 0) ? (sourceBaseQty / parsedTargetQty) : 1;

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

          const individualProcessHistory = [];
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
                const scaledSrcProc = srcProc.map(p => {
                  const itemCopy = { ...p };
                  if (itemCopy.unit_price !== undefined && itemCopy.unit_price !== null) {
                    itemCopy.unit_price = (parseFloat(itemCopy.unit_price) || 0) * priceRatio;
                  }
                  if (itemCopy.price !== undefined && itemCopy.price !== null) {
                    itemCopy.price = (parseFloat(itemCopy.price) || 0) * priceRatio;
                  }
                  return itemCopy;
                });
                individualProcessHistory.push(...scaledSrcProc);
              }
            }
          }

          individualProcessHistory.push({
            type: 'MANUFACTURE',
            process_name: process_name,
            manufacture_id: mfgId,
            unit_price: parsedPrice,
            source_traces: [st]
          });

          const targetQtyForSt = consumeQty * ratio;

          const newTraceRes = await client.query(
            `INSERT INTO trace_item (item_code, process, message, quantity, price, status, company_id)
             VALUES ($1, $2::jsonb, $3, $4, $5, 'under Manufacture', $6) RETURNING id`,
            [
              targetDbId,
              JSON.stringify(individualProcessHistory),
              `Manufactured via Process: ${process_name}`,
              targetQtyForSt,
              parsedPrice,
              companyId
            ]
          );
          const newTraceId = newTraceRes.rows[0].id;

          await client.query(
            `INSERT INTO inventory (item_code, quantity, price, location, message, company_id, trace_item_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              targetDbId,
              targetQtyForSt,
              parsedPrice,
              'Manufacturing Store',
              `Manufactured Job #${mfgId} (${process_name})`,
              companyId,
              newTraceId
            ]
          );

          targetTraceIdArray.push({
            traceid: newTraceId,
            source_trace_id: traceId,
            Qty: targetQtyForSt
          });
        }
      } else {
        const newTraceRes = await client.query(
          `INSERT INTO trace_item (item_code, process, message, quantity, price, status, company_id)
           VALUES ($1, $2::jsonb, $3, $4, $5, 'under Manufacture', $6) RETURNING id`,
          [
            targetDbId,
            JSON.stringify([{
              type: 'MANUFACTURE',
              process_name: process_name,
              manufacture_id: mfgId,
              unit_price: parsedPrice
            }]),
            `Manufactured via Process: ${process_name}`,
            parsedTargetQty,
            parsedPrice,
            companyId
          ]
        );
        const newTraceId = newTraceRes.rows[0].id;

        await client.query(
          `INSERT INTO inventory (item_code, quantity, price, location, message, company_id, trace_item_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            targetDbId,
            parsedTargetQty,
            parsedPrice,
            'Manufacturing Store',
            `Manufactured Job #${mfgId} (${process_name})`,
            companyId,
            newTraceId
          ]
        );

        targetTraceIdArray.push({
          traceid: newTraceId,
          Qty: parsedTargetQty
        });
      }

      // Insert row into manufacture_item
      await client.query(
        `INSERT INTO manufacture_item (
           manufacture_id, source_item_id, target_item_id,
           source_trace_id_array, price, source_qty, target_qty,
           target_trace_id_array, company_id
         ) VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8::jsonb, $9)`,
        [
          mfgId,
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
router.put('/:id/complete-production', async (req, res) => {
  const { id } = req.params;
  const { manufacture_item_id, completed_qty } = req.body || {};

  const inputMfgQty = parseFloat(completed_qty);
  if (isNaN(inputMfgQty) || inputMfgQty <= 0) {
    return res.status(400).json({ error: 'completed_qty must be a valid positive number' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const companyId = req.user.company_id;

    // 1. Fetch manufacture_item record
    let miRes;
    if (manufacture_item_id) {
      miRes = await client.query(
        'SELECT * FROM manufacture_item WHERE id = $1 AND manufacture_id = $2 AND company_id = $3',
        [manufacture_item_id, id, companyId]
      );
    } else {
      miRes = await client.query(
        'SELECT * FROM manufacture_item WHERE manufacture_id = $1 AND company_id = $2 ORDER BY id ASC LIMIT 1',
        [id, companyId]
      );
    }

    if (miRes.rows.length === 0) {
      throw new Error('Manufacture item record not found for this job');
    }

    const miRow = miRes.rows[0];
    let currentTargetQty = parseFloat(miRow.target_qty) || 0;
    const rawTargetTraceArray = Array.isArray(miRow.target_trace_id_array) ? miRow.target_trace_id_array : [];

    if (rawTargetTraceArray.length === 0) {
      throw new Error('No target trace item found in target_trace_id_array for this manufacture item');
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
            traceRow.message || 'Manufactured Item - Production Completed',
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
            'Manufacturing Store',
            `Manufactured Stock Completed - Job #${id}`,
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

    // Update target_qty and target_trace_id_array on manufacture_item
    currentTargetQty = Math.max(0, currentTargetQty - inputMfgQty);
    await client.query(
      'UPDATE manufacture_item SET target_qty = $1, target_trace_id_array = $2::jsonb WHERE id = $3 AND company_id = $4',
      [currentTargetQty, JSON.stringify(updatedTargetTraceArray), miRow.id, companyId]
    );

    await client.query('COMMIT');
    res.json({ message: 'Completed production processed successfully', id });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error processing completed production:', err.message);
    res.status(500).json({ error: err.message || 'Failed to process completed production' });
  } finally {
    client.release();
  }
});

module.exports = router;
