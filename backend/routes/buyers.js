const express = require('express');
const { pool } = require('../db');

const router = express.Router();

// Get all buyers
router.get('/', async (req, res) => {
  const { search } = req.query;
  try {
    let queryText = 'SELECT * FROM buyers ORDER BY id DESC';
    let values = [];

    if (search) {
      queryText = `
        SELECT * FROM buyers 
        WHERE name ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1 
        ORDER BY id DESC
      `;
      values = [`%${search}%`];
    }

    const { rows } = await pool.query(queryText, values);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching buyers:', error);
    res.status(500).json({ error: 'Server error fetching buyers' });
  }
});

// Add new buyer
router.post('/', async (req, res) => {
  const { name, email, phone } = req.body;
  if (!name || !email || !phone) {
    return res.status(400).json({ error: 'Name, email, and phone number are required' });
  }

  try {
    const queryText = `
      INSERT INTO buyers (name, email, phone) 
      VALUES ($1, $2, $3) 
      RETURNING *
    `;
    const { rows } = await pool.query(queryText, [name, email, phone]);
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Error creating buyer:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'A buyer with this email already exists' });
    }
    res.status(500).json({ error: 'Server error creating buyer' });
  }
});

// Update buyer
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, email, phone } = req.body;

  if (!name || !email || !phone) {
    return res.status(400).json({ error: 'Name, email, and phone number are required' });
  }

  try {
    const queryText = `
      UPDATE buyers 
      SET name = $1, email = $2, phone = $3 
      WHERE id = $4 
      RETURNING *
    `;
    const { rows } = await pool.query(queryText, [name, email, phone, id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Buyer not found' });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error('Error updating buyer:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'A buyer with this email already exists' });
    }
    res.status(500).json({ error: 'Server error updating buyer' });
  }
});

// Delete buyer
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { rowCount } = await pool.query('DELETE FROM buyers WHERE id = $1', [id]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Buyer not found' });
    }
    res.json({ success: true, message: 'Buyer successfully deleted' });
  } catch (error) {
    console.error('Error deleting buyer:', error);
    res.status(500).json({ error: 'Server error deleting buyer' });
  }
});

module.exports = router;
