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
        rp.rq_process_no,
        rp.date,
        rp.seller,
        rp.party,
        rp.message,
        t.trade_id,
        rp.created_at,
        (
          SELECT COALESCE(json_agg(json_build_object(
            'id', pi.id,
            'source_item_id', pi.source_item_id,
            'source_item_code', si.item_code,
            'source_description', si.description,
            'source_drawing_number', si.drawing_number,
            'source_item_quantity', pi.source_item_quantity,
            'target_item_id', pi.target_item_id,
            'target_item_code', ti.item_code,
            'target_description', ti.description,
            'target_drawing_number', ti.drawing_number,
            'target_item_quantity', pi.target_item_quantity
          ) ORDER BY pi.id), '[]')
          FROM process_item pi
          LEFT JOIN items si ON pi.source_item_id = si.id AND si.company_id = pi.company_id
          LEFT JOIN items ti ON pi.target_item_id = ti.id AND ti.company_id = pi.company_id
          WHERE pi.rq_process_id = rp.id AND pi.company_id = rp.company_id
        ) as items
      FROM rq_process rp
      LEFT JOIN trades t ON rp.trade_id = t.id
      WHERE rp.company_id = $1
      ORDER BY rp.created_at DESC
    `, [req.user.company_id]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching Process RQs:', err.message);
    res.status(500).json({ error: 'Failed to fetch Process RQs' });
  }
});

// GET a single Process RQ by ID or rq_process_no
router.get('/:identifier', async (req, res) => {
  const { identifier } = req.params;
  try {
    const result = await pool.query(`
      SELECT
        rp.id,
        rp.rq_process_no,
        rp.date,
        rp.seller,
        rp.party,
        rp.message,
        t.trade_id,
        rp.created_at,
        (
          SELECT COALESCE(json_agg(json_build_object(
            'id', pi.id,
            'source_item_id', pi.source_item_id,
            'source_item_code', si.item_code,
            'source_description', si.description,
            'source_drawing_number', si.drawing_number,
            'source_item_quantity', pi.source_item_quantity,
            'target_item_id', pi.target_item_id,
            'target_item_code', ti.item_code,
            'target_description', ti.description,
            'target_drawing_number', ti.drawing_number,
            'target_item_quantity', pi.target_item_quantity
          ) ORDER BY pi.id), '[]')
          FROM process_item pi
          LEFT JOIN items si ON pi.source_item_id = si.id AND si.company_id = pi.company_id
          LEFT JOIN items ti ON pi.target_item_id = ti.id AND ti.company_id = pi.company_id
          WHERE pi.rq_process_id = rp.id AND pi.company_id = rp.company_id
        ) as items
      FROM rq_process rp
      LEFT JOIN trades t ON rp.trade_id = t.id
      WHERE (rp.rq_process_no = $1 OR rp.id::text = $1) AND rp.company_id = $2
    `, [identifier, req.user.company_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Process RQ not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching Process RQ details:', err.message);
    res.status(500).json({ error: 'Failed to fetch Process RQ details' });
  }
});

// CREATE a new Process RQ
router.post('/', async (req, res) => {
  const {
    date,
    seller,
    party,
    message,
    items
  } = req.body || {};

  if (!date) {
    return res.status(400).json({ error: 'Date is required' });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'At least one process item mapping is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Generate next PR no
    const countRes = await client.query('SELECT COUNT(*) FROM rq_process WHERE company_id = $1', [req.user.company_id]);
    const count = parseInt(countRes.rows[0].count) || 0;
    const rq_process_no = `PR-${String(count + 1).padStart(4, '0')}`;

    // 2. Generate new trade ID
    const tradeCountRes = await client.query('SELECT COUNT(*) FROM trades WHERE company_id = $1', [req.user.company_id]);
    const tradeCount = parseInt(tradeCountRes.rows[0].count) || 0;
    const trade_code = `TRD-${String(tradeCount + 1).padStart(4, '0')}`;

    const tradeRes = await client.query(
      `INSERT INTO trades (trade_id, documents, status, trade_type, company_id)
       VALUES ($1, $2::jsonb, $3, $4, $5) RETURNING id`,
      [
        trade_code,
        JSON.stringify([{ type: 'PR', id: rq_process_no }]),
        'process_rq',
        'process',
        req.user.company_id
      ]
    );
    const tradeDbId = tradeRes.rows[0].id;

    // 3. Insert into rq_process table
    const rqRes = await client.query(
      `INSERT INTO rq_process (rq_process_no, date, seller, party, message, trade_id, company_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [
        rq_process_no,
        date,
        seller || null,
        party || null,
        message || null,
        tradeDbId,
        req.user.company_id
      ]
    );
    const rqDbId = rqRes.rows[0].id;

    // 4. Insert into process_item table
    for (const item of items) {
      let sourceItemId = item.source_item_id;
      let targetItemId = item.target_item_id;

      if (!sourceItemId && item.source_item_code) {
        const sRes = await client.query('SELECT id FROM items WHERE item_code = $1 AND company_id = $2', [item.source_item_code, req.user.company_id]);
        if (sRes.rows.length > 0) sourceItemId = sRes.rows[0].id;
      }
      if (!targetItemId && item.target_item_code) {
        const tRes = await client.query('SELECT id FROM items WHERE item_code = $1 AND company_id = $2', [item.target_item_code, req.user.company_id]);
        if (tRes.rows.length > 0) targetItemId = tRes.rows[0].id;
      }

      if (!sourceItemId || !targetItemId) {
        throw new Error('Valid source item and target item are required for all process items');
      }

      await client.query(
        `INSERT INTO process_item (rq_process_id, source_item_id, source_item_quantity, target_item_id, target_item_quantity, company_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          rqDbId,
          sourceItemId,
          parseFloat(item.source_item_quantity) || 1,
          targetItemId,
          parseFloat(item.target_item_quantity) || 1,
          req.user.company_id
        ]
      );
    }

    // Ensure status is recorded
    await client.query(
      "INSERT INTO status (name, company_id) VALUES ('process_rq', $1) ON CONFLICT (name, company_id) DO NOTHING",
      [req.user.company_id]
    );

    await client.query('COMMIT');
    res.status(201).json({ rq_process_no, trade_id: trade_code, id: rqDbId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating Process RQ:', err.message);
    res.status(500).json({ error: err.message || 'Failed to create Process RQ' });
  } finally {
    client.release();
  }
});

module.exports = router;
