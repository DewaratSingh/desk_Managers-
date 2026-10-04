require('dotenv').config();
const { pool } = require('./db');

async function testGet() {
  try {
    const res = await pool.query('SELECT job_ids FROM rq_process ORDER BY id DESC LIMIT 1');
    const job_ids = res.rows[0]?.job_ids;
    console.log('Job IDs:', job_ids);
    
    if (job_ids && job_ids.length > 0) {
      const jobsResult = await pool.query(`
        SELECT j.*, 
               (SELECT json_agg(si.*) FROM source_item si WHERE si.job_id = j.id) as source_items,
               (SELECT json_agg(ti.*) FROM target_item ti WHERE ti.job_id = j.id) as target_items
        FROM job j
        WHERE j.id = ANY($1::int[])
      `, [job_ids]);
      console.log('Jobs:', JSON.stringify(jobsResult.rows, null, 2));
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
testGet();
