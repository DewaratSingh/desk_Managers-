const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// GET all active manufacturing runs
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT m.id, 
              it_src.item_code AS source_item_code_val,
              it_tgt.item_code AS target_item_code_val,
              m.source_item_code,
              m.source_p_item_id,
              m.source_inventory_id,
              m.target_item_code,
              m.possible_cost_per_unit,
              m.quantity_used,
              m.possible_quantity_produced,
              m.start_date,
              m.possible_end_date,
              m.message,
              m.company_id,
              m.created_at
       FROM manufacturing m
       LEFT JOIN items it_src ON m.source_item_code = it_src.id
       LEFT JOIN items it_tgt ON m.target_item_code = it_tgt.id
       WHERE m.company_id = $1
       ORDER BY m.created_at DESC`,
      [req.user.company_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching manufacturing list:', err.message);
    res.status(500).json({ error: 'Failed to fetch manufacturing list' });
  }
});

// POST start new manufacturing run
router.post('/', async (req, res) => {
  const {
    source_item_code,
    source_p_item_id,
    source_inventory_id,
    target_item_code,
    possible_cost_per_unit,
    quantity_used,
    possible_quantity_produced,
    start_date,
    possible_end_date,
    message
  } = req.body || {};

  if (!source_item_code || !source_inventory_id || !target_item_code || !quantity_used || !possible_quantity_produced || !start_date) {
    return res.status(400).json({ error: 'Missing required manufacturing parameters' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Resolve source item database ID
    const srcItemRes = await client.query('SELECT id FROM items WHERE item_code = $1 AND company_id = $2', [source_item_code, req.user.company_id]);
    if (srcItemRes.rows.length === 0) throw new Error(`Source Item ${source_item_code} not found`);
    const srcItemDbId = srcItemRes.rows[0].id;

    // Resolve target item database ID
    const tgtItemRes = await client.query('SELECT id FROM items WHERE item_code = $1 AND company_id = $2', [target_item_code, req.user.company_id]);
    if (tgtItemRes.rows.length === 0) throw new Error(`Target Item ${target_item_code} not found`);
    const tgtItemDbId = tgtItemRes.rows[0].id;

    // Verify available inventory stock
    const invRes = await client.query('SELECT quantity FROM inventory WHERE id = $1 AND company_id = $2', [parseInt(source_inventory_id), req.user.company_id]);
    if (invRes.rows.length === 0) throw new Error('Source inventory record not found');
    const availableQty = parseInt(invRes.rows[0].quantity) || 0;

    if (parseInt(quantity_used) > availableQty) {
      throw new Error(`Insufficient inventory quantity. Available: ${availableQty}, Requested: ${quantity_used}`);
    }

    // Deduct quantity from source inventory record
    const invUpdate = await client.query(
      `UPDATE inventory 
       SET quantity = quantity - $1 
       WHERE id = $2 AND company_id = $3 
       RETURNING quantity`,
      [parseInt(quantity_used), parseInt(source_inventory_id), req.user.company_id]
    );
    const remainingQty = invUpdate.rows.length > 0 ? parseInt(invUpdate.rows[0].quantity) : 0;
    const inventoryConsumed = remainingQty <= 0;

    // Retrieve source P_item process trace to cache in manufacturing stage run
    let processArray = [];
    if (source_p_item_id) {
      const pRes = await client.query('SELECT process FROM P_item WHERE id = $1 AND company_id = $2', [parseInt(source_p_item_id), req.user.company_id]);
      if (pRes.rows.length > 0 && Array.isArray(pRes.rows[0].process)) {
        processArray = pRes.rows[0].process;
      }
    }

    // Insert staged manufacturing run
    // Use NULL for source_inventory_id if inventory will be deleted (fully consumed)
    const result = await client.query(
      `INSERT INTO manufacturing (
         source_item_code, source_p_item_id, source_inventory_id, target_item_code,
         possible_cost_per_unit, quantity_used, possible_quantity_produced,
         start_date, possible_end_date, message, process, company_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
      [
        srcItemDbId,
        source_p_item_id ? parseInt(source_p_item_id) : null,
        inventoryConsumed ? null : parseInt(source_inventory_id),
        tgtItemDbId,
        parseFloat(possible_cost_per_unit) || 0.00,
        parseInt(quantity_used),
        parseInt(possible_quantity_produced),
        start_date,
        possible_end_date || null,
        message || null,
        processArray,
        req.user.company_id
      ]
    );

    // Now safe to delete inventory if fully consumed (FK already stored as NULL)
    if (inventoryConsumed) {
      await client.query(
        'DELETE FROM inventory WHERE id = $1 AND company_id = $2',
        [parseInt(source_inventory_id), req.user.company_id]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ message: 'Manufacturing run started successfully', id: result.rows[0].id });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating manufacturing run:', err.message);
    res.status(500).json({ error: err.message || 'Failed to start manufacturing run' });
  } finally {
    client.release();
  }
});

