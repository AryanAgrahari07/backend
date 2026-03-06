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

async function req() {
  return new Promise((resolve) => {
    const bodyStr = JSON.stringify({
      orderType: 'DINE_IN',
      items: [{ menuItemId: MENU_ITEM_ID, quantity: 1 }],
      paymentMethod: 'DUE',
      paymentStatus: 'DUE',
    });
    const options = {
      host: 'localhost', port: 5555, method: 'POST', path: `/api/restaurants/${RESTAURANT_ID}/orders`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr)
      }
    };
    const r = http.request(options, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d.substring(0, 200) }));
    });
    r.on('error', e => resolve({ status: 0, body: e.message }));
    r.write(bodyStr);
    r.end();
  });
}

async function run() {
  const promises = [];
  for (let i = 0; i < 150; i++) {
    promises.push(req());
  }
  const results = await Promise.all(promises);
  const statusCounts = {};
  for (const r of results) {
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
    if (r.status !== 201) {
      console.log(`Failed! Status: ${r.status}, Body: ${r.body}`);
    }
  }
  console.log('Summary:', statusCounts);
}
run();
