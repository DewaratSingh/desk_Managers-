require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool();
pool.query("SELECT conname, pg_get_constraintdef(c.oid) FROM pg_constraint c WHERE conname = 'delivery_note_items_process_target_trace_item_id_fkey'")
  .then(res => console.log(res.rows))
  .catch(console.error)
  .finally(() => pool.end());
