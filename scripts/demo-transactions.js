'use strict';
/**
 * PART D demo - transactions, COMMIT and ROLLBACK, run against the live API.
 *   1) start the server (npm start)   2) npm run db:setup   3) npm run demo:rollback
 * It prints stock + sales counts BEFORE and AFTER each request so you can show them in your video.
 */
require('dotenv').config();
const BASE = process.env.API_URL || `http://localhost:${process.env.PORT || 3000}/api`;

let TOKEN = '';
async function login() {
  const r = await fetch(BASE + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: process.env.ADMIN_USERNAME, password: process.env.ADMIN_PASSWORD }) });
  const d = await r.json();
  if (!r.ok) throw new Error('Login failed - set ADMIN_USERNAME and ADMIN_PASSWORD in .env: ' + d.error);
  TOKEN = d.token;
}
async function call(method, path, body) {
  const res = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOKEN }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, body: await res.json() };
}
const stock = async (fruit, size) => (await call('GET', `/stock?fruit_id=${fruit}&size=${size}`)).body.data[0].available_quantity;
const salesCount = async () => (await call('GET', '/sales')).body.count;
const line = (t) => console.log('\n' + '='.repeat(70) + '\n' + t + '\n' + '='.repeat(70));

(async () => {
  try {
    await login();
    const health = await call('GET', '/health');
    if (health.status !== 200) throw new Error('Server/database not ready: ' + JSON.stringify(health.body));

    line('DEMO 1 - SALE REJECTED: vendor asks for more LARGE apples than are in stock (plus a valid banana line)');
    const a0 = await stock(1, 'LARGE'), b0 = await stock(2, 'MEDIUM'), n0 = await salesCount();
    console.log(`BEFORE  apples LARGE=${a0}  bananas MEDIUM=${b0}  sales=${n0}`);
    const wantApples = a0 + 4; // always more than is available
    const r1 = await call('POST', '/sales', { vendor_id: 1, payment_method: 'CASH', amount_paid: 100,
      items: [{ fruit_id: 2, packaging_size: 'MEDIUM', quantity: 2 }, { fruit_id: 1, packaging_size: 'LARGE', quantity: wantApples }] });
    console.log(`REQUEST ${wantApples} large apples (valid banana line first) ->`, r1.status, r1.body.error);
    console.log('DETAILS', JSON.stringify(r1.body.details));
    console.log(`AFTER   apples LARGE=${await stock(1, 'LARGE')}  bananas MEDIUM=${await stock(2, 'MEDIUM')}  sales=${await salesCount()}`);
    console.log('=> ROLLBACK worked: the valid banana line was NOT saved either.');

    line('DEMO 2 - SALE ACCEPTED (COMMIT): 3 LARGE apples + 2 SMALL grapes, 500 paid by mobile money');
    const r2 = await call('POST', '/sales', { vendor_id: 2, payment_method: 'MOBILE_MONEY', amount_paid: 500, reference: 'DEMO-1',
      items: [{ fruit_id: 1, packaging_size: 'LARGE', quantity: 3 }, { fruit_id: 5, packaging_size: 'SMALL', quantity: 2 }] });
    console.log('->', r2.status, r2.body.message);
    const s = r2.body.data;
    console.log(`Total (calculated by server) = ${s.total_amount}, paid = ${s.amount_paid}, outstanding = ${s.outstanding_balance}, status = ${s.payment_status}`);
    console.log(`AFTER   apples LARGE=${await stock(1, 'LARGE')} (was ${a0})  sales=${await salesCount()}`);

    line('DEMO 3 - PURCHASE REJECTED: second item refers to a fruit that does not exist');
    const sm0 = await stock(1, 'SMALL');
    const r3 = await call('POST', '/purchases', { supplier_id: 1, items: [
      { fruit_id: 1, packaging_size: 'SMALL', quantity: 5, unit_cost: 50 }, { fruit_id: 999, packaging_size: 'SMALL', quantity: 5, unit_cost: 50 }] });
    console.log('->', r3.status, r3.body.error, JSON.stringify(r3.body.details));
    console.log(`apples SMALL before=${sm0} after=${await stock(1, 'SMALL')}  => nothing changed`);

    line('DEMO 4 - PURCHASE ACCEPTED (COMMIT): total calculated and stock increased');
    const r4 = await call('POST', '/purchases', { supplier_id: 1, items: [
      { fruit_id: 1, packaging_size: 'SMALL', quantity: 5, unit_cost: 50 }, { fruit_id: 3, packaging_size: 'LARGE', quantity: 4, unit_cost: 115.5 }] });
    console.log('->', r4.status, 'total =', r4.body.data.total_amount, '(5x50 + 4x115.50 = 712.00)');
    console.log(`apples SMALL ${sm0} -> ${await stock(1, 'SMALL')}`);
  } catch (err) {
    console.error('Demo failed:', err.message);
    process.exitCode = 1;
  }
})();
