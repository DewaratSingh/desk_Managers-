const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Get ARC items
router.get('/', async (req, res) => {
  try {
    const { q } = req.query || {};
    const limit = req.query.limit ? parseInt(req.query.limit) : null;
    const offset = req.query.offset ? parseInt(req.query.offset) : 0;
    
    let query = `
      SELECT ai.id, i.item_code, ai.price, i.description, i.drawing_number, i.long_description, ai.created_at
      FROM arc_items ai
      JOIN items i ON ai.item_id = i.id
      WHERE ai.company_id = $1
    `;
    const params = [req.user.company_id];
    
    if (q) {
      query += ' AND (i.item_code ILIKE $2 OR i.description ILIKE $2 OR i.drawing_number ILIKE $2)';
      params.push(`%${q}%`);
    }
    
    query += ' ORDER BY ai.created_at DESC';
    
    if (limit !== null) {
      const limitParamIdx = params.length + 1;
      const offsetParamIdx = params.length + 2;
      query += ` LIMIT $${limitParamIdx} OFFSET $${offsetParamIdx}`;
      params.push(limit, offset);
    }
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching arc_items:', err.message);
    res.status(500).json({ error: 'Failed to fetch ARC items' });
  }
});

// Create an ARC item
router.post('/', async (req, res) => {
  const { item_code, price } = req.body || {};
  if (!item_code || price === undefined) return res.status(400).json({ error: 'item_code and price required' });
  try {
    const itemCheck = await pool.query('SELECT id FROM items WHERE item_code = $1 AND company_id = $2', [item_code, req.user.company_id]);
    if (itemCheck.rows.length === 0) return res.status(400).json({ error: 'Item code does not exist in catalog' });
    const itemDbId = itemCheck.rows[0].id;

    const result = await pool.query(
      'INSERT INTO arc_items (item_id, price, company_id) VALUES ($1, $2, $3) ON CONFLICT (item_id, company_id) DO NOTHING RETURNING id',
      [itemDbId, parseFloat(price), req.user.company_id]
    );
    if (result.rows.length === 0) return res.status(400).json({ error: 'ARC pricing already exists for this item' });

    const fullItemResult = await pool.query(`
      SELECT ai.id, i.item_code, ai.price, i.description, i.drawing_number, i.long_description, ai.created_at
      FROM arc_items ai
      JOIN items i ON ai.item_id = i.id
      WHERE ai.item_id = $1 AND ai.company_id = $2
    `, [itemDbId, req.user.company_id]);
    res.status(201).json(fullItemResult.rows[0]);
  } catch (err) {
    console.error('Error creating arc_item:', err.message);
    res.status(500).json({ error: 'Failed to create ARC item' });
  }
});

// Update an ARC item
router.put('/:item_code', async (req, res) => {
  const { item_code } = req.params;
  const { price } = req.body || {};
  if (price === undefined) return res.status(400).json({ error: 'price required' });
  try {
    const itemCheck = await pool.query('SELECT id FROM items WHERE item_code = $1 AND company_id = $2', [item_code, req.user.company_id]);
    if (itemCheck.rows.length === 0) return res.status(404).json({ error: 'Item not found' });
    const itemDbId = itemCheck.rows[0].id;

    const result = await pool.query(
      'UPDATE arc_items SET price = $1 WHERE item_id = $2 AND company_id = $3 RETURNING id',
      [parseFloat(price), itemDbId, req.user.company_id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'ARC item not found' });

    const fullItemResult = await pool.query(`
      SELECT ai.id, i.item_code, ai.price, i.description, i.drawing_number, i.long_description, ai.created_at
      FROM arc_items ai
      JOIN items i ON ai.item_id = i.id
      WHERE ai.item_id = $1 AND ai.company_id = $2
    `, [itemDbId, req.user.company_id]);
    res.json(fullItemResult.rows[0]);
  } catch (err) {
    console.error('Error updating arc_item:', err.message);
    res.status(500).json({ error: 'Failed to update ARC item' });
  }
});

// Delete an ARC item
router.delete('/:item_code', async (req, res) => {
  const { item_code } = req.params;
  try {
    const itemCheck = await pool.query('SELECT id FROM items WHERE item_code = $1 AND company_id = $2', [item_code, req.user.company_id]);
    if (itemCheck.rows.length === 0) return res.status(404).json({ error: 'Item not found' });
    const itemDbId = itemCheck.rows[0].id;

    const result = await pool.query('DELETE FROM arc_items WHERE item_id = $1 AND company_id = $2 RETURNING id', [itemDbId, req.user.company_id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'ARC item not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    console.error('Error deleting arc_item:', err.message);
    res.status(500).json({ error: 'Failed to delete ARC item' });
  }
});

module.exports = router;
