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
SELECT ppo.id as po_id,
  COALESCE(
    (SELECT json_agg(json_build_object(
       'id', poi.id,
       'target_item_quantity', poi.target_qty,
       'delivered_qty', COALESCE((
          SELECT SUM(dni.quantity)
          FROM delivery_notes dn
          JOIN delivery_note_items dni ON dn.id = dni.delivery_note_id
          WHERE dn.trade_id = ppo.trade_id AND dni.item_id = poi.target_item_id AND dn.company_id = ppo.company_id
       ), 0)
     ))
     FROM process_po_item poi
     WHERE poi.process_po_id = ppo.id AND poi.company_id = ppo.company_id
    ), '[]'::json
  ) AS items
FROM process_po ppo
ORDER BY ppo.id DESC LIMIT 2
`).then(res => console.log('Process POs Items:', JSON.stringify(res.rows, null, 2)))
  .catch(console.error)
  .finally(() => pool.end());
