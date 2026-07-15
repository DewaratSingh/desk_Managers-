const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Get trades (optional pagination & optional search/filtering)
router.get('/', async (req, res) => {
  const { q, status, trade_type } = req.query || {};
  const limit = req.query.limit ? parseInt(req.query.limit) : null;
  const offset = req.query.offset ? parseInt(req.query.offset) : 0;

  try {
    let query = `
      SELECT t.trade_id, t.status, t.trade_type, t.created_at, t.documents,
        COALESCE(
          (SELECT r.rfq_no FROM rfqs r WHERE r.trade_id = t.id AND r.company_id = t.company_id LIMIT 1),
          (SELECT rq.received_quotation_no FROM received_quotations rq WHERE rq.trade_id = t.id AND rq.company_id = t.company_id LIMIT 1),
          (SELECT ro.ro_no FROM release_orders ro WHERE ro.trade_id = t.id AND ro.company_id = t.company_id LIMIT 1),
          '—'
        ) AS ref_id,
        COALESCE(
          (SELECT c.customer_code FROM rfqs r JOIN customers c ON r.customer_id = c.id WHERE r.trade_id = t.id AND r.company_id = t.company_id LIMIT 1),
          (SELECT c.customer_code FROM received_quotations rq JOIN customers c ON rq.customer_id = c.id WHERE rq.trade_id = t.id AND rq.company_id = t.company_id LIMIT 1),
          (SELECT c.customer_code FROM release_orders ro JOIN customers c ON ro.customer_id = c.id WHERE ro.trade_id = t.id AND ro.company_id = t.company_id LIMIT 1),
          '—'
        ) AS party_id,
        COALESCE(
          (SELECT b.name FROM rfqs r JOIN buyers b ON r.buyer_id = b.id WHERE r.trade_id = t.id AND r.company_id = t.company_id LIMIT 1),
          (SELECT b.name FROM received_quotations rq JOIN buyers b ON rq.buyer_id = b.id WHERE rq.trade_id = t.id AND rq.company_id = t.company_id LIMIT 1),
          (SELECT b.name FROM release_orders ro JOIN buyers b ON ro.buyer_id = b.id WHERE ro.trade_id = t.id AND ro.company_id = t.company_id LIMIT 1),
          '—'
        ) AS contact_name,
        (
          SELECT CASE WHEN ordered_qty > 0 THEN ROUND((delivered_qty::numeric / ordered_qty::numeric) * 100, 1) ELSE 0.0 END
          FROM (
            SELECT
              COALESCE(
                (SELECT SUM(poi.quantity) FROM purchase_orders po JOIN purchase_order_items poi ON po.id = poi.po_id WHERE po.trade_id = t.id AND po.company_id = t.company_id),
                (SELECT SUM(roi.quantity) FROM release_orders ro JOIN release_order_items roi ON ro.id = roi.ro_id WHERE ro.trade_id = t.id AND ro.company_id = t.company_id),
                0
              ) AS ordered_qty,
              COALESCE(
                (
                  SELECT SUM(
                    dni.quantity - COALESCE((
                      SELECT SUM((elem->>'quantity')::numeric)
                      FROM grns g
                      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(g.rejection_items, '[]'::jsonb)) AS elem
                      WHERE g.delivery_note_id = dn.id
                        AND elem->>'item_code' = i.item_code
                        AND g.company_id = dn.company_id
                    ), 0)
                  )
                  FROM delivery_notes dn
                  JOIN delivery_note_items dni ON dn.id = dni.delivery_note_id
                  JOIN items i ON dni.item_id = i.id
                  WHERE dn.trade_id = t.id AND dn.company_id = t.company_id
                ),
                0
              ) AS delivered_qty
          ) qty_sub
        ) AS delivered_pct
      FROM trades t
    `;
    const conditions = ['t.company_id = $1'];
    const params = [req.user.company_id];

    if (q) {
      const searchParam = `%${q}%`;
      const idx = params.length + 1;
      conditions.push(`(
        t.trade_id ILIKE $${idx}
        OR EXISTS (SELECT 1 FROM purchase_orders po WHERE po.trade_id = t.id AND po.company_id = t.company_id AND po.po_no ILIKE $${idx})
        OR EXISTS (SELECT 1 FROM release_orders ro WHERE ro.trade_id = t.id AND ro.company_id = t.company_id AND ro.ro_no ILIKE $${idx})
        OR EXISTS (SELECT 1 FROM delivery_notes dn WHERE dn.trade_id = t.id AND dn.company_id = t.company_id AND dn.delivery_note_no ILIKE $${idx})
        OR EXISTS (SELECT 1 FROM quotations q WHERE q.trade_id = t.id AND q.company_id = t.company_id AND q.quotation_no ILIKE $${idx})
        OR EXISTS (SELECT 1 FROM received_quotations rq WHERE rq.trade_id = t.id AND rq.company_id = t.company_id AND rq.received_quotation_no ILIKE $${idx})
        OR EXISTS (SELECT 1 FROM rfqs r WHERE r.trade_id = t.id AND r.company_id = t.company_id AND r.rfq_no ILIKE $${idx})
        OR EXISTS (SELECT 1 FROM invoices inv WHERE inv.trade_id = t.id AND inv.company_id = t.company_id AND inv.invoice_no ILIKE $${idx})
        OR EXISTS (SELECT 1 FROM grns g WHERE g.trade_id = t.id AND g.company_id = t.company_id AND g.grn_no ILIKE $${idx})
        OR EXISTS (SELECT 1 FROM payments pay WHERE pay.trade_id = t.id AND pay.company_id = t.company_id AND pay.payment_no ILIKE $${idx})
      )`);
      params.push(searchParam);
    }

    if (status) {
      const idx = params.length + 1;
      conditions.push(`LOWER(t.status) = LOWER($${idx})`);
      params.push(status.trim());
    }

    if (trade_type) {
      const idx = params.length + 1;
      conditions.push(`LOWER(t.trade_type) = LOWER($${idx})`);
      params.push(trade_type.trim());
    }

    if (conditions.length > 0) {
      query += ` WHERE ` + conditions.join(' AND ');
    }

    query += ` ORDER BY t.created_at DESC`;

    if (limit !== null) {
      const limitParamIdx = params.length + 1;
      const offsetParamIdx = params.length + 2;
      query += ` LIMIT $${limitParamIdx} OFFSET $${offsetParamIdx}`;
      params.push(limit, offset);
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching trades:', err.message);
    res.status(500).json({ error: 'Failed to fetch trades' });
  }
});

// Get a single trade by trade_id
router.get('/:trade_id', async (req, res) => {
  const { trade_id } = req.params;
  try {
    const result = await pool.query('SELECT trade_id, documents, status, trade_type, created_at FROM trades WHERE trade_id = $1 AND company_id = $2', [trade_id, req.user.company_id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Trade not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching trade:', err.message);
    res.status(500).json({ error: 'Failed to fetch trade' });
  }
});

// PATCH trade status
router.patch('/:trade_id/status', async (req, res) => {
  const { trade_id } = req.params;
  const { status } = req.body || {};
  if (!status || !status.trim()) {
    return res.status(400).json({ error: 'status is required' });
  }
  const newStatus = status.trim().toLowerCase();
  try {
    // Upsert the status into the status table
    await pool.query(
      `INSERT INTO status (name, company_id) VALUES ($1, $2) ON CONFLICT (name, company_id) DO NOTHING`,
      [newStatus, req.user.company_id]
    );
    // Update the trade
    const result = await pool.query(
      'UPDATE trades SET status = $1 WHERE trade_id = $2 AND company_id = $3 RETURNING trade_id, status',
      [newStatus, trade_id, req.user.company_id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Trade not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating trade status:', err.message);
    res.status(500).json({ error: 'Failed to update trade status' });
  }
});

module.exports = router;
