const express = require('express');
const { pool } = require('../db');

const router = express.Router();

/**
 * @route   GET /api/delivery-notes
 * @desc    Fetch all delivery notes with search, pagination and linked entity details
 */
router.get('/', async (req, res) => {
  const { search } = req.query;
  const limit = parseInt(req.query.limit) || 20;
  const offset = parseInt(req.query.offset) || 0;

  try {
    let whereClause = '';
    let values = [limit, offset];

    if (search) {
      whereClause = `
        WHERE dn.delivery_note_no ILIKE $3 
           OR dn.po_no ILIKE $3 
           OR dn.ro_no ILIKE $3 
           OR COALESCE(c.name, cro.name) ILIKE $3
           OR COALESCE(c.id, cro.id) ILIKE $3
           OR EXISTS (
             SELECT 1 FROM delivery_note_items dni2 
             WHERE dni2.delivery_note_no = dn.delivery_note_no AND dni2.item_code ILIKE $3
           )
      `;
      values = [limit, offset, `%${search}%`];
    }

    const queryText = `
      SELECT 
        dn.*,
        po.po_date,
        po.quotation_no,
        COALESCE(q.quotation_date, rq.quotation_date) AS quotation_date,
        r.rfq_no,
        ro.ro_date,
        COALESCE(r.customer_id, rq.customer_id, ro.customer_id) AS customer_id,
        COALESCE(c.name, cro.name) AS customer_name,
        COALESCE(c.address, cro.address) AS customer_address,
        COALESCE(b.name, bro.name) AS buyer_name,
        COALESCE(b.email, bro.email) AS buyer_email,
        COALESCE(b.phone, bro.phone) AS buyer_phone,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'item_code', dni.item_code,
                'description', i.description,
                'drawing_number', i.drawing_number,
                'quantity', dni.quantity,
                'rate_per_piece', dni.rate_per_piece,
                'shipping_address', COALESCE(poi.shipping_address, roi.shipping_address),
                'delivery_date', COALESCE(poi.delivery_date, roi.delivery_date)
              ) ORDER BY dni.id
            )
            FROM delivery_note_items dni
            LEFT JOIN items i ON dni.item_code = i.item_code
            LEFT JOIN purchase_order_items poi ON dn.po_no = poi.po_no AND dni.item_code = poi.item_code
            LEFT JOIN release_order_items roi ON dn.ro_no = roi.ro_no AND dni.item_code = roi.item_code
            WHERE dni.delivery_note_no = dn.delivery_note_no
          ),
          '[]'::json
        ) AS items
      FROM delivery_notes dn
      LEFT JOIN purchase_orders po ON dn.po_no = po.po_no
      LEFT JOIN quotations q ON po.quotation_no = q.quotation_no
      LEFT JOIN rfqs r ON q.rfq_no = r.rfq_no
      LEFT JOIN received_quotations rq ON po.quotation_no = rq.received_quotation_no
      LEFT JOIN customers c ON COALESCE(r.customer_id, rq.customer_id) = c.id
      LEFT JOIN buyers b ON COALESCE(r.buyer_id, rq.buyer_id) = b.id
      LEFT JOIN release_orders ro ON dn.ro_no = ro.ro_no
      LEFT JOIN customers cro ON ro.customer_id = cro.id
      LEFT JOIN buyers bro ON ro.buyer_id = bro.id
      ${whereClause}
      ORDER BY dn.created_at DESC
      LIMIT $1 OFFSET $2
    `;
    const { rows } = await pool.query(queryText, values);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching delivery notes:', error);
    res.status(500).json({ error: 'Server error fetching delivery notes' });
  }
});

/**
 * @route   POST /api/delivery-notes
 * @desc    Create a new delivery note with its items
 */
