require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_DATABASE || 'deskManager',
  password: process.env.DB_PASSWORD || '1209',
  port: process.env.DB_PORT || 5432,
});
pool.query("SELECT conname, pg_get_constraintdef(c.oid) FROM pg_constraint c WHERE conname = 'delivery_note_items_process_target_trace_item_id_fkey'")
  .then(res => console.log(res.rows))
  .catch(console.error)
  .finally(() => pool.end());
