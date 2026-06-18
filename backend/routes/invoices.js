const express = require('express');
const { pool } = require('../db');

const router = express.Router();

/**
 * Helper: fetch a full invoice record with joined customer/buyer data
 */
const fetchFullInvoice = async (invoice_no) => {
  const { rows } = await pool.query(`
    SELECT
      inv.*,
      COALESCE(dn.po_no, inv.po_no) AS po_no,
      COALESCE(dn.ro_no, inv.ro_no) AS ro_no,
      dn.dispatch_through AS dn_dispatch_through,
      dn.motor_vehicle_no AS dn_motor_vehicle_no,
      po.quotation_no,
      COALESCE(r.customer_id, rq.customer_id, ro.customer_id) AS customer_id,
      COALESCE(c.name,  cro.name)             AS customer_name,
      COALESCE(c.address, cro.address)        AS customer_address,
      COALESCE(b.name,  bro.name)             AS buyer_name,
      COALESCE(b.email, bro.email)            AS buyer_email,
      COALESCE(b.phone, bro.phone)            AS buyer_phone,
      COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              'item_code',     ii.item_code,
              'description',   i.description,
              'drawing_number',i.drawing_number,
              'quantity',      ii.quantity,
              'rate_per_piece',ii.rate_per_piece,
              'amount',        ii.quantity * ii.rate_per_piece,
              'shipping_address', COALESCE(ii.shipping_address, poi.shipping_address, roi.shipping_address),
              'delivery_date',    COALESCE(ii.delivery_date, poi.delivery_date, roi.delivery_date)
            ) ORDER BY ii.id
          )
          FROM invoice_items ii
          LEFT JOIN items i ON ii.item_code = i.item_code
          LEFT JOIN purchase_order_items poi ON COALESCE(dn.po_no, inv.po_no) = poi.po_no AND ii.item_code = poi.item_code
          LEFT JOIN release_order_items roi ON COALESCE(dn.ro_no, inv.ro_no) = roi.ro_no AND ii.item_code = roi.item_code
          WHERE ii.invoice_no = inv.invoice_no
        ),
        '[]'::json
      ) AS items
    FROM invoices inv
    LEFT JOIN delivery_notes dn ON inv.delivery_note_no = dn.delivery_note_no
    LEFT JOIN purchase_orders po ON COALESCE(dn.po_no, inv.po_no) = po.po_no
    LEFT JOIN quotations q ON po.quotation_no = q.quotation_no
    LEFT JOIN rfqs r ON q.rfq_no = r.rfq_no
    LEFT JOIN received_quotations rq ON po.quotation_no = rq.received_quotation_no
    LEFT JOIN customers c ON COALESCE(r.customer_id, rq.customer_id) = c.id
    LEFT JOIN buyers b ON COALESCE(r.buyer_id, rq.buyer_id) = b.id
    LEFT JOIN release_orders ro ON COALESCE(dn.ro_no, inv.ro_no) = ro.ro_no
    LEFT JOIN customers cro ON ro.customer_id = cro.id
    LEFT JOIN buyers bro ON ro.buyer_id = bro.id
    WHERE inv.invoice_no = $1
  `, [invoice_no]);
  return rows[0] || null;
};

/**
 * GET /api/invoices
 * Fetch all invoices with search + pagination
 */
