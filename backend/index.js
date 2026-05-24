require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { pool, initializeDatabase } = require('./db');

const app = express();
const port = process.env.PORT || 5000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Initialize PostgreSQL connection and tables
initializeDatabase();

// Session token cache
const activeSessions = new Map();

// Native crypto helper for hashing passwords
const crypto = require('crypto');
const hashPassword = (password) => {
  return crypto.createHash('sha256').update(password).digest('hex');
};

// Token Verification Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No authentication token provided.' });
  }

  const user = activeSessions.get(token);
  if (!user) {
    return res.status(401).json({ error: 'Session expired or invalid token. Please log in again.' });
  }

  req.user = user;
  next();
};

app.get('/', (req, res) => {
  res.send('DeskManager API is online and connected to PostgreSQL!');
});

// ============================================================================
// AUTHENTICATION API ENDPOINTS
// ============================================================================

// Login Endpoint
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const inputHash = hashPassword(password);
    const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username.trim()]);

    if (rows.length === 0 || rows[0].password_hash !== inputHash) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = rows[0];
    const token = crypto.randomBytes(32).toString('hex');
    activeSessions.set(token, { username: user.username, role: user.role });

    res.json({
      token,
      user: {
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: 'Server error during login authentication' });
  }
});

// Verify Session Endpoint
app.get('/api/auth/verify', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const user = activeSessions.get(token);
  if (!user) {
    return res.status(401).json({ error: 'Invalid or expired session token' });
  }

  res.json({ valid: true, user });
});

// Protect CRUD endpoints (all endpoints defined below this point under these paths will require a token)
app.use('/api/customers', authenticateToken);
app.use('/api/buyers', authenticateToken);
app.use('/api/items', authenticateToken);

// ============================================================================
// CUSTOMERS API ENDPOINTS (Simplified: ID, Name, Address)
// ============================================================================

