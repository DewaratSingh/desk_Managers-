require('dotenv').config();
const { Pool, types } = require('pg');
const crypto = require('crypto');

// Return SQL DATE fields as raw strings ('YYYY-MM-DD') instead of converting to local Date objects.
// This prevents timezone shift discrepancies when serializing to JSON.
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

    // Users Table (Authentication)
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        username VARCHAR(100) PRIMARY KEY,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'operator',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Seed default admin account if empty
    const defaultAdminHash = crypto.createHash('sha256').update('admin').digest('hex');
    await client.query(`
      INSERT INTO users (username, password_hash, role)
      VALUES 
        ('admin', $1, 'admin'),
        ('admin1', $1, 'admin'),
        ('admin2', $1, 'admin'),
        ('admin3', $1, 'admin')
      ON CONFLICT (username) DO NOTHING;
    `, [defaultAdminHash]);

    // Customers Table: User-written Customer ID, Name, and Address
    await client.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        address TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Buyers Table (Name, Email, Phone Number)
    await client.query(`
      CREATE TABLE IF NOT EXISTS buyers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Trades Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS trades (
        trade_id VARCHAR(100) PRIMARY KEY,
        documents JSONB NOT NULL DEFAULT '[]'::jsonb,
        status VARCHAR(50) DEFAULT 'rfq',
        trade_type VARCHAR(50) DEFAULT 'sell',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Items Table — auto-migrate if old schema (id/name/sku) is detected
    const oldSchemaCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'items' AND column_name = 'name'
    `);

    if (oldSchemaCheck.rows.length > 0) {
      console.log('Old items schema detected. Migrating to new schema (item_code, description, drawing_number, long_description)...');
      await client.query('DROP TABLE IF EXISTS items;');
      console.log('Old items table dropped.');
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS items (
        item_code VARCHAR(100) PRIMARY KEY,
        description VARCHAR(500) NOT NULL,
        drawing_number VARCHAR(255),
        long_description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // RFQs Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS rfqs (
        rfq_no VARCHAR(100) PRIMARY KEY,
        rfq_date DATE NOT NULL,
        commercial_bid_due_date DATE NOT NULL,
        technical_bid_due_date DATE NOT NULL,
        buyer_id INTEGER,
        customer_id VARCHAR(100),
        trade_id VARCHAR(100) REFERENCES trades(trade_id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // RFQ Items Table — stores items linked to each RFQ
    await client.query(`
      CREATE TABLE IF NOT EXISTS rfq_items (
        id SERIAL PRIMARY KEY,
        rfq_no VARCHAR(100) NOT NULL REFERENCES rfqs(rfq_no) ON DELETE CASCADE,
        item_code VARCHAR(100) NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(rfq_no, item_code)
      );
    `);

    // Check if quantity column exists in rfq_items, if not, add it
    const quantityCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'rfq_items' AND column_name = 'quantity'
    `);
    if (quantityCheck.rows.length === 0) {
      console.log('Adding quantity column to rfq_items table...');
      await client.query(`
        ALTER TABLE rfq_items 
        ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0);
      `);
      console.log('quantity column added successfully.');
    }

    // Quotations Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS quotations (
        quotation_no VARCHAR(100) PRIMARY KEY,
        rfq_no VARCHAR(100) NOT NULL REFERENCES rfqs(rfq_no) ON DELETE CASCADE,
        quotation_date DATE NOT NULL,
        terms_and_conditions TEXT,
        trade_id VARCHAR(100) REFERENCES trades(trade_id) ON DELETE SET NULL,
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Quotation Items Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS quotation_items (
        id SERIAL PRIMARY KEY,
        quotation_no VARCHAR(100) NOT NULL REFERENCES quotations(quotation_no) ON DELETE CASCADE,
        item_code VARCHAR(100) NOT NULL,
        quantity INTEGER NOT NULL CHECK (quantity > 0),
        unit_price DECIMAL(12, 2) NOT NULL CHECK (unit_price >= 0),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(quotation_no, item_code)
      );
    `);

    // Received Quotations Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS received_quotations (
        received_quotation_no VARCHAR(100) PRIMARY KEY,
        buyer_id INTEGER REFERENCES buyers(id) ON DELETE SET NULL,
        customer_id VARCHAR(100) REFERENCES customers(id) ON DELETE SET NULL,
        quotation_date DATE NOT NULL,
        terms_and_conditions TEXT,
        trade_id VARCHAR(100) REFERENCES trades(trade_id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Received Quotation Items Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS received_quotation_items (
        id SERIAL PRIMARY KEY,
        received_quotation_no VARCHAR(100) NOT NULL REFERENCES received_quotations(received_quotation_no) ON DELETE CASCADE,
        item_code VARCHAR(100) NOT NULL REFERENCES items(item_code) ON DELETE CASCADE,
        quantity INTEGER NOT NULL CHECK (quantity > 0),
        unit_price DECIMAL(12, 2) NOT NULL CHECK (unit_price >= 0),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(received_quotation_no, item_code)
      );
    `);

    // Quotation - Received Quotation Join Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS quotation_received_quotations (
        quotation_no VARCHAR(100) NOT NULL REFERENCES quotations(quotation_no) ON DELETE CASCADE,
        received_quotation_no VARCHAR(100) NOT NULL REFERENCES received_quotations(received_quotation_no) ON DELETE CASCADE,
        PRIMARY KEY (quotation_no, received_quotation_no)
      );
    `);

    // Purchase Orders Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS purchase_orders (
        po_no VARCHAR(100) PRIMARY KEY,
        quotation_no VARCHAR(100),
        contract_ref VARCHAR(255),
        po_date DATE NOT NULL,
        gst DECIMAL(12, 2) DEFAULT 0.00,
        transport DECIMAL(12, 2) DEFAULT 0.00,
        other DECIMAL(12, 2) DEFAULT 0.00,
        basic_value DECIMAL(12, 2) DEFAULT 0.00,
        packing_forward DECIMAL(12, 2) DEFAULT 0.00,
        trade_id VARCHAR(100) REFERENCES trades(trade_id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Purchase Order Items Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS purchase_order_items (
        id SERIAL PRIMARY KEY,
        po_no VARCHAR(100) NOT NULL REFERENCES purchase_orders(po_no) ON DELETE CASCADE,
        item_code VARCHAR(100) NOT NULL REFERENCES items(item_code) ON DELETE CASCADE,
        quantity INTEGER NOT NULL CHECK (quantity > 0),
        unit_price DECIMAL(12, 2) NOT NULL CHECK (unit_price >= 0),
        shipping_address TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        vendor VARCHAR(255) DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(po_no, item_code)
      );
    `);

    // Release Orders Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS release_orders (
        ro_no VARCHAR(100) PRIMARY KEY,
        contract_ref VARCHAR(255),
        buyer_id INTEGER REFERENCES buyers(id) ON DELETE SET NULL,
        customer_id VARCHAR(100) REFERENCES customers(id) ON DELETE SET NULL,
        ro_date DATE NOT NULL,
        gst DECIMAL(12, 2) DEFAULT 0.00,
        transport DECIMAL(12, 2) DEFAULT 0.00,
        other DECIMAL(12, 2) DEFAULT 0.00,
        basic_value DECIMAL(12, 2) DEFAULT 0.00,
        packing_forward DECIMAL(12, 2) DEFAULT 0.00,
        trade_id VARCHAR(100) REFERENCES trades(trade_id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Release Order Items Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS release_order_items (
        id SERIAL PRIMARY KEY,
        ro_no VARCHAR(100) NOT NULL REFERENCES release_orders(ro_no) ON DELETE CASCADE,
        item_code VARCHAR(100) NOT NULL REFERENCES items(item_code) ON DELETE CASCADE,
        quantity INTEGER NOT NULL CHECK (quantity > 0),
        unit_price DECIMAL(12, 2) NOT NULL CHECK (unit_price >= 0),
        shipping_address TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(ro_no, item_code)
      );
    `);

    // Delivery Notes Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS delivery_notes (
        delivery_note_no VARCHAR(100) PRIMARY KEY,
        po_no VARCHAR(100) REFERENCES purchase_orders(po_no) ON DELETE SET NULL,
        ro_no VARCHAR(100) REFERENCES release_orders(ro_no) ON DELETE SET NULL,
        delivery_date DATE NOT NULL,
        dispatch_doc_no VARCHAR(100),
        dispatch_through VARCHAR(255),
        motor_vehicle_no VARCHAR(100),
        trade_id VARCHAR(100) REFERENCES trades(trade_id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Delivery Note Items Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS delivery_note_items (
        id SERIAL PRIMARY KEY,
        delivery_note_no VARCHAR(100) NOT NULL REFERENCES delivery_notes(delivery_note_no) ON DELETE CASCADE,
        item_code VARCHAR(100) NOT NULL REFERENCES items(item_code) ON DELETE CASCADE,
        quantity INTEGER NOT NULL CHECK (quantity > 0),
        rate_per_piece DECIMAL(12, 2) NOT NULL CHECK (rate_per_piece >= 0),
        shipping_address TEXT,
        delivery_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(delivery_note_no, item_code)
      );
    `);

    // Invoices Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        invoice_no       VARCHAR(100) PRIMARY KEY,
        invoice_date     DATE NOT NULL,
        delivery_note_no VARCHAR(100) REFERENCES delivery_notes(delivery_note_no) ON DELETE SET NULL,
        po_no            VARCHAR(100) REFERENCES purchase_orders(po_no) ON DELETE SET NULL,
        ro_no            VARCHAR(100) REFERENCES release_orders(ro_no) ON DELETE SET NULL,
        dispatch_doc_no  VARCHAR(100),
        dispatch_through VARCHAR(255),
        motor_vehicle_no VARCHAR(100),
        trade_id         VARCHAR(100) REFERENCES trades(trade_id) ON DELETE SET NULL,
        created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Invoice Items Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS invoice_items (
        id             SERIAL PRIMARY KEY,
        invoice_no     VARCHAR(100) NOT NULL REFERENCES invoices(invoice_no) ON DELETE CASCADE,
        item_code      VARCHAR(100) NOT NULL REFERENCES items(item_code) ON DELETE CASCADE,
        quantity       INTEGER NOT NULL CHECK (quantity > 0),
        rate_per_piece DECIMAL(12, 2) NOT NULL CHECK (rate_per_piece >= 0),
        shipping_address TEXT,
        delivery_date DATE,
        created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(invoice_no, item_code)
      );
    `);

    // ARC Items Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS arc_items (
        id SERIAL PRIMARY KEY,
        item_code VARCHAR(100) NOT NULL REFERENCES items(item_code) ON DELETE CASCADE,
        price DECIMAL(12, 2) NOT NULL CHECK (price >= 0),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(item_code)
      );
    `);

    // Drop legacy/mismatched GRNs and Payments tables if they exist with old schemas
    const oldGrnsCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'grns' AND column_name = 'invoice_no'
    `);
    if (oldGrnsCheck.rows.length > 0) {
      console.log('Old grns schema detected. Migrating to new schema...');
      await client.query('DROP TABLE IF EXISTS grns CASCADE;');
    }

    // Also drop old minimal GRN schema (only grn_no, trade_id, created_at) and recreate full schema
    const minimalGrnsCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'grns' AND column_name = 'delivery_note_no'
    `);
    if (minimalGrnsCheck.rows.length === 0) {
      // delivery_note_no column missing — drop and recreate with full schema
      const grnsExists = await client.query(`SELECT to_regclass('public.grns')`);
      if (grnsExists.rows[0].to_regclass) {
        console.log('GRNs table missing delivery_note_no column. Recreating...');
        await client.query('DROP TABLE IF EXISTS grns CASCADE;');
      }
    }

    const oldPaymentsCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'payments' AND column_name = 'payment_mode'
    `);
    if (oldPaymentsCheck.rows.length > 0) {
      console.log('Old payments schema detected. Migrating to new schema...');
      await client.query('DROP TABLE IF EXISTS payments CASCADE;');
    }

    // GRNs Table (full schema)
    await client.query(`
      CREATE TABLE IF NOT EXISTS grns (
        grn_no VARCHAR(100) PRIMARY KEY,
        delivery_note_no VARCHAR(100) REFERENCES delivery_notes(delivery_note_no) ON DELETE SET NULL,
        trade_id VARCHAR(100) REFERENCES trades(trade_id) ON DELETE SET NULL,
        grn_date DATE,
        has_rejection BOOLEAN DEFAULT FALSE,
        rejection_items JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Payments Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS payments (
        payment_no VARCHAR(100) PRIMARY KEY,
        po_no VARCHAR(100) REFERENCES purchase_orders(po_no) ON DELETE SET NULL,
        ro_no VARCHAR(100) REFERENCES release_orders(ro_no) ON DELETE SET NULL,
        total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        trade_id VARCHAR(100) REFERENCES trades(trade_id) ON DELETE SET NULL,
        note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);


    // --- Schema Normalization Migrations ---
    console.log('Running schema normalization migrations...');
    
    // Drop purchase_orders_quotation_no_fkey constraint to support received quotations polymorphic lookup
    console.log('Checking purchase_orders_quotation_no_fkey constraint...');
    await client.query(`
      ALTER TABLE purchase_orders 
      DROP CONSTRAINT IF EXISTS purchase_orders_quotation_no_fkey;
    `);

    await client.query(`
      ALTER TABLE rfqs
        DROP COLUMN IF EXISTS buyer_name,
        DROP COLUMN IF EXISTS buyer_email,
        DROP COLUMN IF EXISTS buyer_phone;

      ALTER TABLE rfq_items
        DROP COLUMN IF EXISTS description,
        DROP COLUMN IF EXISTS drawing_number;

      ALTER TABLE quotation_items
        DROP COLUMN IF EXISTS description,
        DROP COLUMN IF EXISTS drawing_number;
    `);
    
    // Add contract_ref column to purchase_orders if it doesn't exist
    const contractRefCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'purchase_orders' AND column_name = 'contract_ref'
    `);
    if (contractRefCheck.rows.length === 0) {
      console.log('Adding contract_ref column to purchase_orders table...');
      await client.query(`
        ALTER TABLE purchase_orders 
        ADD COLUMN contract_ref VARCHAR(255);
      `);
      console.log('contract_ref column added successfully.');
    }
    
    // Add ro_no column to payments if it doesn't exist
    const paymentsRoNoCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'payments' AND column_name = 'ro_no'
    `);
    if (paymentsRoNoCheck.rows.length === 0) {
      console.log('Adding ro_no column to payments table...');
      await client.query(`
        ALTER TABLE payments 
        ADD COLUMN ro_no VARCHAR(100) REFERENCES release_orders(ro_no) ON DELETE SET NULL;
      `);
      console.log('ro_no column added to payments successfully.');
    }

    // Add payment_date column to payments if it doesn't exist
    const paymentsDateCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'payments' AND column_name = 'payment_date'
    `);
    if (paymentsDateCheck.rows.length === 0) {
      console.log('Adding payment_date column to payments table...');
      await client.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_date DATE;`);
      console.log('payment_date column added to payments successfully.');
    }

    // Add delivery_note_no column to payments if it doesn't exist
    const paymentsDnCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'payments' AND column_name = 'delivery_note_no'
    `);
    if (paymentsDnCheck.rows.length === 0) {
      console.log('Adding delivery_note_no column to payments table...');
      await client.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS delivery_note_no VARCHAR(100) REFERENCES delivery_notes(delivery_note_no) ON DELETE SET NULL;`);
      console.log('delivery_note_no column added to payments successfully.');
    }

    // Add note column to payments if it doesn't exist
    const paymentsNoteCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'payments' AND column_name = 'note'
    `);
    if (paymentsNoteCheck.rows.length === 0) {
      console.log('Adding note column to payments table...');
      await client.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS note TEXT;`);
      console.log('note column added to payments successfully.');
    }
    
    // Add shipping_address column to purchase_order_items if it doesn't exist
    const shippingAddressCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'purchase_order_items' AND column_name = 'shipping_address'
    `);
    if (shippingAddressCheck.rows.length === 0) {
      console.log('Adding shipping_address column to purchase_order_items table...');
      await client.query(`
        ALTER TABLE purchase_order_items 
        ADD COLUMN shipping_address TEXT;
      `);
      console.log('shipping_address column added successfully.');
    }

    // Add delivery_date, gst_type, and gst_rate columns to release_order_items if they don't exist
    const roItemsCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'release_order_items' AND column_name IN ('delivery_date', 'gst_type', 'gst_rate')
    `);
    const existingRoColumns = roItemsCheck.rows.map(r => r.column_name);
    if (!existingRoColumns.includes('delivery_date')) {
      console.log('Adding delivery_date column to release_order_items table...');
      await client.query(`
        ALTER TABLE release_order_items 
        ADD COLUMN delivery_date DATE;
      `);
      console.log('delivery_date column added successfully.');
    }
    if (!existingRoColumns.includes('gst_type')) {
      console.log('Adding gst_type column to release_order_items table...');
      await client.query(`
        ALTER TABLE release_order_items 
        ADD COLUMN gst_type VARCHAR(20) DEFAULT 'CGST/SGST';
      `);
      console.log('gst_type column added successfully.');
    }
    if (!existingRoColumns.includes('gst_rate')) {
      console.log('Adding gst_rate column to release_order_items table...');
      await client.query(`
        ALTER TABLE release_order_items 
        ADD COLUMN gst_rate DECIMAL(5, 2) DEFAULT 0.00;
      `);
      console.log('gst_rate column added successfully.');
    }

    // Add status and vendor columns to release_order_items if they don't exist
    const roItemsStatusCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'release_order_items' AND column_name IN ('status', 'vendor')
    `);
    const existingRoStatusColumns = roItemsStatusCheck.rows.map(r => r.column_name);
    if (!existingRoStatusColumns.includes('status')) {
      console.log('Adding status column to release_order_items table...');
      await client.query(`
        ALTER TABLE release_order_items 
        ADD COLUMN status VARCHAR(50) DEFAULT 'pending';
      `);
      console.log('status column added successfully.');
    }
    if (!existingRoStatusColumns.includes('vendor')) {
      console.log('Adding vendor column to release_order_items table...');
      await client.query(`
        ALTER TABLE release_order_items 
        ADD COLUMN vendor VARCHAR(255) DEFAULT '';
      `);
      console.log('vendor column added successfully.');
    }

    // Add delivery_date column to release_orders if it doesn't exist
    const roDeliveryDateCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'release_orders' AND column_name = 'delivery_date'
    `);
    if (roDeliveryDateCheck.rows.length === 0) {
      console.log('Adding delivery_date column to release_orders table...');
      await client.query(`
        ALTER TABLE release_orders 
        ADD COLUMN delivery_date DATE;
      `);
      console.log('delivery_date column added to release_orders successfully.');
    }

    // Add delivery_date column to purchase_orders if it doesn't exist
    const poDeliveryDateCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'purchase_orders' AND column_name = 'delivery_date'
    `);
    if (poDeliveryDateCheck.rows.length === 0) {
      console.log('Adding delivery_date column to purchase_orders table...');
      await client.query(`
        ALTER TABLE purchase_orders 
        ADD COLUMN delivery_date DATE;
      `);
      console.log('delivery_date column added to purchase_orders successfully.');
    }

    // Add delivery_date, gst_type, and gst_rate columns to purchase_order_items if they don't exist
    const poItemsCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'purchase_order_items' AND column_name IN ('delivery_date', 'gst_type', 'gst_rate')
    `);
    const existingPoColumns = poItemsCheck.rows.map(r => r.column_name);
    if (!existingPoColumns.includes('delivery_date')) {
      console.log('Adding delivery_date column to purchase_order_items table...');
      await client.query(`
        ALTER TABLE purchase_order_items 
        ADD COLUMN delivery_date DATE;
      `);
      console.log('delivery_date column added to purchase_order_items successfully.');
    }
    if (!existingPoColumns.includes('gst_type')) {
      console.log('Adding gst_type column to purchase_order_items table...');
      await client.query(`
        ALTER TABLE purchase_order_items 
        ADD COLUMN gst_type VARCHAR(20) DEFAULT 'CGST/SGST';
      `);
      console.log('gst_type column added to purchase_order_items successfully.');
    }
    if (!existingPoColumns.includes('gst_rate')) {
      console.log('Adding gst_rate column to purchase_order_items table...');
      await client.query(`
        ALTER TABLE purchase_order_items 
        ADD COLUMN gst_rate DECIMAL(5, 2) DEFAULT 0.00;
      `);
      console.log('gst_rate column added to purchase_order_items successfully.');
    }

    // Drop gst_type and gst_rate from received_quotation_items since they are no longer used
    console.log('Dropping gst_type and gst_rate columns from received_quotation_items table if they exist...');
    await client.query(`
      ALTER TABLE received_quotation_items 
      DROP COLUMN IF EXISTS gst_type,
      DROP COLUMN IF EXISTS gst_rate;
    `);
    console.log('gst_type and gst_rate columns dropped successfully from received_quotation_items.');

    // Add customer_id column to received_quotations if it doesn't exist
    const rqCustomerCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'received_quotations' AND column_name = 'customer_id'
    `);
    if (rqCustomerCheck.rows.length === 0) {
      console.log('Adding customer_id column to received_quotations table...');
      await client.query(`
        ALTER TABLE received_quotations 
        ADD COLUMN customer_id VARCHAR(100) REFERENCES customers(id) ON DELETE SET NULL;
      `);
      console.log('customer_id column added to received_quotations successfully.');
    }

    // Add trade_id column to received_quotations if it doesn't exist
    const rqTradeIdCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'received_quotations' AND column_name = 'trade_id'
    `);
    if (rqTradeIdCheck.rows.length === 0) {
      console.log('Adding trade_id column to received_quotations table...');
      await client.query(`
        ALTER TABLE received_quotations 
        ADD COLUMN trade_id VARCHAR(100) REFERENCES trades(trade_id) ON DELETE SET NULL;
      `);
      console.log('trade_id column added to received_quotations successfully.');
    }

    // Add status table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS status (
        name VARCHAR(100) PRIMARY KEY
      );
    `);

    // Seed default values in status table
    await client.query(`
      INSERT INTO status (name) VALUES 
      ('pending'), ('ordered'), ('shipped'), ('delivered'), ('received'), ('completed'), ('cancelled')
      ON CONFLICT (name) DO NOTHING;
    `);

    // Add status and vendor columns to purchase_order_items if they don't exist
    const poItemsStatusVendorCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'purchase_order_items' AND column_name IN ('status', 'vendor')
    `);
    const existingPoStatusVendorColumns = poItemsStatusVendorCheck.rows.map(r => r.column_name);
    if (!existingPoStatusVendorColumns.includes('status')) {
      console.log('Adding status column to purchase_order_items table...');
      await client.query(`
        ALTER TABLE purchase_order_items 
        ADD COLUMN status VARCHAR(50) DEFAULT 'pending';
      `);
      console.log('status column added to purchase_order_items successfully.');
    }
    if (!existingPoStatusVendorColumns.includes('vendor')) {
      console.log('Adding vendor column to purchase_order_items table...');
      await client.query(`
        ALTER TABLE purchase_order_items 
        ADD COLUMN vendor VARCHAR(255) DEFAULT '';
      `);
      console.log('vendor column added to purchase_order_items successfully.');
    }
    
    // Add status column to rfqs if it doesn't exist
    // Add shipping_address and delivery_date columns to delivery_note_items if they don't exist
    const dnItemsColCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'delivery_note_items' AND column_name IN ('shipping_address', 'delivery_date')
    `);
    const existingDnItemsCols = dnItemsColCheck.rows.map(r => r.column_name);
    if (!existingDnItemsCols.includes('shipping_address')) {
      console.log('Adding shipping_address column to delivery_note_items table...');
      await client.query(`ALTER TABLE delivery_note_items ADD COLUMN shipping_address TEXT;`);
    }
    if (!existingDnItemsCols.includes('delivery_date')) {
      console.log('Adding delivery_date column to delivery_note_items table...');
      await client.query(`ALTER TABLE delivery_note_items ADD COLUMN delivery_date DATE;`);
    }

    // Add shipping_address and delivery_date columns to invoice_items if they don't exist
    const invItemsColCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'invoice_items' AND column_name IN ('shipping_address', 'delivery_date')
    `);
    const existingInvItemsCols = invItemsColCheck.rows.map(r => r.column_name);
    if (!existingInvItemsCols.includes('shipping_address')) {
      console.log('Adding shipping_address column to invoice_items table...');
      await client.query(`ALTER TABLE invoice_items ADD COLUMN shipping_address TEXT;`);
    }
    if (!existingInvItemsCols.includes('delivery_date')) {
      console.log('Adding delivery_date column to invoice_items table...');
      await client.query(`ALTER TABLE invoice_items ADD COLUMN delivery_date DATE;`);
    }

    // Add po_no and ro_no columns to invoices if they don't exist
    const invOrderCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'invoices' AND column_name IN ('po_no', 'ro_no')
    `);
    const existingInvOrderCols = invOrderCheck.rows.map(r => r.column_name);
    if (!existingInvOrderCols.includes('po_no')) {
      console.log('Adding po_no column to invoices table...');
      await client.query(`ALTER TABLE invoices ADD COLUMN po_no VARCHAR(100) REFERENCES purchase_orders(po_no) ON DELETE SET NULL;`);
    }
    if (!existingInvOrderCols.includes('ro_no')) {
      console.log('Adding ro_no column to invoices table...');
      await client.query(`ALTER TABLE invoices ADD COLUMN ro_no VARCHAR(100) REFERENCES release_orders(ro_no) ON DELETE SET NULL;`);
    }

    // Add status column to rfqs if it doesn't exist
    const rfqStatusCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'rfqs' AND column_name = 'status'
    `);
    if (rfqStatusCheck.rows.length === 0) {
      console.log('Adding status column to rfqs table...');
      await client.query(`
        ALTER TABLE rfqs 
        ADD COLUMN status VARCHAR(50) DEFAULT 'rfq';
      `);
      console.log('status column added to rfqs successfully.');
      
      // Update existing records
      console.log('Backfilling status values for existing RFQs...');
      await client.query(`
        UPDATE rfqs 
        SET status = 'quotated' 
        WHERE rfq_no IN (SELECT rfq_no FROM quotations);
      `);
      await client.query(`
        UPDATE rfqs 
        SET status = 'ordered' 
        WHERE rfq_no IN (
          SELECT q.rfq_no FROM quotations q 
          JOIN purchase_orders po ON q.quotation_no = po.quotation_no
        );
      `);
      console.log('RFQ status backfilling completed.');
    }
    
    // Units of Measurement Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS units (
        name VARCHAR(50) PRIMARY KEY,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Seed default units if empty
    const unitsCountResult = await client.query('SELECT COUNT(*) FROM units');
    if (parseInt(unitsCountResult.rows[0].count) === 0) {
      console.log('Seeding default units of measurement...');
      const defaultUnits = ['Piece', 'Kg', 'Meter', 'Box', 'Set', 'Liter', 'Ton', 'Nos'];
      for (const unit of defaultUnits) {
        await client.query('INSERT INTO units (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [unit]);
      }
      console.log('Default units seeded.');
    }

    // Add unit column to rfq_items
    const rfqItemsUnitCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'rfq_items' AND column_name = 'unit'
    `);
    if (rfqItemsUnitCheck.rows.length === 0) {
      console.log('Adding unit column to rfq_items table...');
      await client.query(`
        ALTER TABLE rfq_items 
        ADD COLUMN unit VARCHAR(50) DEFAULT 'Piece';
      `);
      console.log('unit column added to rfq_items.');
    }

    // Add unit column to quotation_items
    const qtnItemsUnitCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'quotation_items' AND column_name = 'unit'
    `);
    if (qtnItemsUnitCheck.rows.length === 0) {
      console.log('Adding unit column to quotation_items table...');
      await client.query(`
        ALTER TABLE quotation_items 
        ADD COLUMN unit VARCHAR(50) DEFAULT 'Piece';
      `);
      console.log('unit column added to quotation_items.');
    }

    // GST Rates Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS gst_rates (
        id SERIAL PRIMARY KEY,
        type VARCHAR(100) NOT NULL UNIQUE,
        rate DECIMAL(5, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Seed default GST rates (Indian Manufacturing Rates)
    const gstCountResult = await client.query('SELECT COUNT(*) FROM gst_rates');
    if (parseInt(gstCountResult.rows[0].count) === 0) {
      console.log('Seeding Indian manufacturing GST rates...');
      const defaultGstRates = [
        { type: 'CGST + SGST 18%', rate: 18.00 },
        { type: 'IGST 18%', rate: 18.00 },
        { type: 'CGST + SGST 28%', rate: 28.00 },
        { type: 'IGST 28%', rate: 28.00 },
        { type: 'CGST + SGST 12%', rate: 12.00 },
        { type: 'IGST 12%', rate: 12.00 },
        { type: 'CGST + SGST 5%', rate: 5.00 },
        { type: 'IGST 5%', rate: 5.00 },
        { type: 'Exempted 0%', rate: 0.00 }
      ];
      for (const item of defaultGstRates) {
        await client.query('INSERT INTO gst_rates (type, rate) VALUES ($1, $2) ON CONFLICT (type) DO NOTHING', [item.type, item.rate]);
      }
      console.log('Indian manufacturing GST rates seeded.');
    }

    // Add gst_type and gst_rate columns to quotations
    const qtnGstTypeCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'quotations' AND column_name = 'gst_type'
    `);
    if (qtnGstTypeCheck.rows.length === 0) {
      console.log('Adding gst_type column to quotations table...');
      await client.query(`
        ALTER TABLE quotations 
        ADD COLUMN gst_type VARCHAR(100);
      `);
      console.log('gst_type column added to quotations.');
    }

    const qtnGstRateCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'quotations' AND column_name = 'gst_rate'
    `);
    if (qtnGstRateCheck.rows.length === 0) {
      console.log('Adding gst_rate column to quotations table...');
      await client.query(`
        ALTER TABLE quotations 
        ADD COLUMN gst_rate DECIMAL(5, 2) DEFAULT 0.00;
      `);
      console.log('gst_rate column added to quotations.');
    }

    // Add status column to quotations if it doesn't exist
    const qtnStatusCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'quotations' AND column_name = 'status'
    `);
    if (qtnStatusCheck.rows.length === 0) {
      console.log('Adding status column to quotations table...');
      await client.query(`
        ALTER TABLE quotations 
        ADD COLUMN status VARCHAR(50) DEFAULT 'active';
      `);
      console.log('status column added to quotations.');
    }

    // Add gst_type and gst_rate to purchase_orders
    const poGstTypeCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'purchase_orders' AND column_name = 'gst_type'
    `);
    if (poGstTypeCheck.rows.length === 0) {
      console.log('Adding gst_type column to purchase_orders table...');
      await client.query(`
        ALTER TABLE purchase_orders 
        ADD COLUMN gst_type VARCHAR(100);
      `);
      console.log('gst_type column added to purchase_orders.');
    }

    const poGstRateCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'purchase_orders' AND column_name = 'gst_rate'
    `);
    if (poGstRateCheck.rows.length === 0) {
      console.log('Adding gst_rate column to purchase_orders table...');
      await client.query(`
        ALTER TABLE purchase_orders 
        ADD COLUMN gst_rate DECIMAL(5, 2) DEFAULT 0.00;
      `);
      console.log('gst_rate column added to purchase_orders.');
    }

    // Add gst_type and gst_rate to release_orders
    const roGstTypeCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'release_orders' AND column_name = 'gst_type'
    `);
    if (roGstTypeCheck.rows.length === 0) {
      console.log('Adding gst_type column to release_orders table...');
      await client.query(`
        ALTER TABLE release_orders 
        ADD COLUMN gst_type VARCHAR(100);
      `);
      console.log('gst_type column added to release_orders.');
    }

    const roGstRateCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'release_orders' AND column_name = 'gst_rate'
    `);
    if (roGstRateCheck.rows.length === 0) {
      console.log('Adding gst_rate column to release_orders table...');
      await client.query(`
        ALTER TABLE release_orders 
        ADD COLUMN gst_rate DECIMAL(5, 2) DEFAULT 0.00;
      `);
      console.log('gst_rate column added to release_orders.');
    }

    // Create grns table if not exists (migration) — full schema
    await client.query(`
      CREATE TABLE IF NOT EXISTS grns (
        grn_no VARCHAR(100) PRIMARY KEY,
        delivery_note_no VARCHAR(100) REFERENCES delivery_notes(delivery_note_no) ON DELETE SET NULL,
        trade_id VARCHAR(100) REFERENCES trades(trade_id) ON DELETE SET NULL,
        grn_date DATE,
        has_rejection BOOLEAN DEFAULT FALSE,
        rejection_items JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ALTER TABLE migrations — add missing columns to grns if they don't exist yet
    const grnColMigrations = [
      { col: 'delivery_note_no', ddl: `ALTER TABLE grns ADD COLUMN IF NOT EXISTS delivery_note_no VARCHAR(100) REFERENCES delivery_notes(delivery_note_no) ON DELETE SET NULL` },
      { col: 'trade_id',         ddl: `ALTER TABLE grns ADD COLUMN IF NOT EXISTS trade_id VARCHAR(100) REFERENCES trades(trade_id) ON DELETE SET NULL` },
      { col: 'grn_date',         ddl: `ALTER TABLE grns ADD COLUMN IF NOT EXISTS grn_date DATE` },
      { col: 'has_rejection',    ddl: `ALTER TABLE grns ADD COLUMN IF NOT EXISTS has_rejection BOOLEAN DEFAULT FALSE` },
      { col: 'rejection_items',  ddl: `ALTER TABLE grns ADD COLUMN IF NOT EXISTS rejection_items JSONB DEFAULT '[]'::jsonb` },
    ];
    for (const { col, ddl } of grnColMigrations) {
      const check = await client.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'grns' AND column_name = $1`,
        [col]
      );
      if (check.rows.length === 0) {
        console.log(`grns: adding missing column "${col}"...`);
        await client.query(ddl);
        console.log(`grns: column "${col}" added.`);
      }
    }


    // Create payments table if not exists (migration)
    await client.query(`
      CREATE TABLE IF NOT EXISTS payments (
        payment_no VARCHAR(100) PRIMARY KEY,
        po_no VARCHAR(100) REFERENCES purchase_orders(po_no) ON DELETE SET NULL,
        ro_no VARCHAR(100) REFERENCES release_orders(ro_no) ON DELETE SET NULL,
        total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Drop legacy inventory_items and inventory_item tables if they exist
    console.log('Dropping legacy inventory_items and inventory_item tables...');
    await client.query('DROP TABLE IF EXISTS inventory_items CASCADE;');
    await client.query('DROP TABLE IF EXISTS inventory_item CASCADE;');

    // Create inventory table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS inventory (
        id SERIAL PRIMARY KEY,
        item_code VARCHAR(100) NOT NULL REFERENCES items(item_code) ON DELETE CASCADE,
        quantity_in_stock NUMERIC NOT NULL CHECK (quantity_in_stock >= 0),
        rack VARCHAR(100),
        shelf_number VARCHAR(100),
        location VARCHAR(255),
        unit VARCHAR(50) DEFAULT 'Piece',
        allocated_quantity INTEGER DEFAULT 0 CHECK (allocated_quantity >= 0),
        rfq_no VARCHAR(100) REFERENCES rfqs(rfq_no) ON DELETE SET NULL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create trades table if not exists (migration)
    await client.query(`
      CREATE TABLE IF NOT EXISTS trades (
        trade_id VARCHAR(100) PRIMARY KEY,
        documents JSONB NOT NULL DEFAULT '[]'::jsonb,
        status VARCHAR(50) DEFAULT 'rfq',
        trade_type VARCHAR(50) DEFAULT 'sell',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Check if status column exists in trades table, if not, add it
    const tradesStatusCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'trades' AND column_name = 'status'
    `);
    if (tradesStatusCheck.rows.length === 0) {
      console.log('Adding status column to trades table...');
      await client.query(`
        ALTER TABLE trades 
        ADD COLUMN status VARCHAR(50) DEFAULT 'rfq';
      `);
      console.log('status column added to trades successfully.');
    }

    // Check if trade_type column exists in trades table, if not, add it
    const tradesTradeTypeCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'trades' AND column_name = 'trade_type'
    `);
    if (tradesTradeTypeCheck.rows.length === 0) {
      console.log('Adding trade_type column to trades table...');
      await client.query(`
        ALTER TABLE trades 
        ADD COLUMN trade_type VARCHAR(50) DEFAULT 'sell';
      `);
      console.log('trade_type column added to trades successfully.');

      console.log('Backfilling trade_type values for existing trades...');
      await client.query(`
        UPDATE trades
        SET trade_type = 'ARC'
        WHERE EXISTS (
          SELECT 1 FROM release_orders ro WHERE ro.trade_id = trades.trade_id
        ) OR documents @> '[{"type": "RO"}]';
      `);
      await client.query(`
        UPDATE trades
        SET trade_type = 'buy'
        WHERE EXISTS (
          SELECT 1 FROM received_quotations rq WHERE rq.trade_id = trades.trade_id
        ) OR documents::text LIKE '%"id": "RQTN-%';
      `);
      console.log('trade_type backfilling completed.');
    }

    // Add trade_id column to tables if they don't exist (migration)
    const tablesToMigrate = [
      'rfqs',
      'quotations',
      'purchase_orders',
      'release_orders',
      'delivery_notes',
      'invoices',
      'grns',
      'payments'
    ];

    for (const tableName of tablesToMigrate) {
      const columnCheck = await client.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = $1 AND column_name = 'trade_id'
      `, [tableName]);
      if (columnCheck.rows.length === 0) {
        console.log(`Adding trade_id column to ${tableName} table...`);
        await client.query(`
          ALTER TABLE ${tableName} 
          ADD COLUMN trade_id VARCHAR(100) REFERENCES trades(trade_id) ON DELETE SET NULL;
        `);
        console.log(`trade_id column added to ${tableName} successfully.`);
      }
    }

    // Backfill trade_id column in transactional tables from trades documents array
    console.log('Backfilling trade_id values for existing transactional records...');
    const tradesRes = await client.query('SELECT trade_id, documents FROM trades');
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

    for (const row of tradesRes.rows) {
      const tradeId = row.trade_id;
      const documents = row.documents || [];
      for (const doc of documents) {
        if (!doc.type || !doc.id) continue;
        const mapping = typeToTableMap[doc.type.toUpperCase()];
        if (mapping) {
          await client.query(
            `UPDATE ${mapping.table} SET trade_id = $1 WHERE ${mapping.idCol} = $2 AND trade_id IS NULL`,
            [tradeId, doc.id]
          );
        }
      }
    }
    console.log('trade_id backfilling completed.');

    // Propagate trade_id down the document chain for existing records
    console.log('Propagating trade_id down document chain...');
    await client.query(`
      UPDATE quotations q
      SET trade_id = r.trade_id
      FROM rfqs r
      WHERE q.rfq_no = r.rfq_no AND q.trade_id IS NULL AND r.trade_id IS NOT NULL;
    `);
    await client.query(`
      UPDATE purchase_orders po
      SET trade_id = q.trade_id
      FROM quotations q
      WHERE po.quotation_no = q.quotation_no AND po.trade_id IS NULL AND q.trade_id IS NOT NULL;
    `);
    await client.query(`
      UPDATE delivery_notes dn
      SET trade_id = po.trade_id
      FROM purchase_orders po
      WHERE dn.po_no = po.po_no AND dn.trade_id IS NULL AND po.trade_id IS NOT NULL;
    `);
    await client.query(`
      UPDATE delivery_notes dn
      SET trade_id = ro.trade_id
      FROM release_orders ro
      WHERE dn.ro_no = ro.ro_no AND dn.trade_id IS NULL AND ro.trade_id IS NOT NULL;
    `);
    await client.query(`
      UPDATE invoices inv
      SET trade_id = dn.trade_id
      FROM delivery_notes dn
      WHERE inv.delivery_note_no = dn.delivery_note_no AND inv.trade_id IS NULL AND dn.trade_id IS NOT NULL;
    `);
    await client.query(`
      UPDATE payments p
      SET trade_id = po.trade_id
      FROM purchase_orders po
      WHERE p.po_no = po.po_no AND p.trade_id IS NULL AND po.trade_id IS NOT NULL;
    `);
    console.log('trade_id propagation completed.');

    // Now, synchronize trades documents JSONB array from relational data
    console.log('Synchronizing trades documents arrays from relational data...');
    const allTradesResult = await client.query('SELECT trade_id, documents FROM trades');
    for (const trade of allTradesResult.rows) {
      const tradeId = trade.trade_id;
      const currentDocs = trade.documents || [];
      const updatedDocsMap = new Map();
      currentDocs.forEach(d => updatedDocsMap.set(`${d.type}:${d.id}`, d));

      // Fetch all documents linked to this trade_id
      const queryList = [
        { q: 'SELECT rfq_no FROM rfqs WHERE trade_id = $1', type: 'RFQ', idCol: 'rfq_no' },
        { q: 'SELECT quotation_no FROM quotations WHERE trade_id = $1', type: 'QUOTATION', idCol: 'quotation_no' },
        { q: 'SELECT po_no FROM purchase_orders WHERE trade_id = $1', type: 'PO', idCol: 'po_no' },
        { q: 'SELECT ro_no FROM release_orders WHERE trade_id = $1', type: 'RO', idCol: 'ro_no' },
        { q: 'SELECT delivery_note_no FROM delivery_notes WHERE trade_id = $1', type: 'DN', idCol: 'delivery_note_no' },
        { q: 'SELECT invoice_no FROM invoices WHERE trade_id = $1', type: 'INVOICE', idCol: 'invoice_no' },
        { q: 'SELECT grn_no FROM grns WHERE trade_id = $1', type: 'GRN', idCol: 'grn_no' },
        { q: 'SELECT payment_no FROM payments WHERE trade_id = $1', type: 'PAYMENT', idCol: 'payment_no' }
      ];

      for (const item of queryList) {
        const res = await client.query(item.q, [tradeId]);
        for (const row of res.rows) {
          const docId = row[item.idCol];
          const key = `${item.type}:${docId}`;
          if (!updatedDocsMap.has(key)) {
            updatedDocsMap.set(key, { type: item.type, id: docId });
          }
        }
      }

      // Convert map to array and check if we need to update documents only
      const newDocsList = Array.from(updatedDocsMap.values());

      if (JSON.stringify(currentDocs) !== JSON.stringify(newDocsList)) {
        await client.query(
          'UPDATE trades SET documents = $1 WHERE trade_id = $2',
          [JSON.stringify(newDocsList), tradeId]
        );
      }
    }
    console.log('trades documents array synchronization completed.');

    console.log('Schema normalization migrations completed.');
    // ----------------------------------------

    console.log('Database tables successfully verified/created.');
  } catch (error) {
    console.error('Error during PostgreSQL database initialization:', error.message);
    console.error('Please verify your DB_PASSWORD and DB_USER in the backend/.env file.');
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

const appendDocToTrade = async (client, tradeId, docType, docId) => {
  if (!tradeId) return;
  try {
    const res = await client.query('SELECT documents FROM trades WHERE trade_id = $1', [tradeId]);
    if (res.rows.length > 0) {
      const documents = res.rows[0].documents || [];

      // Only append the new doc if not already present — never touch status
      if (!documents.some(d => d.type === docType && d.id === docId)) {
        const updatedDocs = [...documents, { type: docType, id: docId }];
        await client.query(
          'UPDATE trades SET documents = $1 WHERE trade_id = $2',
          [JSON.stringify(updatedDocs), tradeId]
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
