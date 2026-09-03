require('dotenv').config();
const { pool } = require('./db');

async function runManufactureMigration() {
  const client = await pool.connect();
  try {
    console.log('Running Manufacture database migration...');
    await client.query('BEGIN');

    // 1. Add status column to trace_item
    await client.query(`
      ALTER TABLE trace_item 
      ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';
    `);
    console.log('Added status column to trace_item table.');

    // 2. Create manufacture table
    await client.query(`
      CREATE TABLE IF NOT EXISTS manufacture (
        id SERIAL PRIMARY KEY,
        trace_item_id INTEGER REFERENCES trace_item(id) ON DELETE SET NULL,
        target_trace_item_id INTEGER REFERENCES trace_item(id) ON DELETE SET NULL,
        source_item_id INTEGER REFERENCES items(id) ON DELETE CASCADE,
        target_item_id INTEGER REFERENCES items(id) ON DELETE CASCADE,
        quantity_used INTEGER NOT NULL CHECK (quantity_used > 0),
        expected_quantity INTEGER NOT NULL CHECK (expected_quantity > 0),
        date_of_starting DATE NOT NULL,
        date_of_ending DATE,
        message TEXT,
        status VARCHAR(50) DEFAULT 'manufacturing',
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Created manufacture table successfully.');

    await client.query('COMMIT');
    console.log('Migration completed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error running migration:', err.message);
  } finally {
    client.release();
    pool.end();
    process.exit(0);
  }
}

runManufactureMigration();