router.get('/', async (req, res) => {
  const { search } = req.query;
  const limit  = parseInt(req.query.limit)  || 20;
  const offset = parseInt(req.query.offset) || 0;

  try {
    let whereClause = '';
    let values = [limit, offset];

    if (search) {
      whereClause = `
        WHERE inv.invoice_no ILIKE $3
           OR inv.delivery_note_no ILIKE $3
           OR COALESCE(c.name, cro.name) ILIKE $3
           OR COALESCE(c.id,   cro.id)   ILIKE $3
           OR EXISTS (
             SELECT 1 FROM invoice_items ii2
             WHERE ii2.invoice_no = inv.invoice_no AND ii2.item_code ILIKE $3
           )
      `;
      values = [limit, offset, `%${search}%`];
    }

    const { rows } = await pool.query(`
      SELECT
        inv.*,
        COALESCE(dn.po_no, inv.po_no) AS po_no,
        COALESCE(dn.ro_no, inv.ro_no) AS ro_no,
        COALESCE(r.customer_id, rq.customer_id, ro.customer_id) AS customer_id,
        COALESCE(c.name,  cro.name)             AS customer_name,
        COALESCE(b.name,  bro.name)             AS buyer_name,
        COALESCE(b.email, bro.email)            AS buyer_email,
        (
          SELECT COUNT(*) FROM invoice_items ii
          WHERE ii.invoice_no = inv.invoice_no
        ) AS item_count
      FROM invoices inv
      LEFT JOIN delivery_notes dn ON inv.delivery_note_no = dn.delivery_note_no
      LEFT JOIN purchase_orders po ON COALESCE(dn.po_no, inv.po_no) = po.po_no
      LEFT JOIN quotations q ON po.quotation_no = q.quotation_no
      LEFT JOIN rfqs r ON q.rfq_no = r.rfq_no
      LEFT JOIN received_quotations rq ON po.quotation_no = rq.received_quotation_no
      LEFT JOIN customers c ON COALESCE(r.customer_id, rq.customer_id) = c.id
      LEFT JOIN buyers b ON COALESCE(r.buyer_id, rq.buyer_id) = b.id
      LEFT JOIN release_orders ro ON COALESCE(dn.ro_no, inv.ro_no) = ro.ro_no
      LEFT JOIN customers cro ON ro.customer_id = cro.id
      LEFT JOIN buyers bro ON ro.buyer_id = bro.id
      ${whereClause}
      ORDER BY inv.created_at DESC
      LIMIT $1 OFFSET $2
    `, values);

    res.json(rows);
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ error: 'Server error fetching invoices' });
  }
});

/**
 * POST /api/invoices
 * Create a new invoice with items
 */
router.post('/', async (req, res) => {
  const {
    invoice_no,
    invoice_date,
    delivery_note_no,
    po_no,
    ro_no,
    dispatch_doc_no,
    dispatch_through,
    motor_vehicle_no,
    items = [],
    trade_id: bodyTradeId
  } = req.body;

  if (!invoice_no) return res.status(400).json({ error: 'Invoice Number is required' });
  if (!invoice_date) return res.status(400).json({ error: 'Invoice Date is required' });
  if (!delivery_note_no && !po_no && !ro_no) {
    return res.status(400).json({ error: 'Either Delivery Note, Purchase Order, or Release Order link is required' });
  }
  if (items.length === 0) return res.status(400).json({ error: 'At least one item is required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Auto-resolve trade_id from linked documents
    let trade_id = bodyTradeId;
    if (!trade_id) {
      if (delivery_note_no) {
        const dnRes = await client.query('SELECT trade_id FROM delivery_notes WHERE delivery_note_no = $1', [delivery_note_no]);
        if (dnRes.rows.length > 0) trade_id = dnRes.rows[0].trade_id;
      }
      if (!trade_id && po_no) {
        const poRes = await client.query('SELECT trade_id FROM purchase_orders WHERE po_no = $1', [po_no]);
        if (poRes.rows.length > 0) trade_id = poRes.rows[0].trade_id;
      }
      if (!trade_id && ro_no) {
        const roRes = await client.query('SELECT trade_id FROM release_orders WHERE ro_no = $1', [ro_no]);
        if (roRes.rows.length > 0) trade_id = roRes.rows[0].trade_id;
      }
    }

    // Duplicate check
    const exists = await client.query(
      'SELECT invoice_no FROM invoices WHERE invoice_no = $1',
      [invoice_no]
    );
    if (exists.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'An Invoice with this number already exists' });
    }

    // Header insert
    await client.query(`
      INSERT INTO invoices
        (invoice_no, invoice_date, delivery_note_no, po_no, ro_no, dispatch_doc_no, dispatch_through, motor_vehicle_no, trade_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      invoice_no,
      invoice_date,
      delivery_note_no  || null,
      po_no             || null,
      ro_no             || null,
      dispatch_doc_no   || null,
      dispatch_through  || null,
      motor_vehicle_no  || null,
      trade_id
    ]);

    // Link document in trades table
    if (trade_id) {
      const { appendDocToTrade } = require('../db');
      await appendDocToTrade(client, trade_id, 'INVOICE', invoice_no);
    }

    // Items insert
    for (const item of items) {
      const rate = parseFloat(item.rate_per_piece);
      const qty  = parseInt(item.quantity);
      if (isNaN(rate) || rate < 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Valid rate required for item ${item.item_code}` });
      }
      if (isNaN(qty) || qty <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Quantity must be > 0 for item ${item.item_code}` });
      }
      const shipAddr = item.shipping_address || null;
      const delivDate = item.delivery_date ? item.delivery_date.slice(0, 10) : null;
      await client.query(`
        INSERT INTO invoice_items (invoice_no, item_code, quantity, rate_per_piece, shipping_address, delivery_date)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [invoice_no, item.item_code, qty, rate, shipAddr, delivDate]);
    }

    await client.query('COMMIT');
    const full = await fetchFullInvoice(invoice_no);
    res.status(201).json(full);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating invoice:', error);
    res.status(500).json({ error: 'Server error creating invoice' });
  } finally {
    client.release();
  }
});

