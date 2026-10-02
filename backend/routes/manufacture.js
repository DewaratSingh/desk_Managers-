const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// ─────────────────────────────────────────────
//  JOB routes  /api/manufacture/jobs
// ─────────────────────────────────────────────

// GET all jobs
router.get('/jobs', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT j.*,
              COALESCE(
                (SELECT row_to_json(m) FROM manufacture m
                 WHERE m.job_id = j.id AND m.company_id = j.company_id LIMIT 1),
                NULL
              ) AS manufacture,
              COALESCE(
                (SELECT si.items FROM source_item si
                 WHERE si.job_id = j.id AND si.company_id = j.company_id LIMIT 1),
                '[]'::jsonb
              ) AS source_items,
              COALESCE(
                (SELECT ti.items FROM target_item ti
                 WHERE ti.job_id = j.id AND ti.company_id = j.company_id LIMIT 1),
                '[]'::jsonb
              ) AS target_items
       FROM job j
       WHERE j.company_id = $1
       ORDER BY j.created_at DESC`,
      [req.user.company_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('GET /jobs error:', err.message);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

// GET single job by id
router.get('/jobs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT j.*,
              (SELECT row_to_json(m) FROM manufacture m
               WHERE m.job_id = j.id AND m.company_id = j.company_id LIMIT 1) AS manufacture,
              COALESCE(
                (SELECT si.items FROM source_item si
                 WHERE si.job_id = j.id AND si.company_id = j.company_id LIMIT 1),
                '[]'::jsonb
              ) AS source_items,
              COALESCE(
                (SELECT ti.items FROM target_item ti
                 WHERE ti.job_id = j.id AND ti.company_id = j.company_id LIMIT 1),
                '[]'::jsonb
              ) AS target_items
       FROM job j
       WHERE j.id = $1 AND j.company_id = $2`,
      [id, req.user.company_id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Job not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('GET /jobs/:id error:', err.message);
    res.status(500).json({ error: 'Failed to fetch job' });
  }
});

