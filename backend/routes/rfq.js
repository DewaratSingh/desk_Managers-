const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Get all RFQs (supports search & limit)
router.get('/', async (req, res) => {
  const { q } = req.query || {};
  try {
    let queryText = `
      SELECT r.rfq_no, r.rfq_date, r.commercial_bid_due_date, r.technical_bid_due_date, r.buyer_id, b.name as buyer_name, b.email as buyer_email, b.phone as buyer_phone, r.customer_id, c.name as customer_name, c.address as customer_address, r.status, r.trade_id, r.created_at,
             COALESCE(
               (
                 SELECT json_agg(
                   json_build_object(
                     'item_code', ri.item_code,
                     'quantity', ri.quantity,
                     'unit', ri.unit,
                     'unit_price', COALESCE((
                       SELECT qi.unit_price 
                       FROM quotations q 
                       LEFT JOIN quotation_items qi ON q.quotation_no = qi.quotation_no 
                       WHERE q.rfq_no = r.rfq_no AND qi.item_code = ri.item_code
                       LIMIT 1
                     ), 0),
                     'description', i.description,
                     'drawing_number', i.drawing_number
                   )
                 )
                 FROM rfq_items ri
                 LEFT JOIN items i ON ri.item_code = i.item_code
                 WHERE ri.rfq_no = r.rfq_no
               ),
               '[]'
             ) as items
      FROM rfqs r
      LEFT JOIN buyers b ON r.buyer_id = b.id
      LEFT JOIN customers c ON r.customer_id = c.id
    `;
    const params = [];
    if (q) {
      queryText += ` WHERE r.rfq_no ILIKE $1 OR c.name ILIKE $1`;
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
    const dupCheck = await client.query('SELECT rfq_no FROM rfqs WHERE rfq_no = $1', [rfq_no]);
    if (dupCheck.rows.length > 0) {
      throw new Error('RFQ number already exists');
    }

    // Generate trade_id
    const trade_id = 'TRD-' + rfq_no.replace(/[\s/]+/g, '-');

    // Check duplicate trade_id
    const tradeDupCheck = await client.query('SELECT trade_id FROM trades WHERE trade_id = $1', [trade_id]);
    if (tradeDupCheck.rows.length > 0) {
      throw new Error('Trade ID already exists for this RFQ');
    }

    // Generate quotation_no
    const qCountRes = await client.query('SELECT COUNT(*) FROM quotations');
    const qCount = parseInt(qCountRes.rows[0].count) || 0;
    const quotation_no = `QT-${String(qCount + 1).padStart(4, '0')}`;

    // Insert trade document (status is 'quotation' since both RFQ and Quotation are made)
    await client.query(
      "INSERT INTO trades (trade_id, status, trade_type, documents) VALUES ($1, 'quotation', 'sell', $2)",
      [trade_id, JSON.stringify([{ type: 'RFQ', id: rfq_no }, { type: 'QUOTATION', id: quotation_no }])]
    );

    // Insert RFQ (status is 'quotated' because quotation is created)
    await client.query(
      'INSERT INTO rfqs (rfq_no, rfq_date, commercial_bid_due_date, technical_bid_due_date, buyer_id, customer_id, status, trade_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [rfq_no, rfq_date, commercial_bid_due_date, technical_bid_due_date, buyer_id, customer_id, 'quotated', trade_id]
    );

    // Insert RFQ Items
    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        await client.query(
          'INSERT INTO rfq_items (rfq_no, item_code, quantity, unit) VALUES ($1, $2, $3, $4)',
          [rfq_no, item.item_code, parseInt(item.quantity) || 1, item.unit || 'Piece']
        );
      }
    }

    // Insert Quotation
    await client.query(
      'INSERT INTO quotations (quotation_no, rfq_no, quotation_date, terms_and_conditions, trade_id, status) VALUES ($1, $2, $3, $4, $5, $6)',
      [quotation_no, rfq_no, rfq_date, 'Standard Quotation terms', trade_id, 'active']
    );

    // Insert Quotation Items
    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        await client.query(
          'INSERT INTO quotation_items (quotation_no, item_code, quantity, unit_price, unit) VALUES ($1, $2, $3, $4, $5)',
          [quotation_no, item.item_code, parseInt(item.quantity) || 1, parseFloat(item.unit_price) || 0, item.unit || 'Piece']
        );
      }
    }

    // Insert status name into status table if not exists
    await client.query(
      "INSERT INTO status (name) VALUES ('quotation') ON CONFLICT (name) DO NOTHING"
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
      SELECT r.rfq_no, r.rfq_date, r.commercial_bid_due_date, r.technical_bid_due_date, r.buyer_id, b.name as buyer_name, b.email as buyer_email, b.phone as buyer_phone, r.customer_id, c.name as customer_name, c.address as customer_address, r.status, r.trade_id, r.created_at,
             COALESCE(
               json_agg(
                 json_build_object(
                   'item_code', ri.item_code,
                   'quantity', ri.quantity,
                   'unit', ri.unit,
                   'unit_price', COALESCE(qi.unit_price, 0),
                   'description', i.description,
                   'drawing_number', i.drawing_number
                 )
               ) FILTER (WHERE ri.item_code IS NOT NULL),
               '[]'
             ) as items
      FROM rfqs r
      LEFT JOIN buyers b ON r.buyer_id = b.id
      LEFT JOIN customers c ON r.customer_id = c.id
      LEFT JOIN rfq_items ri ON r.rfq_no = ri.rfq_no
      LEFT JOIN items i ON ri.item_code = i.item_code
      LEFT JOIN quotations q ON r.rfq_no = q.rfq_no
      LEFT JOIN quotation_items qi ON q.quotation_no = qi.quotation_no AND ri.item_code = qi.item_code
      WHERE r.rfq_no = $1
      GROUP BY r.rfq_no, b.name, b.email, b.phone, c.name, c.address, q.quotation_no
    `, [rfq_no]);
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
    
    // Update RFQ
    const updateResult = await client.query(
      'UPDATE rfqs SET rfq_date = $1, commercial_bid_due_date = $2, technical_bid_due_date = $3, buyer_id = $4, customer_id = $5 WHERE rfq_no = $6 RETURNING *',
      [rfq_date, commercial_bid_due_date, technical_bid_due_date, buyer_id, customer_id, rfq_no]
    );
    if (updateResult.rows.length === 0) {
      throw new Error('RFQ not found');
    }
    const rfq = updateResult.rows[0];

    // Find or create linked quotation
    const qtnCheck = await client.query('SELECT quotation_no FROM quotations WHERE rfq_no = $1', [rfq_no]);
    let quotation_no;
    if (qtnCheck.rows.length > 0) {
      quotation_no = qtnCheck.rows[0].quotation_no;
      // Update quotation date
      await client.query(
        'UPDATE quotations SET quotation_date = $1 WHERE quotation_no = $2',
        [rfq_date, quotation_no]
      );
    } else {
      const qCountRes = await client.query('SELECT COUNT(*) FROM quotations');
      const qCount = parseInt(qCountRes.rows[0].count) || 0;
      quotation_no = `QT-${String(qCount + 1).padStart(4, '0')}`;
      
      await client.query(
        'INSERT INTO quotations (quotation_no, rfq_no, quotation_date, terms_and_conditions, trade_id, status) VALUES ($1, $2, $3, $4, $5, $6)',
        [quotation_no, rfq_no, rfq_date, 'Standard Quotation terms', rfq.trade_id, 'active']
      );
      
      // Ensure the trade has both RFQ and Quotation documents
      if (rfq.trade_id) {
        const tradeRes = await client.query('SELECT documents FROM trades WHERE trade_id = $1', [rfq.trade_id]);
        if (tradeRes.rows.length > 0) {
          let documents = tradeRes.rows[0].documents || [];
          if (!documents.some(d => d.type === 'QUOTATION')) {
            documents.push({ type: 'QUOTATION', id: quotation_no });
            await client.query('UPDATE trades SET documents = $1 WHERE trade_id = $2', [JSON.stringify(documents), rfq.trade_id]);
          }
        }
      }
    }

    // Delete and replace RFQ items
    await client.query('DELETE FROM rfq_items WHERE rfq_no = $1', [rfq_no]);
    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        await client.query(
          'INSERT INTO rfq_items (rfq_no, item_code, quantity, unit) VALUES ($1, $2, $3, $4)',
          [rfq_no, item.item_code, parseInt(item.quantity) || 1, item.unit || 'Piece']
        );
      }
    }

    // Delete and replace Quotation items
    await client.query('DELETE FROM quotation_items WHERE quotation_no = $1', [quotation_no]);
    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        await client.query(
          'INSERT INTO quotation_items (quotation_no, item_code, quantity, unit_price, unit) VALUES ($1, $2, $3, $4, $5)',
          [quotation_no, item.item_code, parseInt(item.quantity) || 1, parseFloat(item.unit_price) || 0, item.unit || 'Piece']
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
