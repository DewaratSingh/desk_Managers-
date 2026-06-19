const express = require('express');
const router = express.Router();
const { pool, appendDocToTrade } = require('../db');

// GET a single Invoice details by invoice_no
router.get('/:invoice_no', async (req, res) => {
  const { invoice_no } = req.params;
  try {
    const result = await pool.query(`
      SELECT
        inv.invoice_no, inv.invoice_date, inv.delivery_note_no,
        inv.dispatch_doc_no, inv.dispatch_through, inv.motor_vehicle_no, inv.trade_id,
        (
          SELECT COALESCE(json_agg(json_build_object(
            'item_code', ii.item_code,
            'quantity', ii.quantity,
            'rate_per_piece', ii.rate_per_piece,
            'shipping_address', ii.shipping_address,
            'delivery_date', ii.delivery_date,
            'description', items.description,
            'drawing_number', items.drawing_number
          ) ORDER BY ii.id), '[]')
          FROM invoice_items ii
          LEFT JOIN items ON ii.item_code = items.item_code
          WHERE ii.invoice_no = inv.invoice_no
        ) as items
      FROM invoices inv
      WHERE inv.invoice_no = $1
    `, [invoice_no]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching Invoice:', err.message);
    res.status(500).json({ error: 'Failed to fetch Invoice' });
  }
});

// GET items from a linked Delivery Note, computing remaining quantities to invoice
router.get('/items-lookup/:delivery_note_no', async (req, res) => {
  const { delivery_note_no } = req.params;
  const { exclude_invoice_no } = req.query;

  try {
    // Query Delivery Note header info
    const dnRes = await pool.query(
      'SELECT delivery_date, dispatch_through, dispatch_doc_no, motor_vehicle_no FROM delivery_notes WHERE delivery_note_no = $1',
      [delivery_note_no]
    );
    if (dnRes.rows.length === 0) {
      return res.status(404).json({ error: 'Delivery Note not found' });
    }
    const dn = dnRes.rows[0];

    // Query items from delivery_note_items and calculate already invoiced quantities
    const itemsRes = await pool.query(
      `SELECT
        dni.item_code,
        dni.quantity as original_qty, -- Quantity delivered in this DN
        dni.rate_per_piece,
        dni.shipping_address,
        dni.delivery_date,
        i.description,
        i.drawing_number,
        COALESCE((
          SELECT SUM(ii.quantity)
          FROM invoice_items ii
          JOIN invoices inv ON ii.invoice_no = inv.invoice_no
          WHERE inv.delivery_note_no = $1
            AND ii.item_code = dni.item_code
            AND ($2::varchar IS NULL OR inv.invoice_no != $2)
        ), 0) as invoiced_qty
      FROM delivery_note_items dni
      LEFT JOIN items i ON dni.item_code = i.item_code
      WHERE dni.delivery_note_no = $1
      ORDER BY dni.id`,
      [delivery_note_no, exclude_invoice_no || null]
    );

    const mappedItems = itemsRes.rows.map(item => {
      const original = parseInt(item.original_qty) || 0;
      const invoiced = parseInt(item.invoiced_qty) || 0;
      const remaining = Math.max(0, original - invoiced);
      return {
        ...item,
        original_qty: original,
        delivered_qty: original, // Delivered is original for invoice
        invoiced_qty: invoiced,
        remaining_qty: remaining
      };
    });

    res.json({
      delivery_note_no,
      delivery_date: dn.delivery_date,
      dispatch_through: dn.dispatch_through || '',
      dispatch_doc_no: dn.dispatch_doc_no || '',
      motor_vehicle_no: dn.motor_vehicle_no || '',
      items: mappedItems
    });
  } catch (err) {
    console.error('Error in invoice items-lookup:', err.message);
    res.status(500).json({ error: 'Failed to look up invoiceable items' });
  }
});

// CREATE a custom Invoice
router.post('/', async (req, res) => {
  const {
    invoice_no,
    invoice_date,
    delivery_note_no,
    dispatch_through,
    dispatch_doc_no,
    motor_vehicle_no,
    trade_id,
    items
  } = req.body || {};

  if (!invoice_no || !invoice_date || !delivery_note_no || !dispatch_through || !motor_vehicle_no || !trade_id) {
    return res.status(400).json({ error: 'Missing required Invoice fields' });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'At least one item must be included in the invoice' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Check duplicate invoice_no
    const dupCheck = await client.query('SELECT invoice_no FROM invoices WHERE invoice_no = $1', [invoice_no]);
    if (dupCheck.rows.length > 0) {
      throw new Error('Invoice number already exists');
    }

    // 2. Fetch Delivery Note to resolve po_no and ro_no references
    const dnRes = await client.query('SELECT po_no, ro_no FROM delivery_notes WHERE delivery_note_no = $1', [delivery_note_no]);
    if (dnRes.rows.length === 0) {
      throw new Error('Delivery Note not found');
    }
    const { po_no, ro_no } = dnRes.rows[0];

    // 3. Insert Invoice header
    await client.query(
      `INSERT INTO invoices (invoice_no, invoice_date, delivery_note_no, po_no, ro_no, dispatch_doc_no, dispatch_through, motor_vehicle_no, trade_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        invoice_no,
        invoice_date,
        delivery_note_no,
        po_no || null,
        ro_no || null,
        dispatch_doc_no || null,
        dispatch_through,
        motor_vehicle_no,
        trade_id
      ]
    );

    // 4. Insert items
    for (const item of items) {
      await client.query(
        `INSERT INTO invoice_items (invoice_no, item_code, quantity, rate_per_piece, shipping_address, delivery_date)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          invoice_no,
          item.item_code,
          parseInt(item.quantity) || 0,
          parseFloat(item.rate_per_piece) || 0,
          item.shipping_address || null,
          item.delivery_date || null
        ]
      );
    }

    // 5. Append to trade documents (which calculates trade status to 'invoice')
    await appendDocToTrade(client, trade_id, 'INVOICE', invoice_no);

    await client.query('COMMIT');
    res.status(201).json({ invoice_no, trade_id });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating Invoice:', err.message);
    res.status(500).json({ error: err.message || 'Failed to create Invoice' });
  } finally {
    client.release();
  }
});

