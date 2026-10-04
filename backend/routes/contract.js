const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Get all contracts
router.get('/', async (req, res) => {
  try {
    const { q } = req.query || {};
    const limit = req.query.limit ? parseInt(req.query.limit) : null;
    const offset = req.query.offset ? parseInt(req.query.offset) : 0;
    
    let query = `
      SELECT c.*, b.name as buyer_name, b.email, b.phone 
      FROM contracts c
      LEFT JOIN buyers b ON c.buyer_id = b.id
      WHERE c.company_id = $1
    `;
    const params = [req.user.company_id];
    
    if (q) {
      query += ' AND (c.company_name ILIKE $2 OR b.name ILIKE $2 OR b.email ILIKE $2)';
      params.push(`%${q}%`);
    }
    
    query += ' ORDER BY c.created_at DESC';
    
    if (limit !== null) {
      const limitParamIdx = params.length + 1;
      const offsetParamIdx = params.length + 2;
      query += ` LIMIT $${limitParamIdx} OFFSET $${offsetParamIdx}`;
      params.push(limit, offset);
    }
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching contracts:', err.message);
    res.status(500).json({ error: 'Failed to fetch contracts' });
  }
});

// Get a specific contract with items
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const contractRes = await pool.query(`
      SELECT c.*, b.name as buyer_name, b.email, b.phone 
      FROM contracts c
      LEFT JOIN buyers b ON c.buyer_id = b.id
      WHERE c.id = $1 AND c.company_id = $2
    `, [id, req.user.company_id]);
    
    if (contractRes.rows.length === 0) {
      return res.status(404).json({ error: 'Contract not found' });
    }
    
    const itemsRes = await pool.query(`
      SELECT ci.*, i.item_code, i.description, i.drawing_number, i.long_description
      FROM contract_items ci
      JOIN items i ON ci.item_id = i.id
      WHERE ci.contract_id = $1 AND ci.company_id = $2
      ORDER BY ci.created_at DESC
    `, [id, req.user.company_id]);
    
    const contract = contractRes.rows[0];
    contract.items = itemsRes.rows;
    
    res.json(contract);
  } catch (err) {
    console.error('Error fetching contract details:', err.message);
    res.status(500).json({ error: 'Failed to fetch contract details' });
  }
});

// Create a new contract
router.post('/', async (req, res) => {
  const { company_name, buyer_id } = req.body || {};
  if (!company_name) return res.status(400).json({ error: 'company_name required' });
  
  try {
    const result = await pool.query(
      'INSERT INTO contracts (company_name, buyer_id, company_id) VALUES ($1, $2, $3) RETURNING *',
      [company_name, buyer_id || null, req.user.company_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating contract:', err.message);
    res.status(500).json({ error: 'Failed to create contract' });
  }
});

// Update a contract
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { company_name, buyer_id } = req.body || {};
  
  if (!company_name) return res.status(400).json({ error: 'company_name required' });
  
  try {
    const result = await pool.query(
      'UPDATE contracts SET company_name = $1, buyer_id = $2 WHERE id = $3 AND company_id = $4 RETURNING *',
      [company_name, buyer_id || null, id, req.user.company_id]
    );
    
    if (result.rows.length === 0) return res.status(404).json({ error: 'Contract not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating contract:', err.message);
    res.status(500).json({ error: 'Failed to update contract' });
  }
});

// Delete a contract
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM contracts WHERE id = $1 AND company_id = $2 RETURNING id', [id, req.user.company_id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Contract not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    console.error('Error deleting contract:', err.message);
    res.status(500).json({ error: 'Failed to delete contract' });
  }
});

