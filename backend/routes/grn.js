const express = require('express');
const router = express.Router();
const { pool, appendDocToTrade } = require('../db');

// GET a single GRN by grn_no
router.get('/:grn_no', async (req, res) => {
  const { grn_no } = req.params;
  try {
    const result = await pool.query(
      `SELECT g.grn_no, dn.delivery_note_no, t.trade_id, g.grn_date, g.has_rejection, g.rejection_items, g.created_at
       FROM grns g
       LEFT JOIN delivery_notes dn ON g.delivery_note_id = dn.id
       LEFT JOIN trades t ON g.trade_id = t.id
       WHERE g.grn_no = $1 AND g.company_id = $2`,
      [grn_no, req.user.company_id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'GRN not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching GRN:', err.message);
    res.status(500).json({ error: 'Failed to fetch GRN' });
  }
});

// GET items from a Delivery Note for GRN (with item descriptions)
router.get('/items-lookup/:delivery_note_no', async (req, res) => {
  const { delivery_note_no } = req.params;
  try {
    const dnRes = await pool.query('SELECT id FROM delivery_notes WHERE delivery_note_no = $1 AND company_id = $2', [delivery_note_no, req.user.company_id]);
    if (dnRes.rows.length === 0) {
      return res.status(404).json({ error: 'Delivery Note not found' });
    }
    const dnDbId = dnRes.rows[0].id;

    const result = await pool.query(
      `SELECT
         i.item_code,
         dni.quantity,
         dni.rate_per_piece,
         i.description,
         i.drawing_number
       FROM delivery_note_items dni
       LEFT JOIN items i ON dni.item_id = i.id AND i.company_id = dni.company_id
       WHERE dni.delivery_note_id = $1 AND dni.company_id = $2
       ORDER BY dni.id`,
      [dnDbId, req.user.company_id]
    );
    res.json({ items: result.rows });
  } catch (err) {
    console.error('Error fetching GRN items lookup:', err.message);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

// CREATE a GRN
router.post('/', async (req, res) => {
  const {
    grn_no,
    delivery_note_no,
    trade_id,
    grn_date,
    has_rejection,
    rejection_items
  } = req.body || {};

  if (!grn_no || !delivery_note_no || !trade_id || !grn_date) {
    return res.status(400).json({ error: 'Missing required GRN fields: grn_no, delivery_note_no, trade_id, grn_date' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Check duplicate
    const dup = await client.query('SELECT grn_no FROM grns WHERE grn_no = $1 AND company_id = $2', [grn_no, req.user.company_id]);
    if (dup.rows.length > 0) {
      throw new Error('GRN number already exists');
    }

    // 2. Verify delivery note exists
    const dnCheck = await client.query('SELECT id, trade_id FROM delivery_notes WHERE delivery_note_no = $1 AND company_id = $2', [delivery_note_no, req.user.company_id]);
    if (dnCheck.rows.length === 0) {
      throw new Error('Delivery Note not found');
    }
    const dnDbId = dnCheck.rows[0].id;
    const tradeDbId = dnCheck.rows[0].trade_id;

    // Get trade code string
    const tradeRes = await client.query('SELECT trade_id FROM trades WHERE id = $1 AND company_id = $2', [tradeDbId, req.user.company_id]);
    if (tradeRes.rows.length === 0) {
      throw new Error('Trade not found');
    }
    const trade_code = tradeRes.rows[0].trade_id;

    // 3. Insert GRN
    await client.query(
      `INSERT INTO grns (grn_no, delivery_note_id, trade_id, grn_date, has_rejection, rejection_items, company_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        grn_no,
        dnDbId,
        tradeDbId,
        grn_date,
        has_rejection || false,
        JSON.stringify(rejection_items || []),
        req.user.company_id
      ]
    );

    // 4. Append to trade documents
    await appendDocToTrade(client, trade_code, 'GRN', grn_no, req.user.company_id);

    // Update trade delivery status
    await updateTradeDeliveryStatus(client, tradeDbId, req.user.company_id);

    await client.query('COMMIT');
    res.status(201).json({ grn_no, trade_id: trade_code });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating GRN:', err.message);
    res.status(500).json({ error: err.message || 'Failed to create GRN' });
  } finally {
    client.release();
  }
});

// UPDATE an existing GRN
router.put('/:grn_no', async (req, res) => {
  const { grn_no } = req.params;
  const { grn_date, has_rejection, rejection_items } = req.body || {};

  if (!grn_date) {
    return res.status(400).json({ error: 'grn_date is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `UPDATE grns
       SET grn_date = $1, has_rejection = $2, rejection_items = $3
       WHERE grn_no = $4 AND company_id = $5 RETURNING trade_id`,
      [grn_date, has_rejection || false, JSON.stringify(rejection_items || []), grn_no, req.user.company_id]
    );

    if (result.rows.length === 0) {
      throw new Error('GRN not found');
    }
    const tradeDbId = result.rows[0].trade_id;

    // Update trade delivery status
    await updateTradeDeliveryStatus(client, tradeDbId, req.user.company_id);

    await client.query('COMMIT');
    res.json({ grn_no });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating GRN:', err.message);
    res.status(500).json({ error: err.message || 'Failed to update GRN' });
  } finally {
    client.release();
  }
});

async function updateTradeDeliveryStatus(client, trade_id, company_id) {
  if (!trade_id) return;

  const pctRes = await client.query(`
    SELECT 
      CASE WHEN ordered_val > 0 THEN (delivered_val / ordered_val) * 100 ELSE 0.0 END AS pct
    FROM (
      SELECT
        COALESCE(
          (SELECT SUM(poi.quantity * poi.unit_price) FROM purchase_orders po JOIN purchase_order_items poi ON po.id = poi.po_id WHERE po.trade_id = $1 AND po.company_id = $2),
          (SELECT SUM(roi.quantity * roi.unit_price) FROM release_orders ro JOIN release_order_items roi ON ro.id = roi.ro_id WHERE ro.trade_id = $1 AND ro.company_id = $2),
          0
        )::numeric AS ordered_val,
        COALESCE(
          (
            SELECT SUM(
              (
                dni.quantity - COALESCE((
                  SELECT SUM((elem->>'quantity')::numeric)
                  FROM grns g
                  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(g.rejection_items, '[]'::jsonb)) AS elem
                  WHERE g.delivery_note_id = dn.id
                    AND elem->>'item_code' = i.item_code
                    AND g.company_id = $2
                ), 0)
              ) * poi.unit_price
            )
            FROM delivery_notes dn
            JOIN delivery_note_items dni ON dn.id = dni.delivery_note_id
            JOIN purchase_order_items poi ON dn.po_id = poi.po_id AND dni.item_id = poi.item_id
            JOIN items i ON dni.item_id = i.id
            WHERE dn.trade_id = $1 AND dn.company_id = $2
          ),
          (
            SELECT SUM(
              (
                dni.quantity - COALESCE((
                  SELECT SUM((elem->>'quantity')::numeric)
                  FROM grns g
                  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(g.rejection_items, '[]'::jsonb)) AS elem
                  WHERE g.delivery_note_id = dn.id
                    AND elem->>'item_code' = i.item_code
                    AND g.company_id = $2
                ), 0)
              ) * roi.unit_price
            )
            FROM delivery_notes dn
            JOIN delivery_note_items dni ON dn.id = dni.delivery_note_id
            JOIN release_order_items roi ON dn.ro_id = roi.ro_id AND dni.item_id = roi.item_id
            JOIN items i ON dni.item_id = i.id
            WHERE dn.trade_id = $1 AND dn.company_id = $2
          ),
          0
        )::numeric AS delivered_val
    ) val_sub
  `, [trade_id, company_id]);

  const pct = pctRes.rows.length > 0 ? parseFloat(pctRes.rows[0].pct) : 0;
  
  let statusName = 'ordered';
  if (pct >= 99.9) {
    statusName = 'delivered';
  } else if (pct > 0) {
    statusName = 'partially delivered';
  }

  await client.query(
    "INSERT INTO status (name, company_id) VALUES ($1, $2) ON CONFLICT (name, company_id) DO NOTHING",
    [statusName, company_id]
  );
  await client.query(
    "UPDATE trades SET status = $1 WHERE id = $2 AND company_id = $3",
    [statusName, trade_id, company_id]
  );
}

module.exports = router;
