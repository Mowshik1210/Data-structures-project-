'use strict';

/* ============================================================
 *  TRWL test suite — runs against the REAL core and the REAL API.
 *  Run:  node tests/run-tests.js   (or:  npm test)
 * ============================================================ */

const assert = require('assert');
const ReservationSystem = require('../backend/reservationSystem');
const { server } = require('../server');

const quiet = { log() {} };            // silence logs so results are readable
let passed = 0, failed = 0;
const results = [];

function test(id, title, fn) {
  try { fn(); results.push([id, title, 'PASS']); passed++; }
  catch (e) { results.push([id, title, 'FAIL — ' + e.message]); failed++; }
}

const fresh = (opts = {}) =>
  new ReservationSystem({ trainNo: 12658, totalSeats: 5, maxWaiting: 10, logger: quiet, ...opts });

/* ------------------------- CORE TESTS ------------------------- */

test('TC01', 'Book when a confirmed seat is available', () => {
  const s = fresh();
  const r = s.book({ name: 'Alpha', age: 30, gender: 'M' });
  assert.strictEqual(r.status, 'CONFIRMED');
  assert.strictEqual(r.passenger.pnr, 1001);
  assert.strictEqual(s.confirmed.size, 1);
});

test('TC02', 'Book when all seats are full → FIFO waiting queue', () => {
  const s = fresh();
  for (let i = 0; i < 5; i++) s.book({ name: 'P' + i, age: 25, gender: 'M' });
  const r = s.book({ name: 'Sixth', age: 40, gender: 'F' });
  assert.strictEqual(r.status, 'WAITING');
  assert.strictEqual(r.position, 1);
  assert.strictEqual(s.waiting.size, 1);
});

test('TC03', 'Cancel confirmed with non-empty waiting list → auto FIFO promotion', () => {
  const s = fresh();
  for (let i = 0; i < 5; i++) s.book({ name: 'P' + i, age: 25, gender: 'M' });
  s.book({ name: 'W1', age: 33, gender: 'F' });   // PNR 1006 → WL #1
  s.book({ name: 'W2', age: 34, gender: 'F' });   // PNR 1007 → WL #2
  const r = s.cancel(1002);
  assert.strictEqual(r.cancelled.pnr, 1002);
  assert.strictEqual(r.promoted.pnr, 1006);       // the FIRST waiter is promoted
  assert.strictEqual(s.confirmed.size, 5);
  assert.strictEqual(s.waiting.size, 1);
  assert.strictEqual(s.waiting.toArray()[0].pnr, 1007);  // W2 shifts to WL #1
  assert(s.confirmed.toArray().some((p) => p.pnr === 1006 && p.status === 1));
});

test('TC04', 'Cancel confirmed with empty waiting list → berth freed, no promotion', () => {
  const s = fresh();
  s.book({ name: 'A', age: 30, gender: 'M' });
  const r = s.cancel(1001);
  assert.strictEqual(r.promoted, null);
  assert.strictEqual(s.confirmed.size, 0);
  assert.strictEqual(s.availability().available, 5);
});

test('TC05', 'Cancel a passenger who is only in the waiting list', () => {
  const s = fresh();
  for (let i = 0; i < 5; i++) s.book({ name: 'P' + i, age: 25, gender: 'M' });
  s.book({ name: 'W1', age: 30, gender: 'F' });
  s.book({ name: 'W2', age: 31, gender: 'F' });
  const r = s.cancel(1006);
  assert.strictEqual(r.cancelled.pnr, 1006);
  assert.strictEqual(r.promoted, null);
  assert.strictEqual(s.confirmed.size, 5);
  assert.strictEqual(s.waiting.size, 1);
  assert.strictEqual(s.waiting.toArray()[0].pnr, 1007);
});

test('TC06', 'Cancel a non-existent PNR → clean error, no state change', () => {
  const s = fresh();
  s.book({ name: 'A', age: 30, gender: 'M' });
  assert.throws(() => s.cancel(9999), /not found/i);
  assert.strictEqual(s.confirmed.size, 1);
});

