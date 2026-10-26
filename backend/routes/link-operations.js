const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Helper to calculate job delivery status
function getJobStatusInfo(job) {
  const rawStat = job.status || job.job_status || 'pending';
  const stat = rawStat.toLowerCase();
  let pct = (stat === 'completed' || stat === 'done') ? 100 : 0;

  // Format real status: e.g. 'in_progress' -> 'In Progress'
  const displayStatus = rawStat.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  return { status: displayStatus, pct };
}

// 1. GET /api/link-operations/available - Get available Trades and Manufacture Jobs for linking
router.get('/available', async (req, res) => {
  try {
    const companyId = req.user.company_id;

    // Fetch active/recent trades
    const tradesRes = await pool.query(`
      SELECT id, trade_id, status, COALESCE(delivery_percentage, 0) AS delivery_percentage, trade_type, created_at,
        COALESCE(
          (SELECT pti.process_name FROM process_ro_target_item pti JOIN process_ro pro ON pti.process_ro_id = pro.id WHERE (pro.trade_id = trades.id OR pro.trade_id::text = trades.trade_id) AND pti.process_name IS NOT NULL AND pti.process_name != '' LIMIT 1),
          (SELECT pti.process_name FROM process_po_target_item pti JOIN process_po ppo ON pti.process_po_id = ppo.id WHERE (ppo.trade_id = trades.id OR ppo.trade_id::text = trades.trade_id) AND pti.process_name IS NOT NULL AND pti.process_name != '' LIMIT 1),
          (SELECT prfq.process_name FROM process_received_rfqs prfq WHERE (prfq.trade_id = trades.id OR prfq.trade_id::text = trades.trade_id) AND prfq.process_name IS NOT NULL AND prfq.process_name != '' LIMIT 1)
        ) AS process_name
      FROM trades
      WHERE company_id = $1
      ORDER BY created_at DESC
      LIMIT 100
    `, [companyId]);

    // Fetch active/recent manufacture jobs
    const jobsRes = await pool.query(`
      SELECT j.id, j.process_name, j.date_of_start, j.date_of_end, j.message,
             COALESCE(m.status, 'pending') AS status,
             COALESCE(
               (SELECT ti.items FROM target_item ti WHERE ti.job_id = j.id AND ti.company_id = j.company_id LIMIT 1),
               '[]'::jsonb
             ) AS target_items
      FROM job j
      LEFT JOIN manufacture m ON m.job_id = j.id AND m.company_id = j.company_id
      WHERE j.company_id = $1
      ORDER BY j.created_at DESC
      LIMIT 100
    `, [companyId]);

    const jobs = jobsRes.rows.map(job => {
      const jInfo = getJobStatusInfo(job);
      return {
        id: job.id,
        process_name: job.process_name || `Job #${job.id}`,
        status: jInfo.status,
        date_of_start: job.date_of_start,
        delivery_pct: jInfo.pct
      };
    });

    res.json({
      trades: tradesRes.rows,
      jobs
    });
  } catch (err) {
    console.error('Error fetching available operations:', err.message);
    res.status(500).json({ error: 'Failed to fetch available operations' });
  }
});

// Helper: Query linked operations for a specific item
async function queryItemLinks(itemType, itemId, companyId) {
  const isPO = itemType.toLowerCase() === 'po';
  const result = await pool.query(`
    SELECT lo.id, lo.operation_type, lo.trade_id, lo.trade_ref, lo.job_id, lo.job_ref, lo.created_at,
           t.trade_id AS trade_code,
           t.status AS trade_status,
           t.trade_type AS trade_type,
           COALESCE(t.delivery_percentage, 0) AS trade_delivery_percentage,
           COALESCE(
             (SELECT pti.process_name FROM process_ro_target_item pti JOIN process_ro pro ON pti.process_ro_id = pro.id WHERE (pro.trade_id = t.id OR pro.trade_id::text = t.trade_id) AND pti.process_name IS NOT NULL AND pti.process_name != '' LIMIT 1),
             (SELECT pti.process_name FROM process_po_target_item pti JOIN process_po ppo ON pti.process_po_id = ppo.id WHERE (ppo.trade_id = t.id OR ppo.trade_id::text = t.trade_id) AND pti.process_name IS NOT NULL AND pti.process_name != '' LIMIT 1),
             (SELECT prfq.process_name FROM process_received_rfqs prfq WHERE (prfq.trade_id = t.id OR prfq.trade_id::text = t.trade_id) AND prfq.process_name IS NOT NULL AND prfq.process_name != '' LIMIT 1)
           ) AS trade_process_name,
           j.process_name AS job_name,
           COALESCE(m.status, 'pending') AS job_status,
           COALESCE(
             (SELECT ti.items FROM target_item ti WHERE ti.job_id = j.id AND ti.company_id = lo.company_id LIMIT 1),
             '[]'::jsonb
           ) AS target_items
    FROM link_operations lo
    LEFT JOIN trades t ON (lo.trade_id = t.id OR lo.trade_ref = t.trade_id) AND t.company_id = lo.company_id
    LEFT JOIN job j ON lo.job_id = j.id AND j.company_id = lo.company_id
    LEFT JOIN manufacture m ON m.job_id = j.id AND m.company_id = lo.company_id
    WHERE (
      ($1 = true AND lo.po_item_id = $2) OR
      ($1 = false AND lo.ro_item_id = $2)
    )
    AND lo.company_id = $3
    ORDER BY lo.created_at ASC
  `, [isPO, itemId, companyId]);

  return result.rows.map(row => {
    let displayRef = '';
    let liveStatus = 'Pending';
    let progressPct = 0;

    if (row.operation_type === 'TRADE') {
      displayRef = row.trade_code || row.trade_ref || (row.trade_id ? `Trade #${row.trade_id}` : 'Trade');
      progressPct = parseFloat(row.trade_delivery_percentage) || 0;
      const tStat = (row.trade_status || 'ordered').toLowerCase();
      if (progressPct >= 100 || tStat === 'delivered' || tStat === 'completed') {
        liveStatus = 'Delivered';
        progressPct = 100;
      } else if (progressPct > 0 || tStat.includes('partial')) {
        liveStatus = `Delivery ${progressPct}%`;
      } else {
        liveStatus = row.trade_status || 'Ordered';
      }
    } else {
      displayRef = row.job_name || row.job_ref || (row.job_id ? `Job #${row.job_id}` : 'Manufacture');
      const jInfo = getJobStatusInfo(row);
      liveStatus = jInfo.status;
      progressPct = jInfo.pct;
    }

    return {
      id: row.id,
      operation_type: row.operation_type,
      trade_id: row.trade_id,
      trade_ref: row.trade_code || row.trade_ref,
      trade_type: row.trade_type,
      trade_process_name: row.trade_process_name,
      job_id: row.job_id,
      job_ref: row.job_name || row.job_ref,
      display_ref: displayRef,
      live_status: liveStatus,
      progress_pct: progressPct,
      created_at: row.created_at
    };
  });
}

