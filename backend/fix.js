require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '1209',
  database: process.env.DB_DATABASE || 'deskManager',
  port: process.env.DB_PORT || 5432,
  host: process.env.DB_HOST || 'localhost'
});
pool.query(`UPDATE process_po_item SET process_name = 'Nut Making' WHERE process_name IS NULL;`)
  .then(res => console.log('Updated:', res.rowCount))
  .catch(console.error)
  .finally(() => pool.end());
