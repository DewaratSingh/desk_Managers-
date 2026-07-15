const express = require('express');
const router = express.Router();
const { pool, appendDocToTrade } = require('../db');

// Update a single PO item's status and vendor (inline edit)
router.put('/:po_no/items/:item_code', async (req, res) => {
  const { po_no, item_code } = req.params;
  const { status, vendor } = req.body || {};

  if (status === undefined && vendor === undefined) {
    return res.status(400).json({ error: 'Provide at least status or vendor to update' });
  }

  try {
    const poRes = await pool.query('SELECT id FROM purchase_orders WHERE po_no = $1 AND company_id = $2', [po_no, req.user.company_id]);
    const itemRes = await pool.query('SELECT id FROM items WHERE item_code = $1 AND company_id = $2', [item_code, req.user.company_id]);
    if (poRes.rows.length === 0 || itemRes.rows.length === 0) {
      return res.status(404).json({ error: 'PO item not found' });
    }
    const poDbId = poRes.rows[0].id;
    const itemDbId = itemRes.rows[0].id;

    // Build SET clause dynamically for only the fields provided
    const fields = [];
    const values = [];
    if (status !== undefined) { fields.push(`status = $${fields.length + 1}`); values.push(status || null); }
    if (vendor !== undefined) { fields.push(`vendor = $${fields.length + 1}`); values.push(vendor || null); }

    values.push(poDbId, itemDbId, req.user.company_id);

    const result = await pool.query(
      `UPDATE purchase_order_items
       SET ${fields.join(', ')}
       WHERE po_id = $${values.length - 2} AND item_id = $${values.length - 1} AND company_id = $${values.length}
       RETURNING *`,
      values
    );

    // Return the full updated items list
    const items = await pool.query(
      `SELECT poi.*, i.item_code, i.description, i.drawing_number,
              COALESCE((
                SELECT SUM(dni.quantity)
                FROM delivery_note_items dni
                JOIN delivery_notes dn ON dni.delivery_note_id = dn.id
                WHERE dn.po_id = poi.po_id AND dn.company_id = poi.company_id
                  AND dni.item_id = poi.item_id
              ), 0) - COALESCE((
                SELECT SUM((elem->>'quantity')::numeric)
                FROM grns g
                CROSS JOIN LATERAL jsonb_array_elements(COALESCE(g.rejection_items, '[]'::jsonb)) AS elem
                WHERE g.delivery_note_id IN (
                  SELECT id FROM delivery_notes WHERE po_id = poi.po_id AND company_id = poi.company_id
                )
                AND (SELECT item_code FROM items WHERE id = poi.item_id) = elem->>'item_code' AND g.company_id = poi.company_id
              ), 0) as delivered_qty
       FROM purchase_order_items poi
       LEFT JOIN items i ON poi.item_id = i.id
       WHERE poi.po_id = $1 AND poi.company_id = $2
       ORDER BY poi.id`,
      [poDbId, req.user.company_id]
    );
    res.json(items.rows);
  } catch (err) {
    console.error('Error updating PO item:', err.message);
    res.status(500).json({ error: 'Failed to update PO item' });
  }
});

