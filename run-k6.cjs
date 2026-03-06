const jwt = require('jsonwebtoken');
require('dotenv').config();
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const OWNER_ID      = '72bdc0c8-ab9d-4b66-a652-7d8122649abf';
const RESTAURANT_ID = 'b1e3003d-2394-41c4-b1db-2971a1c033ca';
const MENU_ITEM_ID  = '92e646f1-8d31-4b18-82b3-1a1053584add';

const token = jwt.sign(
  { sub: OWNER_ID, role: 'OWNER', restaurantId: RESTAURANT_ID, email: 'owner@loadtest.com' },
  process.env.JWT_SECRET || 'nndsajkfndfsgmkdfngjdfngdfngs',
  { expiresIn: '1d' }
).trim();

const k6Exe = path.resolve(__dirname, '../k6-bin/k6-v0.50.0-windows-amd64/k6.exe');
const script = path.resolve(__dirname, 'tests/load/rms-launch.js');
const outFile = path.resolve(__dirname, 'k6_results.txt');

const fd = fs.openSync(outFile, 'w');

console.log('Starting load test... results → k6_results.txt');
const result = spawnSync(k6Exe, [
  'run', script,
  '--env', 'SCENARIO=normal_peak',
  '-e', `BASE_URL=http://localhost:5555`,
  '-e', `JWT_TOKEN=${token}`,
  '-e', `RESTAURANT_ID=${RESTAURANT_ID}`,
  '-e', `MENU_ITEM_ID=${MENU_ITEM_ID}`,
], {
  stdio: ['ignore', fd, fd],
  shell: false,
});

fs.closeSync(fd);
console.log('Done. Exit code:', result.status);