// POST create a new job (with optional source/target items)
// Body: { process_name, date_of_start, date_of_end, message,
//         source_items: [{traceID, Qty}],
//         target_items: [{itemcode, Qty}],
//         loss_qty: [{itemCode, Qty}],
//         status }
router.post('/jobs', async (req, res) => {
  const {
    process_name, date_of_start, date_of_end, message,
    source_items, target_items, loss_qty, status
  } = req.body || {};

  if (!process_name || !process_name.trim()) {
    return res.status(400).json({ error: 'process_name is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const companyId = req.user.company_id;

    // 1. Insert job
    const jobRes = await client.query(
      `INSERT INTO job (process_name, date_of_start, date_of_end, message, company_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [process_name.trim(), date_of_start || null, date_of_end || null, message || null, companyId]
    );
    const job = jobRes.rows[0];

    // 2. Insert manufacture record linked to this job
    const mfgRes = await client.query(
      `INSERT INTO manufacture (status, job_id, loss_qty, company_id)
       VALUES ($1, $2, $3::jsonb, $4) RETURNING *`,
      [
        status || 'in_progress',
        job.id,
        JSON.stringify(Array.isArray(loss_qty) ? loss_qty : []),
        companyId
      ]
    );

    // 3. Insert source_item row and deduct from inventory
    if (Array.isArray(source_items) && source_items.length > 0) {
      await client.query(
        `INSERT INTO source_item (job_id, items, company_id) VALUES ($1, $2::jsonb, $3)`,
        [job.id, JSON.stringify(source_items), companyId]
      );

      for (const item of source_items) {
        const tId = item.trace_id || item.trace_item_id;
        const qty = parseFloat(item.qty) || 0;
        if (tId && qty > 0) {
          await client.query(
            'UPDATE trace SET qty = qty - $1 WHERE id = $2 AND company_id = $3',
            [qty, tId, companyId]
          );
        }
      }
    }

    // 4. Insert target_item row
    if (Array.isArray(target_items) && target_items.length > 0) {
      await client.query(
        `INSERT INTO target_item (job_id, items, company_id) VALUES ($1, $2::jsonb, $3)`,
        [job.id, JSON.stringify(target_items), companyId]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({
      message: 'Job created successfully',
      job,
      manufacture: mfgRes.rows[0]
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('POST /jobs error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to create job' });
  } finally {
    client.release();
  }
});

// PUT update a job and its manufacture/source/target items
router.put('/jobs/:id', async (req, res) => {
  const { id } = req.params;
  const {
    process_name, date_of_start, date_of_end, message,
    source_items, target_items, loss_qty, status
  } = req.body || {};

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const companyId = req.user.company_id;

    // Update job
    const jobRes = await client.query(
      `UPDATE job
       SET process_name  = COALESCE($1, process_name),
           date_of_start = COALESCE($2, date_of_start),
           date_of_end   = COALESCE($3, date_of_end),
           message       = COALESCE($4, message)
       WHERE id = $5 AND company_id = $6
       RETURNING *`,
      [process_name || null, date_of_start || null, date_of_end || null, message || null, id, companyId]
    );
    if (jobRes.rows.length === 0) throw new Error('Job not found');

    // Update manufacture record
    if (status !== undefined || loss_qty !== undefined) {
      await client.query(
        `UPDATE manufacture
         SET status   = COALESCE($1, status),
             loss_qty = COALESCE($2::jsonb, loss_qty)
         WHERE job_id = $3 AND company_id = $4`,
        [
          status || null,
          loss_qty !== undefined ? JSON.stringify(loss_qty) : null,
          id, companyId
        ]
      );
    }

    // Replace source_items if provided
    if (Array.isArray(source_items)) {
      // First, restore old source items to inventory
      const oldSrcRes = await client.query('SELECT items FROM source_item WHERE job_id = $1 AND company_id = $2', [id, companyId]);
      if (oldSrcRes.rows.length > 0) {
        let oldItems = oldSrcRes.rows[0].items || [];
        if (typeof oldItems === 'string') oldItems = JSON.parse(oldItems);
        for (const item of oldItems) {
          const tId = item.trace_id || item.trace_item_id;
          const qty = parseFloat(item.qty) || 0;
          if (tId && qty > 0) {
            await client.query('UPDATE trace SET qty = qty + $1 WHERE id = $2 AND company_id = $3', [qty, tId, companyId]);
          }
        }
      }

      await client.query('DELETE FROM source_item WHERE job_id = $1 AND company_id = $2', [id, companyId]);
      
      if (source_items.length > 0) {
        await client.query(
          `INSERT INTO source_item (job_id, items, company_id) VALUES ($1, $2::jsonb, $3)`,
          [id, JSON.stringify(source_items), companyId]
        );

        // Deduct new items from inventory
        for (const item of source_items) {
          const tId = item.trace_id || item.trace_item_id;
          const qty = parseFloat(item.qty) || 0;
          if (tId && qty > 0) {
            await client.query('UPDATE trace SET qty = qty - $1 WHERE id = $2 AND company_id = $3', [qty, tId, companyId]);
          }
        }
      }
    }

    // Replace target_items if provided
    if (Array.isArray(target_items)) {
      await client.query('DELETE FROM target_item WHERE job_id = $1 AND company_id = $2', [id, companyId]);
      if (target_items.length > 0) {
        await client.query(
          `INSERT INTO target_item (job_id, items, company_id) VALUES ($1, $2::jsonb, $3)`,
          [id, JSON.stringify(target_items), companyId]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ message: 'Job updated successfully', job: jobRes.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('PUT /jobs/:id error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to update job' });
  } finally {
    client.release();
  }
});

// PUT complete production for a job
router.put('/jobs/:id/complete-production', async (req, res) => {
  const { id } = req.params;
  const { target_items, remarks } = req.body || {};
  const companyId = req.user.company_id;

  if (!Array.isArray(target_items) || target_items.length === 0) {
    return res.status(400).json({ error: 'target_items array is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Fetch the target items JSON
    const tiRes = await client.query(
      'SELECT items FROM target_item WHERE job_id = $1 AND company_id = $2 FOR UPDATE',
      [id, companyId]
    );
    let dbTargetItems = tiRes.rows.length > 0 ? tiRes.rows[0].items || [] : [];
    if (typeof dbTargetItems === 'string') dbTargetItems = JSON.parse(dbTargetItems);

    // Fetch the source items to extract their trace histories
    const siRes = await client.query(
      'SELECT items FROM source_item WHERE job_id = $1 AND company_id = $2',
      [id, companyId]
    );
    let dbSourceItems = siRes.rows.length > 0 ? siRes.rows[0].items || [] : [];
    if (typeof dbSourceItems === 'string') dbSourceItems = JSON.parse(dbSourceItems);

    const sourceTraceIds = dbSourceItems
      .map(s => parseInt(s.trace_id || s.trace_item_id))
      .filter(t => !isNaN(t));

    let sourceHistories = [];
    if (sourceTraceIds.length > 0) {
      const traceHistoryRes = await client.query(
        'SELECT history FROM trace WHERE id = ANY($1) AND company_id = $2',
        [sourceTraceIds, companyId]
      );
      for (const row of traceHistoryRes.rows) {
        if (Array.isArray(row.history)) {
          sourceHistories.push(row.history);
        }
      }
    }

    for (const tgt of target_items) {
      const { item_code, completed_qty, location, target_status, cost_price } = tgt;
      if (!item_code || !completed_qty || completed_qty <= 0) continue;

      // 1. Find or create inventory bin
      let invId = null;
      if (location) {
        const invRes = await client.query(
          'SELECT id FROM inventory WHERE location = $1 AND company_id = $2',
          [location.trim(), companyId]
        );
        if (invRes.rows.length > 0) {
          invId = invRes.rows[0].id;
        } else {
          const newInvRes = await client.query(
            'INSERT INTO inventory (location, company_id) VALUES ($1, $2) RETURNING id',
            [location.trim(), companyId]
          );
          invId = newInvRes.rows[0].id;
        }
      }

      // 2. Fetch internal item db ID
      const itRes = await client.query(
        'SELECT id FROM items WHERE item_code = $1 AND company_id = $2',
        [item_code, companyId]
      );
      if (itRes.rows.length === 0) continue; // skip if item doesn't exist
      const itemDbId = itRes.rows[0].id;

      // Fetch the process_name for the trace property
      const jobInfoRes = await client.query('SELECT process_name FROM job WHERE id = $1 AND company_id = $2', [id, companyId]);
      const jobProcessName = jobInfoRes.rows.length > 0 ? jobInfoRes.rows[0].process_name : 'Manufacturing';

      // 3. Create trace row for the produced goods with merged history
      const finalHistory = [
        {
          action: 'Manufacture Production',
          trace: jobProcessName,
          date: new Date().toISOString(),
          job_id: id,
          remarks: remarks,
          sources: sourceHistories
        }
      ];

      await client.query(
        `INSERT INTO trace (item_code, qty, cost_price, inventory_id, status, history, company_id)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
        [
          itemDbId,
          completed_qty,
          cost_price || 0,
          invId,
          target_status || 'In Inventory',
          JSON.stringify(finalHistory),
          companyId
        ]
      );

      // 4. Update the delivered_qty in the target_item array
      for (const dbItem of dbTargetItems) {
        if (dbItem.item_code === item_code) {
          dbItem.delivered_qty = (dbItem.delivered_qty || 0) + completed_qty;
        }
      }
    }

    // Save updated target items
    await client.query(
      'UPDATE target_item SET items = $1::jsonb WHERE job_id = $2 AND company_id = $3',
      [JSON.stringify(dbTargetItems), id, companyId]
    );

    // Check if job is fully completed
    let isFullyCompleted = true;
    for (const dbItem of dbTargetItems) {
      if ((dbItem.delivered_qty || 0) < (parseFloat(dbItem.qty) || 0)) {
        isFullyCompleted = false;
        break;
      }
    }

    if (isFullyCompleted) {
      await client.query(
        "UPDATE manufacture SET status = 'completed' WHERE job_id = $1 AND company_id = $2",
        [id, companyId]
      );
    }

    await client.query('COMMIT');
    res.json({ message: 'Production completed successfully', fullyCompleted: isFullyCompleted });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('PUT /jobs/:id/complete-production error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to complete production' });
  } finally {
    client.release();
  }
});