test('TC07', 'Undo immediately after a cancellation (with promotion)', () => {
  const s = fresh();
  for (let i = 0; i < 5; i++) s.book({ name: 'P' + i, age: 25, gender: 'M' });
  s.book({ name: 'W1', age: 30, gender: 'F' });   // PNR 1006 waiting
  s.cancel(1002);                                  // promotes PNR 1006
  assert.strictEqual(s.confirmed.size, 5);
  s.undo();
  const conf = s.confirmed.toArray();
  assert(conf.some((p) => p.pnr === 1002 && p.status === 1));   // cancelled passenger restored
  const waiting = s.waiting.toArray();
  assert.strictEqual(waiting.length, 1);
  assert.strictEqual(waiting[0].pnr, 1006);                      // promoted passenger back at FRONT
  assert.strictEqual(waiting[0].status, 0);
});

test('TC08', 'Undo when the action stack is empty → clean error', () => {
  const s = fresh();
  assert.throws(() => s.undo(), /nothing to undo/i);
});

test('TC09', 'Search an existing PNR (linear search, both structures)', () => {
  const s = fresh();
  for (let i = 0; i < 5; i++) s.book({ name: 'P' + i, age: 25, gender: 'M' });
  s.book({ name: 'W1', age: 30, gender: 'F' });   // PNR 1006 waiting
  const r = s.search('pnr', 1006);
  assert.strictEqual(r.found, true);
  assert.strictEqual(r.passenger.pnr, 1006);
  assert.strictEqual(r.where, 'waiting queue');
  assert.strictEqual(r.waitingPosition, 1);
});

test('TC10', 'Search a PNR that does not exist', () => {
  const s = fresh();
  s.book({ name: 'A', age: 30, gender: 'M' });
  const r = s.search('pnr', 4242);
  assert.strictEqual(r.found, false);
});

test('TC11', 'Insertion sort on already-sorted records (best case ≈ O(n))', () => {
  const s = fresh();
  for (let i = 0; i < 5; i++) s.book({ name: 'P' + i, age: 25, gender: 'M' });
  const before = s.confirmed.toArray().map((p) => p.pnr);
  const r = s.sortConfirmed('pnr');
  assert.deepStrictEqual(r.after.map((p) => p.pnr), before);
  assert.deepStrictEqual(r.after.map((p) => p.pnr), [...before].sort((a, b) => a - b));
  assert.strictEqual(s.confirmed.size, 5);       // no nodes lost
  assert.strictEqual(r.comparisons, 4);          // n-1 comparisons on sorted input
});

