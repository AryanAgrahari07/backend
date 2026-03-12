import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  const sqlFile = path.join(__dirname, '..', 'migrations', '0007_kot_numbers.sql');
  console.log(`Reading ${sqlFile}...`);
  const sql = fs.readFileSync(sqlFile, 'utf8');
  
  const statements = sql.split('--> statement-breakpoint')
    .map(s => s.trim())
    .filter(s => s.length > 0);
    
  console.log(`Found ${statements.length} statements to execute.`);
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (let i = 0; i < statements.length; i++) {
      console.log(`Executing statement ${i + 1}...`);
      await client.query(statements[i]);
    }
    await client.query('COMMIT');
    console.log('Migration successful!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
