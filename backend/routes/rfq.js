const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Get all RFQs (supports search & limit)
router.get('/', async (req, res) => {
  const { q } = req.query || {};
  try {
    let queryText = `
      SELECT r.rfq_no, r.rfq_date, r.commercial_bid_due_date, r.technical_bid_due_date, r.buyer_id, b.name as buyer_name, b.email as buyer_email, b.phone as buyer_phone, c.customer_code as customer_id, c.name as customer_name, c.address as customer_address, r.status, t.trade_id, r.created_at,
             COALESCE(
               (
                 SELECT json_agg(
                   json_build_object(
                     'item_code', i.item_code,
                     'quantity', ri.quantity,
                     'unit', ri.unit,
                     'unit_price', COALESCE((
                       SELECT qi.unit_price 
                       FROM quotations q 
                       LEFT JOIN quotation_items qi ON q.id = qi.quotation_id 
                       WHERE q.rfq_id = r.id AND qi.item_id = ri.item_id AND q.company_id = r.company_id AND qi.company_id = r.company_id
                       LIMIT 1
                     ), 0),
                     'description', i.description,
                     'drawing_number', i.drawing_number
                   )
                 )
                 FROM rfq_items ri
                 LEFT JOIN items i ON ri.item_id = i.id
                 WHERE ri.rfq_id = r.id AND ri.company_id = r.company_id
               ),
               '[]'
             ) as items
      FROM rfqs r
      LEFT JOIN buyers b ON r.buyer_id = b.id
      LEFT JOIN customers c ON r.customer_id = c.id
      LEFT JOIN trades t ON r.trade_id = t.id
      WHERE r.company_id = $1
    `;
    const params = [req.user.company_id];
    if (q) {
      queryText += ` AND (r.rfq_no ILIKE $2 OR c.name ILIKE $2)`;
      params.push(`%${q}%`);
    }
    queryText += ` ORDER BY r.created_at DESC`;

    const limit = req.query.limit ? parseInt(req.query.limit) : null;
    if (limit !== null) {
      queryText += ` LIMIT $${params.length + 1}`;
      params.push(limit);
    } else if (q) {
      queryText += ` LIMIT 5`;
    }

    const result = await pool.query(queryText, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching rfqs:', err.message);
    res.status(500).json({ error: 'Failed to fetch RFQs' });
  }
});

// Create an RFQ and Quotation
router.post('/', async (req, res) => {
  const { rfq_no, rfq_date, commercial_bid_due_date, technical_bid_due_date, buyer_id, customer_id, items } = req.body || {};
  if (!rfq_no || !rfq_date || !commercial_bid_due_date || !technical_bid_due_date || !buyer_id || !customer_id) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Check duplicate rfq_no
    const dupCheck = await client.query('SELECT rfq_no FROM rfqs WHERE rfq_no = $1 AND company_id = $2', [rfq_no, req.user.company_id]);
    if (dupCheck.rows.length > 0) {
      throw new Error('RFQ number already exists');
    }

    // Resolve customerDbId
    const custRes = await client.query('SELECT id FROM customers WHERE customer_code = $1 AND company_id = $2', [customer_id, req.user.company_id]);
    if (custRes.rows.length === 0) {
      throw new Error('Customer not found');
    }
    const customerDbId = custRes.rows[0].id;

    // Generate trade_id
    const trade_id = 'TRD-' + rfq_no.replace(/[\s/]+/g, '-');

    // Check duplicate trade_id
    const tradeDupCheck = await client.query('SELECT trade_id FROM trades WHERE trade_id = $1 AND company_id = $2', [trade_id, req.user.company_id]);
    if (tradeDupCheck.rows.length > 0) {
      throw new Error('Trade ID already exists for this RFQ');
    }

    // Generate quotation_no
    const qCountRes = await client.query('SELECT COUNT(*) FROM quotations WHERE company_id = $1', [req.user.company_id]);
    const qCount = parseInt(qCountRes.rows[0].count) || 0;
    const quotation_no = `QT-${String(qCount + 1).padStart(4, '0')}`;

    // Insert trade document
    const tradeRes = await client.query(
      "INSERT INTO trades (trade_id, status, trade_type, documents, company_id) VALUES ($1, 'quotation', 'sell', $2, $3) RETURNING id",
      [trade_id, JSON.stringify([{ type: 'RFQ', id: rfq_no }, { type: 'QUOTATION', id: quotation_no }]), req.user.company_id]
    );
    const tradeDbId = tradeRes.rows[0].id;

    // Insert RFQ
    const rfqRes = await client.query(
      'INSERT INTO rfqs (rfq_no, rfq_date, commercial_bid_due_date, technical_bid_due_date, buyer_id, customer_id, status, trade_id, company_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id',
      [rfq_no, rfq_date, commercial_bid_due_date, technical_bid_due_date, buyer_id, customerDbId, 'quotated', tradeDbId, req.user.company_id]
    );
    const rfqDbId = rfqRes.rows[0].id;

    // Insert RFQ Items
    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        const itemRes = await client.query('SELECT id FROM items WHERE item_code = $1 AND company_id = $2', [item.item_code, req.user.company_id]);
        if (itemRes.rows.length === 0) {
          throw new Error(`Item ${item.item_code} not found`);
        }
        const itemDbId = itemRes.rows[0].id;
        await client.query(
          'INSERT INTO rfq_items (rfq_id, item_id, quantity, unit, company_id) VALUES ($1, $2, $3, $4, $5)',
          [rfqDbId, itemDbId, parseInt(item.quantity) || 1, item.unit || 'Piece', req.user.company_id]
        );
      }
    }

    // Insert Quotation
    const qInsertRes = await client.query(
      'INSERT INTO quotations (quotation_no, rfq_id, quotation_date, terms_and_conditions, trade_id, status, company_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
      [quotation_no, rfqDbId, rfq_date, 'Standard Quotation terms', tradeDbId, 'active', req.user.company_id]
    );
    const quotationDbId = qInsertRes.rows[0].id;

    // Insert Quotation Items
    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        const itemRes = await client.query('SELECT id FROM items WHERE item_code = $1 AND company_id = $2', [item.item_code, req.user.company_id]);
        const itemDbId = itemRes.rows[0].id;
        await client.query(
          'INSERT INTO quotation_items (quotation_id, item_id, quantity, unit_price, unit, company_id) VALUES ($1, $2, $3, $4, $5, $6)',
          [quotationDbId, itemDbId, parseInt(item.quantity) || 1, parseFloat(item.unit_price) || 0, item.unit || 'Piece', req.user.company_id]
        );
      }
    }

    // Insert status name into status table if not exists
    await client.query(
      "INSERT INTO status (name, company_id) VALUES ('quotation', $1) ON CONFLICT (name, company_id) DO NOTHING",
      [req.user.company_id]
    );

    await client.query('COMMIT');

    res.status(201).json({ rfq_no, trade_id, quotation_no });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating RFQ & Quotation:', err.message);
    res.status(500).json({ error: err.message || 'Failed to create RFQ & Quotation' });
  } finally {
    client.release();
  }
});

