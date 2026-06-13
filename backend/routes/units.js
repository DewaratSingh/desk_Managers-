const express = require('express');
const { pool } = require('../db');

const router = express.Router();

// Get units (with optional search filter)
router.get('/', async (req, res) => {
  const { search } = req.query;
  try {
    let queryText = 'SELECT name FROM units ORDER BY name ASC';
    let values = [];
    
    if (search) {
      queryText = 'SELECT name FROM units WHERE name ILIKE $1 ORDER BY name ASC';
      values = [`%${search}%`];
    }
    
    const { rows } = await pool.query(queryText, values);
    res.json(rows.map(r => r.name));
  } catch (error) {
    console.error('Error fetching units:', error);
    res.status(500).json({ error: 'Server error fetching units' });
  }
});

// Create a new unit if it doesn't already exist
router.post('/', async (req, res) => {
  const { name } = req.body;
  
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Unit name is required' });
  }
  
  const cleanName = name.trim();
  try {
    await pool.query('INSERT INTO units (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [cleanName]);
    res.status(201).json({ name: cleanName });
  } catch (error) {
    console.error('Error creating unit:', error);
    res.status(500).json({ error: 'Server error creating unit' });
  }
});

module.exports = router;