// Get all customers (with search support)
app.get('/api/customers', async (req, res) => {
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
app.post('/api/customers', async (req, res) => {
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
app.put('/api/customers/:id', async (req, res) => {
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
app.delete('/api/customers/:id', async (req, res) => {
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

// ============================================================================
// BUYERS API ENDPOINTS
// ============================================================================

// Get all buyers
app.get('/api/buyers', async (req, res) => {
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
app.post('/api/buyers', async (req, res) => {
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
app.put('/api/buyers/:id', async (req, res) => {
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
app.delete('/api/buyers/:id', async (req, res) => {
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

// ============================================================================
// ITEMS API ENDPOINTS
// ============================================================================

// Get all items
app.get('/api/items', async (req, res) => {
  const { search } = req.query;
  try {
    let queryText = 'SELECT * FROM items ORDER BY created_at DESC';
    let values = [];

    if (search) {
      queryText = `
        SELECT * FROM items 
        WHERE item_code ILIKE $1 OR description ILIKE $1 OR drawing_number ILIKE $1 OR long_description ILIKE $1
        ORDER BY created_at DESC
      `;
      values = [`%${search}%`];
    }

    const { rows } = await pool.query(queryText, values);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ error: 'Server error fetching items' });
  }
});

// Add new item
app.post('/api/items', async (req, res) => {
  const { item_code, description, drawing_number, long_description } = req.body;
  if (!item_code || !description) {
    return res.status(400).json({ error: 'Item Code and Description are required' });
  }

  try {
    const queryText = `
      INSERT INTO items (item_code, description, drawing_number, long_description) 
      VALUES ($1, $2, $3, $4) 
      RETURNING *
    `;
    const { rows } = await pool.query(queryText, [
      item_code.trim(),
      description.trim(),
      drawing_number ? drawing_number.trim() : null,
      long_description ? long_description.trim() : null
    ]);
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Error creating item:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'An item with this Item Code already exists' });
    }
    res.status(500).json({ error: 'Server error creating item' });
  }
});

// Update item
app.put('/api/items/:item_code', async (req, res) => {
  const { item_code } = req.params;
  const { description, drawing_number, long_description } = req.body;

  if (!description) {
    return res.status(400).json({ error: 'Description is required' });
  }

  try {
    const queryText = `
      UPDATE items 
      SET description = $1, drawing_number = $2, long_description = $3 
      WHERE item_code = $4 
      RETURNING *
    `;
    const { rows } = await pool.query(queryText, [
      description.trim(),
      drawing_number ? drawing_number.trim() : null,
      long_description ? long_description.trim() : null,
      item_code
    ]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error('Error updating item:', error);
    res.status(500).json({ error: 'Server error updating item' });
  }
});

// Delete item
app.delete('/api/items/:item_code', async (req, res) => {
  const { item_code } = req.params;
  try {
    const { rowCount } = await pool.query('DELETE FROM items WHERE item_code = $1', [item_code]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json({ success: true, message: 'Item successfully deleted' });
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ error: 'Server error deleting item' });
  }
});

// ============================================================================
// RFQ API ENDPOINTS
// ============================================================================

app.use('/api/rfqs', authenticateToken);

// Get all RFQs — each row includes an `items` array
app.get('/api/rfqs', async (req, res) => {
  const { search } = req.query;
  try {
    let whereClause = '';
    let values = [];

    if (search) {
      whereClause = `WHERE r.rfq_no ILIKE $1 OR r.buyer_name ILIKE $1 OR r.customer_id ILIKE $1`;
      values = [`%${search}%`];
    }

    const queryText = `
      SELECT r.*,
        COALESCE(
          json_agg(
            json_build_object(
              'item_code', ri.item_code,
              'description', ri.description,
              'drawing_number', ri.drawing_number,
              'quantity', ri.quantity
            ) ORDER BY ri.id
          ) FILTER (WHERE ri.item_code IS NOT NULL),
          '[]'
        ) AS items
      FROM rfqs r
      LEFT JOIN rfq_items ri ON r.rfq_no = ri.rfq_no
      ${whereClause}
      GROUP BY r.rfq_no
      ORDER BY r.created_at DESC
    `;
    const { rows } = await pool.query(queryText, values);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching RFQs:', error);
    res.status(500).json({ error: 'Server error fetching RFQs' });
  }
});

// Add new RFQ — inserts RFQ then rfq_items in a single transaction
app.post('/api/rfqs', async (req, res) => {
  const {
    rfq_no, rfq_date, commercial_bid_due_date, technical_bid_due_date,
    buyer_id, buyer_name, buyer_email, buyer_phone, customer_id,
    items = []
  } = req.body;

  if (!rfq_no || !rfq_date || !commercial_bid_due_date || !technical_bid_due_date) {
    return res.status(400).json({ error: 'RFQ No., RFQ Date, Commercial Bid Due Date, and Technical Bid Due Date are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const rfqResult = await client.query(`
      INSERT INTO rfqs (rfq_no, rfq_date, commercial_bid_due_date, technical_bid_due_date,
        buyer_id, buyer_name, buyer_email, buyer_phone, customer_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      rfq_no.trim(), rfq_date, commercial_bid_due_date, technical_bid_due_date,
      buyer_id || null, buyer_name || null, buyer_email || null,
      buyer_phone || null, customer_id || null
    ]);

    // Validate and insert associated items
    for (const item of items) {
      const qty = parseInt(item.quantity);
      if (isNaN(qty) || qty <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Quantity is compulsory and must be greater than 0 for item ${item.item_code}` });
      }

      await client.query(`
        INSERT INTO rfq_items (rfq_no, item_code, description, drawing_number, quantity)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (rfq_no, item_code) DO NOTHING
      `, [rfq_no.trim(), item.item_code, item.description || null, item.drawing_number || null, qty]);
    }

    await client.query('COMMIT');

    // Return RFQ with items array
    const { rows } = await pool.query(`
      SELECT r.*,
        COALESCE(
          json_agg(json_build_object('item_code', ri.item_code, 'description', ri.description, 'drawing_number', ri.drawing_number, 'quantity', ri.quantity) ORDER BY ri.id)
          FILTER (WHERE ri.item_code IS NOT NULL), '[]'
        ) AS items
      FROM rfqs r LEFT JOIN rfq_items ri ON r.rfq_no = ri.rfq_no
      WHERE r.rfq_no = $1 GROUP BY r.rfq_no
    `, [rfq_no.trim()]);

    res.status(201).json(rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating RFQ:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'An RFQ with this RFQ No. already exists' });
    }
    res.status(500).json({ error: 'Server error creating RFQ' });
  } finally {
    client.release();
  }
});

// Update RFQ — replaces rfq_items entirely in a transaction
app.put('/api/rfqs/:rfq_no', async (req, res) => {
  const { rfq_no } = req.params;
  const {
    rfq_date, commercial_bid_due_date, technical_bid_due_date,
    buyer_id, buyer_name, buyer_email, buyer_phone, customer_id,
    items = []
  } = req.body;

  if (!rfq_date || !commercial_bid_due_date || !technical_bid_due_date) {
    return res.status(400).json({ error: 'RFQ Date, Commercial Bid Due Date, and Technical Bid Due Date are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const rfqResult = await client.query(`
      UPDATE rfqs SET
        rfq_date = $1, commercial_bid_due_date = $2, technical_bid_due_date = $3,
        buyer_id = $4, buyer_name = $5, buyer_email = $6,
        buyer_phone = $7, customer_id = $8
      WHERE rfq_no = $9 RETURNING *
    `, [
      rfq_date, commercial_bid_due_date, technical_bid_due_date,
      buyer_id || null, buyer_name || null, buyer_email || null,
      buyer_phone || null, customer_id || null, rfq_no
    ]);

    if (rfqResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'RFQ not found' });
    }

    // Validate and replace all items
    await client.query('DELETE FROM rfq_items WHERE rfq_no = $1', [rfq_no]);
    for (const item of items) {
      const qty = parseInt(item.quantity);
      if (isNaN(qty) || qty <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Quantity is compulsory and must be greater than 0 for item ${item.item_code}` });
      }

      await client.query(`
        INSERT INTO rfq_items (rfq_no, item_code, description, drawing_number, quantity)
        VALUES ($1, $2, $3, $4, $5)
      `, [rfq_no, item.item_code, item.description || null, item.drawing_number || null, qty]);
    }

    await client.query('COMMIT');

    // Return updated RFQ with items
    const { rows } = await pool.query(`
      SELECT r.*,
        COALESCE(
          json_agg(json_build_object('item_code', ri.item_code, 'description', ri.description, 'drawing_number', ri.drawing_number, 'quantity', ri.quantity) ORDER BY ri.id)
          FILTER (WHERE ri.item_code IS NOT NULL), '[]'
        ) AS items
      FROM rfqs r LEFT JOIN rfq_items ri ON r.rfq_no = ri.rfq_no
      WHERE r.rfq_no = $1 GROUP BY r.rfq_no
    `, [rfq_no]);

    res.json(rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating RFQ:', error);
    res.status(500).json({ error: 'Server error updating RFQ' });
  } finally {
    client.release();
  }
});

// ============================================================================
// QUOTATIONS API ENDPOINTS
// ============================================================================

app.use('/api/quotations', authenticateToken);

// Get all quotations
app.get('/api/quotations', async (req, res) => {
  const { search } = req.query;
  try {
    let whereClause = '';
    let values = [];

    if (search) {
      whereClause = `WHERE q.quotation_no ILIKE $1 OR q.rfq_no ILIKE $1`;
      values = [`%${search}%`];
    }

    const queryText = `
      SELECT q.*,
        COALESCE(
          json_agg(
            json_build_object(
              'item_code', qi.item_code,
              'description', qi.description,
              'drawing_number', qi.drawing_number,
              'quantity', qi.quantity,
              'unit_price', qi.unit_price
            ) ORDER BY qi.id
          ) FILTER (WHERE qi.item_code IS NOT NULL),
          '[]'
        ) AS items
      FROM quotations q
      LEFT JOIN quotation_items qi ON q.quotation_no = qi.quotation_no
      ${whereClause}
      GROUP BY q.quotation_no
      ORDER BY q.created_at DESC
    `;
    const { rows } = await pool.query(queryText, values);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching quotations:', error);
    res.status(500).json({ error: 'Server error fetching quotations' });
  }
});

// Get next auto-generated quotation number
app.get('/api/quotations/next-no', async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    const prefix = `QTN-${currentYear}-`;
    
    const queryText = `
      SELECT quotation_no FROM quotations 
      WHERE quotation_no LIKE $1 
      ORDER BY quotation_no DESC 
      LIMIT 1
    `;
    const { rows } = await pool.query(queryText, [`${prefix}%`]);
    
    let nextSeq = 1;
    if (rows.length > 0) {
      const lastNo = rows[0].quotation_no;
      const parts = lastNo.split('-');
      const lastSeq = parseInt(parts[parts.length - 1]);
      if (!isNaN(lastSeq)) {
        nextSeq = lastSeq + 1;
      }
    }
    
    const nextNo = `${prefix}${String(nextSeq).padStart(4, '0')}`;
    res.json({ next_no: nextNo });
  } catch (error) {
    console.error('Error generating next quotation number:', error);
    res.status(500).json({ error: 'Server error generating next quotation number' });
  }
});

// Add new quotation
app.post('/api/quotations', async (req, res) => {
  const {
    rfq_no, quotation_date, terms_and_conditions, items = []
  } = req.body;

  if (!rfq_no || !quotation_date) {
    return res.status(400).json({ error: 'RFQ No. and Quotation Date are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const currentYear = new Date(quotation_date).getFullYear();
    const prefix = `QTN-${currentYear}-`;
    const nextNumResult = await client.query(`
      SELECT quotation_no FROM quotations 
      WHERE quotation_no LIKE $1 
      ORDER BY quotation_no DESC 
      LIMIT 1
    `, [`${prefix}%`]);

    let nextSeq = 1;
    if (nextNumResult.rows.length > 0) {
      const lastNo = nextNumResult.rows[0].quotation_no;
      const parts = lastNo.split('-');
      const lastSeq = parseInt(parts[parts.length - 1]);
      if (!isNaN(lastSeq)) {
        nextSeq = lastSeq + 1;
      }
    }
    const quotation_no = `${prefix}${String(nextSeq).padStart(4, '0')}`;

    // Insert quotation
    await client.query(`
      INSERT INTO quotations (quotation_no, rfq_no, quotation_date, terms_and_conditions)
      VALUES ($1, $2, $3, $4)
    `, [quotation_no, rfq_no, quotation_date, terms_and_conditions || null]);

    // Insert items
    for (const item of items) {
      const price = parseFloat(item.unit_price);
      if (isNaN(price) || price < 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Unit price is required and must be at least 0 for item ${item.item_code}` });
      }
      
      const qty = parseInt(item.quantity);
      if (isNaN(qty) || qty <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Quantity must be greater than 0 for item ${item.item_code}` });
      }

      await client.query(`
        INSERT INTO quotation_items (quotation_no, item_code, description, drawing_number, quantity, unit_price)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (quotation_no, item_code) DO NOTHING
      `, [quotation_no, item.item_code, item.description || null, item.drawing_number || null, qty, price]);
    }

    await client.query('COMMIT');

    const { rows } = await pool.query(`
      SELECT q.*,
        COALESCE(
          json_agg(
            json_build_object(
              'item_code', qi.item_code,
              'description', qi.description,
              'drawing_number', qi.drawing_number,
              'quantity', qi.quantity,
              'unit_price', qi.unit_price
            ) ORDER BY qi.id
          ) FILTER (WHERE qi.item_code IS NOT NULL),
          '[]'
        ) AS items
      FROM quotations q
      LEFT JOIN quotation_items qi ON q.quotation_no = qi.quotation_no
      WHERE q.quotation_no = $1
      GROUP BY q.quotation_no
    `, [quotation_no]);

    res.status(201).json(rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating quotation:', error);
    res.status(500).json({ error: 'Server error creating quotation' });
  } finally {
    client.release();
  }
});

// Update quotation
app.put('/api/quotations/:quotation_no', async (req, res) => {
  const { quotation_no } = req.params;
  const {
    quotation_date, terms_and_conditions, items = []
  } = req.body;

  if (!quotation_date) {
    return res.status(400).json({ error: 'Quotation Date is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const updateResult = await client.query(`
      UPDATE quotations 
      SET quotation_date = $1, terms_and_conditions = $2
      WHERE quotation_no = $3
      RETURNING *
    `, [quotation_date, terms_and_conditions || null, quotation_no]);

    if (updateResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Quotation not found' });
    }

    // Replace items
    await client.query('DELETE FROM quotation_items WHERE quotation_no = $1', [quotation_no]);
    for (const item of items) {
      const price = parseFloat(item.unit_price);
      if (isNaN(price) || price < 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Unit price is required and must be at least 0 for item ${item.item_code}` });
      }
      
      const qty = parseInt(item.quantity);
      if (isNaN(qty) || qty <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Quantity must be greater than 0 for item ${item.item_code}` });
      }

      await client.query(`
        INSERT INTO quotation_items (quotation_no, item_code, description, drawing_number, quantity, unit_price)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [quotation_no, item.item_code, item.description || null, item.drawing_number || null, qty, price]);
    }

    await client.query('COMMIT');

    const { rows } = await pool.query(`
      SELECT q.*,
        COALESCE(
          json_agg(
            json_build_object(
              'item_code', qi.item_code,
              'description', qi.description,
              'drawing_number', qi.drawing_number,
              'quantity', qi.quantity,
              'unit_price', qi.unit_price
            ) ORDER BY qi.id
          ) FILTER (WHERE qi.item_code IS NOT NULL),
          '[]'
        ) AS items
      FROM quotations q
      LEFT JOIN quotation_items qi ON q.quotation_no = qi.quotation_no
      WHERE q.quotation_no = $1
      GROUP BY q.quotation_no
    `, [quotation_no]);

    res.json(rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating quotation:', error);
    res.status(500).json({ error: 'Server error updating quotation' });
  } finally {
    client.release();
  }
});

app.listen(port, () => {
  console.log(`Server is successfully running on port ${port}`);
});