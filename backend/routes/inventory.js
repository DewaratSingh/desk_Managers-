const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Get inventory items (with optional search, limit & offset)
router.get('/', async (req, res) => {
  const { q } = req.query || {};
  const limit = req.query.limit ? parseInt(req.query.limit) : null;
  const offset = req.query.offset ? parseInt(req.query.offset) : 0;
  try {
    let queryText = `
      SELECT inv.id, it.item_code, inv.quantity_in_stock, inv.rack, inv.shelf_number,
             inv.location, inv.unit, inv.allocated_quantity, r.rfq_no, inv.notes,
             inv.company_id, inv.created_at, inv.updated_at,
             it.description, it.drawing_number 
      FROM inventory inv
      LEFT JOIN items it ON inv.item_id = it.id
      LEFT JOIN rfqs r ON inv.rfq_id = r.id
      WHERE inv.company_id = $1
    `;
    const params = [req.user.company_id];
    if (q) {
      queryText += `
        AND (it.item_code ILIKE $2 
           OR inv.location ILIKE $2 
           OR inv.rack ILIKE $2 
           OR inv.shelf_number ILIKE $2
           OR it.description ILIKE $2)
      `;
      params.push(`%${q}%`);
    }
    queryText += ` ORDER BY inv.created_at DESC`;

    if (limit !== null) {
      const limitParamIdx = params.length + 1;
      const offsetParamIdx = params.length + 2;
      queryText += ` LIMIT $${limitParamIdx} OFFSET $${offsetParamIdx}`;
      params.push(limit, offset);
    } else if (q) {
      queryText += ` LIMIT 5`; // Default to 5 when searching
    }

    const result = await pool.query(queryText, params);
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
    // Resolve itemDbId
    const itemRes = await pool.query('SELECT id FROM items WHERE item_code = $1 AND company_id = $2', [item_code, req.user.company_id]);
    if (itemRes.rows.length === 0) {
      return res.status(400).json({ error: `Item ${item_code} not found` });
    }
    const itemDbId = itemRes.rows[0].id;

    // Resolve rfqDbId
    let rfqDbId = null;
    if (rfq_no) {
      const rfqRes = await pool.query('SELECT id FROM rfqs WHERE rfq_no = $1 AND company_id = $2', [rfq_no, req.user.company_id]);
      if (rfqRes.rows.length > 0) {
        rfqDbId = rfqRes.rows[0].id;
      }
    }

    const result = await pool.query(
      `INSERT INTO inventory (
        item_id, quantity_in_stock, rack, shelf_number, location, unit, allocated_quantity, rfq_id, notes, company_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [
        itemDbId,
        parsedQty,
        rack || null,
        shelf_number || null,
        location || null,
        unit || 'Piece',
        parsedAllocated,
        rfqDbId,
        notes || null,
        req.user.company_id
      ]
    );

    // Fetch the inserted record with joined details
    const joinedRes = await pool.query(
      `SELECT inv.id, it.item_code, inv.quantity_in_stock, inv.rack, inv.shelf_number,
              inv.location, inv.unit, inv.allocated_quantity, r.rfq_no, inv.notes,
              inv.company_id, inv.created_at, inv.updated_at,
              it.description, it.drawing_number 
       FROM inventory inv
       LEFT JOIN items it ON inv.item_id = it.id
       LEFT JOIN rfqs r ON inv.rfq_id = r.id
       WHERE inv.id = $1 AND inv.company_id = $2`,
      [result.rows[0].id, req.user.company_id]
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
    // Resolve itemDbId
    const itemRes = await pool.query('SELECT id FROM items WHERE item_code = $1 AND company_id = $2', [item_code, req.user.company_id]);
    if (itemRes.rows.length === 0) {
      return res.status(400).json({ error: `Item ${item_code} not found` });
    }
    const itemDbId = itemRes.rows[0].id;

    // Resolve rfqDbId
    let rfqDbId = null;
    if (rfq_no) {
      const rfqRes = await pool.query('SELECT id FROM rfqs WHERE rfq_no = $1 AND company_id = $2', [rfq_no, req.user.company_id]);
      if (rfqRes.rows.length > 0) {
        rfqDbId = rfqRes.rows[0].id;
      }
    }

    const result = await pool.query(
      `UPDATE inventory 
       SET item_id = $1, 
           quantity_in_stock = $2, 
           rack = $3, 
           shelf_number = $4, 
           location = $5, 
           unit = $6, 
           allocated_quantity = $7, 
           rfq_id = $8, 
           notes = $9,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $10 AND company_id = $11 
       RETURNING id`,
      [
        itemDbId,
        parsedQty,
        rack || null,
        shelf_number || null,
        location || null,
        unit || 'Piece',
        parsedAllocated,
        rfqDbId,
        notes || null,
        id,
        req.user.company_id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Inventory record not found' });
    }

    // Fetch updated record with joined details
    const joinedRes = await pool.query(
      `SELECT inv.id, it.item_code, inv.quantity_in_stock, inv.rack, inv.shelf_number,
              inv.location, inv.unit, inv.allocated_quantity, r.rfq_no, inv.notes,
              inv.company_id, inv.created_at, inv.updated_at,
              it.description, it.drawing_number 
       FROM inventory inv
       LEFT JOIN items it ON inv.item_id = it.id
       LEFT JOIN rfqs r ON inv.rfq_id = r.id
       WHERE inv.id = $1 AND inv.company_id = $2`,
      [id, req.user.company_id]
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
    const result = await pool.query('DELETE FROM inventory WHERE id = $1 AND company_id = $2 RETURNING id', [id, req.user.company_id]);
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
