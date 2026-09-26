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
            FROM rq_process_source_item si
            LEFT JOIN items src ON si.item_code = src.id
            WHERE si.rq_process_id = rp.id AND si.company_id = rp.company_id
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
                'price', ti.price
              )
            )
            FROM rq_process_target_item ti
            LEFT JOIN items tgt ON ti.item_code = tgt.id
            WHERE ti.rq_process_id = rp.id AND ti.company_id = rp.company_id
          ), '[]'::json
        ) AS target_items,
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
            FROM rq_process_source_item si
            LEFT JOIN items src ON si.item_code = src.id
            WHERE si.rq_process_id = rp.id AND si.company_id = rp.company_id
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
                'price', ti.price
              )
            )
            FROM rq_process_target_item ti
            LEFT JOIN items tgt ON ti.item_code = tgt.id
            WHERE ti.rq_process_id = rp.id AND ti.company_id = rp.company_id
          ), '[]'::json
        ) AS target_items,
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
    source_items,
    target_items,
    items
  } = req.body || {};

  if (!date) {
    return res.status(400).json({ error: 'Date is required' });
  }

  // Normalize source items array
  let cleanSourceItems = [];
  if (Array.isArray(source_items) && source_items.length > 0) {
    cleanSourceItems = source_items;
  } else if (Array.isArray(items) && items.length > 0) {
    cleanSourceItems = items.map(it => ({
      item_code: it.source_item_code,
      qty: it.source_item_quantity
    }));
  }

  // Normalize target items array
  let cleanTargetItems = [];
  if (Array.isArray(target_items) && target_items.length > 0) {
    cleanTargetItems = target_items;
  } else if (Array.isArray(items) && items.length > 0) {
    cleanTargetItems = items.map(it => ({
      item_code: it.target_item_code,
      qty: it.target_item_quantity,
      price: it.price || 0
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

    // 1. Generate next PR no
    const countRes = await client.query('SELECT COUNT(*) FROM rq_process WHERE company_id = $1', [companyId]);
    const count = parseInt(countRes.rows[0].count) || 0;
    const rq_process_no = `PR-${String(count + 1).padStart(4, '0')}`;

    // 2. Generate new trade ID
    const tradeCountRes = await client.query('SELECT COUNT(*) FROM trades WHERE company_id = $1', [companyId]);
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
        companyId
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
        companyId
      ]
    );
    const rqDbId = rqRes.rows[0].id;

    // 4. Insert into rq_process_source_item table
    const sourceDbIds = [];
    for (const src of cleanSourceItems) {
      if (!src.item_code) continue;
      const sRes = await client.query('SELECT id FROM items WHERE item_code = $1 AND company_id = $2', [src.item_code.trim(), companyId]);
      if (sRes.rows.length === 0) {
        throw new Error(`Source Item Code '${src.item_code}' not found in Catalog`);
      }
      const sourceDbId = sRes.rows[0].id;
      sourceDbIds.push({ id: sourceDbId, qty: parseFloat(src.qty) || 0 });
      const traceItemId = src.trace_item_id || src.trace_id ? parseInt(src.trace_item_id || src.trace_id) : null;

      await client.query(
        `INSERT INTO rq_process_source_item (rq_process_id, item_code, trace_item_id, qty, company_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [rqDbId, sourceDbId, traceItemId, parseFloat(src.qty) || 0, companyId]
      );
    }

    // 5. Insert into rq_process_target_item table
    const targetDbIds = [];
    for (const tgt of cleanTargetItems) {
      if (!tgt.item_code) continue;
      const tRes = await client.query('SELECT id FROM items WHERE item_code = $1 AND company_id = $2', [tgt.item_code.trim(), companyId]);
      if (tRes.rows.length === 0) {
        throw new Error(`Target Item Code '${tgt.item_code}' not found in Catalog`);
      }
      const targetDbId = tRes.rows[0].id;
      targetDbIds.push({ id: targetDbId, qty: parseFloat(tgt.qty) || 0 });

      await client.query(
        `INSERT INTO rq_process_target_item (rq_process_id, item_code, qty, price, company_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [rqDbId, targetDbId, parseFloat(tgt.qty) || 0, parseFloat(tgt.price) || 0.00, companyId]
      );
    }

    // 6. Insert fallback row into process_item table for legacy pair compatibility
    if (sourceDbIds.length > 0 && targetDbIds.length > 0) {
      await client.query(
        `INSERT INTO process_item (rq_process_id, source_item_id, source_item_quantity, target_item_id, target_item_quantity, company_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          rqDbId,
          sourceDbIds[0].id,
          sourceDbIds[0].qty,
          targetDbIds[0].id,
          targetDbIds[0].qty,
          companyId
        ]
      );
    }

    // Ensure status is recorded
    await client.query(
      "INSERT INTO status (name, company_id) VALUES ('process_rq', $1) ON CONFLICT (name, company_id) DO NOTHING",
      [companyId]
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
