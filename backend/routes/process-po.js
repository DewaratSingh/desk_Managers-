const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// GET next Process PO number
router.get('/next-no', async (req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(*) FROM process_po WHERE company_id = $1', [req.user.company_id]);
    const count = parseInt(result.rows[0].count) || 0;
    const nextNo = `PPO-${String(count + 1).padStart(4, '0')}`;
    res.json({ nextNo });
  } catch (err) {
    console.error('Error fetching next process PO no:', err.message);
    res.status(500).json({ error: 'Failed to generate next process PO number' });
  }
});

// GET a single Process PO by po_no
router.get('/:identifier', async (req, res) => {
  const { identifier } = req.params;
  try {
    const result = await pool.query(`
      SELECT
        pp.id,
        pp.po_no,
        pp.date,
        pp.delivery_date,
        pp.rq_process_id,
        rp.rq_process_no,
        rp.seller,
        rp.party,
        t.trade_id,
        pp.created_at,
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
            'target_item_quantity', pi.target_item_quantity,
            'price', pi.price,
            'source_item_traceid_array', pi.source_item_traceid_array,
            'target_item_traceid_array', pi.target_item_traceid_array
          ) ORDER BY pi.id), '[]')
          FROM po_process_item pi
          LEFT JOIN items si ON pi.source_item_id = si.id
          LEFT JOIN items ti ON pi.target_item_id = ti.id
          WHERE pi.process_po_id = pp.id AND pi.company_id = pp.company_id
        ) as items
      FROM process_po pp
      LEFT JOIN rq_process rp ON pp.rq_process_id = rp.id
      LEFT JOIN trades t ON pp.trade_id = t.id
      WHERE (pp.po_no = $1 OR pp.id::text = $1) AND pp.company_id = $2
    `, [identifier, req.user.company_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Process PO not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching Process PO:', err.message);
    res.status(500).json({ error: 'Failed to fetch Process PO' });
  }
});

// CREATE a new Process PO
router.post('/', async (req, res) => {
  const { date, delivery_date, rq_process_no, trade_id: tradeCode, items } = req.body || {};

  if (!date) return res.status(400).json({ error: 'Date is required' });
  if (!rq_process_no) return res.status(400).json({ error: 'RQ Process number is required' });
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'At least one item is required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Generate PPO number
    const countRes = await client.query('SELECT COUNT(*) FROM process_po WHERE company_id = $1', [req.user.company_id]);
    const count = parseInt(countRes.rows[0].count) || 0;
    const po_no = `PPO-${String(count + 1).padStart(4, '0')}`;

    // 2. Resolve rq_process record
    const rqRes = await client.query(
      'SELECT id FROM rq_process WHERE rq_process_no = $1 AND company_id = $2',
      [rq_process_no, req.user.company_id]
    );
    if (rqRes.rows.length === 0) throw new Error(`Process RQ "${rq_process_no}" not found`);
    const rqDbId = rqRes.rows[0].id;

    // 3. Resolve trade
    let tradeDbId = null;
    if (tradeCode) {
      const tradeRes = await client.query('SELECT id FROM trades WHERE trade_id = $1 AND company_id = $2', [tradeCode, req.user.company_id]);
      if (tradeRes.rows.length > 0) tradeDbId = tradeRes.rows[0].id;
    }

    // 4. Insert process_po
    const poRes = await client.query(
      `INSERT INTO process_po (po_no, date, delivery_date, rq_process_id, trade_id, company_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [po_no, date, delivery_date || null, rqDbId, tradeDbId, req.user.company_id]
    );
    const poDbId = poRes.rows[0].id;

    // 5. For each item: insert po_process_item, create target trace+inventory, update source trace status
    for (const item of items) {
      const sourceTraceArray = Array.isArray(item.source_item_traceid_array) ? item.source_item_traceid_array : [];
      const targetTraceArray = [];

      // Gather process history from source trace items so new trace item inherits the same trace history
      let inheritedProcess = [];
      for (const alloc of sourceTraceArray) {
        if (alloc.trace_item_id) {
          const srcRow = await client.query(
            'SELECT process FROM trace_item WHERE id = $1 AND company_id = $2',
            [alloc.trace_item_id, req.user.company_id]
          );
          if (srcRow.rows.length > 0 && Array.isArray(srcRow.rows[0].process)) {
            for (const step of srcRow.rows[0].process) {
              if (!inheritedProcess.some(p => p.id === step.id && p.type === step.type)) {
                inheritedProcess.push(step);
              }
            }
          }
        }
      }

      const processStep = {
        type: 'process',
        po_no,
        trade_id: tradeCode,
        unit_price: parseFloat(item.price) || 0
      };
      const finalProcessArray = [...inheritedProcess, processStep];

      // Create one new trace_item + inventory row for the TARGET item
      const newTraceRes = await client.query(
        `INSERT INTO trace_item (item_code, process, message, quantity, price, status, company_id)
         VALUES ($1, $2::jsonb, $3, $4, $5, 'in process', $6) RETURNING id`,
        [
          item.target_item_id,
          JSON.stringify(finalProcessArray),
          `Process PO: ${po_no}`,
          parseInt(item.target_item_quantity) || 0,
          parseFloat(item.price) || 0,
          req.user.company_id
        ]
      );
      const newTraceId = newTraceRes.rows[0].id;

      // Insert into inventory for target item
      await client.query(
        `INSERT INTO inventory (item_code, message, quantity, price, trade_id, trace_item_id, company_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          item.target_item_id,
          `Created by Process PO ${po_no} — awaiting processing`,
          parseInt(item.target_item_quantity) || 0,
          parseFloat(item.price) || 0,
          tradeDbId,
          newTraceId,
          req.user.company_id
        ]
      );

      targetTraceArray.push({ trace_item_id: newTraceId, quantity: parseInt(item.target_item_quantity) || 0 });

      // Reduce quantity of source inventory rows (do NOT change status)
      for (const alloc of sourceTraceArray) {
        if (alloc.inventory_id && alloc.quantity > 0) {
          await client.query(
            `UPDATE inventory
             SET quantity = GREATEST(0, quantity - $1), updated_at = NOW()
             WHERE id = $2 AND company_id = $3`,
            [parseInt(alloc.quantity), alloc.inventory_id, req.user.company_id]
          );
          await client.query(
            `DELETE FROM inventory WHERE id = $1 AND quantity <= 0 AND company_id = $2`,
            [alloc.inventory_id, req.user.company_id]
          );
        }
      }

      // Insert po_process_item
      await client.query(
        `INSERT INTO po_process_item
           (process_po_id, source_item_id, source_item_quantity, target_item_id, target_item_quantity, price, source_item_traceid_array, target_item_traceid_array, company_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9)`,
        [
          poDbId,
          item.source_item_id,
          parseInt(item.source_item_quantity) || 0,
          item.target_item_id,
          parseInt(item.target_item_quantity) || 0,
          parseFloat(item.price) || 0,
          JSON.stringify(sourceTraceArray),
          JSON.stringify(targetTraceArray),
          req.user.company_id
        ]
      );
    }

    // 6. Append PO document to trade
    if (tradeDbId) {
      await client.query(
        `UPDATE trades
         SET documents = documents || $1::jsonb
         WHERE id = $2 AND company_id = $3`,
        [JSON.stringify([{ type: 'PURCHASE_ORDER', id: po_no }]), tradeDbId, req.user.company_id]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ po_no, trade_id: tradeCode, id: poDbId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating Process PO:', err.message);
    res.status(500).json({ error: err.message || 'Failed to create Process PO' });
  } finally {
    client.release();
  }
});

module.exports = router;
