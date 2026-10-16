const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// GET all Process RFQs (supports search & limit)
router.get('/', async (req, res) => {
  const { q } = req.query || {};
  try {
    let queryText = `
      SELECT 
        pr.id,
        pr.rfq_number,
        pr.rfq_date,
        pr.commercial_bid_due_date,
        pr.technical_bid_due_date,
        pr.buyer_id,
        b.name as buyer_name,
        b.email as buyer_email,
        b.phone as buyer_phone,
        pr.customer_id,
        c.customer_code as customer_code,
        c.name as customer_name,
        c.address as customer_address,
        pr.status,
        t.trade_id,
        pr.created_at,
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
            FROM "processRFQ_item" pri
            LEFT JOIN items i ON pri.item_id = i.id
            WHERE pri.process_rfq_id = pr.id AND pri.company_id = pr.company_id
          ),
          '[]'
        ) as items
      FROM "processRFQ" pr
      LEFT JOIN buyers b ON pr.buyer_id = b.id
      LEFT JOIN customers c ON pr.customer_id = c.id
      LEFT JOIN trades t ON pr.trade_id = t.id
      WHERE pr.company_id = $1
    `;
    const params = [req.user.company_id];
    if (q) {
      queryText += ` AND (pr.rfq_number ILIKE $2 OR c.name ILIKE $2 OR b.name ILIKE $2)`;
      params.push(`%${q}%`);
    }
    queryText += ` ORDER BY pr.created_at DESC`;

    const limit = req.query.limit ? parseInt(req.query.limit) : null;
    if (limit !== null) {
      queryText += ` LIMIT $${params.length + 1}`;
      params.push(limit);
    }

    const result = await pool.query(queryText, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching process RFQs:', err.message);
    res.status(500).json({ error: 'Failed to fetch Process RFQs' });
  }
});

// GET single Process RFQ by ID or RFQ number
router.get('/:identifier', async (req, res) => {
  const { identifier } = req.params;
  try {
    const isNum = /^\d+$/.test(identifier);
    const queryText = `
      SELECT 
        pr.id,
        pr.rfq_number,
        pr.rfq_date,
        pr.commercial_bid_due_date,
        pr.technical_bid_due_date,
        pr.buyer_id,
        b.name as buyer_name,
        b.email as buyer_email,
        b.phone as buyer_phone,
        pr.customer_id,
        c.customer_code as customer_code,
        c.name as customer_name,
        c.address as customer_address,
        pr.status,
        t.trade_id,
        pr.created_at,
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
            FROM "processRFQ_item" pri
            LEFT JOIN items i ON pri.item_id = i.id
            WHERE pri.process_rfq_id = pr.id AND pri.company_id = pr.company_id
          ),
          '[]'
        ) as items
      FROM "processRFQ" pr
      LEFT JOIN buyers b ON pr.buyer_id = b.id
      LEFT JOIN customers c ON pr.customer_id = c.id
      LEFT JOIN trades t ON pr.trade_id = t.id
      WHERE (pr.rfq_number = $1 ${isNum ? 'OR pr.id = $2' : ''}) AND pr.company_id = ${isNum ? '$3' : '$2'}
      LIMIT 1
    `;
    const params = isNum
      ? [identifier, parseInt(identifier), req.user.company_id]
      : [identifier, req.user.company_id];

    const result = await pool.query(queryText, params);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Process RFQ not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching process RFQ:', err.message);
    res.status(500).json({ error: 'Failed to fetch Process RFQ' });
  }
});

// POST Create Process RFQ
router.post('/', async (req, res) => {
  const {
    rfq_number,
    rfq_no,
    rfq_date,
    RFQdate,
    commercial_bid_due_date,
    technical_bid_due_date,
    buyer_id,
    customer_id,
    items
  } = req.body || {};

  const effectiveRfqNo = (rfq_number || rfq_no || '').trim();
  const effectiveRfqDate = rfq_date || RFQdate;

  if (!effectiveRfqNo || !effectiveRfqDate || !commercial_bid_due_date || !technical_bid_due_date || !buyer_id || !customer_id) {
    return res.status(400).json({ error: 'All header fields are required: RFQ number, dates, buyer, and customer' });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'At least one item with process name is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Check duplicate rfq_number
    const dupCheck = await client.query(
      'SELECT id FROM "processRFQ" WHERE rfq_number = $1 AND company_id = $2',
      [effectiveRfqNo, req.user.company_id]
    );
    if (dupCheck.rows.length > 0) {
      throw new Error('Process RFQ number already exists');
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
      throw new Error('Selected Customer not found in records');
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
    const trade_id = 'TRD-' + effectiveRfqNo.replace(/[\s/]+/g, '-');
    let tradeDbId = null;

    const tradeDupCheck = await client.query(
      'SELECT id, documents FROM trades WHERE trade_id = $1 AND company_id = $2',
      [trade_id, req.user.company_id]
    );

    if (tradeDupCheck.rows.length > 0) {
      tradeDbId = tradeDupCheck.rows[0].id;
      const currentDocs = tradeDupCheck.rows[0].documents || [];
      if (!currentDocs.some(d => d.type === 'PROCESS_RFQ' && d.id === effectiveRfqNo)) {
        currentDocs.push({ type: 'PROCESS_RFQ', id: effectiveRfqNo });
        await client.query(
          'UPDATE trades SET documents = $1 WHERE id = $2 AND company_id = $3',
          [JSON.stringify(currentDocs), tradeDbId, req.user.company_id]
        );
      }
    } else {
      const tradeRes = await client.query(
        `INSERT INTO trades (trade_id, status, trade_type, documents, company_id) 
         VALUES ($1, 'quotation', 'sell_process', $2, $3) RETURNING id`,
        [trade_id, JSON.stringify([{ type: 'PROCESS_RFQ', id: effectiveRfqNo }]), req.user.company_id]
      );
      tradeDbId = tradeRes.rows[0].id;
    }

    // 5. Insert header into processRFQ
    const pRfqRes = await client.query(
      `INSERT INTO "processRFQ" (
        rfq_number,
        rfq_date,
        commercial_bid_due_date,
        technical_bid_due_date,
        buyer_id,
        customer_id,
        trade_id,
        status,
        company_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        effectiveRfqNo,
        effectiveRfqDate,
        commercial_bid_due_date,
        technical_bid_due_date,
        buyerDbId,
        customerDbId,
        tradeDbId,
        'active',
        req.user.company_id
      ]
    );
    const createdRfq = pRfqRes.rows[0];

    // 6. Insert items into processRFQ_item
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
        `INSERT INTO "processRFQ_item" (
          process_rfq_id,
          item_id,
          item_code,
          quantity,
          price,
          process_name,
          company_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [createdRfq.id, itemId, itemCode, qty, isNaN(price) ? 0 : price, processName, req.user.company_id]
      );
      insertedItems.push(itemRes.rows[0]);
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Process RFQ created successfully',
      processRFQ: createdRfq,
      items: insertedItems,
      trade_id: trade_id
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating Process RFQ:', err.message);
    res.status(400).json({ error: err.message || 'Failed to create Process RFQ' });
  } finally {
    client.release();
  }
});

// PUT Update Process RFQ
router.put('/:identifier', async (req, res) => {
  const { identifier } = req.params;
  const {
    rfq_number,
    rfq_no,
    rfq_date,
    RFQdate,
    commercial_bid_due_date,
    technical_bid_due_date,
    buyer_id,
    customer_id,
    items
  } = req.body || {};

  const effectiveRfqDate = rfq_date || RFQdate;

  if (!effectiveRfqDate || !commercial_bid_due_date || !technical_bid_due_date || !buyer_id || !customer_id) {
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
      `SELECT * FROM "processRFQ" WHERE (rfq_number = $1 ${isNum ? 'OR id = $2' : ''}) AND company_id = ${isNum ? '$3' : '$2'} LIMIT 1`,
      isNum ? [identifier, parseInt(identifier), req.user.company_id] : [identifier, req.user.company_id]
    );

    if (existingRes.rows.length === 0) {
      throw new Error('Process RFQ not found');
    }
    const currentRfq = existingRes.rows[0];

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
      throw new Error('Selected Customer not found in records');
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
      `UPDATE "processRFQ"
       SET rfq_date = $1,
           commercial_bid_due_date = $2,
           technical_bid_due_date = $3,
           buyer_id = $4,
           customer_id = $5
       WHERE id = $6 AND company_id = $7
       RETURNING *`,
      [
        effectiveRfqDate,
        commercial_bid_due_date,
        technical_bid_due_date,
        buyerDbId,
        customerDbId,
        currentRfq.id,
        req.user.company_id
      ]
    );
    const updatedRfq = updateRes.rows[0];

    // Delete existing items
    await client.query(
      'DELETE FROM "processRFQ_item" WHERE process_rfq_id = $1 AND company_id = $2',
      [currentRfq.id, req.user.company_id]
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
        `INSERT INTO "processRFQ_item" (
          process_rfq_id,
          item_id,
          item_code,
          quantity,
          price,
          process_name,
          company_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [currentRfq.id, itemId, itemCode, qty, isNaN(price) ? 0 : price, processName, req.user.company_id]
      );
      insertedItems.push(itemRes.rows[0]);
    }

    await client.query('COMMIT');

    res.json({
      message: 'Process RFQ updated successfully',
      processRFQ: updatedRfq,
      items: insertedItems
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating Process RFQ:', err.message);
    res.status(400).json({ error: err.message || 'Failed to update Process RFQ' });
  } finally {
    client.release();
  }
});

// DELETE Process RFQ
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM "processRFQ" WHERE id = $1 AND company_id = $2 RETURNING id',
      [parseInt(id), req.user.company_id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Process RFQ not found' });
    }
    res.json({ message: 'Process RFQ deleted successfully' });
  } catch (err) {
    console.error('Error deleting Process RFQ:', err.message);
    res.status(500).json({ error: 'Failed to delete Process RFQ' });
  }
});

module.exports = router;
