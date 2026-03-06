import { Pool } from 'pg';
import { config } from 'dotenv';
config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();

const r = await client.query(
  `SELECT r.id, r.owner_id, u.email FROM restaurants r 
   JOIN users u ON u.id = r.owner_id 
   WHERE r.id = 'b1e3003d-2394-41c4-b1db-2971a1c033ca'`
);
console.log('Restaurant row:', r.rows[0]);

// Also decode a real token to check what we'd send
import jwt from 'jsonwebtoken';
const token = jwt.sign(
  { sub: '72bdc0c8-ab9d-4b66-a652-7d8122649abf', role: 'OWNER', restaurantId: 'b1e3003d-2394-41c4-b1db-2971a1c033ca', email: 'owner@loadtest.com' },
  process.env.JWT_SECRET || 'nndsajkfndfsgmkdfngjdfngdfngs',
  { expiresIn: '1d' }
);
console.log('\nJWT decoded payload:', jwt.decode(token));
console.log('\nowner_id match:', r.rows[0]?.owner_id === '72bdc0c8-ab9d-4b66-a652-7d8122649abf');

client.release();
await pool.end();