// DELETE a job (cascades to manufacture, source_item, target_item)
router.delete('/jobs/:id', async (req, res) => {
  const { id } = req.params;
  const companyId = req.user.company_id;
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Restore source items to inventory before deletion
    const oldSrcRes = await client.query('SELECT items FROM source_item WHERE job_id = $1 AND company_id = $2', [id, companyId]);
    if (oldSrcRes.rows.length > 0) {
      let oldItems = oldSrcRes.rows[0].items || [];
      if (typeof oldItems === 'string') oldItems = JSON.parse(oldItems);
      for (const item of oldItems) {
        const tId = item.trace_id || item.trace_item_id;
        const qty = parseFloat(item.qty) || 0;
        if (tId && qty > 0) {
          await client.query('UPDATE trace SET qty = qty + $1 WHERE id = $2 AND company_id = $3', [qty, tId, companyId]);
        }
      }
    }

    const result = await client.query(
      'DELETE FROM job WHERE id = $1 AND company_id = $2 RETURNING id',
      [id, companyId]
    );
    
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Job not found' });
    }
    
    await client.query('COMMIT');
    res.json({ message: 'Job deleted successfully', id: result.rows[0].id });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('DELETE /jobs/:id error:', err.message);
    res.status(500).json({ error: 'Failed to delete job' });
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────────
//  MANUFACTURE status update
//  PATCH /api/manufacture/:manufacture_id/status
// ─────────────────────────────────────────────
router.patch('/:manufacture_id/status', async (req, res) => {
  const { manufacture_id } = req.params;
  const { status, loss_qty } = req.body || {};

  if (!status) return res.status(400).json({ error: 'status is required' });

  try {
    const result = await pool.query(
      `UPDATE manufacture
       SET status   = $1,
           loss_qty = COALESCE($2::jsonb, loss_qty)
       WHERE id = $3 AND company_id = $4
       RETURNING *`,
      [
        status,
        loss_qty !== undefined ? JSON.stringify(loss_qty) : null,
        manufacture_id,
        req.user.company_id
      ]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Manufacture record not found' });
    res.json({ message: 'Status updated', manufacture: result.rows[0] });
  } catch (err) {
    console.error('PATCH /:manufacture_id/status error:', err.message);
    res.status(500).json({ error: 'Failed to update manufacture status' });
  }
});

// ─────────────────────────────────────────────
//  GET all manufacture records (list view)
// ─────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT m.*,
              row_to_json(j) AS job
       FROM manufacture m
       LEFT JOIN job j ON m.job_id = j.id
       WHERE m.company_id = $1
       ORDER BY m.created_at DESC`,
      [req.user.company_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('GET / error:', err.message);
    res.status(500).json({ error: 'Failed to fetch manufacture records' });
  }
});

module.exports = router;
