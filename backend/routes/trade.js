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
          (SELECT r.rfq_no FROM rfqs r WHERE r.trade_id = t.trade_id LIMIT 1),
          (SELECT rq.received_quotation_no FROM received_quotations rq WHERE rq.trade_id = t.trade_id LIMIT 1),
          (SELECT ro.ro_no FROM release_orders ro WHERE ro.trade_id = t.trade_id LIMIT 1),
          '—'
        ) AS ref_id,
        COALESCE(
          (SELECT r.customer_id FROM rfqs r WHERE r.trade_id = t.trade_id LIMIT 1),
          (SELECT rq.customer_id FROM received_quotations rq WHERE rq.trade_id = t.trade_id LIMIT 1),
          (SELECT ro.customer_id FROM release_orders ro WHERE ro.trade_id = t.trade_id LIMIT 1),
          '—'
        ) AS party_id,
        COALESCE(
          (SELECT b.name FROM rfqs r JOIN buyers b ON r.buyer_id = b.id WHERE r.trade_id = t.trade_id LIMIT 1),
          (SELECT b.name FROM received_quotations rq JOIN buyers b ON rq.buyer_id = b.id WHERE rq.trade_id = t.trade_id LIMIT 1),
          (SELECT b.name FROM release_orders ro JOIN buyers b ON ro.buyer_id = b.id WHERE ro.trade_id = t.trade_id LIMIT 1),
          '—'
        ) AS contact_name,
        (
          SELECT CASE WHEN ordered_qty > 0 THEN ROUND((delivered_qty::numeric / ordered_qty::numeric) * 100, 1) ELSE 0.0 END
          FROM (
            SELECT
              COALESCE(
                (SELECT SUM(poi.quantity) FROM purchase_orders po JOIN purchase_order_items poi ON po.po_no = poi.po_no WHERE po.trade_id = t.trade_id),
                (SELECT SUM(roi.quantity) FROM release_orders ro JOIN release_order_items roi ON ro.ro_no = roi.ro_no WHERE ro.trade_id = t.trade_id),
                0
              ) AS ordered_qty,
              COALESCE(
                (
                  SELECT SUM(
                    dni.quantity - COALESCE((
                      SELECT SUM((elem->>'quantity')::numeric)
                      FROM grns g
                      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(g.rejection_items, '[]'::jsonb)) AS elem
                      WHERE g.delivery_note_no = dn.delivery_note_no
                        AND elem->>'item_code' = dni.item_code
                    ), 0)
                  )
                  FROM delivery_notes dn
                  JOIN delivery_note_items dni ON dn.delivery_note_no = dni.delivery_note_no
                  WHERE dn.trade_id = t.trade_id
                ),
                0
              ) AS delivered_qty
          ) qty_sub
        ) AS delivered_pct
      FROM trades t
    `;
    const conditions = [];
    const params = [];

    if (q) {
      const searchParam = `%${q}%`;
      const idx = params.length + 1;
      conditions.push(`(
        t.trade_id ILIKE $${idx}
        OR EXISTS (SELECT 1 FROM purchase_orders po WHERE po.trade_id = t.trade_id AND po.po_no ILIKE $${idx})
        OR EXISTS (SELECT 1 FROM release_orders ro WHERE ro.trade_id = t.trade_id AND ro.ro_no ILIKE $${idx})
        OR EXISTS (SELECT 1 FROM delivery_notes dn WHERE dn.trade_id = t.trade_id AND dn.delivery_note_no ILIKE $${idx})
        OR EXISTS (SELECT 1 FROM quotations q WHERE q.trade_id = t.trade_id AND q.quotation_no ILIKE $${idx})
        OR EXISTS (SELECT 1 FROM received_quotations rq WHERE rq.trade_id = t.trade_id AND rq.received_quotation_no ILIKE $${idx})
        OR EXISTS (SELECT 1 FROM rfqs r WHERE r.trade_id = t.trade_id AND r.rfq_no ILIKE $${idx})
        OR EXISTS (SELECT 1 FROM invoices inv WHERE inv.trade_id = t.trade_id AND inv.invoice_no ILIKE $${idx})
        OR EXISTS (SELECT 1 FROM grns g WHERE g.trade_id = t.trade_id AND g.grn_no ILIKE $${idx})
        OR EXISTS (SELECT 1 FROM payments pay WHERE pay.trade_id = t.trade_id AND pay.payment_no ILIKE $${idx})
        OR EXISTS (SELECT 1 FROM purchase_order_items poi JOIN purchase_orders po ON poi.po_no = po.po_no WHERE po.trade_id = t.trade_id AND poi.item_code ILIKE $${idx})
        OR EXISTS (SELECT 1 FROM release_order_items roi JOIN release_orders ro ON roi.ro_no = ro.ro_no WHERE ro.trade_id = t.trade_id AND roi.item_code ILIKE $${idx})
        OR EXISTS (SELECT 1 FROM quotation_items qi JOIN quotations q ON qi.quotation_no = q.quotation_no WHERE q.trade_id = t.trade_id AND qi.item_code ILIKE $${idx})
        OR EXISTS (SELECT 1 FROM received_quotation_items rqi JOIN received_quotations rq ON rqi.received_quotation_no = rq.received_quotation_no WHERE rq.trade_id = t.trade_id AND rqi.item_code ILIKE $${idx})
        OR EXISTS (SELECT 1 FROM rfq_items rfqi JOIN rfqs rfq ON rfqi.rfq_no = rfq.rfq_no WHERE rfq.trade_id = t.trade_id AND rfqi.item_code ILIKE $${idx})
        OR EXISTS (SELECT 1 FROM delivery_note_items dni JOIN delivery_notes dn ON dni.delivery_note_no = dn.delivery_note_no WHERE dn.trade_id = t.trade_id AND dni.item_code ILIKE $${idx})
        OR EXISTS (SELECT 1 FROM invoice_items ii JOIN invoices inv ON ii.invoice_no = inv.invoice_no WHERE inv.trade_id = t.trade_id AND ii.item_code ILIKE $${idx})
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
    const result = await pool.query('SELECT trade_id, documents, status, trade_type, created_at FROM trades WHERE trade_id = $1', [trade_id]);
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
    // Upsert the status into the status table so it's saved for future use
    await pool.query(
      `INSERT INTO status (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`,
      [newStatus]
    );
    // Update the trade
    const result = await pool.query(
      'UPDATE trades SET status = $1 WHERE trade_id = $2 RETURNING trade_id, status',
      [newStatus, trade_id]
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