/**
 * PUT /api/invoices/:invoice_no
 * Update invoice header and sync items
 */
router.put('/:invoice_no', async (req, res) => {
  const { invoice_no } = req.params;
  const {
    invoice_date,
    delivery_note_no,
    po_no,
    ro_no,
    dispatch_doc_no,
    dispatch_through,
    motor_vehicle_no,
    items = []
  } = req.body;

  if (!invoice_date) return res.status(400).json({ error: 'Invoice Date is required' });
  if (!delivery_note_no && !po_no && !ro_no) {
    return res.status(400).json({ error: 'Either Delivery Note, Purchase Order, or Release Order link is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(`
      UPDATE invoices
      SET invoice_date     = $1,
          delivery_note_no = $2,
          po_no            = $3,
          ro_no            = $4,
          dispatch_doc_no  = $5,
          dispatch_through = $6,
          motor_vehicle_no = $7
      WHERE invoice_no = $8
      RETURNING *
    `, [
      invoice_date,
      delivery_note_no || null,
      po_no            || null,
      ro_no            || null,
      dispatch_doc_no  || null,
      dispatch_through || null,
      motor_vehicle_no || null,
      invoice_no
    ]);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Replace items
    await client.query('DELETE FROM invoice_items WHERE invoice_no = $1', [invoice_no]);
    for (const item of items) {
      const shipAddr = item.shipping_address || null;
      const delivDate = item.delivery_date ? item.delivery_date.slice(0, 10) : null;
      await client.query(`
        INSERT INTO invoice_items (invoice_no, item_code, quantity, rate_per_piece, shipping_address, delivery_date)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [invoice_no, item.item_code, parseInt(item.quantity), parseFloat(item.rate_per_piece), shipAddr, delivDate]);
    }

    await client.query('COMMIT');
    const full = await fetchFullInvoice(invoice_no);
    res.json(full);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating invoice:', error);
    res.status(500).json({ error: 'Server error updating invoice' });
  } finally {
    client.release();
  }
});

/**
 * DELETE /api/invoices/:invoice_no
 */
router.delete('/:invoice_no', async (req, res) => {
  const { invoice_no } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM invoices WHERE invoice_no = $1',
      [invoice_no]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Invoice not found' });
    res.json({ message: 'Invoice deleted successfully' });
  } catch (error) {
    console.error('Error deleting invoice:', error);
    res.status(500).json({ error: 'Server error deleting invoice' });
  }
});

module.exports = router;