router.post('/', async (req, res) => {
  const {
    delivery_note_no, po_no, ro_no, delivery_date, dispatch_doc_no, dispatch_through, motor_vehicle_no, items = [], trade_id: bodyTradeId
  } = req.body;

  if (!delivery_note_no) return res.status(400).json({ error: 'Delivery Note Number is required' });
  if (!delivery_date) return res.status(400).json({ error: 'Delivery Date is required' });
  if (items.length === 0) return res.status(400).json({ error: 'At least one item is required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Auto-resolve trade_id from po_no or ro_no if not passed
    let trade_id = bodyTradeId;
    if (!trade_id) {
      if (po_no) {
        const poRes = await client.query('SELECT trade_id FROM purchase_orders WHERE po_no = $1', [po_no]);
        if (poRes.rows.length > 0) {
          trade_id = poRes.rows[0].trade_id;
        }
      } else if (ro_no) {
        const roRes = await client.query('SELECT trade_id FROM release_orders WHERE ro_no = $1', [ro_no]);
        if (roRes.rows.length > 0) {
          trade_id = roRes.rows[0].trade_id;
        }
      }
    }

    // Duplicate check
    const checkDn = await client.query('SELECT delivery_note_no FROM delivery_notes WHERE delivery_note_no = $1', [delivery_note_no]);
    if (checkDn.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'A Delivery Note with this number already exists' });
    }

    // Header Insert
    await client.query(`
      INSERT INTO delivery_notes (delivery_note_no, po_no, ro_no, delivery_date, dispatch_doc_no, dispatch_through, motor_vehicle_no, trade_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [delivery_note_no, po_no || null, ro_no || null, delivery_date, dispatch_doc_no || null, dispatch_through || null, motor_vehicle_no || null, trade_id]);

    // Link document in trades table
    if (trade_id) {
      const { appendDocToTrade } = require('../db');
      await appendDocToTrade(client, trade_id, 'DN', delivery_note_no);
    }

    // Items Insert
    for (const item of items) {
      const rate = parseFloat(item.rate_per_piece);
      const qty = parseInt(item.quantity);
      
      if (isNaN(rate) || rate < 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Valid rate per piece required for item ${item.item_code}` });
      }
      if (isNaN(qty) || qty <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Quantity must be > 0 for item ${item.item_code}` });
      }

      const shipAddr = item.shipping_address || null;
      const delivDate = item.delivery_date ? item.delivery_date.slice(0, 10) : null;
      await client.query(`
        INSERT INTO delivery_note_items (delivery_note_no, item_code, quantity, rate_per_piece, shipping_address, delivery_date)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [delivery_note_no, item.item_code, qty, rate, shipAddr, delivDate]);
    }

    await client.query('COMMIT');

    // Return the full object
    const { rows } = await pool.query(`
      SELECT 
        dn.*,
        po.po_date, po.quotation_no, COALESCE(q.quotation_date, rq.quotation_date) AS quotation_date, r.rfq_no,
        ro.ro_date,
        COALESCE(r.customer_id, rq.customer_id, ro.customer_id) AS customer_id,
        COALESCE(c.name, cro.name) AS customer_name,
        COALESCE(c.address, cro.address) AS customer_address,
        COALESCE(b.name, bro.name) AS buyer_name,
        COALESCE(b.email, bro.email) AS buyer_email,
        COALESCE(b.phone, bro.phone) AS buyer_phone,
        COALESCE((SELECT json_agg(json_build_object('item_code', dni.item_code, 'description', i.description, 'drawing_number', i.drawing_number, 'quantity', dni.quantity, 'rate_per_piece', dni.rate_per_piece, 'shipping_address', COALESCE(poi.shipping_address, roi.shipping_address), 'delivery_date', COALESCE(poi.delivery_date, roi.delivery_date)) ORDER BY dni.id) FROM delivery_note_items dni LEFT JOIN items i ON dni.item_code = i.item_code LEFT JOIN purchase_order_items poi ON dn.po_no = poi.po_no AND dni.item_code = poi.item_code LEFT JOIN release_order_items roi ON dn.ro_no = roi.ro_no AND dni.item_code = roi.item_code WHERE dni.delivery_note_no = dn.delivery_note_no), '[]'::json) AS items
      FROM delivery_notes dn
      LEFT JOIN purchase_orders po ON dn.po_no = po.po_no
      LEFT JOIN quotations q ON po.quotation_no = q.quotation_no
      LEFT JOIN rfqs r ON q.rfq_no = r.rfq_no
      LEFT JOIN received_quotations rq ON po.quotation_no = rq.received_quotation_no
      LEFT JOIN customers c ON COALESCE(r.customer_id, rq.customer_id) = c.id
      LEFT JOIN buyers b ON COALESCE(r.buyer_id, rq.buyer_id) = b.id
      LEFT JOIN release_orders ro ON dn.ro_no = ro.ro_no
      LEFT JOIN customers cro ON ro.customer_id = cro.id
      LEFT JOIN buyers bro ON ro.buyer_id = bro.id
      WHERE dn.delivery_note_no = $1
    `, [delivery_note_no]);

    res.status(201).json(rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating delivery note:', error);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

/**
 * @route   PUT /api/delivery-notes/:id
 * @desc    Update header and sync items
 */
router.put('/:delivery_note_no', async (req, res) => {
  const { delivery_note_no } = req.params;
  const { po_no, ro_no, delivery_date, dispatch_doc_no, dispatch_through, motor_vehicle_no, items = [] } = req.body;

  if (!delivery_date) return res.status(400).json({ error: 'Delivery Date is required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const updateResult = await client.query(`
      UPDATE delivery_notes 
      SET po_no = $1, ro_no = $2, delivery_date = $3, dispatch_doc_no = $4, dispatch_through = $5, motor_vehicle_no = $6
      WHERE delivery_note_no = $7
      RETURNING *
    `, [po_no || null, ro_no || null, delivery_date, dispatch_doc_no || null, dispatch_through || null, motor_vehicle_no || null, delivery_note_no]);

    if (updateResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Delivery Note not found' });
    }

    await client.query('DELETE FROM delivery_note_items WHERE delivery_note_no = $1', [delivery_note_no]);
    for (const item of items) {
      const shipAddr = item.shipping_address || null;
      const delivDate = item.delivery_date ? item.delivery_date.slice(0, 10) : null;
      await client.query(`
        INSERT INTO delivery_note_items (delivery_note_no, item_code, quantity, rate_per_piece, shipping_address, delivery_date)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [delivery_note_no, item.item_code, parseInt(item.quantity), parseFloat(item.rate_per_piece), shipAddr, delivDate]);
    }

    await client.query('COMMIT');
    
    // Return fresh state
    const { rows } = await pool.query(`
      SELECT 
        dn.*,
        po.po_date, po.quotation_no, COALESCE(q.quotation_date, rq.quotation_date) AS quotation_date, r.rfq_no,
        ro.ro_date,
        COALESCE(r.customer_id, rq.customer_id, ro.customer_id) AS customer_id,
        COALESCE(c.name, cro.name) AS customer_name,
        COALESCE(c.address, cro.address) AS customer_address,
        COALESCE(b.name, bro.name) AS buyer_name,
        COALESCE(b.email, bro.email) AS buyer_email,
        COALESCE(b.phone, bro.phone) AS buyer_phone,
        COALESCE((SELECT json_agg(json_build_object('item_code', dni.item_code, 'description', i.description, 'drawing_number', i.drawing_number, 'quantity', dni.quantity, 'rate_per_piece', dni.rate_per_piece, 'shipping_address', COALESCE(poi.shipping_address, roi.shipping_address), 'delivery_date', COALESCE(poi.delivery_date, roi.delivery_date)) ORDER BY dni.id) FROM delivery_note_items dni LEFT JOIN items i ON dni.item_code = i.item_code LEFT JOIN purchase_order_items poi ON dn.po_no = poi.po_no AND dni.item_code = poi.item_code LEFT JOIN release_order_items roi ON dn.ro_no = roi.ro_no AND dni.item_code = roi.item_code WHERE dni.delivery_note_no = dn.delivery_note_no), '[]'::json) AS items
      FROM delivery_notes dn
      LEFT JOIN purchase_orders po ON dn.po_no = po.po_no
      LEFT JOIN quotations q ON po.quotation_no = q.quotation_no
      LEFT JOIN rfqs r ON q.rfq_no = r.rfq_no
      LEFT JOIN received_quotations rq ON po.quotation_no = rq.received_quotation_no
      LEFT JOIN customers c ON COALESCE(r.customer_id, rq.customer_id) = c.id
      LEFT JOIN buyers b ON COALESCE(r.buyer_id, rq.buyer_id) = b.id
      LEFT JOIN release_orders ro ON dn.ro_no = ro.ro_no
      LEFT JOIN customers cro ON ro.customer_id = cro.id
      LEFT JOIN buyers bro ON ro.buyer_id = bro.id
      WHERE dn.delivery_note_no = $1
    `, [delivery_note_no]);

    res.json(rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating delivery note:', error);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

router.delete('/:delivery_note_no', async (req, res) => {
  const { delivery_note_no } = req.params;
  try {
    const result = await pool.query('DELETE FROM delivery_notes WHERE delivery_note_no = $1', [delivery_note_no]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
