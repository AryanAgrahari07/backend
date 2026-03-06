import jwt from 'jsonwebtoken';
import { config } from 'dotenv';
import http from 'http';
config();

const OWNER_ID     = '72bdc0c8-ab9d-4b66-a652-7d8122649abf';
const RESTAURANT_ID = 'b1e3003d-2394-41c4-b1db-2971a1c033ca';
const MENU_ITEM_ID  = '92e646f1-8d31-4b18-82b3-1a1053584add';

const token = jwt.sign(
  { sub: OWNER_ID, role: 'OWNER', restaurantId: RESTAURANT_ID, email: 'owner@loadtest.com' },
  process.env.JWT_SECRET || 'nndsajkfndfsgmkdfngjdfngdfngs',
  { expiresIn: '1d' }
);

async function req(method, path, body) {
  return new Promise((resolve) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const options = {
      host: 'localhost', port: 5555, method, path,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      }
    };
    const r = http.request(options, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d.substring(0, 200) }));
    });
    r.on('error', e => resolve({ status: 0, body: e.message }));
    if (bodyStr) r.write(bodyStr);
    r.end();
  });
}

// Test 1: List orders
console.log('\n1) GET /orders ...');
const list = await req('GET', `/api/restaurants/${RESTAURANT_ID}/orders?limit=5&offset=0`);
console.log(`   Status: ${list.status}`, list.status === 200 ? '✅' : '❌');
if (list.status !== 200) console.log('   Body:', list.body);

// Test 2: Create order
console.log('\n2) POST /orders ...');
const create = await req('POST', `/api/restaurants/${RESTAURANT_ID}/orders`, {
  orderType: 'DINE_IN',
  items: [{ menuItemId: MENU_ITEM_ID, quantity: 1 }],
  paymentMethod: 'DUE',
  paymentStatus: 'DUE',
});
console.log(`   Status: ${create.status}`, create.status === 201 ? '✅' : '❌');
if (create.status !== 201) console.log('   Body:', create.body);

// Test 3: KDS
console.log('\n3) GET /orders/kitchen/active ...');
const kds = await req('GET', `/api/restaurants/${RESTAURANT_ID}/orders/kitchen/active`);
console.log(`   Status: ${kds.status}`, kds.status === 200 ? '✅' : '❌');
