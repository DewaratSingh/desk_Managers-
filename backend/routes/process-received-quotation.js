const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// GET all Process Received Quotations (supports search & limit)
router.get('/', async (req, res) => {
  const { q } = req.query || {};
  try {
    let queryText = `
      SELECT 
        prq.id,
        prq.quotation_number,
        prq.quotation_date,
        prq.commercial_bid_due_date,
        prq.technical_bid_due_date,
        prq.buyer_id,
        b.name as buyer_name,
        b.email as buyer_email,
        b.phone as buyer_phone,
        prq.customer_id,
        c.customer_code as customer_code,
        c.name as customer_name,
        c.address as customer_address,
        prq.status,
        t.trade_id,
        prq.created_at,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', pri.id,
                'item_code', pri.item_code,
                'quantity', pri.quantity,
                'price', pri.price,
                'process_name', pri.process_name,
                'description', i.description,
                'drawing_number', i.drawing_number
              )
            )
            FROM "processReceivedQuotation_item" pri
            LEFT JOIN items i ON pri.item_id = i.id
            WHERE pri.process_received_quotation_id = prq.id AND pri.company_id = prq.company_id
          ),
          '[]'
        ) as items
      FROM "processReceivedQuotation" prq
      LEFT JOIN buyers b ON prq.buyer_id = b.id
      LEFT JOIN customers c ON prq.customer_id = c.id
      LEFT JOIN trades t ON prq.trade_id = t.id
      WHERE prq.company_id = $1
    `;
    const params = [req.user.company_id];
    if (q) {
      queryText += ` AND (prq.quotation_number ILIKE $2 OR c.name ILIKE $2 OR b.name ILIKE $2)`;
      params.push(`%${q}%`);
    }
    queryText += ` ORDER BY prq.created_at DESC`;

    const limit = req.query.limit ? parseInt(req.query.limit) : null;
    if (limit !== null) {
      queryText += ` LIMIT $${params.length + 1}`;
      params.push(limit);
    }

    const result = await pool.query(queryText, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching process received quotations:', err.message);
    res.status(500).json({ error: 'Failed to fetch Process Received Quotations' });
  }
});

// GET single Process Received Quotation by ID or quotation number
router.get('/:identifier', async (req, res) => {
  const { identifier } = req.params;
  try {
    const isNum = /^\d+$/.test(identifier);
    const queryText = `
      SELECT 
        prq.id,
        prq.quotation_number,
        prq.quotation_date,
        prq.commercial_bid_due_date,
        prq.technical_bid_due_date,
        prq.buyer_id,
        b.name as buyer_name,
        b.email as buyer_email,
        b.phone as buyer_phone,
        prq.customer_id,
        c.customer_code as customer_code,
        c.name as customer_name,
        c.address as customer_address,
        prq.status,
        t.trade_id,
        prq.created_at,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', pri.id,
                'item_code', pri.item_code,
                'quantity', pri.quantity,
                'price', pri.price,
                'process_name', pri.process_name,
                'description', i.description,
                'drawing_number', i.drawing_number
              )
            )
            FROM "processReceivedQuotation_item" pri
            LEFT JOIN items i ON pri.item_id = i.id
            WHERE pri.process_received_quotation_id = prq.id AND pri.company_id = prq.company_id
          ),
          '[]'
        ) as items
      FROM "processReceivedQuotation" prq
      LEFT JOIN buyers b ON prq.buyer_id = b.id
      LEFT JOIN customers c ON prq.customer_id = c.id
      LEFT JOIN trades t ON prq.trade_id = t.id
      WHERE (prq.quotation_number = $1 ${isNum ? 'OR prq.id = $2' : ''}) AND prq.company_id = ${isNum ? '$3' : '$2'}
      LIMIT 1
    `;
    const params = isNum
      ? [identifier, parseInt(identifier), req.user.company_id]
      : [identifier, req.user.company_id];

    const result = await pool.query(queryText, params);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Process Received Quotation not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching process received quotation:', err.message);
    res.status(500).json({ error: 'Failed to fetch Process Received Quotation' });
  }
});

// POST Create Process Received Quotation
router.post('/', async (req, res) => {
  const {
    quotation_number,
    quotation_no,
    received_quotation_no,
    quotation_date,
    date,
    commercial_bid_due_date,
    technical_bid_due_date,
    buyer_id,
    customer_id,
    items
  } = req.body || {};

  const effectiveQtnNo = (quotation_number || quotation_no || received_quotation_no || '').trim();
  const effectiveQtnDate = quotation_date || date;

  if (!effectiveQtnNo || !effectiveQtnDate || !commercial_bid_due_date || !technical_bid_due_date || !buyer_id || !customer_id) {
    return res.status(400).json({ error: 'All header fields are required: Quotation number, dates, buyer, and customer' });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'At least one item with process name is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Check duplicate quotation_number
    const dupCheck = await client.query(
      'SELECT id FROM "processReceivedQuotation" WHERE quotation_number = $1 AND company_id = $2',
      [effectiveQtnNo, req.user.company_id]
    );
    if (dupCheck.rows.length > 0) {
      throw new Error('Process Received Quotation number already exists');
    }

    // 2. Resolve customerDbId (accept customer_code or numeric customer id)
    let customerDbId = null;
    if (typeof customer_id === 'number' || /^\d+$/.test(String(customer_id))) {
      const custCheck = await client.query(
        'SELECT id FROM customers WHERE id = $1 AND company_id = $2',
        [parseInt(customer_id), req.user.company_id]
      );
      if (custCheck.rows.length > 0) {
        customerDbId = custCheck.rows[0].id;
      }
    }
    if (!customerDbId) {
      const custCodeCheck = await client.query(
        'SELECT id FROM customers WHERE customer_code = $1 AND company_id = $2',
        [String(customer_id), req.user.company_id]
      );
      if (custCodeCheck.rows.length > 0) {
        customerDbId = custCodeCheck.rows[0].id;
      }
    }
    if (!customerDbId) {
      throw new Error('Selected Customer/Supplier not found in records');
    }

    // 3. Resolve buyerDbId
    const buyerCheck = await client.query(
      'SELECT id FROM buyers WHERE id = $1 AND company_id = $2',
      [parseInt(buyer_id), req.user.company_id]
    );
    if (buyerCheck.rows.length === 0) {
      throw new Error('Selected Buyer not found in records');
    }
    const buyerDbId = buyerCheck.rows[0].id;

    // 4. Create or link trade
    const trade_id = 'TRD-' + effectiveQtnNo.replace(/[\s/]+/g, '-');
    let tradeDbId = null;

    const tradeDupCheck = await client.query(
      'SELECT id, documents FROM trades WHERE trade_id = $1 AND company_id = $2',
      [trade_id, req.user.company_id]
    );

    if (tradeDupCheck.rows.length > 0) {
      tradeDbId = tradeDupCheck.rows[0].id;
      const currentDocs = tradeDupCheck.rows[0].documents || [];
      if (!currentDocs.some(d => d.type === 'PROCESS_RECEIVED_QUOTATION' && d.id === effectiveQtnNo)) {
        currentDocs.push({ type: 'PROCESS_RECEIVED_QUOTATION', id: effectiveQtnNo });
        await client.query(
          'UPDATE trades SET documents = $1 WHERE id = $2 AND company_id = $3',
          [JSON.stringify(currentDocs), tradeDbId, req.user.company_id]
        );
      }
    } else {
      const tradeRes = await client.query(
        `INSERT INTO trades (trade_id, status, trade_type, documents, company_id) 
         VALUES ($1, 'quotation', 'buy_process', $2, $3) RETURNING id`,
        [trade_id, JSON.stringify([{ type: 'PROCESS_RECEIVED_QUOTATION', id: effectiveQtnNo }]), req.user.company_id]
      );
      tradeDbId = tradeRes.rows[0].id;
    }

    // 5. Insert header into processReceivedQuotation
    const pRqRes = await client.query(
      `INSERT INTO "processReceivedQuotation" (
        quotation_number,
        quotation_date,
        commercial_bid_due_date,
        technical_bid_due_date,
        buyer_id,
        customer_id,
        trade_id,
        status,
        company_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        effectiveQtnNo,
        effectiveQtnDate,
        commercial_bid_due_date,
        technical_bid_due_date,
        buyerDbId,
        customerDbId,
        tradeDbId,
        'active',
        req.user.company_id
      ]
    );
    const createdRq = pRqRes.rows[0];

    // 6. Insert items into processReceivedQuotation_item
    const insertedItems = [];
    for (const item of items) {
      const itemCode = (item.itemcode || item.item_code || '').trim();
      const processName = (item.process_name || item.processName || item['process name'] || '').trim();
      const qty = parseFloat(item.quantity ?? item.QTY ?? item.qty ?? 1);
      const price = parseFloat(item.price ?? item.unit_price ?? 0);

      if (!itemCode) {
        throw new Error('Each attached item must have a valid item code');
      }
      if (!processName) {
        throw new Error(`Process name is required for item "${itemCode}"`);
      }
      if (isNaN(qty) || qty <= 0) {
        throw new Error(`Quantity must be greater than 0 for item "${itemCode}"`);
      }

      // Check if item exists in items table
      const itemLookup = await client.query(
        'SELECT id FROM items WHERE item_code = $1 AND company_id = $2',
        [itemCode, req.user.company_id]
      );
      const itemId = itemLookup.rows.length > 0 ? itemLookup.rows[0].id : null;

      const itemRes = await client.query(
        `INSERT INTO "processReceivedQuotation_item" (
          process_received_quotation_id,
          item_id,
          item_code,
          quantity,
          price,
          process_name,
          company_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [createdRq.id, itemId, itemCode, qty, isNaN(price) ? 0 : price, processName, req.user.company_id]
      );
      insertedItems.push(itemRes.rows[0]);
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Process Received Quotation created successfully',
      processReceivedQuotation: createdRq,
      items: insertedItems,
      trade_id: trade_id
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating Process Received Quotation:', err.message);
    res.status(400).json({ error: err.message || 'Failed to create Process Received Quotation' });
  } finally {
    client.release();
  }
});

// PUT Update Process Received Quotation
router.put('/:identifier', async (req, res) => {
  const { identifier } = req.params;
  const {
    quotation_number,
    quotation_no,
    received_quotation_no,
    quotation_date,
    date,
    commercial_bid_due_date,
    technical_bid_due_date,
    buyer_id,
    customer_id,
    items
  } = req.body || {};

  const effectiveQtnDate = quotation_date || date;

  if (!effectiveQtnDate || !commercial_bid_due_date || !technical_bid_due_date || !buyer_id || !customer_id) {
    return res.status(400).json({ error: 'All header fields are required: dates, buyer, and customer' });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'At least one item with process name is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const isNum = /^\d+$/.test(identifier);
    const existingRes = await client.query(
      `SELECT * FROM "processReceivedQuotation" WHERE (quotation_number = $1 ${isNum ? 'OR id = $2' : ''}) AND company_id = ${isNum ? '$3' : '$2'} LIMIT 1`,
      isNum ? [identifier, parseInt(identifier), req.user.company_id] : [identifier, req.user.company_id]
    );

    if (existingRes.rows.length === 0) {
      throw new Error('Process Received Quotation not found');
    }
    const currentRq = existingRes.rows[0];

    // Resolve customerDbId
    let customerDbId = null;
    if (typeof customer_id === 'number' || /^\d+$/.test(String(customer_id))) {
      const custCheck = await client.query(
        'SELECT id FROM customers WHERE id = $1 AND company_id = $2',
        [parseInt(customer_id), req.user.company_id]
      );
      if (custCheck.rows.length > 0) {
        customerDbId = custCheck.rows[0].id;
      }
    }
    if (!customerDbId) {
      const custCodeCheck = await client.query(
        'SELECT id FROM customers WHERE customer_code = $1 AND company_id = $2',
        [String(customer_id), req.user.company_id]
      );
      if (custCodeCheck.rows.length > 0) {
        customerDbId = custCodeCheck.rows[0].id;
      }
    }
    if (!customerDbId) {
      throw new Error('Selected Customer/Supplier not found in records');
    }

    // Resolve buyerDbId
    const buyerCheck = await client.query(
      'SELECT id FROM buyers WHERE id = $1 AND company_id = $2',
      [parseInt(buyer_id), req.user.company_id]
    );
    if (buyerCheck.rows.length === 0) {
      throw new Error('Selected Buyer not found in records');
    }
    const buyerDbId = buyerCheck.rows[0].id;

    // Update header
    const updateRes = await client.query(
      `UPDATE "processReceivedQuotation"
       SET quotation_date = $1,
           commercial_bid_due_date = $2,
           technical_bid_due_date = $3,
           buyer_id = $4,
           customer_id = $5
       WHERE id = $6 AND company_id = $7
       RETURNING *`,
      [
        effectiveQtnDate,
        commercial_bid_due_date,
        technical_bid_due_date,
        buyerDbId,
        customerDbId,
        currentRq.id,
        req.user.company_id
      ]
    );
    const updatedRq = updateRes.rows[0];

    // Delete existing items
    await client.query(
      'DELETE FROM "processReceivedQuotation_item" WHERE process_received_quotation_id = $1 AND company_id = $2',
      [currentRq.id, req.user.company_id]
    );

    // Insert updated items
    const insertedItems = [];
    for (const item of items) {
      const itemCode = (item.itemcode || item.item_code || '').trim();
      const processName = (item.process_name || item.processName || item['process name'] || '').trim();
      const qty = parseFloat(item.quantity ?? item.QTY ?? item.qty ?? 1);
      const price = parseFloat(item.price ?? item.unit_price ?? 0);

      if (!itemCode) {
        throw new Error('Each attached item must have a valid item code');
      }
      if (!processName) {
        throw new Error(`Process name is required for item "${itemCode}"`);
      }
      if (isNaN(qty) || qty <= 0) {
        throw new Error(`Quantity must be greater than 0 for item "${itemCode}"`);
      }

      // Check item
      const itemLookup = await client.query(
        'SELECT id FROM items WHERE item_code = $1 AND company_id = $2',
        [itemCode, req.user.company_id]
      );
      const itemId = itemLookup.rows.length > 0 ? itemLookup.rows[0].id : null;

      const itemRes = await client.query(
        `INSERT INTO "processReceivedQuotation_item" (
          process_received_quotation_id,
          item_id,
          item_code,
          quantity,
          price,
          process_name,
          company_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [currentRq.id, itemId, itemCode, qty, isNaN(price) ? 0 : price, processName, req.user.company_id]
      );
      insertedItems.push(itemRes.rows[0]);
    }

    await client.query('COMMIT');

    res.json({
      message: 'Process Received Quotation updated successfully',
      processReceivedQuotation: updatedRq,
      items: insertedItems
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating Process Received Quotation:', err.message);
    res.status(400).json({ error: err.message || 'Failed to update Process Received Quotation' });
  } finally {
    client.release();
  }
});

// DELETE Process Received Quotation
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM "processReceivedQuotation" WHERE id = $1 AND company_id = $2 RETURNING id',
      [parseInt(id), req.user.company_id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Process Received Quotation not found' });
    }
    res.json({ message: 'Process Received Quotation deleted successfully' });
  } catch (err) {
    console.error('Error deleting Process Received Quotation:', err.message);
    res.status(500).json({ error: 'Failed to delete Process Received Quotation' });
  }
});

module.exports = router;
