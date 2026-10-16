require('dotenv').config();
const { pool } = require('./db');

async function checkSchema() {
  try {
    const { initializeDatabase } = require('./db');
    await initializeDatabase();
    console.log("Database initialized successfully without errors!");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
checkSchema();
