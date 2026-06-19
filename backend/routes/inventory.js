const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Get inventory items (with optional search)
router.get('/', async (req, res) => {
  const { q } = req.query || {};
  try {
    let result;
    if (q) {
      const searchQuery = `%${q}%`;
      result = await pool.query(
        `SELECT inv.*, it.description, it.drawing_number 
         FROM inventory inv
         LEFT JOIN items it ON inv.item_code = it.item_code
         WHERE inv.item_code ILIKE $1 
            OR inv.location ILIKE $1 
            OR inv.rack ILIKE $1 
            OR inv.shelf_number ILIKE $1
            OR it.description ILIKE $1
         ORDER BY inv.created_at DESC`,
        [searchQuery]
      );
    } else {
      result = await pool.query(
        `SELECT inv.*, it.description, it.drawing_number 
         FROM inventory inv
         LEFT JOIN items it ON inv.item_code = it.item_code
         ORDER BY inv.created_at DESC`
      );
    }
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching inventory:', err.message);
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});

// Create inventory entry
router.post('/', async (req, res) => {
  const {
    item_code,
    quantity_in_stock,
    rack,
    shelf_number,
    location,
    unit,
    allocated_quantity,
    rfq_no,
    notes
  } = req.body || {};

  if (!item_code) {
    return res.status(400).json({ error: 'item_code is required' });
  }
  if (quantity_in_stock === undefined || quantity_in_stock === null || isNaN(parseFloat(quantity_in_stock))) {
    return res.status(400).json({ error: 'Valid quantity_in_stock is required' });
  }

  const parsedQty = parseFloat(quantity_in_stock);
  const parsedAllocated = allocated_quantity ? parseInt(allocated_quantity, 10) : 0;

  if (parsedQty < 0) {
    return res.status(400).json({ error: 'Quantity in stock cannot be negative' });
  }
  if (parsedAllocated < 0) {
    return res.status(400).json({ error: 'Allocated quantity cannot be negative' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO inventory (
        item_code, quantity_in_stock, rack, shelf_number, location, unit, allocated_quantity, rfq_no, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        item_code,
        parsedQty,
        rack || null,
        shelf_number || null,
        location || null,
        unit || 'Piece',
        parsedAllocated,
        rfq_no || null,
        notes || null
      ]
    );

    // Fetch the inserted record with joined item description to return to the frontend
    const joinedRes = await pool.query(
      `SELECT inv.*, it.description, it.drawing_number 
       FROM inventory inv
       LEFT JOIN items it ON inv.item_code = it.item_code
       WHERE inv.id = $1`,
      [result.rows[0].id]
    );

    res.status(201).json(joinedRes.rows[0]);
  } catch (err) {
    console.error('Error creating inventory entry:', err.message);
    res.status(500).json({ error: 'Failed to create inventory entry' });
  }
});

// Update inventory entry
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const {
    item_code,
    quantity_in_stock,
    rack,
    shelf_number,
    location,
    unit,
    allocated_quantity,
    rfq_no,
    notes
  } = req.body || {};

  if (!item_code) {
    return res.status(400).json({ error: 'item_code is required' });
  }
  if (quantity_in_stock === undefined || quantity_in_stock === null || isNaN(parseFloat(quantity_in_stock))) {
    return res.status(400).json({ error: 'Valid quantity_in_stock is required' });
  }

  const parsedQty = parseFloat(quantity_in_stock);
  const parsedAllocated = allocated_quantity ? parseInt(allocated_quantity, 10) : 0;

  if (parsedQty < 0) {
    return res.status(400).json({ error: 'Quantity in stock cannot be negative' });
  }
  if (parsedAllocated < 0) {
    return res.status(400).json({ error: 'Allocated quantity cannot be negative' });
  }

  try {
    const result = await pool.query(
      `UPDATE inventory 
       SET item_code = $1, 
           quantity_in_stock = $2, 
           rack = $3, 
           shelf_number = $4, 
           location = $5, 
           unit = $6, 
           allocated_quantity = $7, 
           rfq_no = $8, 
           notes = $9,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $10 
       RETURNING *`,
      [
        item_code,
        parsedQty,
        rack || null,
        shelf_number || null,
        location || null,
        unit || 'Piece',
        parsedAllocated,
        rfq_no || null,
        notes || null,
        id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Inventory record not found' });
    }

    // Fetch updated record with joined details
    const joinedRes = await pool.query(
      `SELECT inv.*, it.description, it.drawing_number 
       FROM inventory inv
       LEFT JOIN items it ON inv.item_code = it.item_code
       WHERE inv.id = $1`,
      [id]
    );

    res.json(joinedRes.rows[0]);
  } catch (err) {
    console.error('Error updating inventory entry:', err.message);
    res.status(500).json({ error: 'Failed to update inventory entry' });
  }
});

// Delete inventory entry
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM inventory WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Inventory record not found' });
    }
    res.json({ message: 'Inventory record deleted successfully', id });
  } catch (err) {
    console.error('Error deleting inventory entry:', err.message);
    res.status(500).json({ error: 'Failed to delete inventory entry' });
  }
});

module.exports = router;
