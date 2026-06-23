const express = require('express');
const router = express.Router();
const { pool, appendDocToTrade } = require('../db');

// List all ROs
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        ro.ro_no, ro.contract_ref, ro.ro_date, ro.delivery_date,
        ro.gst, ro.transport, ro.other, ro.basic_value, ro.packing_forward,
        ro.trade_id, ro.buyer_id, ro.customer_id AS party_id, ro.created_at,
        b.name as buyer_name, b.email as buyer_email, b.phone as buyer_phone,
        c.name as customer_name, c.address as customer_address,
        t.status AS trade_status,
        (
          SELECT COALESCE(json_agg(json_build_object(
            'item_code', roi.item_code,
            'quantity', roi.quantity,
            'unit_price', roi.unit_price,
            'gst_rate', roi.gst_rate,
            'gst_type', roi.gst_type,
            'shipping_address', roi.shipping_address,
            'delivery_date', roi.delivery_date,
            'status', roi.status,
            'vendor', roi.vendor,
            'delivered_qty', COALESCE((
              SELECT SUM(dni.quantity)
              FROM delivery_note_items dni
              JOIN delivery_notes dn ON dni.delivery_note_no = dn.delivery_note_no
              WHERE dn.ro_no = ro.ro_no
                AND dni.item_code = roi.item_code
            ), 0) - COALESCE((
              SELECT SUM((elem->>'quantity')::numeric)
              FROM grns g
              CROSS JOIN LATERAL jsonb_array_elements(COALESCE(g.rejection_items, '[]'::jsonb)) AS elem
              WHERE g.delivery_note_no IN (
                SELECT delivery_note_no FROM delivery_notes WHERE ro_no = ro.ro_no
              )
              AND elem->>'item_code' = roi.item_code
            ), 0)
          )), '[]')
          FROM release_order_items roi
          WHERE roi.ro_no = ro.ro_no
        ) as items
      FROM release_orders ro
      LEFT JOIN buyers b ON ro.buyer_id = b.id
      LEFT JOIN customers c ON ro.customer_id = c.id
      LEFT JOIN trades t ON ro.trade_id = t.trade_id
      ORDER BY ro.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error listing ROs:', err.message);
    res.status(500).json({ error: 'Failed to list release orders' });
  }
});

// Get next RO reference number
router.get('/next-no', async (req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(*) FROM release_orders');
    const count = parseInt(result.rows[0].count) || 0;
    const nextNo = `RO-${String(count + 1).padStart(4, '0')}`;
    res.json({ nextNo });
  } catch (err) {
    console.error('Error fetching next RO no:', err.message);
    res.status(500).json({ error: 'Failed to generate next RO number' });
  }
});

