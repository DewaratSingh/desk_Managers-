const express = require('express');
const router = express.Router();
const { pool, appendDocToTrade } = require('../db');

// ─── GET a single GRN by grn_no ───────────────────────────────────────────────
router.get('/:grn_no', async (req, res) => {
  const { grn_no } = req.params;
  try {
    const result = await pool.query(
      `SELECT grn_no, delivery_note_no, trade_id, grn_date, has_rejection, rejection_items, created_at
       FROM grns WHERE grn_no = $1`,
      [grn_no]
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

// ─── GET items from a Delivery Note for GRN (with item descriptions) ───────────
router.get('/items-lookup/:delivery_note_no', async (req, res) => {
  const { delivery_note_no } = req.params;
  try {
    const result = await pool.query(
      `SELECT
         dni.item_code,
         dni.quantity,
         dni.rate_per_piece,
         i.description,
         i.drawing_number
       FROM delivery_note_items dni
       LEFT JOIN items i ON dni.item_code = i.item_code
       WHERE dni.delivery_note_no = $1
       ORDER BY dni.id`,
      [delivery_note_no]
    );
    res.json({ items: result.rows });
  } catch (err) {
    console.error('Error fetching GRN items lookup:', err.message);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

// ─── CREATE a GRN ─────────────────────────────────────────────────────────────
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
    const dup = await client.query('SELECT grn_no FROM grns WHERE grn_no = $1', [grn_no]);
    if (dup.rows.length > 0) {
      throw new Error('GRN number already exists');
    }

    // 2. Verify delivery note exists
    const dnCheck = await client.query('SELECT delivery_note_no FROM delivery_notes WHERE delivery_note_no = $1', [delivery_note_no]);
    if (dnCheck.rows.length === 0) {
      throw new Error('Delivery Note not found');
    }

    // 3. Insert GRN
    await client.query(
      `INSERT INTO grns (grn_no, delivery_note_no, trade_id, grn_date, has_rejection, rejection_items)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        grn_no,
        delivery_note_no,
        trade_id,
        grn_date,
        has_rejection || false,
        JSON.stringify(rejection_items || [])
      ]
    );

    // 4. Append to trade documents
    await appendDocToTrade(client, trade_id, 'GRN', grn_no);

    // Update trade delivery status based on delivered %
    await updateTradeDeliveryStatus(client, trade_id);

    await client.query('COMMIT');
    res.status(201).json({ grn_no, trade_id });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating GRN:', err.message);
    res.status(500).json({ error: err.message || 'Failed to create GRN' });
  } finally {
    client.release();
  }
});

// ─── UPDATE an existing GRN ───────────────────────────────────────────────────
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
       WHERE grn_no = $4 RETURNING *`,
      [grn_date, has_rejection || false, JSON.stringify(rejection_items || []), grn_no]
    );

    if (result.rows.length === 0) {
      throw new Error('GRN not found');
    }

    // Update trade delivery status based on delivered %
    await updateTradeDeliveryStatus(client, result.rows[0].trade_id);

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

async function updateTradeDeliveryStatus(client, trade_id) {
  if (!trade_id) return;

  const pctRes = await client.query(`
    SELECT 
      CASE WHEN ordered_val > 0 THEN (delivered_val / ordered_val) * 100 ELSE 0.0 END AS pct
    FROM (
      SELECT
        COALESCE(
          (SELECT SUM(poi.quantity * poi.unit_price) FROM purchase_orders po JOIN purchase_order_items poi ON po.po_no = poi.po_no WHERE po.trade_id = $1),
          (SELECT SUM(roi.quantity * roi.unit_price) FROM release_orders ro JOIN release_order_items roi ON ro.ro_no = roi.ro_no WHERE ro.trade_id = $1),
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
                  WHERE g.delivery_note_no = dn.delivery_note_no
                    AND elem->>'item_code' = dni.item_code
                ), 0)
              ) * poi.unit_price
            )
            FROM delivery_notes dn
            JOIN delivery_note_items dni ON dn.delivery_note_no = dni.delivery_note_no
            JOIN purchase_order_items poi ON dn.po_no = poi.po_no AND dni.item_code = poi.item_code
            WHERE dn.trade_id = $1
          ),
          (
            SELECT SUM(
              (
                dni.quantity - COALESCE((
                  SELECT SUM((elem->>'quantity')::numeric)
                  FROM grns g
                  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(g.rejection_items, '[]'::jsonb)) AS elem
                  WHERE g.delivery_note_no = dn.delivery_note_no
                    AND elem->>'item_code' = dni.item_code
                ), 0)
              ) * roi.unit_price
            )
            FROM delivery_notes dn
            JOIN delivery_note_items dni ON dn.delivery_note_no = dni.delivery_note_no
            JOIN release_order_items roi ON dn.ro_no = roi.ro_no AND dni.item_code = roi.item_code
            WHERE dn.trade_id = $1
          ),
          0
        )::numeric AS delivered_val
    ) val_sub
  `, [trade_id]);

  const pct = pctRes.rows.length > 0 ? parseFloat(pctRes.rows[0].pct) : 0;
  
  let statusName = 'ordered';
  if (pct >= 99.9) {
    statusName = 'delivered';
  } else if (pct > 0) {
    statusName = 'partially delivered';
  }

  await client.query(
    "INSERT INTO status (name) VALUES ($1) ON CONFLICT (name) DO NOTHING",
    [statusName]
  );
  await client.query(
    "UPDATE trades SET status = $1 WHERE trade_id = $2",
    [statusName, trade_id]
  );
}

module.exports = router;
