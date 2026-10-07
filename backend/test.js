require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '1209',
  database: process.env.DB_DATABASE || 'deskManager',
  port: process.env.DB_PORT || 5432,
  host: process.env.DB_HOST || 'localhost'
});
pool.query(`
  SELECT dn.id as dn_id, dn.trade_id, dni.item_id, dni.quantity 
  FROM delivery_notes dn 
  JOIN delivery_note_items dni ON dn.id = dni.delivery_note_id 
  WHERE dn.trade_id IS NOT NULL
`).then(res => console.log('DNs with trade_id:', res.rows))
  .catch(console.error)
  .finally(() => pool.end());