// Get a single RO
router.get('/:ro_no', async (req, res) => {
  const { ro_no } = req.params;
  try {
    const result = await pool.query(`
      SELECT
        ro.ro_no, ro.contract_ref, ro.ro_date, ro.delivery_date,
        ro.gst, ro.transport, ro.other, ro.basic_value, ro.packing_forward,
        ro.trade_id, ro.buyer_id, ro.customer_id,
        b.name as buyer_name, b.email as buyer_email, b.phone as buyer_phone,
        c.name as customer_name, c.address as customer_address,
        (
          SELECT COALESCE(json_agg(json_build_object(
            'item_code', roi.item_code,
            'quantity', roi.quantity,
            'unit_price', roi.unit_price,
            'gst_type', roi.gst_type,
            'gst_rate', roi.gst_rate,
            'shipping_address', roi.shipping_address,
            'delivery_date', roi.delivery_date,
            'status', roi.status,
            'vendor', roi.vendor,
            'description', i.description,
            'drawing_number', i.drawing_number,
            'delivered_qty', COALESCE((
              SELECT SUM(dni.quantity)
              FROM delivery_note_items dni
              JOIN delivery_notes dn ON dni.delivery_note_no = dn.delivery_note_no
              WHERE dn.ro_no = ro.ro_no
                AND dni.item_code = roi.item_code
            ), 0) - COALESCE((
              SELECT SUM((elem->>'quantity')::numeric)
              FROM grns g
              CROSS JOIN LATERAL jsonb_array_elements(COALESCE(g.rejection_items, '[]'::jsonb)) AS elem
              WHERE g.delivery_note_no IN (
                SELECT delivery_note_no FROM delivery_notes WHERE ro_no = ro.ro_no
              )
              AND elem->>'item_code' = roi.item_code
            ), 0)
          ) ORDER BY roi.id), '[]')
          FROM release_order_items roi
          LEFT JOIN items i ON roi.item_code = i.item_code
          WHERE roi.ro_no = ro.ro_no
        ) as items
      FROM release_orders ro
      LEFT JOIN buyers b ON ro.buyer_id = b.id
      LEFT JOIN customers c ON ro.customer_id = c.id
      WHERE ro.ro_no = $1
    `, [ro_no]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Release Order not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching RO:', err.message);
    res.status(500).json({ error: 'Failed to fetch release order' });
  }
});

// Create a RO
router.post('/', async (req, res) => {
  const {
    ro_no, contract_ref, ro_date, delivery_date,
    buyer_id, customer_id, trade_id: req_trade_id,
    transport, other, basic_value, packing_forward, items
  } = req.body || {};

  if (!ro_date) {
    return res.status(400).json({ error: 'ro_date is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check duplicate
    const dupCheck = await client.query('SELECT ro_no FROM release_orders WHERE ro_no = $1', [ro_no]);
    if (dupCheck.rows.length > 0) throw new Error('Release Order number already exists');

    // Resolve or generate trade_id
    let trade_id = req_trade_id || null;
    if (!trade_id) {
      trade_id = 'TRD-' + ro_no.replace(/\s+/g, '-');
      // Check duplicate trade_id
      const tradeDupCheck = await client.query('SELECT trade_id FROM trades WHERE trade_id = $1', [trade_id]);
      if (tradeDupCheck.rows.length > 0) {
        throw new Error('Trade ID already exists for this Release Order');
      }

      // Insert new trade of type 'ARC'
      await client.query(
        "INSERT INTO trades (trade_id, status, trade_type, documents) VALUES ($1, 'ro', 'ARC', $2)",
        [trade_id, JSON.stringify([{ type: 'RO', id: ro_no }])]
      );
    }

    // Compute total GST from items
    const totalGst = Array.isArray(items)
      ? items.reduce((sum, item) => {
          const lineTotal = (parseFloat(item.unit_price) || 0) * (parseInt(item.quantity) || 0);
          const rate      = parseFloat(item.gst_rate) || 0;
          return sum + (lineTotal * rate) / 100;
        }, 0)
      : 0;

    // Insert RO header
    await client.query(
      `INSERT INTO release_orders
        (ro_no, contract_ref, buyer_id, customer_id, ro_date, gst, transport, other, basic_value, packing_forward, trade_id, delivery_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        ro_no,
        contract_ref || null,
        buyer_id ? parseInt(buyer_id) : null,
        customer_id || null,
        ro_date,
        totalGst,
        parseFloat(transport)       || 0,
        parseFloat(other)           || 0,
        parseFloat(basic_value)     || 0,
        parseFloat(packing_forward) || 0,
        trade_id,
        delivery_date || null
      ]
    );

    // Insert items
    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        await client.query(
          `INSERT INTO release_order_items
            (ro_no, item_code, quantity, unit_price, gst_type, gst_rate, shipping_address, delivery_date)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            ro_no,
            item.item_code,
            parseInt(item.quantity)    || 1,
            parseFloat(item.unit_price) || 0,
            item.gst_type  || null,
            parseFloat(item.gst_rate)  || 0,
            item.shipping_address || null,
            item.delivery_date    || null
          ]
        );
      }
    }

    // Append to trade documents
    if (trade_id) {
      await appendDocToTrade(client, trade_id, 'RO', ro_no);
    }

    await client.query('COMMIT');
    res.status(201).json({ ro_no, trade_id });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating RO:', err.message);
    res.status(500).json({ error: err.message || 'Failed to create release order' });
  } finally {
    client.release();
  }
});

