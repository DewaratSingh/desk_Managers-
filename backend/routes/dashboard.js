const express = require('express');
const { pool } = require('../db');

const router = express.Router();

router.get('/trace-item', async (req, res) => {
  const { item_code, from_date } = req.query;

  if (!item_code) {
    return res.status(400).json({ error: 'Item Code is required' });
  }

  try {
    // 1. Fetch item details
    const itemResult = await pool.query('SELECT * FROM items WHERE item_code = $1', [item_code]);
    if (itemResult.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found in catalog' });
    }
    const item = itemResult.rows[0];

    const dateVal = from_date && from_date.trim() ? from_date : null;

    // 2. Fetch matching RFQs
    const rfqsQuery = `
      SELECT r.*,
        b.name AS buyer_name, b.email AS buyer_email, b.phone AS buyer_phone,
        c.name AS customer_name, c.address AS customer_address,
        COALESCE(
          json_agg(
            json_build_object(
              'item_code', ri.item_code,
              'description', i.description,
              'drawing_number', i.drawing_number,
              'quantity', ri.quantity
            ) ORDER BY ri.id
          ) FILTER (WHERE ri.item_code IS NOT NULL),
          '[]'
        ) AS items
      FROM rfqs r
      LEFT JOIN buyers b ON r.buyer_id = b.id
      LEFT JOIN customers c ON r.customer_id = c.id
      LEFT JOIN rfq_items ri ON r.rfq_no = ri.rfq_no
      LEFT JOIN items i ON ri.item_code = i.item_code
      WHERE r.rfq_no IN (
        SELECT rfq_no FROM rfq_items WHERE item_code = $1
      )
      AND ($2::DATE IS NULL OR r.rfq_date >= $2::DATE)
      GROUP BY r.rfq_no, b.name, b.email, b.phone, c.name, c.address
      ORDER BY r.rfq_date DESC
    `;
    const rfqsResult = await pool.query(rfqsQuery, [item_code, dateVal]);

    // 3. Fetch matching Quotations
    const quotationsQuery = `
      SELECT q.*,
        r.customer_id, c.name AS customer_name, c.address AS customer_address,
        b.name AS buyer_name, b.email AS buyer_email, b.phone AS buyer_phone,
        COALESCE(
          json_agg(
            json_build_object(
              'item_code', qi.item_code,
              'description', i.description,
              'drawing_number', i.drawing_number,
              'quantity', qi.quantity,
              'unit_price', qi.unit_price
            ) ORDER BY qi.id
          ) FILTER (WHERE qi.item_code IS NOT NULL),
          '[]'
        ) AS items,
        COALESCE(
          (SELECT json_agg(json_build_object(
            'received_quotation_no', rq.received_quotation_no,
            'quotation_date', rq.quotation_date,
            'buyer_name', rb.name
           ) ORDER BY rq.received_quotation_no)
           FROM quotation_received_quotations qrq
           LEFT JOIN received_quotations rq ON qrq.received_quotation_no = rq.received_quotation_no
           LEFT JOIN buyers rb ON rq.buyer_id = rb.id
           WHERE qrq.quotation_no = q.quotation_no
          ), '[]'
        ) AS received_quotations
      FROM quotations q
      LEFT JOIN quotation_items qi ON q.quotation_no = qi.quotation_no
      LEFT JOIN items i ON qi.item_code = i.item_code
      LEFT JOIN rfqs r ON q.rfq_no = r.rfq_no
      LEFT JOIN customers c ON r.customer_id = c.id
      LEFT JOIN buyers b ON r.buyer_id = b.id
      WHERE q.quotation_no IN (
        SELECT quotation_no FROM quotation_items WHERE item_code = $1
      )
      AND ($2::DATE IS NULL OR q.quotation_date >= $2::DATE)
      GROUP BY q.quotation_no, r.customer_id, c.name, c.address, b.name, b.email, b.phone
      ORDER BY q.quotation_date DESC
    `;
    const quotationsResult = await pool.query(quotationsQuery, [item_code, dateVal]);

    // 4. Fetch matching Received Quotations
    const receivedQuotationsQuery = `
      SELECT rq.*,
        b.name AS buyer_name, b.email AS buyer_email, b.phone AS buyer_phone,
        COALESCE(
          json_agg(
            json_build_object(
              'item_code', rqi.item_code,
              'description', i.description,
              'drawing_number', i.drawing_number,
              'quantity', rqi.quantity,
              'unit_price', rqi.unit_price
            ) ORDER BY rqi.id
          ) FILTER (WHERE rqi.item_code IS NOT NULL),
          '[]'
        ) AS items
      FROM received_quotations rq
      LEFT JOIN received_quotation_items rqi ON rq.received_quotation_no = rqi.received_quotation_no
      LEFT JOIN items i ON rqi.item_code = i.item_code
      LEFT JOIN buyers b ON rq.buyer_id = b.id
      WHERE rq.received_quotation_no IN (
        SELECT received_quotation_no FROM received_quotation_items WHERE item_code = $1
      )
      AND ($2::DATE IS NULL OR rq.quotation_date >= $2::DATE)
      GROUP BY rq.received_quotation_no, b.name, b.email, b.phone
      ORDER BY rq.quotation_date DESC
    `;
    const receivedQuotationsResult = await pool.query(receivedQuotationsQuery, [item_code, dateVal]);

    res.json({
      item,
      rfqs: rfqsResult.rows,
      quotations: quotationsResult.rows,
      receivedQuotations: receivedQuotationsResult.rows
    });
  } catch (error) {
    console.error('Error in item trace:', error);
    res.status(500).json({ error: 'Server error tracing item flow' });
  }
});

module.exports = router;
