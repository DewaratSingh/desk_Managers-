const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Get items (limit 100, optional search)
router.get('/', async (req, res) => {
  const { q } = req.query || {};
  try {
    let result;
    if (q) {
      const searchQuery = `%${q}%`;
      result = await pool.query(
        `SELECT item_code, description, drawing_number, long_description, created_at 
         FROM items 
         WHERE item_code ILIKE $1 OR description ILIKE $1 OR drawing_number ILIKE $1 
         ORDER BY created_at DESC LIMIT 100`,
        [searchQuery]
      );
    } else {
      result = await pool.query('SELECT item_code, description, drawing_number, long_description, created_at FROM items ORDER BY created_at DESC LIMIT 100');
    }
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching items:', err.message);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

// Create an item
router.post('/', async (req, res) => {
  const { item_code, description, drawing_number, long_description } = req.body || {};
  if (!item_code || !description) return res.status(400).json({ error: 'item_code and description required' });
  try {
    const result = await pool.query(
      'INSERT INTO items (item_code, description, drawing_number, long_description) VALUES ($1, $2, $3, $4) ON CONFLICT (item_code) DO NOTHING RETURNING *',
      [item_code, description, drawing_number, long_description]
    );
    if (result.rows.length === 0) return res.status(400).json({ error: 'Item code already exists' });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating item:', err.message);
    res.status(500).json({ error: 'Failed to create item' });
  }
});

// Update an item
router.put('/:item_code', async (req, res) => {
  const { item_code } = req.params;
  const { description, drawing_number, long_description } = req.body || {};
  if (!description) return res.status(400).json({ error: 'description required' });
  try {
    const result = await pool.query(
      'UPDATE items SET description = $1, drawing_number = $2, long_description = $3 WHERE item_code = $4 RETURNING *',
      [description, drawing_number, long_description, item_code]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Item not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating item:', err.message);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

module.exports = router;
