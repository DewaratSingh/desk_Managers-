require('dotenv').config();
const { pool } = require('./db');

async function checkSchema() {
  try {
    const rqCount = await pool.query('SELECT COUNT(*) FROM rq_process WHERE company_id = 1');
    const rqMax = await pool.query('SELECT MAX(id), MAX(number) FROM rq_process WHERE company_id = 1');
    const trCount = await pool.query('SELECT COUNT(*) FROM trades WHERE company_id = 1');
    const trMax = await pool.query('SELECT MAX(id), MAX(trade_id) FROM trades WHERE company_id = 1');
    
    console.log("RQ Count:", rqCount.rows[0].count, "Max:", rqMax.rows[0]);
    console.log("Trade Count:", trCount.rows[0].count, "Max:", trMax.rows[0]);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
checkSchema();
