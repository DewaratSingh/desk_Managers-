process.env.DB_USER = 'postgres';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_PASSWORD = '1209';
process.env.DB_DATABASE = 'postgres';

const { pool } = require('./db');

async function main() {
  try {
    const r1 = await pool.query("SELECT * FROM trades WHERE trade_id = 'TRD-PRQ-2026-0001'");
    console.log('Trade row:', r1.rows);

    const r2 = await pool.query("SELECT * FROM received_quotations WHERE received_quotation_no = 'PRQ-2026-0001'");
    console.log('RQ row:', r2.rows);

    const r3 = await pool.query("SELECT * FROM trades ORDER BY created_at DESC LIMIT 10");
    console.log('Recent trades:', r3.rows.map(t => ({ id: t.trade_id, docs: t.documents, type: t.trade_type })));

    const r4 = await pool.query("SELECT * FROM received_quotations ORDER BY created_at DESC LIMIT 10");
    console.log('Recent RQs:', r4.rows.map(rq => ({ no: rq.received_quotation_no, trade_id: rq.trade_id })));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

main();
