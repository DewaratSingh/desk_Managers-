const express = require('express');
const { pool, calculateTradeStatus } = require('../db');

const router = express.Router();

// Helper to sync trade_id foreign keys in child tables
async function syncTradeRelations(client, tradeId, documents) {
  // 1. Unset trade_id for all documents currently pointing to this tradeId in all child tables
  const tables = [
    { name: 'rfqs', idCol: 'rfq_no' },
    { name: 'quotations', idCol: 'quotation_no' },
    { name: 'purchase_orders', idCol: 'po_no' },
    { name: 'release_orders', idCol: 'ro_no' },
    { name: 'delivery_notes', idCol: 'delivery_note_no' },
    { name: 'invoices', idCol: 'invoice_no' },
    { name: 'grns', idCol: 'grn_no' },
    { name: 'payments', idCol: 'payment_no' }
  ];

  for (const table of tables) {
    await client.query(`UPDATE ${table.name} SET trade_id = NULL WHERE trade_id = $1`, [tradeId]);
  }

  // 2. Set trade_id for the documents in the list
  const typeToTableMap = {
    'RFQ': { table: 'rfqs', idCol: 'rfq_no' },
    'QUOTATION': { table: 'quotations', idCol: 'quotation_no' },
    'PO': { table: 'purchase_orders', idCol: 'po_no' },
    'RO': { table: 'release_orders', idCol: 'ro_no' },
    'DN': { table: 'delivery_notes', idCol: 'delivery_note_no' },
    'INVOICE': { table: 'invoices', idCol: 'invoice_no' },
    'GRN': { table: 'grns', idCol: 'grn_no' },
    'PAYMENT': { table: 'payments', idCol: 'payment_no' }
  };

  for (const doc of documents) {
    if (!doc.type || !doc.id) continue;
    const mapping = typeToTableMap[doc.type.toUpperCase()];
    if (mapping) {
      await client.query(
        `UPDATE ${mapping.table} SET trade_id = $1 WHERE ${mapping.idCol} = $2`,
        [tradeId, doc.id]
      );
    }
  }
}

