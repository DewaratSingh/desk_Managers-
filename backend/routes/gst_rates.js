const express = require('express');
const { pool } = require('../db');

const router = express.Router();

// Get all GST rates (with search filter and pagination)
router.get('/', async (req, res) => {
  const { search } = req.query;
  const limit = parseInt(req.query.limit) || 20;
  const offset = parseInt(req.query.offset) || 0;
  
  try {
    let queryText = 'SELECT * FROM gst_rates ORDER BY rate ASC, type ASC LIMIT $1 OFFSET $2';
    let values = [limit, offset];
    
    if (search) {
      queryText = 'SELECT * FROM gst_rates WHERE type ILIKE $3 ORDER BY rate ASC, type ASC LIMIT $1 OFFSET $2';
      values = [limit, offset, `%${search}%`];
    }
    
    const { rows } = await pool.query(queryText, values);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching GST rates:', error);
    res.status(500).json({ error: 'Server error fetching GST rates' });
  }
});

// Add a new GST rate
router.post('/', async (req, res) => {
  const { type, rate } = req.body;
  
  if (!type || rate === undefined) {
    return res.status(400).json({ error: 'GST Type and Rate are required' });
  }
  
  const parsedRate = parseFloat(rate);
  if (isNaN(parsedRate) || parsedRate < 0) {
    return res.status(400).json({ error: 'Rate must be a positive number' });
  }
  
  try {
    const result = await pool.query(
      'INSERT INTO gst_rates (type, rate) VALUES ($1, $2) RETURNING *',
      [type.trim(), parsedRate]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating GST rate:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'A GST Category with this Type already exists' });
    }
    res.status(500).json({ error: 'Server error creating GST rate' });
  }
});

// Update a GST rate
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { type, rate } = req.body;
  
  if (!type || rate === undefined) {
    return res.status(400).json({ error: 'GST Type and Rate are required' });
  }
  
  const parsedRate = parseFloat(rate);
  if (isNaN(parsedRate) || parsedRate < 0) {
    return res.status(400).json({ error: 'Rate must be a positive number' });
  }
  
  try {
    const result = await pool.query(
      'UPDATE gst_rates SET type = $1, rate = $2 WHERE id = $3 RETURNING *',
      [type.trim(), parsedRate, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'GST Category not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating GST rate:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'A GST Category with this Type already exists' });
    }
    res.status(500).json({ error: 'Server error updating GST rate' });
  }
});

// Delete a GST rate
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const result = await pool.query('DELETE FROM gst_rates WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'GST Category not found' });
    }
    res.json({ message: 'GST Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting GST rate:', error);
    res.status(500).json({ error: 'Server error deleting GST rate' });
  }
});

module.exports = router;
