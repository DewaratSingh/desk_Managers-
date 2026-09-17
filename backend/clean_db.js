const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_DATABASE || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  port: parseInt(process.env.DB_PORT || '5432'),
});

const PRESERVED_TABLES = new Set([
  'users',
  'companies',
  'customers',
  'buyers',
  'arc_items',
  'items',
  'gst_rates',
  'units',
  'status'
]);

async function cleanDatabase() {
  const client = await pool.connect();
  try {
    console.log('--- Starting Database Data Cleanup ---');

    // Fetch all tables in the public schema
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    const allTables = tablesResult.rows.map(r => r.table_name);
    const tablesToClean = allTables.filter(t => !PRESERVED_TABLES.has(t.toLowerCase()));
    const tablesToKeep = allTables.filter(t => PRESERVED_TABLES.has(t.toLowerCase()));

    console.log('\nPreserving tables:');
    tablesToKeep.forEach(t => console.log(`  - ${t}`));

    console.log('\nTables to be cleared:');
    tablesToClean.forEach(t => console.log(`  - ${t}`));

    if (tablesToClean.length === 0) {
      console.log('\nNo tables to clean.');
      return;
    }

    // Measure counts before cleanup
    const beforeCounts = {};
    for (const t of allTables) {
      const res = await client.query(`SELECT COUNT(*) FROM "${t}"`);
      beforeCounts[t] = parseInt(res.rows[0].count, 10);
    }

    // Truncate tables to clean with CASCADE and RESTART IDENTITY
    const truncateList = tablesToClean.map(t => `"${t}"`).join(', ');
    await client.query(`TRUNCATE TABLE ${truncateList} RESTART IDENTITY CASCADE;`);

    // Measure counts after cleanup
    const afterCounts = {};
    for (const t of allTables) {
      const res = await client.query(`SELECT COUNT(*) FROM "${t}"`);
      afterCounts[t] = parseInt(res.rows[0].count, 10);
    }

    console.log('\n--- Cleanup Summary ---');
    console.table(
      allTables.map(t => ({
        Table: t,
        Status: PRESERVED_TABLES.has(t.toLowerCase()) ? 'PRESERVED' : 'CLEARED',
        'Before Count': beforeCounts[t],
        'After Count': afterCounts[t]
      }))
    );

    console.log('\nDatabase cleanup completed successfully.');
  } catch (error) {
    console.error('Error during database cleanup:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

cleanDatabase();