// 2. GET /api/link-operations/items/:type/:itemId - Get linked operations for an item
router.get('/items/:type/:itemId', async (req, res) => {
  const { type, itemId } = req.params;
  try {
    const links = await queryItemLinks(type, itemId, req.user.company_id);
    res.json(links);
  } catch (err) {
    console.error('Error fetching item links:', err.message);
    res.status(500).json({ error: 'Failed to fetch linked operations' });
  }
});

// 3. POST /api/link-operations/sync - Synchronize/Replace linked operations for an item
router.post('/sync', async (req, res) => {
  const { itemType, itemId, operations } = req.body;
  if (!itemType || !itemId || !Array.isArray(operations)) {
    return res.status(400).json({ error: 'itemType, itemId, and operations array are required' });
  }

  const companyId = req.user.company_id;
  const isPO = itemType.toLowerCase() === 'po';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get parent order ID for reference
    let poId = null;
    let roId = null;
    if (isPO) {
      const poItem = await client.query('SELECT po_id FROM purchase_order_items WHERE id = $1 AND company_id = $2', [itemId, companyId]);
      if (poItem.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Purchase order item not found' });
      }
      poId = poItem.rows[0].po_id;
    } else {
      const roItem = await client.query('SELECT ro_id FROM release_order_items WHERE id = $1 AND company_id = $2', [itemId, companyId]);
      if (roItem.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Release order item not found' });
      }
      roId = roItem.rows[0].ro_id;
    }

    // Remove old links for this item
    if (isPO) {
      await client.query('DELETE FROM link_operations WHERE po_item_id = $1 AND company_id = $2', [itemId, companyId]);
    } else {
      await client.query('DELETE FROM link_operations WHERE ro_item_id = $1 AND company_id = $2', [itemId, companyId]);
    }

    // Insert new links
    for (const op of operations) {
      const opType = (op.operation_type || op.type || '').toUpperCase();
      if (opType !== 'TRADE' && opType !== 'MANUFACTURE') continue;

      let tradeDbId = null;
      let tradeRef = op.trade_ref || null;
      let jobDbId = null;
      let jobRef = op.job_ref || null;

      if (opType === 'TRADE') {
        const tradeVal = op.trade_id || op.trade_ref;
        if (tradeVal) {
          const tRes = await client.query(
            'SELECT id, trade_id FROM trades WHERE (trade_id = $1 OR id = $2) AND company_id = $3 LIMIT 1',
            [String(tradeVal), parseInt(tradeVal) || -1, companyId]
          );
          if (tRes.rows.length > 0) {
            tradeDbId = tRes.rows[0].id;
            tradeRef = tRes.rows[0].trade_id;
          } else {
            tradeRef = String(tradeVal);
          }
        }
      } else if (opType === 'MANUFACTURE') {
        const jobVal = op.job_id || op.id;
        if (jobVal) {
          const jRes = await client.query(
            'SELECT id, process_name FROM job WHERE id = $1 AND company_id = $2 LIMIT 1',
            [parseInt(jobVal) || -1, companyId]
          );
          if (jRes.rows.length > 0) {
            jobDbId = jRes.rows[0].id;
            jobRef = jRes.rows[0].process_name || `Job #${jRes.rows[0].id}`;
          } else {
            jobDbId = parseInt(jobVal) || null;
            jobRef = op.job_ref || `Job #${jobVal}`;
          }
        }
      }

      await client.query(`
        INSERT INTO link_operations (
          po_item_id, ro_item_id, po_id, ro_id, operation_type,
          trade_id, trade_ref, job_id, job_ref, company_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        isPO ? itemId : null,
        !isPO ? itemId : null,
        poId,
        roId,
        opType,
        tradeDbId,
        tradeRef,
        jobDbId,
        jobRef,
        companyId
      ]);
    }

    await client.query('COMMIT');

    const updatedLinks = await queryItemLinks(itemType, itemId, companyId);
    res.json(updatedLinks);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error syncing linked operations:', err.message);
    res.status(500).json({ error: 'Failed to sync linked operations' });
  } finally {
    client.release();
  }
});

// 4. DELETE /api/link-operations/:id - Delete a link
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM link_operations WHERE id = $1 AND company_id = $2 RETURNING *',
      [id, req.user.company_id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Link operation not found' });
    }
    res.json({ success: true, deleted: result.rows[0] });
  } catch (err) {
    console.error('Error deleting link operation:', err.message);
    res.status(500).json({ error: 'Failed to delete link operation' });
  }
});

module.exports = router;
