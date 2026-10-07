require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '1209',
  database: process.env.DB_DATABASE || 'deskManager',
  port: process.env.DB_PORT || 5432,
  host: process.env.DB_HOST || 'localhost'
});
pool.query(`
  ALTER TABLE process_po_target_item ADD COLUMN IF NOT EXISTS process_name VARCHAR;
  UPDATE process_po_target_item pti
  SET process_name = (
    SELECT process_name 
    FROM process_po_item poi 
    WHERE poi.process_po_id = pti.process_po_id 
      AND poi.target_item_id = pti.item_code 
      AND poi.company_id = pti.company_id
    LIMIT 1
  )
  WHERE process_name IS NULL;
`)
  .then(res => console.log('Migrated!'))
  .catch(console.error)
  .finally(() => pool.end());
