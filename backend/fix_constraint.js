require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_DATABASE || 'deskManager',
  password: process.env.DB_PASSWORD || '1209',
  port: process.env.DB_PORT || 5432,
});

async function fix() {
  try {
    await pool.query('ALTER TABLE delivery_note_items DROP CONSTRAINT IF EXISTS delivery_note_items_process_target_trace_item_id_fkey');
    await pool.query('ALTER TABLE delivery_note_items ADD CONSTRAINT delivery_note_items_process_target_trace_item_id_fkey FOREIGN KEY (process_target_trace_item_id) REFERENCES trace(id) ON DELETE SET NULL');
    console.log("Successfully fixed the foreign key constraint!");
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

fix();
