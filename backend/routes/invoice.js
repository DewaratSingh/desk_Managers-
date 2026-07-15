const express = require('express');
const router = express.Router();
const { pool, appendDocToTrade } = require('../db');

// GET a single Invoice details by invoice_no
router.get('/:invoice_no', async (req, res) => {
  const { invoice_no } = req.params;
  try {
    const result = await pool.query(`
      SELECT
        inv.invoice_no, inv.invoice_date, dn.delivery_note_no,
        inv.dispatch_doc_no, inv.dispatch_through, inv.motor_vehicle_no, t.trade_id,
        (
          SELECT COALESCE(json_agg(json_build_object(
            'item_code', i.item_code,
            'quantity', ii.quantity,
            'rate_per_piece', ii.rate_per_piece,
            'shipping_address', ii.shipping_address,
            'delivery_date', ii.delivery_date,
            'description', i.description,
            'drawing_number', i.drawing_number
          ) ORDER BY ii.id), '[]')
          FROM invoice_items ii
          LEFT JOIN items i ON ii.item_id = i.id AND i.company_id = ii.company_id
          WHERE ii.invoice_id = inv.id AND ii.company_id = inv.company_id
        ) as items
      FROM invoices inv
      LEFT JOIN delivery_notes dn ON inv.delivery_note_id = dn.id
      LEFT JOIN trades t ON inv.trade_id = t.id
      WHERE inv.invoice_no = $1 AND inv.company_id = $2
    `, [invoice_no, req.user.company_id]);

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
  const { exclude_invoice_no } = req.query || {};

  try {
    // Query Delivery Note header info checking company_id
    const dnRes = await pool.query(
      'SELECT id, delivery_date, dispatch_through, dispatch_doc_no, motor_vehicle_no FROM delivery_notes WHERE delivery_note_no = $1 AND company_id = $2',
      [delivery_note_no, req.user.company_id]
    );
    if (dnRes.rows.length === 0) {
      return res.status(404).json({ error: 'Delivery Note not found' });
    }
    const dn = dnRes.rows[0];
    const dnDbId = dn.id;

    // Query items from delivery_note_items and calculate already invoiced quantities
    const itemsRes = await pool.query(
      `SELECT
        i.item_code,
        (
          dni.quantity - COALESCE((
            SELECT SUM((elem->>'quantity')::numeric)
            FROM grns g
            CROSS JOIN LATERAL jsonb_array_elements(COALESCE(g.rejection_items, '[]'::jsonb)) AS elem
            WHERE g.delivery_note_id = $1 AND g.company_id = $3
              AND elem->>'item_code' = i.item_code
          ), 0)
        ) as original_qty, -- Accepted quantity
        dni.rate_per_piece,
        dni.shipping_address,
        dni.delivery_date,
        i.description,
        i.drawing_number,
        COALESCE((
          SELECT SUM(ii.quantity)
          FROM invoice_items ii
          JOIN invoices inv ON ii.invoice_id = inv.id
          WHERE inv.delivery_note_id = $1 AND inv.company_id = $3
            AND ii.item_id = dni.item_id
            AND ($2::varchar IS NULL OR inv.invoice_no != $2)
        ), 0) as invoiced_qty
      FROM delivery_note_items dni
      LEFT JOIN items i ON dni.item_id = i.id AND i.company_id = dni.company_id
      WHERE dni.delivery_note_id = $1 AND dni.company_id = $3
      ORDER BY dni.id`,
      [dnDbId, exclude_invoice_no || null, req.user.company_id]
    );

    const mappedItems = itemsRes.rows.map(item => {
      const original = parseInt(item.original_qty) || 0;
      const invoiced = parseInt(item.invoiced_qty) || 0;
      const remaining = Math.max(0, original - invoiced);
      return {
        ...item,
        original_qty: original,
        delivered_qty: original,
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
    const dupCheck = await client.query('SELECT invoice_no FROM invoices WHERE invoice_no = $1 AND company_id = $2', [invoice_no, req.user.company_id]);
    if (dupCheck.rows.length > 0) {
      throw new Error('Invoice number already exists');
    }

    // 2. Fetch Delivery Note references
    const dnRes = await client.query('SELECT id, po_id, ro_id, trade_id FROM delivery_notes WHERE delivery_note_no = $1 AND company_id = $2', [delivery_note_no, req.user.company_id]);
    if (dnRes.rows.length === 0) {
      throw new Error('Delivery Note not found');
    }
    const { id: dnDbId, po_id, ro_id, trade_id: tradeDbId } = dnRes.rows[0];

    // Get trade code
    const tradeRes = await client.query('SELECT trade_id FROM trades WHERE id = $1 AND company_id = $2', [tradeDbId, req.user.company_id]);
    if (tradeRes.rows.length === 0) {
      throw new Error('Trade not found');
    }
    const trade_code = tradeRes.rows[0].trade_id;

    // 3. Insert Invoice header
    const invRes = await client.query(
      `INSERT INTO invoices (invoice_no, invoice_date, delivery_note_id, po_id, ro_id, dispatch_doc_no, dispatch_through, motor_vehicle_no, trade_id, company_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [
        invoice_no,
        invoice_date,
        dnDbId,
        po_id || null,
        ro_id || null,
        dispatch_doc_no || null,
        dispatch_through,
        motor_vehicle_no,
        tradeDbId,
        req.user.company_id
      ]
    );
    const invoiceDbId = invRes.rows[0].id;

    // 4. Insert items
    for (const item of items) {
      const itemRes = await client.query('SELECT id FROM items WHERE item_code = $1 AND company_id = $2', [item.item_code, req.user.company_id]);
      if (itemRes.rows.length === 0) {
        throw new Error(`Item ${item.item_code} not found`);
      }
      const itemDbId = itemRes.rows[0].id;

      await client.query(
        `INSERT INTO invoice_items (invoice_id, item_id, quantity, rate_per_piece, shipping_address, delivery_date, company_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          invoiceDbId,
          itemDbId,
          parseInt(item.quantity) || 0,
          parseFloat(item.rate_per_piece) || 0,
          item.shipping_address || null,
          item.delivery_date || null,
          req.user.company_id
        ]
      );
    }

    // 5. Append to trade documents
    await appendDocToTrade(client, trade_code, 'INVOICE', invoice_no, req.user.company_id);

    await client.query('COMMIT');
    res.status(201).json({ invoice_no, trade_id: trade_code });
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
       WHERE invoice_no = $5 AND company_id = $6 RETURNING id`,
      [invoice_date, dispatch_doc_no || null, dispatch_through, motor_vehicle_no, invoice_no, req.user.company_id]
    );

    if (updateHeader.rows.length === 0) {
      throw new Error('Invoice not found');
    }
    const invoiceDbId = updateHeader.rows[0].id;

    // 2. Rewrite items
    await client.query('DELETE FROM invoice_items WHERE invoice_id = $1 AND company_id = $2', [invoiceDbId, req.user.company_id]);

    for (const item of items) {
      const itemRes = await client.query('SELECT id FROM items WHERE item_code = $1 AND company_id = $2', [item.item_code, req.user.company_id]);
      if (itemRes.rows.length === 0) {
        throw new Error(`Item ${item.item_code} not found`);
      }
      const itemDbId = itemRes.rows[0].id;

      await client.query(
        `INSERT INTO invoice_items (invoice_id, item_id, quantity, rate_per_piece, shipping_address, delivery_date, company_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          invoiceDbId,
          itemDbId,
          parseInt(item.quantity) || 0,
          parseFloat(item.rate_per_piece) || 0,
          item.shipping_address || null,
          item.delivery_date || null,
          req.user.company_id
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
