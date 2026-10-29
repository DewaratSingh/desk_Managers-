const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '1209',
  database: process.env.DB_DATABASE || 'deskmanager',
  port: parseInt(process.env.DB_PORT || '5432'),
  host: process.env.DB_HOST || 'localhost'
});

async function migrate() {
  try {
    await pool.query(`
      ALTER TABLE process_po_target_item ADD COLUMN IF NOT EXISTS process_name VARCHAR(255);
      ALTER TABLE process_ro_target_item ADD COLUMN IF NOT EXISTS process_name VARCHAR(255);

      UPDATE process_po_target_item pti
      SET process_name = (
        SELECT poi.process_name 
        FROM process_po_item poi 
        WHERE poi.process_po_id = pti.process_po_id 
          AND poi.target_item_id = pti.item_code 
          AND poi.company_id = pti.company_id
        LIMIT 1
      )
      WHERE pti.process_name IS NULL;
    `);
    console.log('Migration successful: process_name column added and backfilled!');
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    await pool.end();
  }
}

migrate();
