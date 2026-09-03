const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// GET all manufacturing records
router.get('/', async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const result = await pool.query(`
      SELECT 
        m.id,
        m.trace_item_id,
        m.target_trace_item_id,
        m.source_item_id,
        m.target_item_id,
        m.quantity_used,
        m.expected_quantity,
        m.completed_quantity,
        m.completed,
        m.date_of_starting,
        m.date_of_ending,
        m.message,
        m.status,
        m.created_at,
        src.item_code AS source_item_code,
        src.description AS source_item_description,
        src.drawing_number AS source_drawing_number,
        tgt.item_code AS target_item_code,
        tgt.description AS target_item_description,
        tgt.drawing_number AS target_drawing_number,
        inv.location,
        inv.rack,
        inv.shelf_number
      FROM manufacture m
      LEFT JOIN items src ON m.source_item_id = src.id AND src.company_id = m.company_id
      LEFT JOIN items tgt ON m.target_item_id = tgt.id AND tgt.company_id = m.company_id
      LEFT JOIN inventory inv ON m.target_trace_item_id = inv.trace_item_id AND inv.company_id = m.company_id
      WHERE m.company_id = $1
      ORDER BY m.created_at DESC
    `, [companyId]);

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching manufacturing records:', err.message);
    res.status(500).json({ error: 'Failed to fetch manufacturing records' });
  }
});

