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
        contract_ref VARCHAR(255),
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
        shipping_address TEXT,
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
