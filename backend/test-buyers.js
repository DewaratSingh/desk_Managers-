require('dotenv').config();
const { pool } = require('./db');

async function testBuyers() {
  try {
    const res = await pool.query("SELECT * FROM buyers WHERE name ILIKE '%apex%'");
    console.log(JSON.stringify(res.rows, null, 2));
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
testBuyers();
