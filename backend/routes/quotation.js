const express = require('express');
const router = express.Router();
const { pool, appendDocToTrade } = require('../db');

// List all quotations (for autocomplete in PO form)
router.get('/', async (req, res) => {
  try {
    const { q } = req.query || {};
    const limit = req.query.limit ? parseInt(req.query.limit) : null;
    const params = [req.user.company_id];
    
    let queryText = `
      SELECT q.quotation_no, r.rfq_no, q.quotation_date, t.trade_id, q.status,
             c.customer_code as customer_id,
             (
               SELECT COALESCE(json_agg(json_build_object(
                 'item_code', i.item_code,
                 'quantity', qi.quantity,
                 'unit_price', qi.unit_price,
                 'unit', qi.unit,
                 'description', i.description,
                 'drawing_number', i.drawing_number
               )), '[]')
               FROM quotation_items qi
               LEFT JOIN items i ON qi.item_id = i.id AND i.company_id = qi.company_id
               WHERE qi.quotation_id = q.id AND qi.company_id = q.company_id
             ) as items
      FROM quotations q
      LEFT JOIN rfqs r ON q.rfq_id = r.id AND r.company_id = q.company_id
      LEFT JOIN customers c ON r.customer_id = c.id AND c.company_id = q.company_id
      LEFT JOIN trades t ON q.trade_id = t.id AND t.company_id = q.company_id
      WHERE q.company_id = $1
    `;
    
    if (q) {
      queryText += ` AND (q.quotation_no ILIKE $2 OR r.rfq_no ILIKE $2)`;
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
      SELECT q.quotation_no, r.rfq_no, q.quotation_date, q.terms_and_conditions, t.trade_id, q.status, c.customer_code as customer_id, c.name as customer_name, b.name as buyer_name, r.status as rfq_status,
             (
               SELECT COALESCE(json_agg(json_build_object(
                 'item_code', i.item_code,
                 'quantity', qi.quantity,
                 'unit_price', qi.unit_price,
                 'unit', qi.unit,
                 'description', i.description,
                 'drawing_number', i.drawing_number
               )), '[]')
               FROM quotation_items qi
               LEFT JOIN items i ON qi.item_id = i.id AND i.company_id = qi.company_id
               WHERE qi.quotation_id = q.id AND qi.company_id = q.company_id
             ) as items,
             (
               SELECT COALESCE(json_agg(rq.received_quotation_no), '[]')
               FROM quotation_received_quotations qrq
               JOIN received_quotations rq ON qrq.received_quotation_id = rq.id
               WHERE qrq.quotation_id = q.id AND qrq.company_id = q.company_id
             ) as received_quotations
      FROM quotations q
      LEFT JOIN rfqs r ON q.rfq_id = r.id AND r.company_id = q.company_id
      LEFT JOIN buyers b ON r.buyer_id = b.id AND b.company_id = q.company_id
      LEFT JOIN customers c ON r.customer_id = c.id AND c.company_id = q.company_id
      LEFT JOIN trades t ON q.trade_id = t.id AND t.company_id = q.company_id
      WHERE q.quotation_no = $1 AND q.company_id = $2
    `, [quotation_no, req.user.company_id]);

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
    const result = await pool.query('SELECT COUNT(*) FROM quotations WHERE company_id = $1', [req.user.company_id]);
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

    // Get trade_id and trade_code from RFQ checking company_id
    const rfqRes = await client.query(
      'SELECT r.id, r.trade_id as trade_db_id, t.trade_id as trade_code FROM rfqs r LEFT JOIN trades t ON r.trade_id = t.id WHERE r.rfq_no = $1 AND r.company_id = $2',
      [rfq_no, req.user.company_id]
    );
    if (rfqRes.rows.length === 0) {
      throw new Error('Linked RFQ not found');
    }
    const rfqDbId = rfqRes.rows[0].id;
    const tradeDbId = rfqRes.rows[0].trade_db_id;
    const trade_code = rfqRes.rows[0].trade_code;

    // Generate quotation_no if not provided
    let final_q_no = quotation_no;
    if (!final_q_no) {
      const countRes = await client.query('SELECT COUNT(*) FROM quotations WHERE company_id = $1', [req.user.company_id]);
      const count = parseInt(countRes.rows[0].count) || 0;
      final_q_no = `QT-${String(count + 1).padStart(4, '0')}`;
    }

    // Check duplicate
    const dupCheck = await client.query('SELECT quotation_no FROM quotations WHERE quotation_no = $1 AND company_id = $2', [final_q_no, req.user.company_id]);
    if (dupCheck.rows.length > 0) {
      throw new Error('Quotation number already exists');
    }

    // Insert Quotation
    const qInsertRes = await client.query(
      'INSERT INTO quotations (quotation_no, rfq_id, quotation_date, terms_and_conditions, trade_id, company_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [final_q_no, rfqDbId, quotation_date, terms_and_conditions, tradeDbId, req.user.company_id]
    );
    const quotationDbId = qInsertRes.rows[0].id;

    // Insert Items
    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        const itemRes = await client.query('SELECT id FROM items WHERE item_code = $1 AND company_id = $2', [item.item_code, req.user.company_id]);
        if (itemRes.rows.length === 0) {
          throw new Error(`Item ${item.item_code} not found`);
        }
        const itemDbId = itemRes.rows[0].id;
        await client.query(
          'INSERT INTO quotation_items (quotation_id, item_id, quantity, unit_price, unit, company_id) VALUES ($1, $2, $3, $4, $5, $6)',
          [quotationDbId, itemDbId, parseInt(item.quantity) || 1, parseFloat(item.unit_price) || 0, item.unit || 'Piece', req.user.company_id]
        );
      }
    }

    // Insert Linked Received Quotations
    if (Array.isArray(received_quotations) && received_quotations.length > 0) {
      for (const rqNo of received_quotations) {
        const rqRes = await client.query('SELECT id FROM received_quotations WHERE received_quotation_no = $1 AND company_id = $2', [rqNo, req.user.company_id]);
        if (rqRes.rows.length > 0) {
          const rqDbId = rqRes.rows[0].id;
          await client.query(
            'INSERT INTO quotation_received_quotations (quotation_id, received_quotation_id, company_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
            [quotationDbId, rqDbId, req.user.company_id]
          );
        }
      }
    }

    // Append document reference to Trade history
    if (tradeDbId) {
      await appendDocToTrade(client, trade_code, 'QUOTATION', final_q_no, req.user.company_id);
      await client.query(
        "INSERT INTO status (name, company_id) VALUES ('quotation', $1) ON CONFLICT (name, company_id) DO NOTHING",
        [req.user.company_id]
      );
      await client.query(
        "UPDATE trades SET status = 'quotation' WHERE id = $1 AND company_id = $2",
        [tradeDbId, req.user.company_id]
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
      'UPDATE quotations SET quotation_date = $1, terms_and_conditions = $2 WHERE quotation_no = $3 AND company_id = $4 RETURNING id',
      [quotation_date, terms_and_conditions, quotation_no, req.user.company_id]
    );
    if (updateResult.rows.length === 0) {
      throw new Error('Quotation not found');
    }
    const quotationDbId = updateResult.rows[0].id;

    // Replace items
    await client.query('DELETE FROM quotation_items WHERE quotation_id = $1 AND company_id = $2', [quotationDbId, req.user.company_id]);
    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        const itemRes = await client.query('SELECT id FROM items WHERE item_code = $1 AND company_id = $2', [item.item_code, req.user.company_id]);
        if (itemRes.rows.length === 0) {
          throw new Error(`Item ${item.item_code} not found`);
        }
        const itemDbId = itemRes.rows[0].id;
        await client.query(
          'INSERT INTO quotation_items (quotation_id, item_id, quantity, unit_price, unit, company_id) VALUES ($1, $2, $3, $4, $5, $6)',
          [quotationDbId, itemDbId, parseInt(item.quantity) || 1, parseFloat(item.unit_price) || 0, item.unit || 'Piece', req.user.company_id]
        );
      }
    }

    // Replace linked received quotations
    await client.query('DELETE FROM quotation_received_quotations WHERE quotation_id = $1 AND company_id = $2', [quotationDbId, req.user.company_id]);
    if (Array.isArray(received_quotations) && received_quotations.length > 0) {
      for (const rqNo of received_quotations) {
        const rqRes = await client.query('SELECT id FROM received_quotations WHERE received_quotation_no = $1 AND company_id = $2', [rqNo, req.user.company_id]);
        if (rqRes.rows.length > 0) {
          const rqDbId = rqRes.rows[0].id;
          await client.query(
            'INSERT INTO quotation_received_quotations (quotation_id, received_quotation_id, company_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
            [quotationDbId, rqDbId, req.user.company_id]
          );
        }
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
      "UPDATE quotations SET status = 'rejected' WHERE quotation_no = $1 AND company_id = $2 RETURNING *",
      [quotation_no, req.user.company_id]
    );
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Quotation not found' });
    }
    const quotation = result.rows[0];
    if (quotation.trade_id) {
      await client.query(
        "INSERT INTO status (name, company_id) VALUES ('rejected', $1) ON CONFLICT (name, company_id) DO NOTHING",
        [req.user.company_id]
      );
      await client.query(
        "UPDATE trades SET status = 'rejected' WHERE id = $1 AND company_id = $2",
        [quotation.trade_id, req.user.company_id]
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
