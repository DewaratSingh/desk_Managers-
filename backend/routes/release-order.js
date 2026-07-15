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
        t.trade_id, ro.buyer_id, c.customer_code AS party_id, ro.created_at,
        b.name as buyer_name, b.email as buyer_email, b.phone as buyer_phone,
        c.name as customer_name, c.address as customer_address,
        t.status AS trade_status,
        (
          SELECT COALESCE(json_agg(json_build_object(
            'item_code', i.item_code,
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
              JOIN delivery_notes dn ON dni.delivery_note_id = dn.id
              WHERE dn.ro_id = ro.id AND dn.company_id = ro.company_id
                AND dni.item_id = roi.item_id
            ), 0) - COALESCE((
              SELECT SUM((elem->>'quantity')::numeric)
              FROM grns g
              CROSS JOIN LATERAL jsonb_array_elements(COALESCE(g.rejection_items, '[]'::jsonb)) AS elem
              WHERE g.delivery_note_id IN (
                SELECT id FROM delivery_notes WHERE ro_id = ro.id AND company_id = ro.company_id
              )
              AND i.item_code = elem->>'item_code' AND g.company_id = ro.company_id
            ), 0)
          )), '[]')
          FROM release_order_items roi
          JOIN items i ON roi.item_id = i.id
          WHERE roi.ro_id = ro.id AND roi.company_id = ro.company_id
        ) as items
      FROM release_orders ro
      LEFT JOIN buyers b ON ro.buyer_id = b.id
      LEFT JOIN customers c ON ro.customer_id = c.id
      LEFT JOIN trades t ON ro.trade_id = t.id
      WHERE ro.company_id = $1
      ORDER BY ro.created_at DESC
    `, [req.user.company_id]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error listing ROs:', err.message);
    res.status(500).json({ error: 'Failed to list release orders' });
  }
});

// Get next RO reference number
router.get('/next-no', async (req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(*) FROM release_orders WHERE company_id = $1', [req.user.company_id]);
    const count = parseInt(result.rows[0].count) || 0;
    const nextNo = `RO-${String(count + 1).padStart(4, '0')}`;
    res.json({ nextNo });
  } catch (err) {
    console.error('Error fetching next RO no:', err.message);
    res.status(500).json({ error: 'Failed to generate next RO number' });
  }
});

// Get a single RO
router.get('/*ro_no', async (req, res) => {
  const ro_no = Array.isArray(req.params.ro_no) ? req.params.ro_no.join('/') : req.params.ro_no;
  try {
    const result = await pool.query(`
      SELECT
        ro.ro_no, ro.contract_ref, ro.ro_date, ro.delivery_date,
        ro.gst, ro.transport, ro.other, ro.basic_value, ro.packing_forward,
        t.trade_id, ro.buyer_id, c.customer_code as customer_id,
        b.name as buyer_name, b.email as buyer_email, b.phone as buyer_phone,
        c.name as customer_name, c.address as customer_address,
        (
          SELECT COALESCE(json_agg(json_build_object(
            'item_code', i.item_code,
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
              JOIN delivery_notes dn ON dni.delivery_note_id = dn.id
              WHERE dn.ro_id = ro.id AND dn.company_id = ro.company_id
                AND dni.item_id = roi.item_id
            ), 0) - COALESCE((
              SELECT SUM((elem->>'quantity')::numeric)
              FROM grns g
              CROSS JOIN LATERAL jsonb_array_elements(COALESCE(g.rejection_items, '[]'::jsonb)) AS elem
              WHERE g.delivery_note_id IN (
                SELECT id FROM delivery_notes WHERE ro_id = ro.id AND company_id = ro.company_id
              )
              AND i.item_code = elem->>'item_code' AND g.company_id = ro.company_id
            ), 0)
          ) ORDER BY roi.id), '[]')
          FROM release_order_items roi
          LEFT JOIN items i ON roi.item_id = i.id
          WHERE roi.ro_id = ro.id AND roi.company_id = ro.company_id
        ) as items
      FROM release_orders ro
      LEFT JOIN buyers b ON ro.buyer_id = b.id
      LEFT JOIN customers c ON ro.customer_id = c.id
      LEFT JOIN trades t ON ro.trade_id = t.id
      WHERE ro.ro_no = $1 AND ro.company_id = $2
    `, [ro_no, req.user.company_id]);

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
    const dupCheck = await client.query('SELECT ro_no FROM release_orders WHERE ro_no = $1 AND company_id = $2', [ro_no, req.user.company_id]);
    if (dupCheck.rows.length > 0) throw new Error('Release Order number already exists');

    // Resolve customerDbId
    const custRes = await client.query('SELECT id FROM customers WHERE customer_code = $1 AND company_id = $2', [customer_id, req.user.company_id]);
    if (custRes.rows.length === 0) throw new Error('Customer not found');
    const customerDbId = custRes.rows[0].id;

    // Resolve or generate trade
    let tradeDbId = null;
    let trade_code = null;
    if (req_trade_id) {
      const tradeRes = await client.query('SELECT id, trade_id FROM trades WHERE trade_id = $1 AND company_id = $2', [req_trade_id, req.user.company_id]);
      if (tradeRes.rows.length > 0) {
        tradeDbId = tradeRes.rows[0].id;
        trade_code = tradeRes.rows[0].trade_id;
      }
    }

    if (!tradeDbId) {
      trade_code = 'TRD-' + ro_no.replace(/[\s/]+/g, '-');
      // Check duplicate trade_id
      const tradeDupCheck = await client.query('SELECT id FROM trades WHERE trade_id = $1 AND company_id = $2', [trade_code, req.user.company_id]);
      if (tradeDupCheck.rows.length > 0) {
        throw new Error('Trade ID already exists for this Release Order');
      }

      // Insert new trade of type 'ARC'
      const tradeRes = await client.query(
        "INSERT INTO trades (trade_id, status, trade_type, documents, company_id) VALUES ($1, 'ro', 'ARC', $2, $3) RETURNING id",
        [trade_code, JSON.stringify([{ type: 'RO', id: ro_no }]), req.user.company_id]
      );
      tradeDbId = tradeRes.rows[0].id;
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
    const roRes = await client.query(
      `INSERT INTO release_orders
        (ro_no, contract_ref, buyer_id, customer_id, ro_date, gst, transport, other, basic_value, packing_forward, trade_id, delivery_date, company_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
      [
        ro_no,
        contract_ref || null,
        buyer_id ? parseInt(buyer_id) : null,
        customerDbId,
        ro_date,
        totalGst,
        parseFloat(transport)       || 0,
        parseFloat(other)           || 0,
        parseFloat(basic_value)     || 0,
        parseFloat(packing_forward) || 0,
        tradeDbId,
        delivery_date || null,
        req.user.company_id
      ]
    );
    const roDbId = roRes.rows[0].id;

    // Insert items
    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        const itemRes = await client.query('SELECT id FROM items WHERE item_code = $1 AND company_id = $2', [item.item_code, req.user.company_id]);
        if (itemRes.rows.length === 0) {
          throw new Error(`Item ${item.item_code} not found`);
        }
        const itemDbId = itemRes.rows[0].id;
        await client.query(
          `INSERT INTO release_order_items
            (ro_id, item_id, quantity, unit_price, gst_type, gst_rate, shipping_address, delivery_date, company_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            roDbId,
            itemDbId,
            parseInt(item.quantity)    || 1,
            parseFloat(item.unit_price) || 0,
            item.gst_type  || null,
            parseFloat(item.gst_rate)  || 0,
            item.shipping_address || null,
            item.delivery_date    || null,
            req.user.company_id
          ]
        );
      }
    }

    // Append to trade documents
    if (tradeDbId) {
      await appendDocToTrade(client, trade_code, 'RO', ro_no, req.user.company_id);
    }

    await client.query('COMMIT');
    res.status(201).json({ ro_no, trade_id: trade_code });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating RO:', err.message);
    res.status(500).json({ error: err.message || 'Failed to create release order' });
  } finally {
    client.release();
  }
});

// Update a RO
router.put('/*ro_no', async (req, res) => {
  const ro_no = Array.isArray(req.params.ro_no) ? req.params.ro_no.join('/') : req.params.ro_no;
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

    // Resolve customerDbId
    const custRes = await client.query('SELECT id FROM customers WHERE customer_code = $1 AND company_id = $2', [customer_id, req.user.company_id]);
    if (custRes.rows.length === 0) throw new Error('Customer not found');
    const customerDbId = custRes.rows[0].id;

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
       WHERE ro_no = $11 AND company_id = $12 RETURNING id`,
      [
        contract_ref || null,
        buyer_id ? parseInt(buyer_id) : null,
        customerDbId,
        ro_date,
        totalGst,
        parseFloat(transport)       || 0,
        parseFloat(other)           || 0,
        parseFloat(basic_value)     || 0,
        parseFloat(packing_forward) || 0,
        delivery_date || null,
        ro_no,
        req.user.company_id
      ]
    );

    if (updateResult.rows.length === 0) throw new Error('Release Order not found');
    const roDbId = updateResult.rows[0].id;

    // Replace items
    await client.query('DELETE FROM release_order_items WHERE ro_id = $1 AND company_id = $2', [roDbId, req.user.company_id]);
    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        const itemRes = await client.query('SELECT id FROM items WHERE item_code = $1 AND company_id = $2', [item.item_code, req.user.company_id]);
        if (itemRes.rows.length === 0) {
          throw new Error(`Item ${item.item_code} not found`);
        }
        const itemDbId = itemRes.rows[0].id;
        await client.query(
          `INSERT INTO release_order_items
            (ro_id, item_id, quantity, unit_price, gst_type, gst_rate, shipping_address, delivery_date, company_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            roDbId,
            itemDbId,
            parseInt(item.quantity)    || 1,
            parseFloat(item.unit_price) || 0,
            item.gst_type  || null,
            parseFloat(item.gst_rate)  || 0,
            item.shipping_address || null,
            item.delivery_date    || null,
            req.user.company_id
          ]
        );
      }
    }

    // Update trade delivery status if ro belongs to a trade
    const roTradeRes = await client.query('SELECT trade_id FROM release_orders WHERE id = $1 AND company_id = $2', [roDbId, req.user.company_id]);
    if (roTradeRes.rows.length > 0 && roTradeRes.rows[0].trade_id) {
      await updateTradeDeliveryStatus(client, roTradeRes.rows[0].trade_id, req.user.company_id);
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
router.put('/*ro_no/items/:item_code', async (req, res) => {
  const ro_no = Array.isArray(req.params.ro_no) ? req.params.ro_no.join('/') : req.params.ro_no;
  const { item_code } = req.params;
  const { status, vendor } = req.body || {};

  if (status === undefined && vendor === undefined) {
    return res.status(400).json({ error: 'Provide at least status or vendor to update' });
  }

  try {
    const roRes = await pool.query('SELECT id FROM release_orders WHERE ro_no = $1 AND company_id = $2', [ro_no, req.user.company_id]);
    const itemRes = await pool.query('SELECT id FROM items WHERE item_code = $1 AND company_id = $2', [item_code, req.user.company_id]);
    if (roRes.rows.length === 0 || itemRes.rows.length === 0) {
      return res.status(404).json({ error: 'RO item not found' });
    }
    const roDbId = roRes.rows[0].id;
    const itemDbId = itemRes.rows[0].id;

    const fields = [];
    const values = [];
    if (status !== undefined) { fields.push(`status = $${fields.length + 1}`); values.push(status || null); }
    if (vendor !== undefined) { fields.push(`vendor = $${fields.length + 1}`); values.push(vendor || null); }

    values.push(roDbId, itemDbId, req.user.company_id);

    const result = await pool.query(
      `UPDATE release_order_items
       SET ${fields.join(', ')}
       WHERE ro_id = $${values.length - 2} AND item_id = $${values.length - 1} AND company_id = $${values.length}
       RETURNING *`,
      values
    );

    const items = await pool.query(
      `SELECT roi.*, i.item_code, i.description, i.drawing_number,
              COALESCE((
                SELECT SUM(dni.quantity)
                FROM delivery_note_items dni
                JOIN delivery_notes dn ON dni.delivery_note_id = dn.id
                WHERE dn.ro_id = roi.ro_id AND dn.company_id = roi.company_id
                  AND dni.item_id = roi.item_id
              ), 0) - COALESCE((
                SELECT SUM((elem->>'quantity')::numeric)
                FROM grns g
                CROSS JOIN LATERAL jsonb_array_elements(COALESCE(g.rejection_items, '[]'::jsonb)) AS elem
                WHERE g.delivery_note_id IN (
                  SELECT id FROM delivery_notes WHERE ro_id = roi.ro_id AND company_id = roi.company_id
                )
                AND (SELECT item_code FROM items WHERE id = roi.item_id) = elem->>'item_code' AND g.company_id = roi.company_id
              ), 0) as delivered_qty
       FROM release_order_items roi
       LEFT JOIN items i ON roi.item_id = i.id
       WHERE roi.ro_id = $1 AND roi.company_id = $2
       ORDER BY roi.id`,
      [roDbId, req.user.company_id]
    );
    res.json(items.rows);
  } catch (err) {
    console.error('Error updating RO item:', err.message);
    res.status(500).json({ error: 'Failed to update RO item' });
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
