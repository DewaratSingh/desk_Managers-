require('dotenv').config();
const { Pool, types } = require('pg');
const crypto = require('crypto');

// Return SQL DATE fields as raw strings ('YYYY-MM-DD') instead of converting to local Date objects.
types.setTypeParser(1082, val => val);

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_DATABASE || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  port: parseInt(process.env.DB_PORT || '5432'),
});

// Automatically create tables if they do not exist
const initializeDatabase = async () => {
  const client = await pool.connect();
  try {
    console.log('Successfully connected to PostgreSQL. Initializing tables...');



    // 1. Companies Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS companies (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        owner_name VARCHAR(255),
        owner_username VARCHAR(100),
        phone VARCHAR(50),
        email VARCHAR(255),
        address TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Users Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        username VARCHAR(100) PRIMARY KEY,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'operator',
        name VARCHAR(255),
        surname VARCHAR(255),
        owner_name VARCHAR(255),
        company_name VARCHAR(255),
        phone VARCHAR(50),
        email VARCHAR(255),
        permissions JSONB DEFAULT '[]'::jsonb,
        company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Seed default company
    let defaultCompanyId = null;
    const compCheck = await client.query('SELECT id FROM companies WHERE name = $1', ['Shreeji Industries']);
    if (compCheck.rows.length === 0) {
      const res = await client.query(
        "INSERT INTO companies (name, owner_name, phone, email) VALUES ('Shreeji Industries', 'Shreeji Owner', '0000000000', 'info@shreeji.com') RETURNING id"
      );
      defaultCompanyId = res.rows[0].id;
    } else {
      defaultCompanyId = compCheck.rows[0].id;
    }

    // Seed default admin accounts
    const defaultAdminHash = crypto.createHash('sha256').update('admin').digest('hex');
    await client.query(`
      INSERT INTO users (username, password_hash, role, name, permissions, company_id)
      VALUES 
        ('admin', $1, 'admin', 'System Admin', '[]'::jsonb, $2),
        ('admin1', $1, 'admin', 'System Admin 1', '[]'::jsonb, $2),
        ('admin2', $1, 'admin', 'System Admin 2', '[]'::jsonb, $2),
        ('admin3', $1, 'admin', 'System Admin 3', '[]'::jsonb, $2)
      ON CONFLICT (username) DO NOTHING;
    `, [defaultAdminHash, defaultCompanyId]);

    // 3. Customers Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        customer_code VARCHAR(100) NOT NULL,
        name VARCHAR(255) NOT NULL,
        address TEXT NOT NULL,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (customer_code, company_id)
      );
    `);

    // 4. Buyers Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS buyers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(50) NOT NULL,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (email, company_id)
      );
    `);

    // 5. Trades Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS trades (
        id SERIAL PRIMARY KEY,
        trade_id VARCHAR(100) NOT NULL,
        documents JSONB NOT NULL DEFAULT '[]'::jsonb,
        status VARCHAR(50) DEFAULT 'rfq',
        trade_type VARCHAR(50) DEFAULT 'sell',
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (trade_id, company_id)
      );
    `);

    // 6. Items Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS items (
        id SERIAL PRIMARY KEY,
        item_code VARCHAR(100) NOT NULL,
        description VARCHAR(500) NOT NULL,
        drawing_number VARCHAR(255),
        long_description TEXT,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (item_code, company_id)
      );
    `);

    // 7. RFQs Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS rfqs (
        id SERIAL PRIMARY KEY,
        rfq_no VARCHAR(100) NOT NULL,
        rfq_date DATE NOT NULL,
        commercial_bid_due_date DATE NOT NULL,
        technical_bid_due_date DATE NOT NULL,
        buyer_id INTEGER REFERENCES buyers(id) ON DELETE SET NULL,
        customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
        trade_id INTEGER REFERENCES trades(id) ON DELETE SET NULL,
        status VARCHAR(50) DEFAULT 'quotation',
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (rfq_no, company_id)
      );
    `);

    // 8. RFQ Items Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS rfq_items (
        id SERIAL PRIMARY KEY,
        rfq_id INTEGER REFERENCES rfqs(id) ON DELETE CASCADE,
        item_id INTEGER REFERENCES items(id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
        unit VARCHAR(50) DEFAULT 'Piece',
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (rfq_id, item_id)
      );
    `);

    // 9. Quotations Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS quotations (
        id SERIAL PRIMARY KEY,
        quotation_no VARCHAR(100) NOT NULL,
        rfq_id INTEGER REFERENCES rfqs(id) ON DELETE CASCADE,
        quotation_date DATE NOT NULL,
        terms_and_conditions TEXT,
        trade_id INTEGER REFERENCES trades(id) ON DELETE SET NULL,
        status VARCHAR(50) DEFAULT 'active',
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (quotation_no, company_id)
      );
    `);

    // 10. Quotation Items Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS quotation_items (
        id SERIAL PRIMARY KEY,
        quotation_id INTEGER REFERENCES quotations(id) ON DELETE CASCADE,
        item_id INTEGER REFERENCES items(id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL CHECK (quantity > 0),
        unit_price DECIMAL(12, 2) NOT NULL CHECK (unit_price >= 0),
        unit VARCHAR(50) DEFAULT 'Piece',
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (quotation_id, item_id)
      );
    `);

    // 11. Received Quotations Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS received_quotations (
        id SERIAL PRIMARY KEY,
        received_quotation_no VARCHAR(100) NOT NULL,
        buyer_id INTEGER REFERENCES buyers(id) ON DELETE SET NULL,
        customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
        quotation_date DATE NOT NULL,
        terms_and_conditions TEXT,
        trade_id INTEGER REFERENCES trades(id) ON DELETE SET NULL,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (received_quotation_no, company_id)
      );
    `);

    // 12. Received Quotation Items Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS received_quotation_items (
        id SERIAL PRIMARY KEY,
        received_quotation_id INTEGER REFERENCES received_quotations(id) ON DELETE CASCADE,
        item_id INTEGER REFERENCES items(id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL CHECK (quantity > 0),
        unit_price DECIMAL(12, 2) NOT NULL CHECK (unit_price >= 0),
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (received_quotation_id, item_id)
      );
    `);

    // 13. Quotation - Received Quotation Join Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS quotation_received_quotations (
        quotation_id INTEGER REFERENCES quotations(id) ON DELETE CASCADE,
        received_quotation_id INTEGER REFERENCES received_quotations(id) ON DELETE CASCADE,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        PRIMARY KEY (quotation_id, received_quotation_id)
      );
    `);

    // 14. Purchase Orders Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS purchase_orders (
        id SERIAL PRIMARY KEY,
        po_no VARCHAR(100) NOT NULL,
        quotation_id INTEGER REFERENCES quotations(id) ON DELETE SET NULL,
        received_quotation_id INTEGER REFERENCES received_quotations(id) ON DELETE SET NULL,
        contract_ref VARCHAR(255),
        po_date DATE NOT NULL,
        gst DECIMAL(12, 2) DEFAULT 0.00,
        transport DECIMAL(12, 2) DEFAULT 0.00,
        other DECIMAL(12, 2) DEFAULT 0.00,
        basic_value DECIMAL(12, 2) DEFAULT 0.00,
        packing_forward DECIMAL(12, 2) DEFAULT 0.00,
        delivery_date DATE,
        trade_id INTEGER REFERENCES trades(id) ON DELETE SET NULL,
        gst_type VARCHAR(50),
        gst_rate DECIMAL(5,2) DEFAULT 0.00,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (po_no, company_id)
      );
    `);

    // Alter table to add column dynamically in case table already exists
    await client.query(`
      ALTER TABLE purchase_orders 
      ADD COLUMN IF NOT EXISTS received_quotation_id INTEGER REFERENCES received_quotations(id) ON DELETE SET NULL;
    `);

    // 15. Purchase Order Items Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS purchase_order_items (
        id SERIAL PRIMARY KEY,
        po_id INTEGER REFERENCES purchase_orders(id) ON DELETE CASCADE,
        item_id INTEGER REFERENCES items(id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL CHECK (quantity > 0),
        unit_price DECIMAL(12, 2) NOT NULL CHECK (unit_price >= 0),
        gst_type VARCHAR(50),
        gst_rate DECIMAL(5,2) DEFAULT 0.00,
        shipping_address TEXT,
        delivery_date DATE,
        status VARCHAR(50) DEFAULT 'ordered',
        vendor VARCHAR(255) DEFAULT '',
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (po_id, item_id)
      );
    `);

    // 16. Release Orders Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS release_orders (
        id SERIAL PRIMARY KEY,
        ro_no VARCHAR(100) NOT NULL,
        contract_ref VARCHAR(255),
        buyer_id INTEGER REFERENCES buyers(id) ON DELETE SET NULL,
        customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
        ro_date DATE NOT NULL,
        gst DECIMAL(12, 2) DEFAULT 0.00,
        transport DECIMAL(12, 2) DEFAULT 0.00,
        other DECIMAL(12, 2) DEFAULT 0.00,
        basic_value DECIMAL(12, 2) DEFAULT 0.00,
        packing_forward DECIMAL(12, 2) DEFAULT 0.00,
        delivery_date DATE,
        trade_id INTEGER REFERENCES trades(id) ON DELETE SET NULL,
        gst_type VARCHAR(50),
        gst_rate DECIMAL(5,2) DEFAULT 0.00,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (ro_no, company_id)
      );
    `);

    // 17. Release Order Items Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS release_order_items (
        id SERIAL PRIMARY KEY,
        ro_id INTEGER REFERENCES release_orders(id) ON DELETE CASCADE,
        item_id INTEGER REFERENCES items(id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL CHECK (quantity > 0),
        unit_price DECIMAL(12, 2) NOT NULL CHECK (unit_price >= 0),
        gst_type VARCHAR(50),
        gst_rate DECIMAL(5,2) DEFAULT 0.00,
        shipping_address TEXT,
        delivery_date DATE,
        status VARCHAR(50) DEFAULT 'ordered',
        vendor VARCHAR(255) DEFAULT '',
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (ro_id, item_id)
      );
    `);

    // 18. Delivery Notes Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS delivery_notes (
        id SERIAL PRIMARY KEY,
        delivery_note_no VARCHAR(100) NOT NULL,
        po_id INTEGER REFERENCES purchase_orders(id) ON DELETE SET NULL,
        ro_id INTEGER REFERENCES release_orders(id) ON DELETE SET NULL,
        delivery_date DATE NOT NULL,
        dispatch_doc_no VARCHAR(255),
        dispatch_through VARCHAR(255) NOT NULL,
        motor_vehicle_no VARCHAR(255) NOT NULL,
        trade_id INTEGER REFERENCES trades(id) ON DELETE SET NULL,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (delivery_note_no, company_id)
      );
    `);

    // 19. Delivery Note Items Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS delivery_note_items (
        id SERIAL PRIMARY KEY,
        delivery_note_id INTEGER REFERENCES delivery_notes(id) ON DELETE CASCADE,
        item_id INTEGER REFERENCES items(id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL CHECK (quantity >= 0),
        rate_per_piece DECIMAL(12, 2) NOT NULL CHECK (rate_per_piece >= 0),
        shipping_address TEXT,
        delivery_date DATE,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (delivery_note_id, item_id)
      );
    `);

    await client.query(`
      ALTER TABLE delivery_note_items ADD COLUMN IF NOT EXISTS next_activity JSONB;
    `);

    // Migrate CHECK constraint to allow quantity >= 0
    await client.query(`
      ALTER TABLE delivery_note_items DROP CONSTRAINT IF EXISTS delivery_note_items_quantity_check;
    `);
    await client.query(`
      ALTER TABLE delivery_note_items ADD CONSTRAINT delivery_note_items_quantity_check CHECK (quantity >= 0);
    `);

    // 20. Invoices Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id               SERIAL PRIMARY KEY,
        invoice_no       VARCHAR(100) NOT NULL,
        invoice_date     DATE NOT NULL,
        delivery_note_id INTEGER REFERENCES delivery_notes(id) ON DELETE RESTRICT,
        po_id            INTEGER REFERENCES purchase_orders(id) ON DELETE SET NULL,
        ro_id            INTEGER REFERENCES release_orders(id) ON DELETE SET NULL,
        dispatch_doc_no  VARCHAR(255),
        dispatch_through VARCHAR(255) NOT NULL,
        motor_vehicle_no VARCHAR(255) NOT NULL,
        trade_id         INTEGER REFERENCES trades(id) ON DELETE SET NULL,
        company_id       INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (invoice_no, company_id)
      );
    `);

    // 21. Invoice Items Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS invoice_items (
        id             SERIAL PRIMARY KEY,
        invoice_id     INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
        item_id        INTEGER REFERENCES items(id) ON DELETE CASCADE,
        quantity       INTEGER NOT NULL CHECK (quantity > 0),
        rate_per_piece DECIMAL(12, 2) NOT NULL CHECK (rate_per_piece >= 0),
        shipping_address TEXT,
        delivery_date  DATE,
        company_id     INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (invoice_id, item_id)
      );
    `);

    // 22. ARC Items Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS arc_items (
        id SERIAL PRIMARY KEY,
        item_id INTEGER REFERENCES items(id) ON DELETE CASCADE,
        price DECIMAL(12, 2) NOT NULL CHECK (price >= 0),
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (item_id, company_id)
      );
    `);

    // 23. GRNs Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS grns (
        id SERIAL PRIMARY KEY,
        grn_no VARCHAR(100) NOT NULL,
        delivery_note_id INTEGER REFERENCES delivery_notes(id) ON DELETE RESTRICT,
        trade_id INTEGER REFERENCES trades(id) ON DELETE SET NULL,
        grn_date DATE NOT NULL,
        has_rejection BOOLEAN DEFAULT FALSE,
        rejection_items JSONB NOT NULL DEFAULT '[]'::jsonb,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (grn_no, company_id)
      );
    `);

    // 24. Payments Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        payment_no VARCHAR(100) NOT NULL,
        delivery_note_id INTEGER REFERENCES delivery_notes(id) ON DELETE SET NULL,
        trade_id INTEGER REFERENCES trades(id) ON DELETE SET NULL,
        payment_date DATE NOT NULL,
        total_amount DECIMAL(12, 2) NOT NULL CHECK (total_amount >= 0),
        po_id INTEGER REFERENCES purchase_orders(id) ON DELETE SET NULL,
        ro_id INTEGER REFERENCES release_orders(id) ON DELETE SET NULL,
        note TEXT,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (payment_no, company_id)
      );
    `);

    // 25. Status Lookup Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS status (
        name VARCHAR(100),
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        PRIMARY KEY (name, company_id)
      );
    `);

    // 26. Units Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS units (
        name VARCHAR(50),
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        PRIMARY KEY (name, company_id)
      );
    `);

    // 27. GST Rates Configuration Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS gst_rates (
        id SERIAL PRIMARY KEY,
        type VARCHAR(50) NOT NULL,
        rate DECIMAL(5,2) NOT NULL CHECK (rate >= 0.0),
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (type, company_id)
      );
    `);

    // 27. Trace_item Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS trace_item (
        id SERIAL PRIMARY KEY,
        item_code INTEGER REFERENCES items(id) ON DELETE CASCADE,
        process JSONB DEFAULT '[]'::jsonb,
        message TEXT,
        quantity INTEGER DEFAULT 0,
        price DECIMAL(12, 2) DEFAULT 0.00,
        status VARCHAR(50) DEFAULT 'active',
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      ALTER TABLE trace_item 
      ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';
    `);

    // 28. Inventory Table (Updated to match trace-item style + position columns + trade_id)
    await client.query(`
      CREATE TABLE IF NOT EXISTS inventory (
        id SERIAL PRIMARY KEY,
        item_code INTEGER REFERENCES items(id) ON DELETE CASCADE,
        message TEXT,
        rack VARCHAR(255),
        shelf_number VARCHAR(255),
        location VARCHAR(255),
        trade_id INTEGER REFERENCES trades(id) ON DELETE SET NULL,
        quantity INTEGER DEFAULT 0,
        price DECIMAL(12, 2) DEFAULT 0.00,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        trace_item_id INTEGER REFERENCES trace_item(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Dynamic column addition to inventory table
    await client.query(`
      ALTER TABLE inventory 
      ADD COLUMN IF NOT EXISTS trace_item_id INTEGER REFERENCES trace_item(id) ON DELETE SET NULL;
    `);

    // 29. Manufacture Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS manufacture (
        id SERIAL PRIMARY KEY,
        trace_item_id INTEGER REFERENCES trace_item(id) ON DELETE SET NULL,
        target_trace_item_id INTEGER REFERENCES trace_item(id) ON DELETE SET NULL,
        source_item_id INTEGER REFERENCES items(id) ON DELETE CASCADE,
        target_item_id INTEGER REFERENCES items(id) ON DELETE CASCADE,
        quantity_used INTEGER NOT NULL CHECK (quantity_used > 0),
        expected_quantity INTEGER NOT NULL CHECK (expected_quantity > 0),
        completed_quantity INTEGER NOT NULL DEFAULT 0,
        completed BOOLEAN DEFAULT false,
        date_of_starting DATE NOT NULL,
        date_of_ending DATE,
        message TEXT,
        status VARCHAR(50) DEFAULT 'manufacturing',
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      ALTER TABLE manufacture 
      ADD COLUMN IF NOT EXISTS completed_quantity INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS completed BOOLEAN DEFAULT false;
    `);

    // Seed default units
    const defaultUnits = ['Piece', 'Set', 'Kg', 'Meter', 'Box', 'Litre'];
    for (const unit of defaultUnits) {
      await client.query(`
        INSERT INTO units (name, company_id) VALUES ($1, $2) ON CONFLICT (name, company_id) DO NOTHING;
      `, [unit, defaultCompanyId]);
    }

    console.log('Database initialized successfully.');
  } catch (error) {
    console.error('Error during PostgreSQL database initialization:', error.message);
  } finally {
    client.release();
  }
};

