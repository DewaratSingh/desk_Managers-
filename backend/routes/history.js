const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// GET history by ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT h.id, h.item_id, h.item_code, h.delivery_note_id, h.price, h.history, h.created_at,
              i.description, i.drawing_number, dn.delivery_note_no
       FROM history h
       LEFT JOIN items i ON h.item_id = i.id
       LEFT JOIN delivery_notes dn ON h.delivery_note_id = dn.id
       WHERE h.id = $1 AND h.company_id = $2`,
      [id, req.user.company_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'History record not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching history:', err.message);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

module.exports = router;
