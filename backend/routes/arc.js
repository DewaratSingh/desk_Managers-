const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Get all ARC items
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT a.id, a.item_code, a.price, i.description, i.drawing_number 
      FROM arc_items a
      JOIN items i ON a.item_code = i.item_code
      ORDER BY a.created_at DESC
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching ARC items:', error);
    res.status(500).json({ error: 'Server error fetching ARC items' });
  }
});

// Add a new ARC item
router.post('/', async (req, res) => {
  const { item_code, price } = req.body;
  if (!item_code || price === undefined) {
    return res.status(400).json({ error: 'Item code and price are required' });
  }
  try {
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      return res.status(400).json({ error: 'Price must be a valid positive number' });
    }
    const { rows } = await pool.query(`
      INSERT INTO arc_items (item_code, price)
      VALUES ($1, $2)
      ON CONFLICT (item_code) DO UPDATE SET price = EXCLUDED.price
      RETURNING *
    `, [item_code, parsedPrice]);
    
    // Fetch with details
    const result = await pool.query(`
      SELECT a.id, a.item_code, a.price, i.description, i.drawing_number 
      FROM arc_items a
      JOIN items i ON a.item_code = i.item_code
      WHERE a.item_code = $1
    `, [item_code]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error adding ARC item:', error);
    res.status(500).json({ error: 'Server error adding ARC item' });
  }
});

// Update ARC item price
router.put('/:item_code', async (req, res) => {
  const { item_code } = req.params;
  const { price } = req.body;
  try {
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      return res.status(400).json({ error: 'Price must be a valid positive number' });
    }
    const { rows } = await pool.query(`
      UPDATE arc_items SET price = $1 WHERE item_code = $2 RETURNING *
    `, [parsedPrice, item_code]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'ARC item not found' });
    }

    const result = await pool.query(`
      SELECT a.id, a.item_code, a.price, i.description, i.drawing_number 
      FROM arc_items a
      JOIN items i ON a.item_code = i.item_code
      WHERE a.item_code = $1
    `, [item_code]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating ARC item:', error);
    res.status(500).json({ error: 'Server error updating ARC item' });
  }
});

// Delete ARC item
router.delete('/:item_code', async (req, res) => {
  const { item_code } = req.params;
  try {
    const { rows } = await pool.query('DELETE FROM arc_items WHERE item_code = $1 RETURNING *', [item_code]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'ARC item not found' });
    }
    res.json({ message: 'ARC item deleted successfully' });
  } catch (error) {
    console.error('Error deleting ARC item:', error);
    res.status(500).json({ error: 'Server error deleting ARC item' });
  }
});

module.exports = router;
