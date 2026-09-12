process.env.DB_USER = 'postgres';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_PASSWORD = '1209';
process.env.DB_DATABASE = 'postgres';

const { pool } = require('./db');

async function main() {
  try {
    const r1 = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'received_quotations'");
    console.log('received_quotations:', r1.rows.map(c => c.column_name));
    
    const r2 = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'received_quotation_items'");
    console.log('received_quotation_items:', r2.rows.map(c => c.column_name));

    const r3 = await pool.query("SELECT DISTINCT trade_type FROM trades");
    console.log('existing trade_types:', r3.rows);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

main();
