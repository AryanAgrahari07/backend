import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { config } from 'dotenv';

config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const RESTAURANT_ID = 'b1e3003d-2394-41c4-b1db-2971a1c033ca';
const MENU_ITEM_ID  = '92e646f1-8d31-4b18-82b3-1a1053584add';

async function main() {
  const client = await pool.connect();
  try {
    // Get or create the test owner  
    let ownerResult = await client.query(
      `SELECT id FROM users WHERE email = 'owner@loadtest.com' LIMIT 1`
    );
    
    let ownerId;
    if (ownerResult.rows.length > 0) {
      ownerId = ownerResult.rows[0].id;
      console.log('Found existing owner:', ownerId);
    } else {
      const userRes = await client.query(`
        INSERT INTO users (email, password_hash, full_name, role)
        VALUES ('owner@loadtest.com', 'hash', 'Load Test Owner', 'OWNER')
        RETURNING id
      `);
      ownerId = userRes.rows[0].id;
      console.log('Created new owner:', ownerId);
    }

    // Check if our seeded restaurant still exists
    const restCheck = await client.query(
      `SELECT id FROM restaurants WHERE id = $1 LIMIT 1`, [RESTAURANT_ID]
    );

    let restaurantId = RESTAURANT_ID;
    if (restCheck.rows.length === 0) {
      // Create a new one
      const restRes = await client.query(`
        INSERT INTO restaurants (owner_id, name, slug)
        VALUES ($1, 'Load Test Rest', 'load-test-rest-2')
        RETURNING id
      `, [ownerId]);
      restaurantId = restRes.rows[0].id;
      console.log('Created new restaurant:', restaurantId);
    } else {
      // Update owner association
      await client.query(`UPDATE restaurants SET owner_id = $1 WHERE id = $2`, [ownerId, RESTAURANT_ID]);
      console.log('Restaurant exists, updated owner association');
    }

    // Check menu item
    const itemCheck = await client.query(
      `SELECT id FROM menu_items WHERE id = $1 LIMIT 1`, [MENU_ITEM_ID]
    );
    let menuItemId = MENU_ITEM_ID;
    if (itemCheck.rows.length === 0) {
      // Create category + item
      const catRes = await client.query(`
        INSERT INTO menu_categories (restaurant_id, name)
        VALUES ($1, 'Mains') RETURNING id
      `, [restaurantId]);
      const itemRes = await client.query(`
        INSERT INTO menu_items (restaurant_id, category_id, name, price)
        VALUES ($1, $2, 'Burger', 10.99) RETURNING id
      `, [restaurantId, catRes.rows[0].id]);
      menuItemId = itemRes.rows[0].id;
      console.log('Created new menu item:', menuItemId);
    }

    // Generate JWT with correct shape for auth.js:
    //  - `sub` = user id (NOT `id`)
    //  - `restaurantId` = restaurant id (required by requireRestaurantOwnership)
    const token = jwt.sign(
      {
        sub: ownerId,
        role: 'OWNER',
        restaurantId: restaurantId,
        email: 'owner@loadtest.com',
      },
      process.env.JWT_SECRET || 'nndsajkfndfsgmkdfngjdfngdfngs',
      { expiresIn: '1d' }
    );

    console.log('\n=== Use these values for the load test ===');
    console.log('RESTAURANT_ID=' + restaurantId);
    console.log('MENU_ITEM_ID=' + menuItemId);
    console.log('JWT_TOKEN=' + token);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