// PUT update message of a run
router.put('/:id/message', async (req, res) => {
  const { id } = req.params;
  const { message } = req.body || {};
  try {
    const result = await pool.query(
      'UPDATE manufacturing SET message = $1 WHERE id = $2 AND company_id = $3 RETURNING id',
      [message || null, parseInt(id), req.user.company_id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Manufacturing run not found' });
    }
    res.json({ message: 'Manufacturing run message updated successfully' });
  } catch (err) {
    console.error('Error updating manufacturing run message:', err.message);
    res.status(500).json({ error: 'Failed to update manufacturing run message' });
  }
});

// POST complete a run
router.post('/:id/complete', async (req, res) => {
  const { id } = req.params;
  const { actual_quantity_produced } = req.body || {};

  const actualQty = parseInt(actual_quantity_produced);
  if (isNaN(actualQty) || actualQty <= 0) {
    return res.status(400).json({ error: 'Valid actual quantity produced is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Retrieve the manufacturing record
    const runRes = await client.query('SELECT * FROM manufacturing WHERE id = $1 AND company_id = $2', [parseInt(id), req.user.company_id]);
    if (runRes.rows.length === 0) throw new Error('Manufacturing run not found');
    const run = runRes.rows[0];

    // 2. Retrieve the process trace cached in the manufacturing record
    let processCopy = [];
    if (run.process && Array.isArray(run.process)) {
      processCopy = [...run.process];
    }

    // 3. Append the new manufacture tag: manufacture:process_name:cost
    const procName = run.message || 'manufacturing';
    const tag = `manufacture:${procName.replace(/:/g, '-')}:${parseFloat(run.possible_cost_per_unit) || 0.00}`;
    processCopy.push(tag);

    // 4. Create the new P_item record for target_item_code as TEXT[]
    const newPRes = await client.query(
      `INSERT INTO P_item (item_code, process, message, quantity, price, company_id)
       VALUES ($1, $2::TEXT[], $3, $4, $5, $6) RETURNING id`,
      [
        run.target_item_code,
        processCopy,
        run.message || `Manufactured from item id ${run.source_item_code}`,
        actualQty,
        parseFloat(run.possible_cost_per_unit) || 0.00,
        req.user.company_id
      ]
    );
    const newPItemId = newPRes.rows[0].id;

    // 5. Add this new P_item in inventory
    await client.query(
      `INSERT INTO inventory (item_code, quantity, price, message, company_id, p_item_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        run.target_item_code,
        actualQty,
        parseFloat(run.possible_cost_per_unit) || 0.00,
        run.message || `Added from completed manufacturing run`,
        req.user.company_id,
        newPItemId
      ]
    );

    // 6. Delete this run from the manufacturing table
    await client.query('DELETE FROM manufacturing WHERE id = $1 AND company_id = $2', [run.id, req.user.company_id]);

    await client.query('COMMIT');
    res.json({ message: 'Manufacturing run completed and inventory stored successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error completing manufacturing run:', err.message);
    res.status(500).json({ error: err.message || 'Failed to complete manufacturing run' });
  } finally {
    client.release();
  }
});

module.exports = router;