test('TC12', 'Insertion sort on unordered records + tail pointer repaired', () => {
  const s = fresh({ totalSeats: 8 });
  ['Echo', 'Delta', 'Charlie', 'Bravo', 'Alpha'].forEach((n) => s.book({ name: n, age: 25, gender: 'M' }));
  const r = s.sortConfirmed('name');
  assert.deepStrictEqual(r.after.map((p) => p.name), ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo']);
  assert.strictEqual(s.confirmed.size, 5);
  s.book({ name: 'Zulu', age: 30, gender: 'F' }); // must append at the (repaired) tail
  const arr = s.confirmed.toArray();
  assert.strictEqual(arr[arr.length - 1].name, 'Zulu');
});

test('TC13', 'Waiting-list boundary conditions (MAX_WAITING enforced, recovers)', () => {
  const s = fresh({ totalSeats: 2, maxWaiting: 3 });
  ['A', 'B', 'C', 'D', 'E'].forEach((n) => s.book({ name: n, age: 30, gender: 'M' }));
  assert.strictEqual(s.waiting.size, 3);
  assert.throws(() => s.book({ name: 'F', age: 30, gender: 'M' }), /full/i);
  s.cancel(1004);                                  // free a waiting slot
  const r = s.book({ name: 'F', age: 30, gender: 'M' });
  assert.strictEqual(r.status, 'WAITING');
  assert.strictEqual(r.position, 3);
});

test('TC14', 'Undo a booking (LIFO order of the stack respected)', () => {
  const s = fresh();
  for (let i = 0; i < 5; i++) s.book({ name: 'P' + i, age: 25, gender: 'M' });
  s.book({ name: 'W1', age: 30, gender: 'F' });   // PNR 1006 — top of stack
  s.undo();                                        // must undo the MOST RECENT booking
  assert.strictEqual(s.waiting.size, 0);
  assert.strictEqual(s.search('pnr', 1006).found, false);
  assert.strictEqual(s.confirmed.size, 5);        // confirmed list untouched
});

test('TC15', 'Invalid input rejected (name / age / gender / PNR / train)', () => {
  const s = fresh();
  assert.throws(() => s.book({ name: '', age: 30, gender: 'M' }), /name/i);
  assert.throws(() => s.book({ name: 'X', age: 0, gender: 'M' }), /age/i);
  assert.throws(() => s.book({ name: 'X', age: 30, gender: 'Q' }), /gender/i);
  assert.throws(() => s.cancel('abc'), /PNR/i);
  assert.throws(() => s.book({ name: 'X', age: 30, gender: 'M', trainNo: 999 }), /train/i);
});

test('TC16', 'Search by passenger name (case-insensitive linear search)', () => {
  const s = fresh();
  s.book({ name: 'Meena Loganathan', age: 41, gender: 'F' });
  const r = s.search('name', 'meena loganathan');
  assert.ok(r.found);
  assert.strictEqual(r.passenger.pnr, 1001);
});

/* --------------------- HTTP API INTEGRATION --------------------- */

async function integrationTests() {
  await new Promise((resolve) => server.listen(0, resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const req = async (path, method, body) => {
    const opts = method === 'POST'
      ? { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }
      : {};
    const res = await fetch(base + path, opts);
    let json = null; try { json = await res.json(); } catch { /* ignore */ }
    return { status: res.status, json };
  };
  const cases = [
    ['I1', 'GET /api/health → 200 ok', async () => {
      const r = await req('/api/health');
      assert.strictEqual(r.status, 200); assert.strictEqual(r.json.ok, true);
    }],
    ['I2', 'GET /api/state returns live state', async () => {
      const r = await req('/api/state');
      assert.ok(r.json.state); assert.ok(Array.isArray(r.json.state.confirmed));
    }],
    ['I3', 'POST /api/book confirms a berth → 201', async () => {
      const r = await req('/api/book', 'POST', { name: 'API Tester', age: 28, gender: 'M' });
      assert.strictEqual(r.status, 201);
      assert.strictEqual(r.json.result.status, 'CONFIRMED');
    }],
    ['I4', 'POST /api/book with invalid data → 400', async () => {
      const r = await req('/api/book', 'POST', { name: '', age: 5, gender: 'M' });
      assert.strictEqual(r.status, 400);
    }],
    ['I5', 'POST /api/cancel unknown PNR → 404', async () => {
      const r = await req('/api/cancel', 'POST', { pnr: 999999 });
      assert.strictEqual(r.status, 404);
    }],
    ['I6', 'POST /api/reset clears state', async () => {
      const r = await req('/api/reset', 'POST');
      assert.strictEqual(r.json.state.confirmedCount, 0);
    }]
  ];
  for (const [id, title, fn] of cases) {
    try { await fn(); results.push([id, title, 'PASS']); passed++; }
    catch (e) { results.push([id, title, 'FAIL — ' + e.message]); failed++; }
  }
}

/* --------------------------- MAIN --------------------------- */

(async function main() {
  console.log('\n  TRWL test suite — core data structures + HTTP API\n');
  if (typeof fetch === 'function') {
    await integrationTests();
  } else {
    console.log('  (HTTP integration tests skipped — global fetch requires Node 18+)\n');
  }

  const W = 76, line = '─'.repeat(W);
  const green = (s) => '\x1b[32m' + s + '\x1b[0m';
  const red = (s) => '\x1b[31m' + s + '\x1b[0m';
  console.log('\n' + line);
  console.log('  TEST RESULTS — Train Reservation Waiting List');
  console.log(line);
  for (const [id, title, status] of results) {
    console.log(`  ${id.padEnd(6)} ${status === 'PASS' ? green('PASS') : red('FAIL')}  ${title}` +
      (status !== 'PASS' ? '   →  ' + status : ''));
  }
  console.log(line);
  console.log(`  Total: ${passed} passed, ${failed} failed`);
  console.log(failed === 0 ? '  All test cases passed. ✔' : '  Some tests FAILED — fix before submitting.');
  console.log('');
  process.exitCode = failed === 0 ? 0 : 1;
  if (server.listening) server.close();
})();