const calculateTradeStatus = (documents = []) => {
  let status = 'rfq';
  const docTypes = (documents || []).map(d => d.type.toUpperCase());
  if (docTypes.includes('PAYMENT')) status = 'payment';
  else if (docTypes.includes('GRN')) status = 'grn';
  else if (docTypes.includes('INVOICE')) status = 'invoice';
  else if (docTypes.includes('DN')) status = 'dn';
  else if (docTypes.includes('RO')) status = 'ro';
  else if (docTypes.includes('PURCHASE_ORDER')) status = 'ordered';
  else if (docTypes.includes('PO')) status = 'ordered';
  else if (docTypes.includes('QUOTATION') || docTypes.includes('RECEIVED_QUOTATION')) status = 'quotation';
  return status;
};

const appendDocToTrade = async (client, tradeId, docType, docId, companyId) => {
  if (!tradeId || !companyId) return;
  try {
    const res = await client.query('SELECT documents FROM trades WHERE trade_id = $1 AND company_id = $2', [tradeId, companyId]);
    if (res.rows.length > 0) {
      const documents = res.rows[0].documents || [];

      // Only append the new doc if not already present
      if (!documents.some(d => d.type === docType && d.id === docId)) {
        const updatedDocs = [...documents, { type: docType, id: docId }];
        await client.query(
          'UPDATE trades SET documents = $1 WHERE trade_id = $2 AND company_id = $3',
          [JSON.stringify(updatedDocs), tradeId, companyId]
        );
      }
    }
  } catch (err) {
    console.error('Error in appendDocToTrade:', err.message);
  }
};

module.exports = {
  pool,
  initializeDatabase,
  appendDocToTrade,
  calculateTradeStatus
};