// POST a new manufacturing job
router.post('/', async (req, res) => {
  const {
    source_item_code,
    target_item_code,
    quantity_used,
    expected_quantity,
    date_of_starting,
    date_of_ending,
    unit_price,
    message,
    source_trace_item_id,
    source_inventory_id
  } = req.body || {};

  if (!source_item_code || !target_item_code || !date_of_starting) {
    return res.status(400).json({ error: 'source_item_code, target_item_code, and date_of_starting are required' });
  }

  const qtyUsed = parseInt(quantity_used, 10);
  const expQty = parseInt(expected_quantity, 10);
  const mUnitPrice = parseFloat(unit_price) || 0.00;

  if (isNaN(qtyUsed) || qtyUsed <= 0) {
    return res.status(400).json({ error: 'quantity_used must be a positive number' });
  }
  if (isNaN(expQty) || expQty <= 0) {
    return res.status(400).json({ error: 'expected_quantity must be a positive number' });
  }

  const client = await pool.connect();
  try {
    const companyId = req.user.company_id;
    await client.query('BEGIN');

    // 1. Resolve source item DB ID
    const srcRes = await client.query('SELECT id FROM items WHERE item_code = $1 AND company_id = $2', [source_item_code, companyId]);
    if (srcRes.rows.length === 0) {
      throw new Error(`Source Item ${source_item_code} not found`);
    }
    const sourceDbId = srcRes.rows[0].id;

    // 2. Resolve target item DB ID
    const tgtRes = await client.query('SELECT id FROM items WHERE item_code = $1 AND company_id = $2', [target_item_code, companyId]);
    if (tgtRes.rows.length === 0) {
      throw new Error(`Target Item ${target_item_code} not found`);
    }
    const targetDbId = tgtRes.rows[0].id;

    // 3. Deduct quantity_used from source inventory if linked or by item_code
    if (source_inventory_id) {
      const invUpdate = await client.query(
        `UPDATE inventory 
         SET quantity = quantity - $1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2 AND company_id = $3 
         RETURNING quantity`,
        [qtyUsed, parseInt(source_inventory_id, 10), companyId]
      );
      if (invUpdate.rows.length > 0 && parseInt(invUpdate.rows[0].quantity, 10) <= 0) {
        await client.query('DELETE FROM inventory WHERE id = $1 AND company_id = $2', [parseInt(source_inventory_id, 10), companyId]);
      }
    } else {
      // Find matching source inventory record
      const findInv = await client.query(
        'SELECT id, quantity FROM inventory WHERE item_code = $1 AND company_id = $2 ORDER BY created_at ASC LIMIT 1',
        [sourceDbId, companyId]
      );
      if (findInv.rows.length > 0) {
        const invId = findInv.rows[0].id;
        const invUpdate = await client.query(
          'UPDATE inventory SET quantity = quantity - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND company_id = $3 RETURNING quantity',
          [qtyUsed, invId, companyId]
        );
        if (invUpdate.rows.length > 0 && parseInt(invUpdate.rows[0].quantity, 10) <= 0) {
          await client.query('DELETE FROM inventory WHERE id = $1 AND company_id = $2', [invId, companyId]);
        }
      }
    }

    // 4. Deduct quantity_used from source trace_item if linked or by item_code & fetch process history
    let srcTraceId = source_trace_item_id ? parseInt(source_trace_item_id, 10) : null;
    let existingProcess = [];
    if (srcTraceId) {
      const traceRes = await client.query(
        'UPDATE trace_item SET quantity = GREATEST(0, quantity - $1) WHERE id = $2 AND company_id = $3 RETURNING process',
        [qtyUsed, srcTraceId, companyId]
      );
      if (traceRes.rows.length > 0 && Array.isArray(traceRes.rows[0].process)) {
        existingProcess = traceRes.rows[0].process;
      }
    } else {
      const findTrace = await client.query(
        'SELECT id, process FROM trace_item WHERE item_code = $1 AND company_id = $2 ORDER BY created_at ASC LIMIT 1',
        [sourceDbId, companyId]
      );
      if (findTrace.rows.length > 0) {
        srcTraceId = findTrace.rows[0].id;
        if (Array.isArray(findTrace.rows[0].process)) existingProcess = findTrace.rows[0].process;
        await client.query(
          'UPDATE trace_item SET quantity = GREATEST(0, quantity - $1) WHERE id = $2 AND company_id = $3',
          [qtyUsed, srcTraceId, companyId]
        );
      }
    }

    // 5. Build process array with new MANUFACTURE step
    const tempMfgId = Math.floor(10000 + Math.random() * 90000);
    const mfgStep = { type: 'MANUFACTURE', id: tempMfgId, unit_price: mUnitPrice };
    const updatedProcess = Array.isArray(existingProcess) ? [...existingProcess, mfgStep] : [mfgStep];

    // Calculate total unit price from all process steps
    const totalPrice = updatedProcess.reduce((sum, item) => sum + (parseFloat(item.unit_price) || 0), 0);

    // 6. Create new target trace_item with status = 'manufacturing' and process JSONB
    const targetTraceRes = await client.query(`
      INSERT INTO trace_item (item_code, process, message, quantity, price, status, company_id)
      VALUES ($1, $2::jsonb, $3, $4, $5, 'manufacturing', $6)
      RETURNING id
    `, [
      targetDbId,
      JSON.stringify(updatedProcess),
      message || `Manufacturing from ${source_item_code}`,
      0,
      totalPrice,
      companyId
    ]);
    const targetTraceId = targetTraceRes.rows[0].id;

    // Update mfgStep id with real trace ID
    updatedProcess[updatedProcess.length - 1].id = targetTraceId;
    await client.query('UPDATE trace_item SET process = $1::jsonb WHERE id = $2', [JSON.stringify(updatedProcess), targetTraceId]);

    // 7. Create new target inventory entry with trace_item_id and total unit price
    await client.query(`
      INSERT INTO inventory (item_code, quantity, price, message, company_id, trace_item_id)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      targetDbId,
      0,
      totalPrice,
      message || `Manufacturing in progress (From: ${source_item_code})`,
      companyId,
      targetTraceId
    ]);

    // 8. Insert record into manufacture table
    const mRes = await client.query(`
      INSERT INTO manufacture (
        trace_item_id, target_trace_item_id, source_item_id, target_item_id,
        quantity_used, expected_quantity, date_of_starting, date_of_ending,
        message, status, company_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'manufacturing', $10)
      RETURNING *
    `, [
      srcTraceId,
      targetTraceId,
      sourceDbId,
      targetDbId,
      qtyUsed,
      expQty,
      date_of_starting,
      date_of_ending || null,
      message || null,
      companyId
    ]);

    await client.query('COMMIT');
    res.status(201).json(mRes.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating manufacturing job:', err.message);
    res.status(500).json({ error: err.message || 'Failed to create manufacturing job' });
  } finally {
    client.release();
  }
});

// UPDATE production progress for a manufacturing job
router.put('/:id/update-production', async (req, res) => {
  const { id } = req.params;
  const { manufactured_quantity, message, location, rack, shelf_number } = req.body || {};
  const mfgQty = parseInt(manufactured_quantity, 10);
  if (isNaN(mfgQty) || mfgQty <= 0) {
    return res.status(400).json({ error: 'manufactured_quantity must be a positive integer' });
  }

  const client = await pool.connect();
  try {
    const companyId = req.user.company_id;
    await client.query('BEGIN');

    // 1. Fetch current manufacture job
    const mfgRes = await client.query('SELECT * FROM manufacture WHERE id = $1 AND company_id = $2', [id, companyId]);
    if (mfgRes.rows.length === 0) {
      throw new Error('Manufacturing job not found');
    }
    const job = mfgRes.rows[0];
    const newCompleted = (parseInt(job.completed_quantity, 10) || 0) + mfgQty;
    const isFullyCompleted = newCompleted >= parseInt(job.expected_quantity, 10);
    const updatedStatus = isFullyCompleted ? 'completed' : job.status;
    const updatedMsg = message ? (job.message ? `${job.message} | Update: ${message}` : message) : job.message;

    // 2. Update manufacture job record
    const updatedMfg = await client.query(`
      UPDATE manufacture 
      SET completed_quantity = $1, status = $2, message = $3, completed = $4 
      WHERE id = $5 AND company_id = $6 
      RETURNING *
    `, [newCompleted, updatedStatus, updatedMsg, isFullyCompleted, id, companyId]);

    // 3. Update target trace_item quantity & status if fully completed
    if (job.target_trace_item_id) {
      const traceStatus = isFullyCompleted ? 'active' : 'manufacturing';
      await client.query(`
        UPDATE trace_item 
        SET quantity = $1, status = $2 
        WHERE id = $3 AND company_id = $4
      `, [newCompleted, traceStatus, job.target_trace_item_id, companyId]);

      // 4. Update target inventory entry location, rack, shelf, and quantity
      const invRes = await client.query('SELECT id FROM inventory WHERE trace_item_id = $1 AND company_id = $2', [job.target_trace_item_id, companyId]);
      if (invRes.rows.length > 0) {
        await client.query(`
          UPDATE inventory 
          SET quantity = $1,
              location = COALESCE($2, location),
              rack = COALESCE($3, rack),
              shelf_number = COALESCE($4, shelf_number),
              updated_at = CURRENT_TIMESTAMP 
          WHERE trace_item_id = $5 AND company_id = $6
        `, [newCompleted, location || null, rack || null, shelf_number || null, job.target_trace_item_id, companyId]);
      }
    }

    await client.query('COMMIT');
    res.json(updatedMfg.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating production:', err.message);
    res.status(500).json({ error: err.message || 'Failed to update production' });
  } finally {
    client.release();
  }
});

module.exports = router;
