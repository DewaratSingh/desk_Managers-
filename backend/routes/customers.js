const express = require('express');
const { pool } = require('../db');

const router = express.Router();

// Get all customers (with search support)
router.get('/', async (req, res) => {
  const { search } = req.query;
  try {
    let queryText = 'SELECT * FROM customers ORDER BY created_at DESC';
    let values = [];

    if (search) {
      queryText = `
        SELECT * FROM customers 
        WHERE id ILIKE $1 OR name ILIKE $1 OR address ILIKE $1 
        ORDER BY created_at DESC
      `;
      values = [`%${search}%`];
    }

    const { rows } = await pool.query(queryText, values);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: 'Server error fetching customers' });
  }
});

// Add new customer (user-specified ID)
router.post('/', async (req, res) => {
  const { id, name, address } = req.body;
  if (!id || !name || !address) {
    return res.status(400).json({ error: 'Customer ID, name, and address are required fields' });
  }

  try {
    const queryText = `
      INSERT INTO customers (id, name, address) 
      VALUES ($1, $2, $3) 
      RETURNING *
    `;
    const { rows } = await pool.query(queryText, [id.trim(), name.trim(), address.trim()]);
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Error creating customer:', error);
    if (error.code === '23505') { // Unique constraint violation (duplicate ID)
      return res.status(400).json({ error: 'A customer with this Customer ID already exists' });
    }
    res.status(500).json({ error: 'Server error creating customer' });
  }
});

// Update customer details (by ID)
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, address } = req.body;

  if (!name || !address) {
    return res.status(400).json({ error: 'Name and address are required fields' });
  }

  try {
    const queryText = `
      UPDATE customers 
      SET name = $1, address = $2 
      WHERE id = $3 
      RETURNING *
    `;
    const { rows } = await pool.query(queryText, [name.trim(), address.trim(), id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error('Error updating customer:', error);
    res.status(500).json({ error: 'Server error updating customer' });
  }
});

// Delete customer
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { rowCount } = await pool.query('DELETE FROM customers WHERE id = $1', [id]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.json({ success: true, message: 'Customer successfully deleted' });
  } catch (error) {
    console.error('Error deleting customer:', error);
    res.status(500).json({ error: 'Server error deleting customer' });
  }
});

module.exports = router;
