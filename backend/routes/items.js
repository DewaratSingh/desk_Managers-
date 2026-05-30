const express = require('express');
const { pool } = require('../db');

const router = express.Router();

// Get all items
router.get('/', async (req, res) => {
  const { search } = req.query;
  const limit = parseInt(req.query.limit) || 20;
  const offset = parseInt(req.query.offset) || 0;

  try {
    let queryText = 'SELECT * FROM items ORDER BY created_at DESC LIMIT $1 OFFSET $2';
    let values = [limit, offset];

    if (search) {
      queryText = `
        SELECT * FROM items 
        WHERE item_code ILIKE $1 OR description ILIKE $1 OR drawing_number ILIKE $1 OR long_description ILIKE $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `;
      values = [`%${search}%`, limit, offset];
    }

    const { rows } = await pool.query(queryText, values);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ error: 'Server error fetching items' });
  }
});

// Add new item
router.post('/', async (req, res) => {
  const { item_code, description, drawing_number, long_description } = req.body;
  if (!item_code || !description) {
    return res.status(400).json({ error: 'Item Code and Description are required' });
  }

  try {
    const queryText = `
      INSERT INTO items (item_code, description, drawing_number, long_description) 
      VALUES ($1, $2, $3, $4) 
      RETURNING *
    `;
    const { rows } = await pool.query(queryText, [
      item_code.trim(),
      description.trim(),
      drawing_number ? drawing_number.trim() : null,
      long_description ? long_description.trim() : null
    ]);
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Error creating item:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'An item with this Item Code already exists' });
    }
    res.status(500).json({ error: 'Server error creating item' });
  }
});

// Update item
router.put('/:item_code', async (req, res) => {
  const { item_code } = req.params;
  const { description, drawing_number, long_description } = req.body;

  if (!description) {
    return res.status(400).json({ error: 'Description is required' });
  }

  try {
    const queryText = `
      UPDATE items 
      SET description = $1, drawing_number = $2, long_description = $3 
      WHERE item_code = $4 
      RETURNING *
    `;
    const { rows } = await pool.query(queryText, [
      description.trim(),
      drawing_number ? drawing_number.trim() : null,
      long_description ? long_description.trim() : null,
      item_code
    ]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error('Error updating item:', error);
    res.status(500).json({ error: 'Server error updating item' });
  }
});

// Delete item
router.delete('/:item_code', async (req, res) => {
  const { item_code } = req.params;
  try {
    const { rowCount } = await pool.query('DELETE FROM items WHERE item_code = $1', [item_code]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json({ success: true, message: 'Item successfully deleted' });
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ error: 'Server error deleting item' });
  }
});

module.exports = router;