// Get a single RFQ
router.get('/:rfq_no', async (req, res) => {
  const { rfq_no } = req.params;
  try {
    const result = await pool.query(`
      SELECT r.rfq_no, r.rfq_date, r.commercial_bid_due_date, r.technical_bid_due_date, r.buyer_id, b.name as buyer_name, b.email as buyer_email, b.phone as buyer_phone, c.customer_code as customer_id, c.name as customer_name, c.address as customer_address, r.status, t.trade_id, r.created_at,
             COALESCE(
               json_agg(
                 json_build_object(
                   'item_code', i.item_code,
                   'quantity', ri.quantity,
                   'unit', ri.unit,
                   'unit_price', COALESCE(qi.unit_price, 0),
                   'description', i.description,
                   'drawing_number', i.drawing_number
                 )
               ) FILTER (WHERE ri.item_id IS NOT NULL),
               '[]'
             ) as items
      FROM rfqs r
      LEFT JOIN buyers b ON r.buyer_id = b.id
      LEFT JOIN customers c ON r.customer_id = c.id
      LEFT JOIN rfq_items ri ON r.id = ri.rfq_id AND ri.company_id = r.company_id
      LEFT JOIN items i ON ri.item_id = i.id AND i.company_id = r.company_id
      LEFT JOIN quotations q ON r.id = q.rfq_id AND q.company_id = r.company_id
      LEFT JOIN quotation_items qi ON q.id = qi.quotation_id AND ri.item_id = qi.item_id AND qi.company_id = r.company_id
      LEFT JOIN trades t ON r.trade_id = t.id AND t.company_id = r.company_id
      WHERE r.rfq_no = $1 AND r.company_id = $2
      GROUP BY r.id, b.name, b.email, b.phone, c.customer_code, c.name, c.address, t.trade_id
    `, [rfq_no, req.user.company_id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'RFQ not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching rfq:', err.message);
    res.status(500).json({ error: 'Failed to fetch RFQ' });
  }
});

// Update an RFQ & Quotation
router.put('/:rfq_no', async (req, res) => {
  const { rfq_no } = req.params;
  const { rfq_date, commercial_bid_due_date, technical_bid_due_date, buyer_id, customer_id, items } = req.body || {};
  if (!rfq_date || !commercial_bid_due_date || !technical_bid_due_date || !buyer_id || !customer_id) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Resolve customerDbId
    const custRes = await client.query('SELECT id FROM customers WHERE customer_code = $1 AND company_id = $2', [customer_id, req.user.company_id]);
    if (custRes.rows.length === 0) {
      throw new Error('Customer not found');
    }
    const customerDbId = custRes.rows[0].id;

    // Update RFQ
    const updateResult = await client.query(
      'UPDATE rfqs SET rfq_date = $1, commercial_bid_due_date = $2, technical_bid_due_date = $3, buyer_id = $4, customer_id = $5 WHERE rfq_no = $6 AND company_id = $7 RETURNING *',
      [rfq_date, commercial_bid_due_date, technical_bid_due_date, buyer_id, customerDbId, rfq_no, req.user.company_id]
    );
    if (updateResult.rows.length === 0) {
      throw new Error('RFQ not found');
    }
    const rfq = updateResult.rows[0];

    // Find or create linked quotation
    const qtnCheck = await client.query('SELECT id, quotation_no FROM quotations WHERE rfq_id = $1 AND company_id = $2', [rfq.id, req.user.company_id]);
    let quotation_no;
    let quotationDbId;
    if (qtnCheck.rows.length > 0) {
      quotation_no = qtnCheck.rows[0].quotation_no;
      quotationDbId = qtnCheck.rows[0].id;
      // Update quotation date
      await client.query(
        'UPDATE quotations SET quotation_date = $1 WHERE id = $2 AND company_id = $3',
        [rfq_date, quotationDbId, req.user.company_id]
      );
    } else {
      const qCountRes = await client.query('SELECT COUNT(*) FROM quotations WHERE company_id = $1', [req.user.company_id]);
      const qCount = parseInt(qCountRes.rows[0].count) || 0;
      quotation_no = `QT-${String(qCount + 1).padStart(4, '0')}`;
      
      const qInsert = await client.query(
        'INSERT INTO quotations (quotation_no, rfq_id, quotation_date, terms_and_conditions, trade_id, status, company_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
        [quotation_no, rfq.id, rfq_date, 'Standard Quotation terms', rfq.trade_id, 'active', req.user.company_id]
      );
      quotationDbId = qInsert.rows[0].id;
      
      // Ensure the trade has both RFQ and Quotation documents
      if (rfq.trade_id) {
        const tradeRes = await client.query('SELECT documents FROM trades WHERE id = $1 AND company_id = $2', [rfq.trade_id, req.user.company_id]);
        if (tradeRes.rows.length > 0) {
          let documents = tradeRes.rows[0].documents || [];
          if (!documents.some(d => d.type === 'QUOTATION')) {
            documents.push({ type: 'QUOTATION', id: quotation_no });
            await client.query('UPDATE trades SET documents = $1 WHERE id = $2 AND company_id = $3', [JSON.stringify(documents), rfq.trade_id, req.user.company_id]);
          }
        }
      }
    }

    // Delete and replace RFQ items
    await client.query('DELETE FROM rfq_items WHERE rfq_id = $1 AND company_id = $2', [rfq.id, req.user.company_id]);
    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        const itemRes = await client.query('SELECT id FROM items WHERE item_code = $1 AND company_id = $2', [item.item_code, req.user.company_id]);
        if (itemRes.rows.length === 0) {
          throw new Error(`Item ${item.item_code} not found`);
        }
        const itemDbId = itemRes.rows[0].id;
        await client.query(
          'INSERT INTO rfq_items (rfq_id, item_id, quantity, unit, company_id) VALUES ($1, $2, $3, $4, $5)',
          [rfq.id, itemDbId, parseInt(item.quantity) || 1, item.unit || 'Piece', req.user.company_id]
        );
      }
    }

    // Delete and replace Quotation items
    await client.query('DELETE FROM quotation_items WHERE quotation_id = $1 AND company_id = $2', [quotationDbId, req.user.company_id]);
    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        const itemRes = await client.query('SELECT id FROM items WHERE item_code = $1 AND company_id = $2', [item.item_code, req.user.company_id]);
        const itemDbId = itemRes.rows[0].id;
        await client.query(
          'INSERT INTO quotation_items (quotation_id, item_id, quantity, unit_price, unit, company_id) VALUES ($1, $2, $3, $4, $5, $6)',
          [quotationDbId, itemDbId, parseInt(item.quantity) || 1, parseFloat(item.unit_price) || 0, item.unit || 'Piece', req.user.company_id]
        );
      }
    }

    await client.query('COMMIT');

    res.json({ rfq_no, quotation_no });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating RFQ & Quotation:', err.message);
    res.status(500).json({ error: err.message || 'Failed to update RFQ & Quotation' });
  } finally {
    client.release();
  }
});

module.exports = router;
