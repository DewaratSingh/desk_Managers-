const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Create a P_item record
router.post('/', async (req, res) => {
  const { item_code, process, message, quantity, price, trade_code } = req.body || {};
  const companyId = req.user.company_id;

  if (!item_code) {
    return res.status(400).json({ error: 'item_code is required' });
  }

  try {
    // Resolve itemDbId from item_code string (e.g. 'ITEM-001')
    const itemRes = await pool.query('SELECT id FROM items WHERE item_code = $1 AND company_id = $2', [item_code, companyId]);
    if (itemRes.rows.length === 0) {
      return res.status(400).json({ error: `Item ${item_code} not found` });
    }
    const itemDbId = itemRes.rows[0].id;

    // Resolve tradeDbId (from trade_code, e.g. 'TRD-XXXX') and add to process array
    let processIds = Array.isArray(process) ? [...process] : [];
    if (trade_code) {
      const tradeRes = await pool.query('SELECT id FROM trades WHERE trade_id = $1 AND company_id = $2', [trade_code, companyId]);
      if (tradeRes.rows.length > 0) {
        const tradeDbId = tradeRes.rows[0].id;
        if (!processIds.includes(tradeDbId)) {
          processIds.push(tradeDbId);
        }
      }
    }

    // Convert process array format to PostgreSQL integer array syntax if it's sent as a regular JS array
    // e.g. [1, 2] -> '{1, 2}'
    let processArray = '{}';
    if (processIds.length > 0) {
      processArray = `{${processIds.map(id => parseInt(id)).filter(id => !isNaN(id)).join(',')}}`;
    }

    const result = await pool.query(
      `INSERT INTO trace_item (item_code, process, message, quantity, price, company_id) 
       VALUES ($1, $2::INTEGER[], $3, $4, $5, $6) RETURNING *`,
      [itemDbId, processArray, message || null, parseInt(quantity) || 0, parseFloat(price) || 0.00, companyId]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating P_item:', err.message);
    res.status(500).json({ error: 'Failed to create process item entry' });
  }
});

// List P_item records
router.get('/', async (req, res) => {
  const companyId = req.user.company_id;
  try {
    const result = await pool.query(
      `SELECT p.id, i.item_code, p.process, p.message, p.quantity, p.price, p.created_at, i.description, i.drawing_number
       FROM trace_item p
       LEFT JOIN items i ON p.item_code = i.id
       WHERE p.company_id = $1
       ORDER BY p.created_at DESC`,
      [companyId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error listing P_item records:', err.message);
    res.status(500).json({ error: 'Failed to list process items' });
  }
});

module.exports = router;
