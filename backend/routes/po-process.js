const express = require('express');
const router = express.Router();
const { pool, appendDocToTrade } = require('../db');

// GET next Process Purchase Order number (PPO-YYYY-XXXX)
router.get('/next-no', async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT COUNT(*) FROM po_process WHERE company_id = $1",
      [req.user.company_id]
    );
    const count = parseInt(result.rows[0].count) || 0;
    const year = new Date().getFullYear();
    const nextNo = `PPO-${year}-${String(count + 1).padStart(4, '0')}`;
    res.json({ nextNo });
  } catch (err) {
    console.error('Error fetching next PPO number:', err.message);
    res.status(500).json({ error: 'Failed to generate next Process Purchase Order number' });
  }
});

// GET single Process Purchase Order by po_no
router.get('/:po_no', async (req, res) => {
  const { po_no } = req.params;
  try {
    const query = `
      SELECT ppo.po_no, ppo.quotation_no, ppo.po_date, ppo.delivery_date, ppo.shipping_address,
             ppo.basic_value, ppo.gst, ppo.transport, ppo.packing_forward, ppo.other,
             t.trade_id, t.status as trade_status,
             (
               SELECT COALESCE(json_agg(json_build_object(
                 'item_code', i.item_code,
                 'quantity', poi.quantity,
                 'unit_price', poi.unit_price,
                 'gst_rate', poi.gst_rate,
                 'process_name', poi.process_name,
                 'expected_output_code', poi.expected_output_code,
                 'linked_inventory_id', poi.linked_inventory_id,
                 'linked_trace_item_id', poi.linked_trace_item_id,
                 'description', i.description,
                 'drawing_number', i.drawing_number
               )), '[]')
               FROM po_process_items poi
               LEFT JOIN items i ON poi.item_id = i.id AND i.company_id = poi.company_id
               WHERE poi.po_process_id = ppo.id AND poi.company_id = ppo.company_id
             ) as items
      FROM po_process ppo
      LEFT JOIN trades t ON ppo.trade_id = t.id AND t.company_id = ppo.company_id
      WHERE ppo.po_no = $1 AND ppo.company_id = $2
    `;
    const result = await pool.query(query, [po_no, req.user.company_id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Process Purchase Order not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching Process Purchase Order:', err.message);
    res.status(500).json({ error: 'Failed to fetch Process Purchase Order' });
  }
});

// CREATE Process Purchase Order
router.post('/', async (req, res) => {
  const {
    po_no,
    quotation_no,
    trade_id,
    po_date,
    delivery_date,
    shipping_address,
    basic_value,
    gst,
    transport,
    packing_forward,
    other,
    items
  } = req.body || {};

  if (!po_date || !trade_id) {
    return res.status(400).json({ error: 'po_date and trade_id are required' });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'At least one item must be included in the process PO' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Generate PO No if blank
    let final_po_no = po_no;
    if (!final_po_no || !final_po_no.trim()) {
      const countRes = await client.query("SELECT COUNT(*) FROM po_process WHERE company_id = $1", [req.user.company_id]);
      const count = parseInt(countRes.rows[0].count) || 0;
      const year = new Date().getFullYear();
      final_po_no = `PPO-${year}-${String(count + 1).padStart(4, '0')}`;
    } else {
      final_po_no = final_po_no.trim();
    }

    // Check duplicate po_no
    const dupCheck = await client.query("SELECT id FROM po_process WHERE po_no = $1 AND company_id = $2", [final_po_no, req.user.company_id]);
    if (dupCheck.rows.length > 0) {
      throw new Error('Process Purchase Order number already exists');
    }

    // Resolve trade db id
    const tradeRes = await client.query("SELECT id, trade_id FROM trades WHERE trade_id = $1 AND company_id = $2", [trade_id, req.user.company_id]);
    if (tradeRes.rows.length === 0) {
      throw new Error('Trade not found');
    }
    const tradeDbId = tradeRes.rows[0].id;

    // Insert po_process header
    const ppoRes = await client.query(
      `INSERT INTO po_process 
       (po_no, quotation_no, trade_id, po_date, delivery_date, shipping_address, basic_value, gst, transport, packing_forward, other, company_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
      [
        final_po_no,
        quotation_no || null,
        tradeDbId,
        po_date,
        delivery_date || null,
        shipping_address || null,
        parseFloat(basic_value) || 0,
        parseFloat(gst) || 0,
        parseFloat(transport) || 0,
        parseFloat(packing_forward) || 0,
        parseFloat(other) || 0,
        req.user.company_id
      ]
    );
    const ppoDbId = ppoRes.rows[0].id;

    // Insert items and execute process inventory & trace logic
    for (const item of items) {
      // 1. Resolve source item DB ID
      const itemRes = await client.query("SELECT id FROM items WHERE item_code = $1 AND company_id = $2", [item.item_code, req.user.company_id]);
      if (itemRes.rows.length === 0) {
        throw new Error(`Item ${item.item_code} not found in catalog`);
      }
      const itemDbId = itemRes.rows[0].id;

      const qty = parseInt(item.quantity) || 1;
      const unitPrice = parseFloat(item.unit_price) || 0;

      // 2. Reduce quantity from source inventory record (if linked_inventory_id provided)
      let srcInvId = item.linked_inventory_id ? parseInt(item.linked_inventory_id) : null;
      let isInvDeleted = false;

      if (srcInvId) {
        const invUpdate = await client.query(
          `UPDATE inventory 
           SET quantity = quantity - $1, updated_at = CURRENT_TIMESTAMP 
           WHERE id = $2 AND company_id = $3 
           RETURNING quantity`,
          [qty, srcInvId, req.user.company_id]
        );
        if (invUpdate.rows.length > 0 && parseInt(invUpdate.rows[0].quantity) <= 0) {
          // If 0 or less remain, delete from inventory so it does not show
          await client.query('DELETE FROM inventory WHERE id = $1 AND company_id = $2', [srcInvId, req.user.company_id]);
          isInvDeleted = true;
        }
      } else {
        // Fallback: search matching source inventory row with stock
        const findInv = await client.query(
          `SELECT id, quantity FROM inventory WHERE item_code = $1 AND company_id = $2 AND quantity > 0 ORDER BY created_at ASC LIMIT 1`,
          [itemDbId, req.user.company_id]
        );
        if (findInv.rows.length > 0) {
          srcInvId = findInv.rows[0].id;
          const invUpdate = await client.query(
            `UPDATE inventory SET quantity = quantity - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND company_id = $3 RETURNING quantity`,
            [qty, srcInvId, req.user.company_id]
          );
          if (invUpdate.rows.length > 0 && parseInt(invUpdate.rows[0].quantity) <= 0) {
            await client.query('DELETE FROM inventory WHERE id = $1 AND company_id = $2', [srcInvId, req.user.company_id]);
            isInvDeleted = true;
          }
        }
      }

      // If inventory row was deleted because 0 remain, store null for linked_inventory_id to satisfy FK constraint
      const savedLinkedInvId = isInvDeleted ? null : srcInvId;

      // 3. Fetch source trace item process array (if linked_trace_item_id provided)
      let srcTraceId = item.linked_trace_item_id ? parseInt(item.linked_trace_item_id) : null;
      let existingProcess = [];
      if (srcTraceId) {
        const traceRes = await client.query(
          'SELECT process FROM trace_item WHERE id = $1 AND company_id = $2',
          [srcTraceId, req.user.company_id]
        );
        if (traceRes.rows.length > 0) {
          const rawProc = traceRes.rows[0].process;
          if (Array.isArray(rawProc)) {
            existingProcess = rawProc;
          } else if (typeof rawProc === 'string') {
            try { existingProcess = JSON.parse(rawProc); } catch (e) { existingProcess = []; }
          }
        }
      } else {
        // Fallback: search matching source trace item
        const findTrace = await client.query(
          'SELECT id, process FROM trace_item WHERE item_code = $1 AND company_id = $2 ORDER BY created_at ASC LIMIT 1',
          [itemDbId, req.user.company_id]
        );
        if (findTrace.rows.length > 0) {
          srcTraceId = findTrace.rows[0].id;
          const rawProc = findTrace.rows[0].process;
          if (Array.isArray(rawProc)) existingProcess = rawProc;
          else if (typeof rawProc === 'string') {
            try { existingProcess = JSON.parse(rawProc); } catch (e) { existingProcess = []; }
          }
        }
      }

      // 4. Resolve target item code & target item DB ID
      const targetItemCode = (item.expected_output_code && item.expected_output_code.trim())
        ? item.expected_output_code.trim()
        : item.item_code;
      
      let targetItemDbId;
      const targetItemRes = await client.query("SELECT id FROM items WHERE item_code = $1 AND company_id = $2", [targetItemCode, req.user.company_id]);
      if (targetItemRes.rows.length === 0) {
        // Auto-create item in catalog if it doesn't exist yet
        const newCatRes = await client.query(
          "INSERT INTO items (item_code, description, company_id) VALUES ($1, $2, $3) RETURNING id",
          [targetItemCode, `Process Output Item (${targetItemCode})`, req.user.company_id]
        );
        targetItemDbId = newCatRes.rows[0].id;
      } else {
        targetItemDbId = targetItemRes.rows[0].id;
      }

      // 5. Construct new process array by appending process step
      const processStep = {
        type: 'process',
        id: trade_id,
        unit_price: unitPrice,
        po_no: final_po_no,
        process_name: item.process_name || 'Process'
      };
      const updatedProcess = [...(Array.isArray(existingProcess) ? existingProcess : []), processStep];

      // Calculate total cumulative price from all process steps
      const totalPrice = updatedProcess.reduce((sum, pStep) => sum + (parseFloat(pStep.unit_price) || 0), 0);

      // 6. Create NEW trace_item for target item code with status 'in process'
      const targetTraceRes = await client.query(
        `INSERT INTO trace_item (item_code, process, message, quantity, price, status, company_id)
         VALUES ($1, $2::jsonb, $3, $4, $5, 'in process', $6)
         RETURNING id`,
        [
          targetItemDbId,
          JSON.stringify(updatedProcess),
          `In process via PO ${final_po_no} (${item.process_name || 'Process'})`,
          qty,
          totalPrice,
          req.user.company_id
        ]
      );
      const targetTraceId = targetTraceRes.rows[0].id;

      // 7. Create NEW inventory record for target item code linked to targetTraceId (initial completed quantity = 0)
      await client.query(
        `INSERT INTO inventory (item_code, quantity, price, trade_id, message, company_id, trace_item_id)
         VALUES ($1, 0, $3, $4, $5, $6, $7)`,
        [
          targetItemDbId,
          totalPrice,
          tradeDbId,
          `In process: ${final_po_no} (${item.process_name || 'Process'})`,
          req.user.company_id,
          targetTraceId
        ]
      );

      // 8. Save po_process_items header line item record
      await client.query(
        `INSERT INTO po_process_items 
         (po_process_id, item_id, process_name, expected_output_code, quantity, unit_price, gst_rate, linked_inventory_id, linked_trace_item_id, company_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          ppoDbId,
          itemDbId,
          item.process_name || null,
          targetItemCode,
          qty,
          unitPrice,
          parseFloat(item.gst_rate) || 0,
          savedLinkedInvId,
          srcTraceId,
          req.user.company_id
        ]
      );
    }

    // Append doc to trade
    await appendDocToTrade(client, trade_id, 'PO', final_po_no, req.user.company_id);

    // Update trade status to ordered
    await client.query(
      "UPDATE trades SET status = 'ordered' WHERE id = $1 AND company_id = $2",
      [tradeDbId, req.user.company_id]
    );

    await client.query('COMMIT');
    res.status(201).json({ po_no: final_po_no, trade_id });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating Process PO:', err.message);
    res.status(500).json({ error: err.message || 'Failed to create Process Purchase Order' });
  } finally {
    client.release();
  }
});

// UPDATE Process Purchase Order
router.put('/:po_no', async (req, res) => {
  const { po_no } = req.params;
  const {
    po_date,
    delivery_date,
    shipping_address,
    basic_value,
    gst,
    transport,
    packing_forward,
    other,
    items
  } = req.body || {};

  if (!po_date) {
    return res.status(400).json({ error: 'po_date is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const updateHeader = await client.query(
      `UPDATE po_process 
       SET po_date = $1, delivery_date = $2, shipping_address = $3, basic_value = $4, gst = $5, transport = $6, packing_forward = $7, other = $8
       WHERE po_no = $9 AND company_id = $10 RETURNING id`,
      [
        po_date,
        delivery_date || null,
        shipping_address || null,
        parseFloat(basic_value) || 0,
        parseFloat(gst) || 0,
        parseFloat(transport) || 0,
        parseFloat(packing_forward) || 0,
        parseFloat(other) || 0,
        po_no,
        req.user.company_id
      ]
    );

    if (updateHeader.rows.length === 0) {
      throw new Error('Process Purchase Order not found');
    }
    const ppoDbId = updateHeader.rows[0].id;

    // Delete existing items
    await client.query("DELETE FROM po_process_items WHERE po_process_id = $1 AND company_id = $2", [ppoDbId, req.user.company_id]);

    // Insert updated items
    for (const item of items) {
      const itemRes = await client.query("SELECT id FROM items WHERE item_code = $1 AND company_id = $2", [item.item_code, req.user.company_id]);
      if (itemRes.rows.length === 0) {
        throw new Error(`Item ${item.item_code} not found in catalog`);
      }
      const itemDbId = itemRes.rows[0].id;

      await client.query(
        `INSERT INTO po_process_items 
         (po_process_id, item_id, process_name, expected_output_code, quantity, unit_price, gst_rate, linked_inventory_id, linked_trace_item_id, company_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          ppoDbId,
          itemDbId,
          item.process_name || null,
          item.expected_output_code || item.item_code,
          parseInt(item.quantity) || 1,
          parseFloat(item.unit_price) || 0,
          parseFloat(item.gst_rate) || 0,
          item.linked_inventory_id ? parseInt(item.linked_inventory_id) : null,
          item.linked_trace_item_id ? parseInt(item.linked_trace_item_id) : null,
          req.user.company_id
        ]
      );
    }

    await client.query('COMMIT');
    res.json({ po_no });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating Process PO:', err.message);
    res.status(500).json({ error: err.message || 'Failed to update Process Purchase Order' });
  } finally {
    client.release();
  }
});

module.exports = router;
