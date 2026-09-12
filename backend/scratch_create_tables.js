process.env.DB_USER = 'postgres';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_PASSWORD = '1209';
process.env.DB_DATABASE = 'postgres';

const { pool } = require('./db');

async function main() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS po_process (
        id SERIAL PRIMARY KEY,
        po_no VARCHAR(100) UNIQUE NOT NULL,
        quotation_no VARCHAR(100),
        trade_id INTEGER REFERENCES trades(id),
        po_date DATE NOT NULL,
        delivery_date DATE,
        shipping_address TEXT,
        basic_value NUMERIC(15,2) DEFAULT 0,
        gst NUMERIC(15,2) DEFAULT 0,
        transport NUMERIC(15,2) DEFAULT 0,
        packing_forward NUMERIC(15,2) DEFAULT 0,
        other NUMERIC(15,2) DEFAULT 0,
        company_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS po_process_items (
        id SERIAL PRIMARY KEY,
        po_process_id INTEGER REFERENCES po_process(id) ON DELETE CASCADE,
        item_id INTEGER REFERENCES items(id),
        process_name VARCHAR(255),
        expected_output_code VARCHAR(255),
        quantity NUMERIC(12,2) NOT NULL,
        unit_price NUMERIC(15,2) DEFAULT 0,
        gst_rate NUMERIC(5,2) DEFAULT 0,
        linked_inventory_id INTEGER REFERENCES inventory(id),
        linked_trace_item_id INTEGER REFERENCES trace_item(id),
        company_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('po_process and po_process_items tables created successfully!');
  } catch (err) {
    console.error('Error creating po_process tables:', err);
  } finally {
    process.exit();
  }
}

main();