// Add item to contract
router.post('/:id/items', async (req, res) => {
  const { id } = req.params;
  const { item_code, price, date, expiry_date } = req.body || {};
  
  if (!item_code || price === undefined) return res.status(400).json({ error: 'item_code and price required' });
  
  try {
    const itemCheck = await pool.query('SELECT id FROM items WHERE item_code = $1 AND company_id = $2', [item_code, req.user.company_id]);
    if (itemCheck.rows.length === 0) return res.status(400).json({ error: 'Item code does not exist in catalog' });
    const itemDbId = itemCheck.rows[0].id;

    const result = await pool.query(
      'INSERT INTO contract_items (contract_id, item_id, price, date, expiry_date, company_id) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (contract_id, item_id, company_id) DO NOTHING RETURNING id',
      [id, itemDbId, parseFloat(price), date || null, expiry_date || null, req.user.company_id]
    );
    if (result.rows.length === 0) return res.status(400).json({ error: 'Item already exists in this contract' });

    const fullItemResult = await pool.query(`
      SELECT ci.*, i.item_code, i.description, i.drawing_number, i.long_description
      FROM contract_items ci
      JOIN items i ON ci.item_id = i.id
      WHERE ci.id = $1 AND ci.company_id = $2
    `, [result.rows[0].id, req.user.company_id]);
    
    res.status(201).json(fullItemResult.rows[0]);
  } catch (err) {
    console.error('Error adding contract item:', err.message);
    res.status(500).json({ error: 'Failed to add contract item' });
  }
});

// Update contract item
router.put('/:contractId/items/:itemId', async (req, res) => {
  const { contractId, itemId } = req.params;
  const { price, date, expiry_date } = req.body || {};
  
  if (price === undefined) return res.status(400).json({ error: 'price required' });
  
  try {
    // Get existing item for history
    const existingCheck = await pool.query('SELECT price, date, expiry_date, history FROM contract_items WHERE id = $1 AND contract_id = $2 AND company_id = $3', [itemId, contractId, req.user.company_id]);
    if (existingCheck.rows.length === 0) return res.status(404).json({ error: 'Contract item not found' });
    
    const existing = existingCheck.rows[0];
    const history = existing.history || [];
    
    const oldDateStr = existing.date ? (typeof existing.date === 'string' ? existing.date.split('T')[0] : existing.date.toISOString().split('T')[0]) : '';
    const newDateStr = date || '';
    const oldExpiryStr = existing.expiry_date ? (typeof existing.expiry_date === 'string' ? existing.expiry_date.split('T')[0] : existing.expiry_date.toISOString().split('T')[0]) : '';
    const newExpiryStr = expiry_date || '';

    // Check if anything materially changed to warrant a history entry
    if (
      parseFloat(existing.price) !== parseFloat(price) ||
      oldDateStr !== newDateStr ||
      oldExpiryStr !== newExpiryStr
    ) {
      history.push({
        old_price: existing.price,
        new_price: price,
        old_date: existing.date,
        new_date: date || null,
        old_expiry_date: existing.expiry_date,
        new_expiry_date: expiry_date || null,
        changed_at: new Date().toISOString()
      });
    }

    const result = await pool.query(
      'UPDATE contract_items SET price = $1, date = $2, expiry_date = $3, history = $4 WHERE id = $5 AND contract_id = $6 AND company_id = $7 RETURNING *',
      [parseFloat(price), date || null, expiry_date || null, JSON.stringify(history), itemId, contractId, req.user.company_id]
    );
    
    if (result.rows.length === 0) return res.status(404).json({ error: 'Contract item not found' });
    
    const fullItemResult = await pool.query(`
      SELECT ci.*, i.item_code, i.description, i.drawing_number, i.long_description
      FROM contract_items ci
      JOIN items i ON ci.item_id = i.id
      WHERE ci.id = $1 AND ci.company_id = $2
    `, [itemId, req.user.company_id]);
    
    res.json(fullItemResult.rows[0]);
  } catch (err) {
    console.error('Error updating contract item:', err.message);
    res.status(500).json({ error: 'Failed to update contract item' });
  }
});

// Delete contract item
router.delete('/:contractId/items/:itemId', async (req, res) => {
  const { contractId, itemId } = req.params;
  try {
    const result = await pool.query('DELETE FROM contract_items WHERE id = $1 AND contract_id = $2 AND company_id = $3 RETURNING id', [itemId, contractId, req.user.company_id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Contract item not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    console.error('Error deleting contract item:', err.message);
    res.status(500).json({ error: 'Failed to delete contract item' });
  }
});

module.exports = router;
