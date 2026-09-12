const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Get next process quotation reference number (PRQ-XXXX)
router.get('/next-no', async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT COUNT(*) FROM received_quotations WHERE company_id = $1 AND received_quotation_no LIKE 'PRQ-%'",
      [req.user.company_id]
    );
    const count = parseInt(result.rows[0].count) || 0;
    const year = new Date().getFullYear();
    const nextNo = `PRQ-${year}-${String(count + 1).padStart(4, '0')}`;
    res.json({ nextNo });
  } catch (err) {
    console.error('Error fetching next process quotation no:', err.message);
    res.status(500).json({ error: 'Failed to generate next process quotation number' });
  }
});

// Get a single process quotation
router.get('/:received_quotation_no', async (req, res) => {
  const { received_quotation_no } = req.params;
  try {
    const query = `
      SELECT rq.received_quotation_no, rq.buyer_id, c.customer_code as customer_id, rq.quotation_date, rq.terms_and_conditions, t.trade_id, rq.created_at,
             b.name as buyer_name, b.email as buyer_email, b.phone as buyer_phone,
             c.name as customer_name, c.address as customer_address,
             (
                SELECT COALESCE(json_agg(json_build_object(
                  'item_code', i.item_code,
                  'quantity', rqi.quantity,
                  'unit_price', rqi.unit_price,
                  'process_name', rqi.process_name,
                  'expected_output_code', rqi.expected_output_code,
                  'description', i.description,
                  'drawing_number', i.drawing_number
                )), '[]')
                FROM received_quotation_items rqi
                LEFT JOIN items i ON rqi.item_id = i.id AND i.company_id = rqi.company_id
                WHERE rqi.received_quotation_id = rq.id AND rqi.company_id = rq.company_id
             ) as items
      FROM received_quotations rq
      LEFT JOIN buyers b ON rq.buyer_id = b.id AND b.company_id = rq.company_id
      LEFT JOIN customers c ON rq.customer_id = c.id AND c.company_id = rq.company_id
      LEFT JOIN trades t ON rq.trade_id = t.id AND t.company_id = rq.company_id
      WHERE rq.received_quotation_no = $1 AND rq.company_id = $2
    `;
    const result = await pool.query(query, [received_quotation_no, req.user.company_id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Process quotation not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching process quotation:', err.message);
    res.status(500).json({ error: 'Failed to fetch process quotation' });
  }
});

// Create a new process quotation
router.post('/', async (req, res) => {
  const { received_quotation_no, buyer_id, customer_id, quotation_date, terms_and_conditions, items } = req.body || {};
  if (!buyer_id || !customer_id || !quotation_date) {
    return res.status(400).json({ error: 'buyer_id, customer_id and quotation_date are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Generate received_quotation_no if not provided
    let final_prq_no = received_quotation_no;
    if (!final_prq_no || !final_prq_no.trim()) {
      const countRes = await client.query(
        "SELECT COUNT(*) FROM received_quotations WHERE company_id = $1 AND received_quotation_no LIKE 'PRQ-%'",
        [req.user.company_id]
      );
      const count = parseInt(countRes.rows[0].count) || 0;
      const year = new Date().getFullYear();
      final_prq_no = `PRQ-${year}-${String(count + 1).padStart(4, '0')}`;
    } else {
      final_prq_no = final_prq_no.trim();
    }

    // Check duplicate received_quotation_no
    const dupCheck = await client.query(
      'SELECT received_quotation_no FROM received_quotations WHERE received_quotation_no = $1 AND company_id = $2',
      [final_prq_no, req.user.company_id]
    );
    if (dupCheck.rows.length > 0) {
      throw new Error('Process Quotation number already exists');
    }

    // Resolve customerDbId
    const custRes = await client.query(
      'SELECT id FROM customers WHERE customer_code = $1 AND company_id = $2',
      [customer_id, req.user.company_id]
    );
    if (custRes.rows.length === 0) {
      throw new Error('Customer not found');
    }
    const customerDbId = custRes.rows[0].id;

    // Generate trade_id
    const trade_id = 'TRD-' + final_prq_no.replace(/[\s/]+/g, '-');

    // Check duplicate trade_id
    const tradeDupCheck = await client.query(
      'SELECT trade_id FROM trades WHERE trade_id = $1 AND company_id = $2',
      [trade_id, req.user.company_id]
    );
    if (tradeDupCheck.rows.length > 0) {
      throw new Error('Trade ID already exists for this process quotation');
    }

    // Insert trade document with trade_type = 'process'
    const tradeRes = await client.query(
      "INSERT INTO trades (trade_id, status, trade_type, documents, company_id) VALUES ($1, 'quotation', 'process', $2, $3) RETURNING id",
      [trade_id, JSON.stringify([{ type: 'PRQ', id: final_prq_no }]), req.user.company_id]
    );
    const tradeDbId = tradeRes.rows[0].id;

    // Insert Received Quotation
    const rqRes = await client.query(
      'INSERT INTO received_quotations (received_quotation_no, buyer_id, customer_id, quotation_date, terms_and_conditions, trade_id, company_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
      [final_prq_no, buyer_id, customerDbId, quotation_date, terms_and_conditions, tradeDbId, req.user.company_id]
    );
    const rqDbId = rqRes.rows[0].id;

    // Insert Items with process_name and expected_output_code
    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        const itemRes = await client.query(
          'SELECT id FROM items WHERE item_code = $1 AND company_id = $2',
          [item.item_code, req.user.company_id]
        );
        if (itemRes.rows.length === 0) {
          throw new Error(`Item ${item.item_code} not found`);
        }
        const itemDbId = itemRes.rows[0].id;

        const processName = item.process_name || null;
        const expectedOutputCode = item.expected_output_code && item.expected_output_code.trim() 
          ? item.expected_output_code.trim() 
          : item.item_code;

        await client.query(
          `INSERT INTO received_quotation_items 
           (received_quotation_id, item_id, quantity, unit_price, process_name, expected_output_code, company_id) 
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            rqDbId,
            itemDbId,
            parseInt(item.quantity) || 1,
            parseFloat(item.unit_price) || 0,
            processName,
            expectedOutputCode,
            req.user.company_id
          ]
        );
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ received_quotation_no: final_prq_no, trade_id });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating process quotation:', err.message);
    res.status(500).json({ error: err.message || 'Failed to create process quotation' });
  } finally {
    client.release();
  }
});

// Update an existing process quotation
router.put('/:received_quotation_no', async (req, res) => {
  const { received_quotation_no } = req.params;
  const { buyer_id, customer_id, quotation_date, terms_and_conditions, items } = req.body || {};
  if (!buyer_id || !customer_id || !quotation_date) {
    return res.status(400).json({ error: 'buyer_id, customer_id and quotation_date are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Resolve customerDbId
    const custRes = await client.query(
      'SELECT id FROM customers WHERE customer_code = $1 AND company_id = $2',
      [customer_id, req.user.company_id]
    );
    if (custRes.rows.length === 0) {
      throw new Error('Customer not found');
    }
    const customerDbId = custRes.rows[0].id;

    // Update received quotation
    const updateResult = await client.query(
      'UPDATE received_quotations SET buyer_id = $1, customer_id = $2, quotation_date = $3, terms_and_conditions = $4 WHERE received_quotation_no = $5 AND company_id = $6 RETURNING id',
      [buyer_id, customerDbId, quotation_date, terms_and_conditions, received_quotation_no, req.user.company_id]
    );
    if (updateResult.rows.length === 0) {
      throw new Error('Process quotation not found');
    }
    const rqDbId = updateResult.rows[0].id;

    // Delete existing items
    await client.query(
      'DELETE FROM received_quotation_items WHERE received_quotation_id = $1 AND company_id = $2',
      [rqDbId, req.user.company_id]
    );

    // Insert new items
    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        const itemRes = await client.query(
          'SELECT id FROM items WHERE item_code = $1 AND company_id = $2',
          [item.item_code, req.user.company_id]
        );
        if (itemRes.rows.length === 0) {
          throw new Error(`Item ${item.item_code} not found`);
        }
        const itemDbId = itemRes.rows[0].id;

        const processName = item.process_name || null;
        const expectedOutputCode = item.expected_output_code && item.expected_output_code.trim() 
          ? item.expected_output_code.trim() 
          : item.item_code;

        await client.query(
          `INSERT INTO received_quotation_items 
           (received_quotation_id, item_id, quantity, unit_price, process_name, expected_output_code, company_id) 
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            rqDbId,
            itemDbId,
            parseInt(item.quantity) || 1,
            parseFloat(item.unit_price) || 0,
            processName,
            expectedOutputCode,
            req.user.company_id
          ]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ received_quotation_no });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating process quotation:', err.message);
    res.status(500).json({ error: err.message || 'Failed to update process quotation' });
  } finally {
    client.release();
  }
});

module.exports = router;
