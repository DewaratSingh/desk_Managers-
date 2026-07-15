const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Get customers
router.get('/', async (req, res) => {
  try {
    const { q } = req.query || {};
    const limit = req.query.limit ? parseInt(req.query.limit) : null;
    const offset = req.query.offset ? parseInt(req.query.offset) : 0;
    
    let query = 'SELECT customer_code as id, name, address, created_at FROM customers WHERE company_id = $1';
    const params = [req.user.company_id];
    
    if (q) {
      query += ' AND (customer_code ILIKE $2 OR name ILIKE $2 OR address ILIKE $2)';
      params.push(`%${q}%`);
    }
    
    query += ' ORDER BY created_at DESC';
    
    if (limit !== null) {
      const limitParamIdx = params.length + 1;
      const offsetParamIdx = params.length + 2;
      query += ` LIMIT $${limitParamIdx} OFFSET $${offsetParamIdx}`;
      params.push(limit, offset);
    }
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching customers:', err.message);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// Create a customer
router.post('/', async (req, res) => {
  const { id, name, address } = req.body || {};
  if (!id || !name || !address) return res.status(400).json({ error: 'id, name and address required' });
  try {
    const result = await pool.query(
      'INSERT INTO customers (customer_code, name, address, company_id) VALUES ($1, $2, $3, $4) ON CONFLICT (customer_code, company_id) DO NOTHING RETURNING customer_code as id, name, address', 
      [id, name, address, req.user.company_id]
    );
    if (result.rows.length === 0) return res.status(400).json({ error: 'Customer already exists' });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating customer:', err.message);
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

// Update a customer
router.put('/:id', async (req, res) => {
  const { id } = req.params; // this is the customer_code
  const { name, address } = req.body || {};
  if (!name || !address) return res.status(400).json({ error: 'name and address required' });
  try {
    const result = await pool.query(
      'UPDATE customers SET name = $1, address = $2 WHERE customer_code = $3 AND company_id = $4 RETURNING customer_code as id, name, address', 
      [name, address, id, req.user.company_id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Customer not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating customer:', err.message);
    res.status(500).json({ error: 'Failed to update customer' });
  }
});

module.exports = router;