// List all POs
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        po.po_no, q.quotation_no, po.po_date, po.delivery_date,
        po.gst, po.transport, po.other, po.basic_value, po.packing_forward,
        t.trade_id, po.created_at,
        t.trade_type,
        t.status AS trade_status,
        COALESCE(
          (SELECT c.customer_code FROM rfqs r JOIN customers c ON r.customer_id = c.id WHERE r.trade_id = po.trade_id AND r.company_id = po.company_id LIMIT 1),
          (SELECT c.customer_code FROM received_quotations rq JOIN customers c ON rq.customer_id = c.id WHERE rq.trade_id = po.trade_id AND rq.company_id = po.company_id LIMIT 1),
          '—'
        ) AS party_id,
        (
          SELECT COALESCE(json_agg(json_build_object(
            'item_code', i.item_code,
            'quantity', poi.quantity,
            'unit_price', poi.unit_price,
            'gst_rate', poi.gst_rate,
            'gst_type', poi.gst_type,
            'delivered_qty', COALESCE((
              SELECT SUM(dni.quantity)
              FROM delivery_note_items dni
              JOIN delivery_notes dn ON dni.delivery_note_id = dn.id
              WHERE dn.po_id = po.id AND dn.company_id = po.company_id
                AND dni.item_id = poi.item_id
            ), 0) - COALESCE((
              SELECT SUM((elem->>'quantity')::numeric)
              FROM grns g
              CROSS JOIN LATERAL jsonb_array_elements(COALESCE(g.rejection_items, '[]'::jsonb)) AS elem
              WHERE g.delivery_note_id IN (
                SELECT id FROM delivery_notes WHERE po_id = po.id AND company_id = po.company_id
              )
              AND i.item_code = elem->>'item_code' AND g.company_id = po.company_id
            ), 0)
          )), '[]')
          FROM purchase_order_items poi
          JOIN items i ON poi.item_id = i.id
          WHERE poi.po_id = po.id AND poi.company_id = po.company_id
        ) as items
      FROM purchase_orders po
      LEFT JOIN quotations q ON po.quotation_id = q.id
      LEFT JOIN trades t ON po.trade_id = t.id
      WHERE po.company_id = $1
      ORDER BY po.created_at DESC
    `, [req.user.company_id]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error listing POs:', err.message);
    res.status(500).json({ error: 'Failed to list purchase orders' });
  }
});

// Get next PO reference number
router.get('/next-no', async (req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(*) FROM purchase_orders WHERE company_id = $1', [req.user.company_id]);
    const count = parseInt(result.rows[0].count) || 0;
    const nextNo = `PO-${String(count + 1).padStart(4, '0')}`;
    res.json({ nextNo });
  } catch (err) {
    console.error('Error fetching next PO no:', err.message);
    res.status(500).json({ error: 'Failed to generate next PO number' });
  }
});

// Get a single PO
router.get('/:po_no', async (req, res) => {
  const { po_no } = req.params;
  try {
    const result = await pool.query(`
      SELECT
        po.po_no, q.quotation_no, po.po_date,
        po.gst, po.transport, po.other, po.basic_value, po.packing_forward,
        po.delivery_date, t.trade_id,
        (
          SELECT COALESCE(json_agg(json_build_object(
            'item_code', i.item_code,
            'quantity', poi.quantity,
            'unit_price', poi.unit_price,
            'gst_type', poi.gst_type,
            'gst_rate', poi.gst_rate,
            'shipping_address', poi.shipping_address,
            'delivery_date', poi.delivery_date,
            'status', poi.status,
            'vendor', poi.vendor,
            'description', i.description,
            'drawing_number', i.drawing_number,
            'delivered_qty', COALESCE((
              SELECT SUM(dni.quantity)
              FROM delivery_note_items dni
              JOIN delivery_notes dn ON dni.delivery_note_id = dn.id
              WHERE dn.po_id = po.id AND dn.company_id = po.company_id
                AND dni.item_id = poi.item_id
            ), 0) - COALESCE((
              SELECT SUM((elem->>'quantity')::numeric)
              FROM grns g
              CROSS JOIN LATERAL jsonb_array_elements(COALESCE(g.rejection_items, '[]'::jsonb)) AS elem
              WHERE g.delivery_note_id IN (
                SELECT id FROM delivery_notes WHERE po_id = po.id AND company_id = po.company_id
              )
              AND i.item_code = elem->>'item_code' AND g.company_id = po.company_id
            ), 0)
          ) ORDER BY poi.id), '[]')
          FROM purchase_order_items poi
          LEFT JOIN items i ON poi.item_id = i.id
          WHERE poi.po_id = po.id AND poi.company_id = po.company_id
        ) as items
      FROM purchase_orders po
      LEFT JOIN quotations q ON po.quotation_id = q.id
      LEFT JOIN trades t ON po.trade_id = t.id
      WHERE po.po_no = $1 AND po.company_id = $2
    `, [po_no, req.user.company_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Purchase Order not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching PO:', err.message);
    res.status(500).json({ error: 'Failed to fetch purchase order' });
  }
});

// Create a PO
router.post('/', async (req, res) => {
  const {
    po_no, quotation_no, po_date,
    transport, other, basic_value, packing_forward,
    delivery_date, items
  } = req.body || {};

  if (!po_date) {
    return res.status(400).json({ error: 'po_date is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Resolve trade_id and quotation_id from the quotation (checking company_id)
    let tradeDbId = null;
    let trade_code = null;
    let quotationDbId = null;
    if (quotation_no) {
      let qRes = await client.query(
        'SELECT q.id, q.trade_id, t.trade_id as trade_code FROM quotations q LEFT JOIN trades t ON q.trade_id = t.id WHERE q.quotation_no = $1 AND q.company_id = $2',
        [quotation_no, req.user.company_id]
      );
      if (qRes.rows.length > 0) {
        quotationDbId = qRes.rows[0].id;
        tradeDbId = qRes.rows[0].trade_id;
        trade_code = qRes.rows[0].trade_code;
      } else {
        qRes = await client.query(
          'SELECT rq.id, rq.trade_id, t.trade_id as trade_code FROM received_quotations rq LEFT JOIN trades t ON rq.trade_id = t.id WHERE rq.received_quotation_no = $1 AND rq.company_id = $2',
          [quotation_no, req.user.company_id]
        );
        if (qRes.rows.length > 0) {
          quotationDbId = qRes.rows[0].id;
          tradeDbId = qRes.rows[0].trade_id;
          trade_code = qRes.rows[0].trade_code;
        }
      }
    }

    // Check duplicate
    const dupCheck = await client.query('SELECT po_no FROM purchase_orders WHERE po_no = $1 AND company_id = $2', [po_no, req.user.company_id]);
    if (dupCheck.rows.length > 0) throw new Error('Purchase Order number already exists');

    // Compute total GST from items
    const totalGst = Array.isArray(items)
      ? items.reduce((sum, item) => {
          const lineTotal = (parseFloat(item.unit_price) || 0) * (parseInt(item.quantity) || 0);
          const rate      = parseFloat(item.gst_rate) || 0;
          return sum + (lineTotal * rate) / 100;
        }, 0)
      : 0;

    // Insert PO header
    const poRes = await client.query(
      `INSERT INTO purchase_orders
        (po_no, quotation_id, po_date, gst, transport, other, basic_value, packing_forward, delivery_date, trade_id, company_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
      [
        po_no,
        quotationDbId || null,
        po_date,
        totalGst,
        parseFloat(transport)       || 0,
        parseFloat(other)           || 0,
        parseFloat(basic_value)     || 0,
        parseFloat(packing_forward) || 0,
        delivery_date || null,
        tradeDbId,
        req.user.company_id
      ]
    );
    const poDbId = poRes.rows[0].id;

    // Insert items
    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        const itemRes = await client.query('SELECT id FROM items WHERE item_code = $1 AND company_id = $2', [item.item_code, req.user.company_id]);
        if (itemRes.rows.length === 0) {
          throw new Error(`Item ${item.item_code} not found`);
        }
        const itemDbId = itemRes.rows[0].id;
        await client.query(
          `INSERT INTO purchase_order_items
            (po_id, item_id, quantity, unit_price, gst_type, gst_rate, shipping_address, delivery_date, company_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            poDbId,
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
      await appendDocToTrade(client, trade_code, 'PO', po_no, req.user.company_id);
      await client.query(
        "INSERT INTO status (name, company_id) VALUES ('ordered', $1) ON CONFLICT (name, company_id) DO NOTHING",
        [req.user.company_id]
      );
      await client.query(
        "UPDATE trades SET status = 'ordered' WHERE id = $1 AND company_id = $2",
        [tradeDbId, req.user.company_id]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ po_no });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating PO:', err.message);
    res.status(500).json({ error: err.message || 'Failed to create purchase order' });
  } finally {
    client.release();
  }
});

// Update a PO
router.put('/:po_no', async (req, res) => {
  const { po_no } = req.params;
  const {
    po_date, transport, other, basic_value, packing_forward,
    delivery_date, items
  } = req.body || {};

  if (!po_date) {
    return res.status(400).json({ error: 'po_date is required' });
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
      `UPDATE purchase_orders
       SET po_date = $1, gst = $2, transport = $3, other = $4,
           basic_value = $5, packing_forward = $6, delivery_date = $7
       WHERE po_no = $8 AND company_id = $9 RETURNING id`,
      [
        po_date,
        totalGst,
        parseFloat(transport)       || 0,
        parseFloat(other)           || 0,
        parseFloat(basic_value)     || 0,
        parseFloat(packing_forward) || 0,
        delivery_date || null,
        po_no,
        req.user.company_id
      ]
    );

    if (updateResult.rows.length === 0) throw new Error('Purchase Order not found');
    const poDbId = updateResult.rows[0].id;

    // Replace items
    await client.query('DELETE FROM purchase_order_items WHERE po_id = $1 AND company_id = $2', [poDbId, req.user.company_id]);
    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        const itemRes = await client.query('SELECT id FROM items WHERE item_code = $1 AND company_id = $2', [item.item_code, req.user.company_id]);
        if (itemRes.rows.length === 0) {
          throw new Error(`Item ${item.item_code} not found`);
        }
        const itemDbId = itemRes.rows[0].id;
        await client.query(
          `INSERT INTO purchase_order_items
            (po_id, item_id, quantity, unit_price, gst_type, gst_rate, shipping_address, delivery_date, company_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            poDbId,
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

    // Update trade delivery status if po belongs to a trade
    const poTradeRes = await client.query('SELECT trade_id FROM purchase_orders WHERE id = $1 AND company_id = $2', [poDbId, req.user.company_id]);
    if (poTradeRes.rows.length > 0 && poTradeRes.rows[0].trade_id) {
      await updateTradeDeliveryStatus(client, poTradeRes.rows[0].trade_id, req.user.company_id);
    }

    await client.query('COMMIT');
    res.json({ po_no });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating PO:', err.message);
    res.status(500).json({ error: err.message || 'Failed to update purchase order' });
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