// UPDATE an existing Invoice
router.put('/:invoice_no', async (req, res) => {
  const { invoice_no } = req.params;
  const {
    invoice_date,
    dispatch_through,
    dispatch_doc_no,
    motor_vehicle_no,
    items
  } = req.body || {};

  if (!invoice_date || !dispatch_through || !motor_vehicle_no) {
    return res.status(400).json({ error: 'Missing required Invoice fields' });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'At least one item must be included in the invoice' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Update header
    const updateHeader = await client.query(
      `UPDATE invoices
       SET invoice_date = $1, dispatch_doc_no = $2, dispatch_through = $3, motor_vehicle_no = $4
       WHERE invoice_no = $5 RETURNING *`,
      [invoice_date, dispatch_doc_no || null, dispatch_through, motor_vehicle_no, invoice_no]
    );

    if (updateHeader.rows.length === 0) {
      throw new Error('Invoice not found');
    }

    // 2. Rewrite items
    await client.query('DELETE FROM invoice_items WHERE invoice_no = $1', [invoice_no]);

    for (const item of items) {
      await client.query(
        `INSERT INTO invoice_items (invoice_no, item_code, quantity, rate_per_piece, shipping_address, delivery_date)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          invoice_no,
          item.item_code,
          parseInt(item.quantity) || 0,
          parseFloat(item.rate_per_piece) || 0,
          item.shipping_address || null,
          item.delivery_date || null
        ]
      );
    }

    await client.query('COMMIT');
    res.json({ invoice_no });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating Invoice:', err.message);
    res.status(500).json({ error: err.message || 'Failed to update Invoice' });
  } finally {
    client.release();
  }
});

module.exports = router;
