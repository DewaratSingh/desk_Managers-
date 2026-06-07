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
      VALUES ('admin', $1, 'admin')
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

    // Items Table — auto-migrate if old schema (id/name/sku) is detected
    const oldSchemaCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'items' AND column_name = 'name'
    `);

    if (oldSchemaCheck.rows.length > 0) {
      // Old schema detected — drop and recreate with new schema
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
        quotation_date DATE NOT NULL,
        terms_and_conditions TEXT,
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
        quotation_no VARCHAR(100) REFERENCES quotations(quotation_no) ON DELETE SET NULL,
        po_date DATE NOT NULL,
        gst DECIMAL(12, 2) DEFAULT 0.00,
        transport DECIMAL(12, 2) DEFAULT 0.00,
        other DECIMAL(12, 2) DEFAULT 0.00,
        basic_value DECIMAL(12, 2) DEFAULT 0.00,
        packing_forward DECIMAL(12, 2) DEFAULT 0.00,
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(po_no, item_code)
      );
    `);

    // --- Schema Normalization Migrations ---
    console.log('Running schema normalization migrations...');
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

module.exports = {
  pool,
  initializeDatabase
};
