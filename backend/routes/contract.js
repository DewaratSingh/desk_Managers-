const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { requirePermission } = require('../middleware/auth');

// Get all contracts
router.get('/', requirePermission(['arc:read', 'manage_arc']), async (req, res) => {
  try {
    const { q, type } = req.query || {};
    const limit = req.query.limit !== undefined
      ? (req.query.limit === 'all' || req.query.limit === '-1' ? null : parseInt(req.query.limit, 10))
      : 20;
    const offset = req.query.offset ? Math.max(0, parseInt(req.query.offset, 10)) : 0;
    
    let query = `
      SELECT c.*, b.name as buyer_name, b.email, b.phone, cu.name as party_name, cu.customer_code as party_code, cu.address as party_address 
      FROM contracts c
      LEFT JOIN buyers b ON c.buyer_id = b.id
      LEFT JOIN customers cu ON c.customer_id = cu.id
      WHERE c.company_id = $1
    `;
    const params = [req.user.company_id];

    if (type) {
      const typeParamIdx = params.length + 1;
      query += ` AND LOWER(c.type) = LOWER($${typeParamIdx})`;
      params.push(type.trim());
    }
    
    if (q) {
      const qParamIdx = params.length + 1;
      query += ` AND (c.company_name ILIKE $${qParamIdx} OR b.name ILIKE $${qParamIdx} OR b.email ILIKE $${qParamIdx} OR cu.name ILIKE $${qParamIdx} OR cu.customer_code ILIKE $${qParamIdx} OR CAST(c.id AS VARCHAR) ILIKE $${qParamIdx})`;
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
router.get('/:id', requirePermission(['arc:read', 'manage_arc']), async (req, res) => {
  const { id } = req.params;
  const limit = req.query.limit !== undefined
    ? (req.query.limit === 'all' || req.query.limit === '-1' ? null : parseInt(req.query.limit, 10))
    : 20;
  const offset = req.query.offset ? Math.max(0, parseInt(req.query.offset, 10)) : 0;

  try {
    const contractRes = await pool.query(`
      SELECT c.*, b.name as buyer_name, b.email, b.phone, cu.name as party_name, cu.customer_code as party_code, cu.address as party_address 
      FROM contracts c
      LEFT JOIN buyers b ON c.buyer_id = b.id
      LEFT JOIN customers cu ON c.customer_id = cu.id
      WHERE c.id = $1 AND c.company_id = $2
    `, [id, req.user.company_id]);
    
    if (contractRes.rows.length === 0) {
      return res.status(404).json({ error: 'Contract not found' });
    }
    
    let itemsQuery = `
      SELECT ci.*, i.item_code, i.description, i.drawing_number, i.long_description
      FROM contract_items ci
      JOIN items i ON ci.item_id = i.id
      WHERE ci.contract_id = $1 AND ci.company_id = $2
      ORDER BY ci.created_at DESC
    `;
    const itemParams = [id, req.user.company_id];

    if (limit !== null) {
      const limitIdx = itemParams.length + 1;
      const offsetIdx = itemParams.length + 2;
      itemsQuery += ` LIMIT $${limitIdx} OFFSET $${offsetIdx}`;
      itemParams.push(limit, offset);
    }

    const itemsRes = await pool.query(itemsQuery, itemParams);
    
    const contract = contractRes.rows[0];
    contract.items = itemsRes.rows;
    
    res.json(contract);
  } catch (err) {
    console.error('Error fetching contract details:', err.message);
    res.status(500).json({ error: 'Failed to fetch contract details' });
  }
});

// Create a new contract
router.post('/', requirePermission(['arc:create', 'manage_arc']), async (req, res) => {
  const { company_name, buyer_id, type, customer_id } = req.body || {};
  if (!company_name) return res.status(400).json({ error: 'company_name required' });
  
  const validTypes = ['buy', 'sell', 'buy process', 'sell process'];
  const contractType = validTypes.includes(type) ? type : 'buy';

  try {
    const result = await pool.query(
      'INSERT INTO contracts (company_name, buyer_id, company_id, type, customer_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [company_name, buyer_id || null, req.user.company_id, contractType, customer_id || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating contract:', err.message);
    res.status(500).json({ error: 'Failed to create contract' });
  }
});

// Update a contract
router.put('/:id', requirePermission(['arc:update', 'manage_arc']), async (req, res) => {
  const { id } = req.params;
  const { company_name, buyer_id, type, customer_id } = req.body || {};
  
  if (!company_name) return res.status(400).json({ error: 'company_name required' });

  const validTypes = ['buy', 'sell', 'buy process', 'sell process'];
  const contractType = validTypes.includes(type) ? type : 'buy';
  
  try {
    const result = await pool.query(
      'UPDATE contracts SET company_name = $1, buyer_id = $2, type = $3, customer_id = $4 WHERE id = $5 AND company_id = $6 RETURNING *',
      [company_name, buyer_id || null, contractType, customer_id !== undefined ? customer_id : null, id, req.user.company_id]
    );
    
    if (result.rows.length === 0) return res.status(404).json({ error: 'Contract not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating contract:', err.message);
    res.status(500).json({ error: 'Failed to update contract' });
  }
});

// Delete a contract
router.delete('/:id', requirePermission(['arc:delete']), async (req, res) => {
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

// Search / list contract items
router.get('/:id/items', requirePermission(['arc:read', 'manage_arc']), async (req, res) => {
  const { id } = req.params;
  const { q } = req.query || {};
  const limit = req.query.limit !== undefined
    ? (req.query.limit === 'all' || req.query.limit === '-1' ? null : parseInt(req.query.limit, 10))
    : 20;
  const offset = req.query.offset ? Math.max(0, parseInt(req.query.offset, 10)) : 0;

  try {
    let query = `
      SELECT ci.*, i.item_code, i.description, i.drawing_number, i.long_description
      FROM contract_items ci
      JOIN items i ON ci.item_id = i.id
      WHERE ci.contract_id = $1 AND ci.company_id = $2
    `;
    const params = [id, req.user.company_id];
    if (q && q.trim()) {
      const qIdx = params.length + 1;
      query += ` AND (i.item_code ILIKE $${qIdx} OR i.description ILIKE $${qIdx} OR i.drawing_number ILIKE $${qIdx})`;
      params.push(`%${q.trim()}%`);
    }
    query += ` ORDER BY ci.created_at DESC`;

    if (limit !== null) {
      const limitIdx = params.length + 1;
      const offsetIdx = params.length + 2;
      query += ` LIMIT $${limitIdx} OFFSET $${offsetIdx}`;
      params.push(limit, offset);
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error searching contract items:', err.message);
    res.status(500).json({ error: 'Failed to search contract items' });
  }
});

// Add item to contract
router.post('/:id/items', requirePermission(['arc:create', 'arc:update', 'manage_arc']), async (req, res) => {
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
router.put('/:contractId/items/:itemId', requirePermission(['arc:update', 'manage_arc']), async (req, res) => {
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
router.delete('/:contractId/items/:itemId', requirePermission(['arc:delete']), async (req, res) => {
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