// Get all trades with aggregated metadata (RFQ customer, buyer, total value)
router.get('/', async (req, res) => {
  const { search, status, trade_type } = req.query;
  const limit = parseInt(req.query.limit) || 20;
  const offset = parseInt(req.query.offset) || 0;

  try {
    let queryText = `
      SELECT t.*,
             r.rfq_no,
             COALESCE(c.name, cro.name, crq.name) AS customer_name,
             COALESCE(c.address, cro.address, crq.address) AS customer_address,
             COALESCE(b.name, bro.name, brq.name) AS buyer_name,
             COALESCE(b.email, bro.email, brq.email) AS buyer_email,
             COALESCE(b.phone, bro.phone, brq.phone) AS buyer_phone,
             COALESCE(
               (
                 SELECT SUM(qi.quantity * qi.unit_price)
                 FROM quotation_items qi
                 JOIN quotations q ON qi.quotation_no = q.quotation_no
                 WHERE q.trade_id = t.trade_id OR q.rfq_no = r.rfq_no
               ),
               (
                 SELECT SUM(rqi.quantity * rqi.unit_price)
                 FROM received_quotation_items rqi
                 JOIN received_quotations rq_val ON rqi.received_quotation_no = rq_val.received_quotation_no
                 WHERE rq_val.trade_id = t.trade_id
               ),
               (
                 SELECT SUM(roi.quantity * roi.unit_price)
                 FROM release_order_items roi
                 JOIN release_orders ro_val ON roi.ro_no = ro_val.ro_no
                 WHERE ro_val.trade_id = t.trade_id
               ),
               0
             ) AS total_value
      FROM trades t
      LEFT JOIN rfqs r ON r.trade_id = t.trade_id
      LEFT JOIN customers c ON r.customer_id = c.id
      LEFT JOIN buyers b ON r.buyer_id = b.id
      LEFT JOIN release_orders ro ON ro.trade_id = t.trade_id
      LEFT JOIN customers cro ON ro.customer_id = cro.id
      LEFT JOIN buyers bro ON ro.buyer_id = bro.id
      LEFT JOIN received_quotations rq ON rq.trade_id = t.trade_id
      LEFT JOIN customers crq ON rq.customer_id = crq.id
      LEFT JOIN buyers brq ON rq.buyer_id = brq.id
    `;
    
    const conditions = [];
    const values = [];
    let paramIdx = 1;

    if (search) {
      conditions.push(`(t.trade_id ILIKE $${paramIdx} OR c.name ILIKE $${paramIdx} OR b.name ILIKE $${paramIdx} OR cro.name ILIKE $${paramIdx} OR bro.name ILIKE $${paramIdx} OR crq.name ILIKE $${paramIdx} OR brq.name ILIKE $${paramIdx})`);
      values.push(`%${search}%`);
      paramIdx++;
    }

    if (status && status !== 'all') {
      conditions.push(`t.status = $${paramIdx}`);
      values.push(status);
      paramIdx++;
    }

    if (trade_type && trade_type !== 'all') {
      conditions.push(`t.trade_type = $${paramIdx}`);
      values.push(trade_type);
      paramIdx++;
    }

    if (conditions.length > 0) {
      queryText += ' WHERE ' + conditions.join(' AND ');
    }

    queryText += ` ORDER BY t.created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
    values.push(limit, offset);

    const { rows } = await pool.query(queryText, values);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching trades:', error);
    res.status(500).json({ error: 'Server error fetching trades' });
  }
});

// Get trade trace (RFQ -> Quotation -> PO)
router.get('/:trade_id/trace', async (req, res) => {
  const { trade_id } = req.params;
  try {
    // 1. Fetch RFQ details for this trade
    const rfqQuery = `
      SELECT r.*,
        b.name AS buyer_name, b.email AS buyer_email, b.phone AS buyer_phone,
        c.name AS customer_name, c.address AS customer_address
      FROM rfqs r
      LEFT JOIN buyers b ON r.buyer_id = b.id
      LEFT JOIN customers c ON r.customer_id = c.id
      WHERE r.trade_id = $1
    `;
    const rfqRes = await pool.query(rfqQuery, [trade_id]);
    
    let rfq = null;
    if (rfqRes.rows.length > 0) {
      rfq = rfqRes.rows[0];
      // Fetch RFQ items
      const rfqItemsRes = await pool.query(`
        SELECT ri.*, i.description, i.drawing_number 
        FROM rfq_items ri
        LEFT JOIN items i ON ri.item_code = i.item_code
        WHERE ri.rfq_no = $1
        ORDER BY ri.id
      `, [rfq.rfq_no]);
      rfq.items = rfqItemsRes.rows;
    }

    // 2. Fetch linked Quotation if it exists
    const qtnQuery = `
      SELECT q.* FROM quotations q WHERE q.trade_id = $1
    `;
    const qtnRes = await pool.query(qtnQuery, [trade_id]);
    let quotation = null;
    if (qtnRes.rows.length > 0) {
      quotation = qtnRes.rows[0];
      const qtnItemsRes = await pool.query(`
        SELECT qi.*, i.description, i.drawing_number 
        FROM quotation_items qi
        LEFT JOIN items i ON qi.item_code = i.item_code
        WHERE qi.quotation_no = $1
        ORDER BY qi.id
      `, [quotation.quotation_no]);
      quotation.items = qtnItemsRes.rows;
    }

    // 3. Fetch linked Purchase Order if it exists
    let purchaseOrder = null;
    const poQuery = `
      SELECT po.* FROM purchase_orders po WHERE po.trade_id = $1
    `;
    const poRes = await pool.query(poQuery, [trade_id]);
    if (poRes.rows.length > 0) {
      purchaseOrder = poRes.rows[0];
      const poItemsRes = await pool.query(`
        SELECT poi.*, i.description, i.drawing_number 
        FROM purchase_order_items poi
        LEFT JOIN items i ON poi.item_code = i.item_code
        WHERE poi.po_no = $1
        ORDER BY poi.id
      `, [purchaseOrder.po_no]);
      purchaseOrder.items = poItemsRes.rows;
    }

    // 3b. Fetch linked Release Order if it exists
    let releaseOrder = null;
    const roQuery = `
      SELECT ro.*,
             c.name AS customer_name, c.address AS customer_address,
             b.name AS buyer_name, b.email AS buyer_email, b.phone AS buyer_phone
      FROM release_orders ro
      LEFT JOIN customers c ON ro.customer_id = c.id
      LEFT JOIN buyers b ON ro.buyer_id = b.id
      WHERE ro.trade_id = $1
    `;
    const roRes = await pool.query(roQuery, [trade_id]);
    if (roRes.rows.length > 0) {
      releaseOrder = roRes.rows[0];
      const roItemsRes = await pool.query(`
        SELECT roi.*, i.description, i.drawing_number 
        FROM release_order_items roi
        LEFT JOIN items i ON roi.item_code = i.item_code
        WHERE roi.ro_no = $1
        ORDER BY roi.id
      `, [releaseOrder.ro_no]);
      releaseOrder.items = roItemsRes.rows;
    }

    // 3c. Fetch linked Received Quotation if it exists
    let receivedQuotation = null;
    const rqQuery = `
      SELECT rq.*,
             c.name AS customer_name, c.address AS customer_address,
             b.name AS buyer_name, b.email AS buyer_email, b.phone AS buyer_phone
      FROM received_quotations rq
      LEFT JOIN customers c ON rq.customer_id = c.id
      LEFT JOIN buyers b ON rq.buyer_id = b.id
      WHERE rq.trade_id = $1
    `;
    const rqRes = await pool.query(rqQuery, [trade_id]);
    if (rqRes.rows.length > 0) {
      receivedQuotation = rqRes.rows[0];
      const rqItemsRes = await pool.query(`
        SELECT rqi.*, i.description, i.drawing_number 
        FROM received_quotation_items rqi
        LEFT JOIN items i ON rqi.item_code = i.item_code
        WHERE rqi.received_quotation_no = $1
        ORDER BY rqi.id
      `, [receivedQuotation.received_quotation_no]);
      receivedQuotation.items = rqItemsRes.rows;
    }

    // Fallback: check documents array inside the trade if legacy records don't have direct trade_id set
    if (!rfq) {
      const tradeRes = await pool.query('SELECT documents FROM trades WHERE trade_id = $1', [trade_id]);
      if (tradeRes.rows.length > 0) {
        const docs = tradeRes.rows[0].documents || [];
        const rfqDoc = docs.find(d => d.type === 'RFQ');
        if (rfqDoc) {
          const fallbackRfqRes = await pool.query(`
            SELECT r.*,
              b.name AS buyer_name, b.email AS buyer_email, b.phone AS buyer_phone,
              c.name AS customer_name, c.address AS customer_address
            FROM rfqs r
            LEFT JOIN buyers b ON r.buyer_id = b.id
            LEFT JOIN customers c ON r.customer_id = c.id
            WHERE r.rfq_no = $1
          `, [rfqDoc.id]);
          if (fallbackRfqRes.rows.length > 0) {
            rfq = fallbackRfqRes.rows[0];
            const rfqItemsRes = await pool.query(`
              SELECT ri.*, i.description, i.drawing_number 
              FROM rfq_items ri
              LEFT JOIN items i ON ri.item_code = i.item_code
              WHERE ri.rfq_no = $1
              ORDER BY ri.id
            `, [rfq.rfq_no]);
            rfq.items = rfqItemsRes.rows;
          }
        }

        const qtnDoc = docs.find(d => d.type === 'QUOTATION');
        if (qtnDoc && !quotation) {
          const fallbackQtnRes = await pool.query(`SELECT q.* FROM quotations q WHERE q.quotation_no = $1`, [qtnDoc.id]);
          if (fallbackQtnRes.rows.length > 0) {
            quotation = fallbackQtnRes.rows[0];
            const qtnItemsRes = await pool.query(`
              SELECT qi.*, i.description, i.drawing_number 
              FROM quotation_items qi
              LEFT JOIN items i ON qi.item_code = i.item_code
              WHERE qi.quotation_no = $1
              ORDER BY qi.id
            `, [quotation.quotation_no]);
            quotation.items = qtnItemsRes.rows;
          }
        }

        const poDoc = docs.find(d => d.type === 'PO');
        if (poDoc && !purchaseOrder) {
          const fallbackPoRes = await pool.query(`SELECT po.* FROM purchase_orders po WHERE po.po_no = $1`, [poDoc.id]);
          if (fallbackPoRes.rows.length > 0) {
            purchaseOrder = fallbackPoRes.rows[0];
            const poItemsRes = await pool.query(`
              SELECT poi.*, i.description, i.drawing_number 
              FROM purchase_order_items poi
              LEFT JOIN items i ON poi.item_code = i.item_code
              WHERE poi.po_no = $1
              ORDER BY poi.id
            `, [purchaseOrder.po_no]);
            purchaseOrder.items = poItemsRes.rows;
          }
        }

        const roDoc = docs.find(d => d.type === 'RO');
        if (roDoc && !releaseOrder) {
          const fallbackRoRes = await pool.query(`
            SELECT ro.*,
                   c.name AS customer_name, c.address AS customer_address,
                   b.name AS buyer_name, b.email AS buyer_email, b.phone AS buyer_phone
            FROM release_orders ro
            LEFT JOIN customers c ON ro.customer_id = c.id
            LEFT JOIN buyers b ON ro.buyer_id = b.id
            WHERE ro.ro_no = $1
          `, [roDoc.id]);
          if (fallbackRoRes.rows.length > 0) {
            releaseOrder = fallbackRoRes.rows[0];
            const roItemsRes = await pool.query(`
              SELECT roi.*, i.description, i.drawing_number 
              FROM release_order_items roi
              LEFT JOIN items i ON roi.item_code = i.item_code
              WHERE roi.ro_no = $1
              ORDER BY roi.id
            `, [releaseOrder.ro_no]);
            releaseOrder.items = roItemsRes.rows;
          }
        }

        const rqDoc = docs.find(d => d.type === 'QUOTATION' && d.id.startsWith('RQTN-'));
        if (rqDoc && !receivedQuotation) {
          const fallbackRqRes = await pool.query(`
            SELECT rq.*,
                   c.name AS customer_name, c.address AS customer_address,
                   b.name AS buyer_name, b.email AS buyer_email, b.phone AS buyer_phone
            FROM received_quotations rq
            LEFT JOIN customers c ON rq.customer_id = c.id
            LEFT JOIN buyers b ON rq.buyer_id = b.id
            WHERE rq.received_quotation_no = $1
          `, [rqDoc.id]);
          if (fallbackRqRes.rows.length > 0) {
            receivedQuotation = fallbackRqRes.rows[0];
            const rqItemsRes = await pool.query(`
              SELECT rqi.*, i.description, i.drawing_number 
              FROM received_quotation_items rqi
              LEFT JOIN items i ON rqi.item_code = i.item_code
              WHERE rqi.received_quotation_no = $1
              ORDER BY rqi.id
            `, [receivedQuotation.received_quotation_no]);
            receivedQuotation.items = rqItemsRes.rows;
          }
        }
      }
    }

    // 4. Fetch linked Delivery Notes
    const dnQuery = `
      SELECT dn.* FROM delivery_notes dn WHERE dn.trade_id = $1 ORDER BY dn.created_at DESC
    `;
    const dnRes = await pool.query(dnQuery, [trade_id]);
    const deliveryNotes = dnRes.rows;
    for (const dn of deliveryNotes) {
      const dnItemsRes = await pool.query(`
        SELECT dni.*, i.description, i.drawing_number,
               COALESCE(poi.shipping_address, roi.shipping_address) AS shipping_address,
               COALESCE(poi.delivery_date, roi.delivery_date) AS delivery_date
        FROM delivery_note_items dni
        LEFT JOIN items i ON dni.item_code = i.item_code
        LEFT JOIN delivery_notes dn ON dni.delivery_note_no = dn.delivery_note_no
        LEFT JOIN purchase_order_items poi ON dn.po_no = poi.po_no AND dni.item_code = poi.item_code
        LEFT JOIN release_order_items roi ON dn.ro_no = roi.ro_no AND dni.item_code = roi.item_code
        WHERE dni.delivery_note_no = $1
        ORDER BY dni.id
      `, [dn.delivery_note_no]);
      dn.items = dnItemsRes.rows;
    }

    // 5. Fetch linked Invoices
    const invQuery = `
      SELECT inv.* FROM invoices inv WHERE inv.trade_id = $1 ORDER BY inv.created_at DESC
    `;
    const invRes = await pool.query(invQuery, [trade_id]);
    const invoices = invRes.rows;
    for (const inv of invoices) {
      const invItemsRes = await pool.query(`
        SELECT invi.*, i.description, i.drawing_number,
               COALESCE(invi.shipping_address, poi.shipping_address, roi.shipping_address) AS shipping_address,
               COALESCE(invi.delivery_date, poi.delivery_date, roi.delivery_date) AS delivery_date
        FROM invoice_items invi
        LEFT JOIN items i ON invi.item_code = i.item_code
        LEFT JOIN invoices inv ON invi.invoice_no = inv.invoice_no
        LEFT JOIN delivery_notes dn ON inv.delivery_note_no = dn.delivery_note_no
        LEFT JOIN purchase_order_items poi ON COALESCE(dn.po_no, inv.po_no) = poi.po_no AND invi.item_code = poi.item_code
        LEFT JOIN release_order_items roi ON COALESCE(dn.ro_no, inv.ro_no) = roi.ro_no AND invi.item_code = roi.item_code
        WHERE invi.invoice_no = $1
        ORDER BY invi.id
      `, [inv.invoice_no]);
      inv.items = invItemsRes.rows;
    }

    // 6. Fetch linked GRNs
    const grnQuery = `
      SELECT grn.* FROM grns grn WHERE grn.trade_id = $1 ORDER BY grn.created_at DESC
    `;
    const grnRes = await pool.query(grnQuery, [trade_id]);
    const grns = grnRes.rows;

    // 7. Fetch linked Payments
    const payQuery = `
      SELECT pay.* FROM payments pay WHERE pay.trade_id = $1 ORDER BY pay.created_at DESC
    `;
    const payRes = await pool.query(payQuery, [trade_id]);
    const payments = payRes.rows;

    // 8. Fetch trade documents sequence
    const tradeRes = await pool.query('SELECT documents FROM trades WHERE trade_id = $1', [trade_id]);
    const documents = tradeRes.rows.length > 0 ? (tradeRes.rows[0].documents || []) : [];

    res.json({
      rfq,
      quotation,
      purchase_order: purchaseOrder,
      release_order: releaseOrder,
      received_quotation: receivedQuotation,
      delivery_notes: deliveryNotes,
      invoices: invoices,
      grns: grns,
      payments: payments,
      documents: documents
    });
  } catch (error) {
    console.error('Error fetching trade trace:', error);
    res.status(500).json({ error: 'Server error fetching trade trace' });
  }
});

// Get trade by trade_id
router.get('/:trade_id', async (req, res) => {
  const { trade_id } = req.params;

  try {
    const { rows } = await pool.query('SELECT * FROM trades WHERE trade_id = $1', [trade_id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Trade not found' });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching trade details:', error);
    res.status(500).json({ error: 'Server error fetching trade details' });
  }
});

// Add a new trade
router.post('/', async (req, res) => {
  let { trade_id, documents = [], status, trade_type = 'sell' } = req.body;

  if (!status) {
    status = calculateTradeStatus(documents);
  }

  // Auto-generate trade_id if not supplied
  if (!trade_id || !trade_id.trim()) {
    try {
      const year = new Date().getFullYear();
      const prefix = `TRADE-${year}-`;
      
      const lastTrade = await pool.query(
        'SELECT trade_id FROM trades WHERE trade_id LIKE $1 ORDER BY trade_id DESC LIMIT 1',
        [`${prefix}%`]
      );

      let nextSeq = 1;
      if (lastTrade.rows.length > 0) {
        const lastId = lastTrade.rows[0].trade_id;
        const parts = lastId.split('-');
        if (parts.length === 3) {
          const lastSeq = parseInt(parts[2], 10);
          if (!isNaN(lastSeq)) {
            nextSeq = lastSeq + 1;
          }
        }
      }

      trade_id = `${prefix}${String(nextSeq).padStart(4, '0')}`;
    } catch (err) {
      console.error('Error auto-generating Trade ID:', err);
      return res.status(500).json({ error: 'Server error generating Trade ID' });
    }
  }

  const client = await pool.connect();
  try {
    const trimmedId = trade_id.trim();
    // Check if duplicate
    const checkDup = await client.query('SELECT trade_id FROM trades WHERE trade_id = $1', [trimmedId]);
    if (checkDup.rows.length > 0) {
      return res.status(400).json({ error: 'Trade ID already exists' });
    }

    await client.query('BEGIN');

    const { rows } = await client.query(
      'INSERT INTO trades (trade_id, documents, status, trade_type) VALUES ($1, $2, $3, $4) RETURNING *',
      [trimmedId, JSON.stringify(documents), status, trade_type]
    );

    await syncTradeRelations(client, trimmedId, documents);

    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating trade:', error);
    res.status(500).json({ error: 'Server error creating trade' });
  } finally {
    client.release();
  }
});

// Update trade documents & status
router.put('/:trade_id', async (req, res) => {
  const { trade_id } = req.params;
  const { documents, status, trade_type } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const currentTradeRes = await client.query('SELECT * FROM trades WHERE trade_id = $1', [trade_id]);
    if (currentTradeRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Trade not found' });
    }
    const currentTrade = currentTradeRes.rows[0];

    const finalDocs = documents !== undefined ? documents : currentTrade.documents;
    const finalTradeType = trade_type !== undefined ? trade_type : currentTrade.trade_type;

    let finalStatus;
    if (status !== undefined) {
      finalStatus = status;
    } else if (documents !== undefined) {
      finalStatus = calculateTradeStatus(finalDocs);
    } else {
      finalStatus = currentTrade.status;
    }

    if (documents !== undefined && !Array.isArray(documents)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Documents must be an array' });
    }

    const { rows } = await client.query(
      'UPDATE trades SET documents = $1, status = $2, trade_type = $3 WHERE trade_id = $4 RETURNING *',
      [JSON.stringify(finalDocs), finalStatus, finalTradeType, trade_id]
    );

    if (documents !== undefined) {
      await syncTradeRelations(client, trade_id, finalDocs);
    }

    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating trade:', error);
    res.status(500).json({ error: 'Server error updating trade' });
  } finally {
    client.release();
  }
});

// Delete a trade
router.delete('/:trade_id', async (req, res) => {
  const { trade_id } = req.params;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Unset trade_id on all child tables referencing this trade
    const tables = ['rfqs', 'quotations', 'purchase_orders', 'release_orders', 'delivery_notes', 'invoices', 'grns', 'payments'];
    for (const table of tables) {
      await client.query(`UPDATE ${table} SET trade_id = NULL WHERE trade_id = $1`, [trade_id]);
    }

    const { rowCount } = await client.query('DELETE FROM trades WHERE trade_id = $1', [trade_id]);
    if (rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Trade not found' });
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'Trade successfully deleted' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting trade:', error);
    res.status(500).json({ error: 'Server error deleting trade' });
  } finally {
    client.release();
  }
});

module.exports = router;
