require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '1209',
  database: process.env.DB_DATABASE || 'deskManager',
  port: process.env.DB_PORT || 5432,
  host: process.env.DB_HOST || 'localhost'
});

async function check() {
  const tables = ['process_po', 'process_po_item', 'rq_process_jobs', 'trades'];
  for (const t of tables) {
    const res = await pool.query('SELECT column_name FROM information_schema.columns WHERE table_name = $1', [t]);
    console.log(`Table ${t}: ${res.rows.map(r => r.column_name).join(', ')}`);
  }
  pool.end();
}
check();