// Update a RO
router.put('/:ro_no', async (req, res) => {
  const { ro_no } = req.params;
  const {
    contract_ref, ro_date, delivery_date,
    buyer_id, customer_id,
    transport, other, basic_value, packing_forward, items
  } = req.body || {};

  if (!ro_date) {
    return res.status(400).json({ error: 'ro_date is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Compute total GST from items
    const totalGst = Array.isArray(items)
      ? items.reduce((sum, item) => {
          const lineTotal = (parseFloat(item.unit_price) || 0) * (parseInt(item.quantity) || 0);
          const rate      = parseFloat(item.gst_rate) || 0;
          return sum + (lineTotal * rate) / 100;
        }, 0)
      : 0;

    const updateResult = await client.query(
      `UPDATE release_orders
       SET contract_ref = $1, buyer_id = $2, customer_id = $3, ro_date = $4,
           gst = $5, transport = $6, other = $7, basic_value = $8,
           packing_forward = $9, delivery_date = $10
       WHERE ro_no = $11 RETURNING *`,
      [
        contract_ref || null,
        buyer_id ? parseInt(buyer_id) : null,
        customer_id || null,
        ro_date,
        totalGst,
        parseFloat(transport)       || 0,
        parseFloat(other)           || 0,
        parseFloat(basic_value)     || 0,
        parseFloat(packing_forward) || 0,
        delivery_date || null,
        ro_no
      ]
    );

    if (updateResult.rows.length === 0) throw new Error('Release Order not found');

    // Replace items
    await client.query('DELETE FROM release_order_items WHERE ro_no = $1', [ro_no]);
    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        await client.query(
          `INSERT INTO release_order_items
            (ro_no, item_code, quantity, unit_price, gst_type, gst_rate, shipping_address, delivery_date)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            ro_no,
            item.item_code,
            parseInt(item.quantity)    || 1,
            parseFloat(item.unit_price) || 0,
            item.gst_type  || null,
            parseFloat(item.gst_rate)  || 0,
            item.shipping_address || null,
            item.delivery_date    || null
          ]
        );
      }
    }

    // Update trade delivery status if ro belongs to a trade
    const roTradeRes = await client.query('SELECT trade_id FROM release_orders WHERE ro_no = $1', [ro_no]);
    if (roTradeRes.rows.length > 0 && roTradeRes.rows[0].trade_id) {
      await updateTradeDeliveryStatus(client, roTradeRes.rows[0].trade_id);
    }

    await client.query('COMMIT');
    res.json({ ro_no });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating RO:', err.message);
    res.status(500).json({ error: err.message || 'Failed to update release order' });
  } finally {
    client.release();
  }
});

// Update a single RO item's status and vendor (inline edit)
router.put('/:ro_no/items/:item_code', async (req, res) => {
  const { ro_no, item_code } = req.params;
  const { status, vendor } = req.body || {};

  if (status === undefined && vendor === undefined) {
    return res.status(400).json({ error: 'Provide at least status or vendor to update' });
  }

  try {
    const fields = [];
    const values = [];
    if (status !== undefined) { fields.push(`status = $${fields.length + 1}`); values.push(status || null); }
    if (vendor !== undefined) { fields.push(`vendor = $${fields.length + 1}`); values.push(vendor || null); }

    values.push(ro_no, item_code);

    const result = await pool.query(
      `UPDATE release_order_items
       SET ${fields.join(', ')}
       WHERE ro_no = $${values.length - 1} AND item_code = $${values.length}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'RO item not found' });
    }

    const items = await pool.query(
      `SELECT roi.*, i.description, i.drawing_number,
              COALESCE((
                SELECT SUM(dni.quantity)
                FROM delivery_note_items dni
                JOIN delivery_notes dn ON dni.delivery_note_no = dn.delivery_note_no
                WHERE dn.ro_no = roi.ro_no
                  AND dni.item_code = roi.item_code
              ), 0) - COALESCE((
                SELECT SUM((elem->>'quantity')::numeric)
                FROM grns g
                CROSS JOIN LATERAL jsonb_array_elements(COALESCE(g.rejection_items, '[]'::jsonb)) AS elem
                WHERE g.delivery_note_no IN (
                  SELECT delivery_note_no FROM delivery_notes WHERE ro_no = roi.ro_no
                )
                AND elem->>'item_code' = roi.item_code
              ), 0) as delivered_qty
       FROM release_order_items roi
       LEFT JOIN items i ON roi.item_code = i.item_code
       WHERE roi.ro_no = $1
       ORDER BY roi.id`,
      [ro_no]
    );
    res.json(items.rows);
  } catch (err) {
    console.error('Error updating RO item:', err.message);
    res.status(500).json({ error: 'Failed to update RO item' });
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
