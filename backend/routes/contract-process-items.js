const express = require('express');
const router = express.Router({ mergeParams: true }); // needed to access :contractId from parent
const { pool } = require('../db');

// GET all process items for a contract
router.get('/', async (req, res) => {
  const { contractId } = req.params;
  try {
    const result = await pool.query(
      `SELECT cip.*, i.item_code, i.description, i.drawing_number, i.long_description
       FROM contract_items_process cip
       JOIN items i ON cip.item_id = i.id
       WHERE cip.contract_id = $1 AND cip.company_id = $2
       ORDER BY cip.created_at DESC`,
      [contractId, req.user.company_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching process contract items:', err.message);
    res.status(500).json({ error: 'Failed to fetch process contract items' });
  }
});

// POST — add a process item to a contract
router.post('/', async (req, res) => {
  const { contractId } = req.params;
  const { item_code, processname, price, date, expiry_date } = req.body || {};

  if (!item_code || !processname || price === undefined) {
    return res.status(400).json({ error: 'item_code, processname and price are required' });
  }

  try {
    // Resolve item_code → item id
    const itemCheck = await pool.query(
      'SELECT id FROM items WHERE item_code = $1 AND company_id = $2',
      [item_code, req.user.company_id]
    );
    if (itemCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Item code does not exist in catalog' });
    }
    const itemDbId = itemCheck.rows[0].id;

    const result = await pool.query(
      `INSERT INTO contract_items_process
         (contract_id, item_id, processname, price, date, expiry_date, company_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [contractId, itemDbId, processname.trim(), parseFloat(price), date || null, expiry_date || null, req.user.company_id]
    );

    const fullItem = await pool.query(
      `SELECT cip.*, i.item_code, i.description, i.drawing_number, i.long_description
       FROM contract_items_process cip
       JOIN items i ON cip.item_id = i.id
       WHERE cip.id = $1 AND cip.company_id = $2`,
      [result.rows[0].id, req.user.company_id]
    );

    res.status(201).json(fullItem.rows[0]);
  } catch (err) {
    console.error('Error adding process contract item:', err.message);
    res.status(500).json({ error: 'Failed to add process contract item' });
  }
});

// PUT — update a process item (price, date, expiry_date, processname)
router.put('/:itemId', async (req, res) => {
  const { contractId, itemId } = req.params;
  const { processname, price, date, expiry_date } = req.body || {};

  if (price === undefined) return res.status(400).json({ error: 'price required' });

  try {
    // Fetch existing for history
    const existingCheck = await pool.query(
      'SELECT price, date, expiry_date, processname, history FROM contract_items_process WHERE id = $1 AND contract_id = $2 AND company_id = $3',
      [itemId, contractId, req.user.company_id]
    );
    if (existingCheck.rows.length === 0) return res.status(404).json({ error: 'Process contract item not found' });

    const existing = existingCheck.rows[0];
    const history = existing.history || [];

    const oldDateStr    = existing.date        ? (typeof existing.date === 'string'        ? existing.date.split('T')[0]        : existing.date.toISOString().split('T')[0])        : '';
    const oldExpiryStr  = existing.expiry_date ? (typeof existing.expiry_date === 'string' ? existing.expiry_date.split('T')[0] : existing.expiry_date.toISOString().split('T')[0]) : '';
    const newDateStr    = date || '';
    const newExpiryStr  = expiry_date || '';

    if (
      parseFloat(existing.price) !== parseFloat(price) ||
      oldDateStr !== newDateStr ||
      oldExpiryStr !== newExpiryStr ||
      (processname && existing.processname !== processname.trim())
    ) {
      history.push({
        old_price:       existing.price,
        new_price:       price,
        old_date:        existing.date,
        new_date:        date || null,
        old_expiry_date: existing.expiry_date,
        new_expiry_date: expiry_date || null,
        old_processname: existing.processname,
        new_processname: processname ? processname.trim() : existing.processname,
        changed_at:      new Date().toISOString()
      });
    }

    const result = await pool.query(
      `UPDATE contract_items_process
       SET price = $1, date = $2, expiry_date = $3, processname = $4, history = $5
       WHERE id = $6 AND contract_id = $7 AND company_id = $8
       RETURNING id`,
      [
        parseFloat(price),
        date || null,
        expiry_date || null,
        processname ? processname.trim() : existing.processname,
        JSON.stringify(history),
        itemId,
        contractId,
        req.user.company_id
      ]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Process contract item not found' });

    const fullItem = await pool.query(
      `SELECT cip.*, i.item_code, i.description, i.drawing_number, i.long_description
       FROM contract_items_process cip
       JOIN items i ON cip.item_id = i.id
       WHERE cip.id = $1 AND cip.company_id = $2`,
      [itemId, req.user.company_id]
    );

    res.json(fullItem.rows[0]);
  } catch (err) {
    console.error('Error updating process contract item:', err.message);
    res.status(500).json({ error: 'Failed to update process contract item' });
  }
});

// DELETE a process item
router.delete('/:itemId', async (req, res) => {
  const { contractId, itemId } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM contract_items_process WHERE id = $1 AND contract_id = $2 AND company_id = $3 RETURNING id',
      [itemId, contractId, req.user.company_id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Process contract item not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    console.error('Error deleting process contract item:', err.message);
    res.status(500).json({ error: 'Failed to delete process contract item' });
  }
});

module.exports = router;
