const express = require('express');
const router = express.Router();
const { pool, appendDocToTrade } = require('../db');

// GET next Process RQ reference number
router.get('/next-no', async (req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(*) FROM rq_process WHERE company_id = $1', [req.user.company_id]);
    const count = parseInt(result.rows[0].count) || 0;
    const nextNo = `PR-${String(count + 1).padStart(4, '0')}`;
    res.json({ nextNo });
  } catch (err) {
    console.error('Error fetching next process RQ no:', err.message);
    res.status(500).json({ error: 'Failed to generate next process RQ number' });
  }
});

// GET all Process RQs
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        rp.id,
        rp.number,
        rp."dateOfStart",
        rp."dateOfEnd",
        rp.party_id,
        rp.customer_id,
        b.name as party_name,
        c.name as customer_name,
        rp.message,
        rp.job_ids,
        t.trade_id,
        rp.created_at
      FROM rq_process rp
      LEFT JOIN trades t ON rp.trade_id = t.id
      LEFT JOIN buyers b ON rp.party_id = b.id
      LEFT JOIN customers c ON rp.customer_id = c.id
      WHERE rp.company_id = $1
      ORDER BY rp.created_at DESC
    `, [req.user.company_id]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching Process RQs:', err.message);
    res.status(500).json({ error: 'Failed to fetch Process RQs' });
  }
});

// GET a single Process RQ by ID or number
router.get('/:identifier', async (req, res) => {
  const { identifier } = req.params;
  try {
    const result = await pool.query(`
      SELECT
        rp.id,
        rp.number,
        rp."dateOfStart",
        rp."dateOfEnd",
        rp.party_id,
        rp.customer_id,
        b.name as party_name,
        c.name as customer_name,
        rp.message,
        rp.job_ids,
        t.trade_id,
        rp.created_at
      FROM rq_process rp
      LEFT JOIN trades t ON rp.trade_id = t.id
      LEFT JOIN buyers b ON rp.party_id = b.id
      LEFT JOIN customers c ON rp.customer_id = c.id
      WHERE (rp.number = $1 OR rp.id::text = $1) AND rp.company_id = $2
    `, [identifier, req.user.company_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Process RQ not found' });
    }
    
    const rq = result.rows[0];
    
    // Fetch associated jobs
    if (rq.job_ids && rq.job_ids.length > 0) {
      const jobsResult = await pool.query(`
        SELECT j.*, 
               (SELECT json_agg(si.*) FROM source_item si WHERE si.job_id = j.id) as source_items,
               (SELECT json_agg(ti.*) FROM target_item ti WHERE ti.job_id = j.id) as target_items
        FROM job j
        WHERE j.id = ANY($1::int[])
      `, [rq.job_ids]);
      
      rq.jobs = jobsResult.rows.map(j => {
        let flattenedSourceItems = [];
        if (j.source_items) {
          j.source_items.forEach(si => {
            if (Array.isArray(si.items)) flattenedSourceItems.push(...si.items);
          });
        }
        
        let flattenedTargetItems = [];
        if (j.target_items) {
          j.target_items.forEach(ti => {
            if (Array.isArray(ti.items)) flattenedTargetItems.push(...ti.items);
          });
        }
        
        return {
          ...j,
          source_items: flattenedSourceItems,
          target_items: flattenedTargetItems
        };
      });
    } else {
      rq.jobs = [];
    }

    res.json(rq);
  } catch (err) {
    console.error('Error fetching Process RQ details:', err.message);
    res.status(500).json({ error: 'Failed to fetch Process RQ details' });
  }
});

// CREATE a new Process RQ
router.post('/', async (req, res) => {
  const {
    dateOfStart,
    dateOfEnd,
    party_id,
    customer_id,
    message,
    job_ids
  } = req.body || {};

  if (!dateOfStart) {
    return res.status(400).json({ error: 'Start Date is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const companyId = req.user.company_id;

    // 1. Generate next PR no
    const countRes = await client.query('SELECT COUNT(*) FROM rq_process WHERE company_id = $1', [companyId]);
    const count = parseInt(countRes.rows[0].count) || 0;
    const number = `PR-${String(count + 1).padStart(4, '0')}`;

    // 2. Generate new trade ID
    const tradeCountRes = await client.query('SELECT COUNT(*) FROM trades WHERE company_id = $1', [companyId]);
    const tradeCount = parseInt(tradeCountRes.rows[0].count) || 0;
    const trade_code = `TRD-${String(tradeCount + 1).padStart(4, '0')}`;

    const tradeRes = await client.query(
      `INSERT INTO trades (trade_id, documents, status, trade_type, company_id)
       VALUES ($1, $2::jsonb, $3, $4, $5) RETURNING id`,
      [
        trade_code,
        JSON.stringify([{ type: 'PR', id: number }]),
        'received_quotation',
        'process',
        companyId
      ]
    );
    const tradeDbId = tradeRes.rows[0].id;

    // 3. Insert into rq_process table
    const safeJobIds = Array.isArray(job_ids) ? job_ids : [];
    
    const rqRes = await client.query(
      `INSERT INTO rq_process (number, "dateOfStart", "dateOfEnd", party_id, customer_id, message, job_ids, trade_id, company_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9) RETURNING id`,
      [
        number,
        dateOfStart,
        dateOfEnd || null,
        party_id || null,
        customer_id || null,
        message || null,
        JSON.stringify(safeJobIds),
        tradeDbId,
        companyId
      ]
    );
    const rqDbId = rqRes.rows[0].id;

    // Ensure status is recorded
    await client.query(
      "INSERT INTO status (name, company_id) VALUES ('received_quotation', $1) ON CONFLICT (name, company_id) DO NOTHING",
      [companyId]
    );

    await client.query('COMMIT');
    res.status(201).json({ number, trade_id: trade_code, id: rqDbId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating Process RQ:', err.message);
    res.status(500).json({ error: err.message || 'Failed to create Process RQ' });
  } finally {
    client.release();
  }
});

module.exports = router;
