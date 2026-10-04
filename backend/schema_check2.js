require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '1209',
  database: process.env.DB_DATABASE || 'deskManager',
  port: process.env.DB_PORT || 5432,
  host: process.env.DB_HOST || 'localhost'
});
pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'process_po_target_item'")
  .then(res => console.log('Columns:', res.rows.map(r => r.column_name).join(', ')))
  .finally(() => pool.end());
