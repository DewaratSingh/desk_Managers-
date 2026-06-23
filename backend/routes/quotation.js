const express = require('express');
const router = express.Router();
const { pool, appendDocToTrade } = require('../db');

// List all quotations (for autocomplete in PO form)
router.get('/', async (req, res) => {
  try {
    const { q } = req.query || {};
    const limit = req.query.limit ? parseInt(req.query.limit) : null;
    const params = [];
    
    let queryText = `
      SELECT q.quotation_no, q.rfq_no, q.quotation_date, q.trade_id, q.status,
             r.customer_id,
             (
               SELECT COALESCE(json_agg(json_build_object(
                 'item_code', qi.item_code,
                 'quantity', qi.quantity,
                 'unit_price', qi.unit_price,
                 'unit', qi.unit,
                 'description', i.description,
                 'drawing_number', i.drawing_number
               )), '[]')
               FROM quotation_items qi
               LEFT JOIN items i ON qi.item_code = i.item_code
               WHERE qi.quotation_no = q.quotation_no
             ) as items
      FROM quotations q
      LEFT JOIN rfqs r ON q.rfq_no = r.rfq_no
    `;
    
    if (q) {
      queryText += ` WHERE q.quotation_no ILIKE $1 OR q.rfq_no ILIKE $1`;
      params.push(`%${q}%`);
    }
    
    queryText += ` ORDER BY q.created_at DESC`;
    
    if (limit !== null) {
      queryText += ` LIMIT $${params.length + 1}`;
      params.push(limit);
    }
    
    const result = await pool.query(queryText, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error listing quotations:', err.message);
    res.status(500).json({ error: 'Failed to list quotations' });
  }
});

// Get a single quotation
router.get('/:quotation_no', async (req, res) => {
  const { quotation_no } = req.params;
  try {
    const result = await pool.query(`
      SELECT q.quotation_no, q.rfq_no, q.quotation_date, q.terms_and_conditions, q.trade_id, q.status, r.customer_id, c.name as customer_name, b.name as buyer_name, r.status as rfq_status,
             (
               SELECT COALESCE(json_agg(json_build_object(
                 'item_code', qi.item_code,
                 'quantity', qi.quantity,
                 'unit_price', qi.unit_price,
                 'unit', qi.unit,
                 'description', i.description,
                 'drawing_number', i.drawing_number
               )), '[]')
               FROM quotation_items qi
               LEFT JOIN items i ON qi.item_code = i.item_code
               WHERE qi.quotation_no = q.quotation_no
             ) as items,
             (
               SELECT COALESCE(json_agg(qrq.received_quotation_no), '[]')
               FROM quotation_received_quotations qrq
               WHERE qrq.quotation_no = q.quotation_no
             ) as received_quotations
      FROM quotations q
      LEFT JOIN rfqs r ON q.rfq_no = r.rfq_no
      LEFT JOIN buyers b ON r.buyer_id = b.id
      LEFT JOIN customers c ON r.customer_id = c.id
      WHERE q.quotation_no = $1
    `, [quotation_no]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Quotation not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching quotation:', err.message);
    res.status(500).json({ error: 'Failed to fetch quotation' });
  }
});

// Get next quotation reference number
router.get('/next-no', async (req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(*) FROM quotations');
    const count = parseInt(result.rows[0].count) || 0;
    const nextNo = `QT-${String(count + 1).padStart(4, '0')}`;
    res.json({ nextNo });
  } catch (err) {
    console.error('Error fetching next quotation no:', err.message);
    res.status(500).json({ error: 'Failed to generate next quotation number' });
  }
});

// Create a quotation
router.post('/', async (req, res) => {
  const { quotation_no, rfq_no, quotation_date, terms_and_conditions, items, received_quotations } = req.body || {};
  if (!rfq_no || !quotation_date) {
    return res.status(400).json({ error: 'rfq_no and quotation_date are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get trade_id from RFQ
    const rfqRes = await client.query('SELECT trade_id FROM rfqs WHERE rfq_no = $1', [rfq_no]);
    if (rfqRes.rows.length === 0) {
      throw new Error('Linked RFQ not found');
    }
    const trade_id = rfqRes.rows[0].trade_id;

    // Generate quotation_no if not provided
    let final_q_no = quotation_no;
    if (!final_q_no) {
      const countRes = await client.query('SELECT COUNT(*) FROM quotations');
      const count = parseInt(countRes.rows[0].count) || 0;
      final_q_no = `QT-${String(count + 1).padStart(4, '0')}`;
    }

    // Check duplicate
    const dupCheck = await client.query('SELECT quotation_no FROM quotations WHERE quotation_no = $1', [final_q_no]);
    if (dupCheck.rows.length > 0) {
      throw new Error('Quotation number already exists');
    }

    // Insert Quotation
    await client.query(
      'INSERT INTO quotations (quotation_no, rfq_no, quotation_date, terms_and_conditions, trade_id) VALUES ($1, $2, $3, $4, $5)',
      [final_q_no, rfq_no, quotation_date, terms_and_conditions, trade_id]
    );

    // Insert Items
    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        await client.query(
          'INSERT INTO quotation_items (quotation_no, item_code, quantity, unit_price, unit) VALUES ($1, $2, $3, $4, $5)',
          [final_q_no, item.item_code, parseInt(item.quantity) || 1, parseFloat(item.unit_price) || 0, item.unit || 'Piece']
        );
      }
    }

    // Insert Linked Received Quotations
    if (Array.isArray(received_quotations) && received_quotations.length > 0) {
      for (const rqNo of received_quotations) {
        await client.query(
          'INSERT INTO quotation_received_quotations (quotation_no, received_quotation_no) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [final_q_no, rqNo]
        );
      }
    }

    // Append document reference to Trade history
    if (trade_id) {
      await appendDocToTrade(client, trade_id, 'QUOTATION', final_q_no);
      await client.query(
        "INSERT INTO status (name) VALUES ('quotation') ON CONFLICT (name) DO NOTHING"
      );
      await client.query(
        "UPDATE trades SET status = 'quotation' WHERE trade_id = $1",
        [trade_id]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ quotation_no: final_q_no });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating quotation:', err.message);
    res.status(500).json({ error: err.message || 'Failed to create quotation' });
  } finally {
    client.release();
  }
});

// Update a quotation
router.put('/:quotation_no', async (req, res) => {
  const { quotation_no } = req.params;
  const { quotation_date, terms_and_conditions, items, received_quotations } = req.body || {};
  if (!quotation_date) {
    return res.status(400).json({ error: 'quotation_date required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Update main quotation
    const updateResult = await client.query(
      'UPDATE quotations SET quotation_date = $1, terms_and_conditions = $2 WHERE quotation_no = $3 RETURNING *',
      [quotation_date, terms_and_conditions, quotation_no]
    );
    if (updateResult.rows.length === 0) {
      throw new Error('Quotation not found');
    }

    // Replace items
    await client.query('DELETE FROM quotation_items WHERE quotation_no = $1', [quotation_no]);
    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        await client.query(
          'INSERT INTO quotation_items (quotation_no, item_code, quantity, unit_price, unit) VALUES ($1, $2, $3, $4, $5)',
          [quotation_no, item.item_code, parseInt(item.quantity) || 1, parseFloat(item.unit_price) || 0, item.unit || 'Piece']
        );
      }
    }

    // Replace linked received quotations
    await client.query('DELETE FROM quotation_received_quotations WHERE quotation_no = $1', [quotation_no]);
    if (Array.isArray(received_quotations) && received_quotations.length > 0) {
      for (const rqNo of received_quotations) {
        await client.query(
          'INSERT INTO quotation_received_quotations (quotation_no, received_quotation_no) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [quotation_no, rqNo]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ quotation_no });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating quotation:', err.message);
    res.status(500).json({ error: err.message || 'Failed to update quotation' });
  } finally {
    client.release();
  }
});

// Reject a quotation
router.put('/:quotation_no/reject', async (req, res) => {
  const { quotation_no } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      "UPDATE quotations SET status = 'rejected' WHERE quotation_no = $1 RETURNING *",
      [quotation_no]
    );
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Quotation not found' });
    }
    const quotation = result.rows[0];
    if (quotation.trade_id) {
      await client.query(
        "INSERT INTO status (name) VALUES ('rejected') ON CONFLICT (name) DO NOTHING"
      );
      await client.query(
        "UPDATE trades SET status = 'rejected' WHERE trade_id = $1",
        [quotation.trade_id]
      );
    }
    await client.query('COMMIT');
    res.json(quotation);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error rejecting quotation:', err.message);
    res.status(500).json({ error: 'Failed to reject quotation' });
  } finally {
    client.release();
  }
});

module.exports = router;
