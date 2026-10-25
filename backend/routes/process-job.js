const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Helper to normalize items from rows
function normalizeJob(job) {
  let source_items = [];
  if (job.raw_source_items) {
    job.raw_source_items.forEach(si => {
      if (Array.isArray(si.items)) source_items.push(...si.items);
      else if (si.items) source_items.push(si.items);
    });
  }

  let target_items = [];
  if (job.raw_target_items) {
    job.raw_target_items.forEach(ti => {
      if (Array.isArray(ti.items)) target_items.push(...ti.items);
      else if (ti.items) target_items.push(ti.items);
    });
  }

  delete job.raw_source_items;
  delete job.raw_target_items;

  return {
    ...job,
    source_items,
    target_items
  };
}

// GET all process jobs
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         j.id,
         j.process_name,
         j.date_of_start,
         j.date_of_end,
         j.message,
         j.company_id,
         j.created_at,
         (SELECT json_agg(si.*) FROM "processSource_item" si WHERE si.job_id = j.id) as raw_source_items,
         (SELECT json_agg(ti.*) FROM "ProcessTarget_item" ti WHERE ti.job_id = j.id) as raw_target_items
       FROM "processJob" j
       WHERE j.company_id = $1
       ORDER BY j.id DESC`,
      [req.user.company_id]
    );

    const jobs = result.rows.map(normalizeJob);
    res.json(jobs);
  } catch (err) {
    console.error('GET /process-jobs error:', err.message);
    res.status(500).json({ error: 'Failed to fetch process jobs' });
  }
});

// GET single process job by ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT
         j.id,
         j.process_name,
         j.date_of_start,
         j.date_of_end,
         j.message,
         j.company_id,
         j.created_at,
         (SELECT json_agg(si.*) FROM "processSource_item" si WHERE si.job_id = j.id) as raw_source_items,
         (SELECT json_agg(ti.*) FROM "ProcessTarget_item" ti WHERE ti.job_id = j.id) as raw_target_items
       FROM "processJob" j
       WHERE j.id = $1 AND j.company_id = $2`,
      [id, req.user.company_id]
    );

    if (result.rows.length === 0) {
      // Fallback to legacy job table for backward compatibility
      const legacyResult = await pool.query(
        `SELECT
           j.id,
           j.process_name,
           j.date_of_start,
           j.date_of_end,
           j.message,
           j.company_id,
           j.created_at,
           (SELECT json_agg(si.*) FROM source_item si WHERE si.job_id = j.id) as raw_source_items,
           (SELECT json_agg(ti.*) FROM target_item ti WHERE ti.job_id = j.id) as raw_target_items
         FROM job j
         WHERE j.id = $1 AND j.company_id = $2`,
        [id, req.user.company_id]
      );

      if (legacyResult.rows.length === 0) {
        return res.status(404).json({ error: 'Process job not found' });
      }

      return res.json(normalizeJob(legacyResult.rows[0]));
    }

    res.json(normalizeJob(result.rows[0]));
  } catch (err) {
    console.error('GET /process-jobs/:id error:', err.message);
    res.status(500).json({ error: 'Failed to fetch process job' });
  }
});

// POST create a new process job
router.post('/', async (req, res) => {
  const {
    process_name,
    date_of_start,
    date_of_end,
    message,
    source_items,
    target_items
  } = req.body || {};

  if (!process_name || !process_name.trim()) {
    return res.status(400).json({ error: 'process_name is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const companyId = req.user.company_id;

    // 1. Insert into "processJob"
    const jobRes = await client.query(
      `INSERT INTO "processJob" (process_name, date_of_start, date_of_end, message, company_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [
        process_name.trim(),
        date_of_start || new Date().toISOString().split('T')[0],
        date_of_end || null,
        message || null,
        companyId
      ]
    );
    const job = jobRes.rows[0];

    // 2. Insert into "processSource_item"
    const normalizedSourceItems = Array.isArray(source_items) ? source_items : [];
    if (normalizedSourceItems.length > 0) {
      await client.query(
        `INSERT INTO "processSource_item" (job_id, items, company_id) VALUES ($1, $2::jsonb, $3)`,
        [job.id, JSON.stringify(normalizedSourceItems), companyId]
      );
    }

    // 3. Insert into "ProcessTarget_item"
    const normalizedTargetItems = Array.isArray(target_items) ? target_items : [];
    if (normalizedTargetItems.length > 0) {
      await client.query(
        `INSERT INTO "ProcessTarget_item" (job_id, items, company_id) VALUES ($1, $2::jsonb, $3)`,
        [job.id, JSON.stringify(normalizedTargetItems), companyId]
      );
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Process job created successfully',
      job: {
        ...job,
        source_items: normalizedSourceItems,
        target_items: normalizedTargetItems
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('POST /process-jobs error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to create process job' });
  } finally {
    client.release();
  }
});

// PUT update a process job
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const {
    process_name,
    date_of_start,
    date_of_end,
    message,
    source_items,
    target_items
  } = req.body || {};

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const companyId = req.user.company_id;

    // 1. Update "processJob"
    const updateRes = await client.query(
      `UPDATE "processJob"
       SET process_name  = COALESCE($1, process_name),
           date_of_start = COALESCE($2, date_of_start),
           date_of_end   = $3,
           message       = $4
       WHERE id = $5 AND company_id = $6
       RETURNING *`,
      [
        process_name ? process_name.trim() : null,
        date_of_start || null,
        date_of_end || null,
        message || null,
        id,
        companyId
      ]
    );

    if (updateRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Process job not found' });
    }

    // 2. Replace source items if passed
    if (Array.isArray(source_items)) {
      await client.query('DELETE FROM "processSource_item" WHERE job_id = $1 AND company_id = $2', [id, companyId]);
      if (source_items.length > 0) {
        await client.query(
          `INSERT INTO "processSource_item" (job_id, items, company_id) VALUES ($1, $2::jsonb, $3)`,
          [id, JSON.stringify(source_items), companyId]
        );
      }
    }

    // 3. Replace target items if passed
    if (Array.isArray(target_items)) {
      await client.query('DELETE FROM "ProcessTarget_item" WHERE job_id = $1 AND company_id = $2', [id, companyId]);
      if (target_items.length > 0) {
        await client.query(
          `INSERT INTO "ProcessTarget_item" (job_id, items, company_id) VALUES ($1, $2::jsonb, $3)`,
          [id, JSON.stringify(target_items), companyId]
        );
      }
    }

    await client.query('COMMIT');

    res.json({
      message: 'Process job updated successfully',
      job: {
        ...updateRes.rows[0],
        source_items: source_items || [],
        target_items: target_items || []
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('PUT /process-jobs/:id error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to update process job' });
  } finally {
    client.release();
  }
});

// DELETE a process job
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM "processJob" WHERE id = $1 AND company_id = $2 RETURNING id',
      [id, req.user.company_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Process job not found' });
    }

    res.json({ message: 'Process job deleted successfully', id: result.rows[0].id });
  } catch (err) {
    console.error('DELETE /process-jobs/:id error:', err.message);
    res.status(500).json({ error: 'Failed to delete process job' });
  }
});

module.exports = router;
