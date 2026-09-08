Since I can't attach binary files in chat, below is **every file of the complete project**. Copy them into the folder structure shown, then run one command to produce your zip:

```bash
# macOS / Linux
zip -r TRWL-Train-Reservation-Waiting-List.zip train-reservation-waiting-list

# Windows PowerShell
Compress-Archive -Path train-reservation-waiting-list -DestinationPath TRWL-Train-Reservation-Waiting-List.zip
```

**Stack chosen:** Node.js backend (zero dependencies — no `npm install` needed) that genuinely implements the Linked List, Queue, Stack, Linear Search & Insertion Sort, plus a polished vanilla HTML/CSS/JS frontend served by the same server. One command runs everything.

## 📁 Project Structure

```
train-reservation-waiting-list/
├── server.js                  # entry point — HTTP API + static frontend hosting
├── package.json
├── backend/
│   ├── logger.js              # colour-coded terminal logs + startup banner
│   ├── reservationSystem.js   # domain core: book, cancel, promote, undo, search, sort
│   └── core/                  # the pure ADTs & algorithms (viva gold)
│       ├── linkedList.js      # CO1 — singly linked list (head + tail)
│       ├── queue.js           # CO2 — linked queue (front + rear, FIFO)
│       ├── stack.js           # CO2 — linked stack (LIFO undo history)
│       ├── search.js          # CO3 — linear search
│       └── sort.js            # CO3 — insertion sort (in-place node relinking)
├── frontend/
│   ├── index.html
│   ├── css/style.css
│   └── js/app.js
├── tests/
│   └── run-tests.js           # TC01–TC16 + live HTTP API integration tests
└── README.md
```

---

#### `package.json`

```json
{
  "name": "train-reservation-waiting-list",
  "version": "1.0.0",
  "description": "TRWL — dynamic railway booking & FIFO waiting-list management using a singly linked list, linked queue, linked stack, linear search and insertion sort (Data Structures PBL project).",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "test": "node tests/run-tests.js"
  },
  "engines": { "node": ">=16" },
  "keywords": ["data-structures", "linked-list", "queue", "stack", "railway", "reservation", "academic-project"],
  "license": "MIT"
}
```

---

#### `server.js`

```js
'use strict';

/* ============================================================
 *  TRWL — server.js
 *  Zero-dependency Node.js backend:
 *    • REAL data structures (linked list, queue, stack)
 *    • JSON API
 *    • serves the frontend (single command to run it all)
 *  Run:  node server.js     (or:  npm start)
 * ============================================================ */

const http = require('http');
const fs = require('fs');
const path = require('path');

const ReservationSystem = require('./backend/reservationSystem');
const Logger = require('./backend/logger');

const PORT = Number(process.env.PORT) || 5000;
const FRONTEND_DIR = path.join(__dirname, 'frontend');

const logger = new Logger();
const system = new ReservationSystem({ trainNo: 12658, totalSeats: 5, maxWaiting: 10, logger });

/* ---------------- helpers ---------------- */

function send(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '', bytes = 0;
    req.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes > 64 * 1024) {
        reject(Object.assign(new Error('Request body too large (limit 64 KB).'), { status: 413 }));
        req.destroy();
        return;
      }
      body += chunk;
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try { resolve(JSON.parse(body)); }
      catch { reject(Object.assign(new Error('Request body is not valid JSON.'), { status: 400 })); }
    });
    req.on('error', (e) => reject(Object.assign(e, { status: 400 })));
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function serveStatic(res, pathname) {
  if (pathname === '/favicon.ico') { res.writeHead(204); return res.end(); }
  const rel = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
  const file = path.normalize(path.join(FRONTEND_DIR, rel));
  if (file !== FRONTEND_DIR && !file.startsWith(FRONTEND_DIR + path.sep)) {
    res.writeHead(403); return res.end('Forbidden');
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      // unknown path → serve the app shell (deep-link friendly)
      return fs.readFile(path.join(FRONTEND_DIR, 'index.html'), (e2, html) => {
        if (e2) { res.writeHead(404); return res.end('Not found'); }
        res.writeHead(200, { 'Content-Type': MIME['.html'] });
        res.end(html);
      });
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
}

/* ---------------- API layer ---------------- */

async function handleApi(req, res, url) {
  const p = url.pathname;
  logger.log('API', `${req.method} ${p}`);
  try {
    if (req.method === 'GET') {
      switch (p) {
        case '/api/health':
          return send(res, 200, {
            ok: true,
            service: 'TRWL Backend — Train Reservation Waiting List',
            uptimeSec: Math.floor((Date.now() - system.startedAt) / 1000),
            structures: {
              confirmedLinkedList: { status: 'ACTIVE', nodes: system.confirmed.size },
              waitingQueue: { status: 'ACTIVE', nodes: system.waiting.size },
              actionStack: { status: 'ACTIVE', actions: system.history.size }
            },
            modules: { search: 'Linear Search', sort: 'Insertion Sort' }
          });
        case '/api/state':        return send(res, 200, { ok: true, state: system.snapshot() });
        case '/api/availability': return send(res, 200, { ok: true, availability: system.availability() });
        case '/api/confirmed':    return send(res, 200, { ok: true, count: system.confirmed.size, confirmed: system.confirmed.toArray() });
        case '/api/waiting':      return send(res, 200, { ok: true, count: system.waiting.size, waiting: system.waiting.toArray() });
        case '/api/history':      return send(res, 200, { ok: true, count: system.history.size, stack: system.history.toArray() });
        case '/api/activity':     return send(res, 200, { ok: true, activity: system.snapshot().activity });
        default:                  return send(res, 404, { ok: false, error: `Unknown API endpoint: ${p}` });
      }
    }

    if (req.method === 'POST') {
      const body = await readBody(req);
      switch (p) {
        case '/api/book':   return send(res, 201, { ok: true, result: system.book(body) });
        case '/api/cancel': return send(res, 200, { ok: true, result: system.cancel(body.pnr) });
        case '/api/search': return send(res, 200, { ok: true, result: system.search(body.type, body.value) });
        case '/api/sort':   return send(res, 200, { ok: true, result: system.sortConfirmed(body.key) });
        case '/api/undo':   return send(res, 200, { ok: true, result: system.undo() });
        case '/api/update': return send(res, 200, { ok: true, result: system.update(body.pnr, body) });
        case '/api/demo':   return send(res, 200, { ok: true, state: system.loadDemo() });
        case '/api/reset':  return send(res, 200, { ok: true, state: system.reset() });
        default:            return send(res, 404, { ok: false, error: `Unknown API endpoint: ${p}` });
      }
    }
    return send(res, 405, { ok: false, error: 'Method not allowed.' });
  } catch (err) {
    const status = err.status || 500;
    logger.log('ERROR', `${req.method} ${p} → ${status} — ${err.message}`);
    return send(res, status, { ok: false, error: err.message || 'Internal server error.' });
  }
}

/* ---------------- HTTP server ---------------- */

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }
  if (url.pathname.startsWith('/api/')) {
    return handleApi(req, res, url).catch((e) => send(res, 500, { ok: false, error: String(e) }));
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end('Method not allowed'); }
  return serveStatic(res, url.pathname);
});

/* auto-start when run directly; exportable so the test-suite can use it */
if (require.main === module) {
  server.listen(PORT, () => {
    logger.banner({
      trainNo: system.trainNo,
      totalSeats: system.totalSeats,
      maxWaiting: system.maxWaiting,
      url: `http://localhost:${PORT}`
    });
  });
  process.on('SIGINT', () => {
    logger.log('SYS', 'Shutting down — goodbye.');
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 400);
  });
}

module.exports = { server, system };
```

---

#### `backend/logger.js`

```js
'use strict';

/* Professional, colour-coded terminal logging for the TRWL backend.
   Every log line corresponds to a REAL operation on the data structures. */

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m', underline: '\x1b[4m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m', gray: '\x1b[90m'
};

const TAG_COLORS = {
  SYS: C.cyan, API: C.blue, BOOK: C.green, CANCEL: C.red, CHECK: C.yellow,
  QUEUE: C.cyan, STACK: C.yellow, LIST: C.blue, SEARCH: C.magenta,
  SORT: C.blue, UNDO: C.magenta, PROMOTE: C.green, SEAT: C.yellow,
  UPDATE: C.blue, DEMO: C.magenta, RESULT: C.bold, ERROR: C.bold + C.red
};

class Logger {
  constructor({ quiet = false } = {}) { this.quiet = quiet; }

  log(tag, message) {
    if (this.quiet) return;
    const ts = new Date().toISOString().slice(11, 19); // HH:MM:SS
    const color = TAG_COLORS[tag] || '';
    const label = `[${tag}]`.padEnd(10);
    console.log(`${C.gray}${ts}${C.reset}  ${color}${label}${C.reset}${message}`);
  }

  /** Startup banner — printed once when the server boots. */
  banner({ trainNo, totalSeats, maxWaiting, url }) {
    const line = '='.repeat(66);
    const row = (k, v) => `  ${k.padEnd(22)}: ${v}`;
    console.log(
`\n${C.cyan}${line}${C.reset}
${C.bold}        TRAIN RESERVATION WAITING LIST SYSTEM${C.reset} ${C.dim}(TRWL backend)${C.reset}
${C.cyan}${line}${C.reset}
${row('Backend Server      ', C.green + 'RUNNING' + C.reset)}
${row('Data Structure Core ', C.green + 'INITIALIZED' + C.reset)}
${row('Confirmed List      ', `READY ${C.dim}— singly linked list (head + tail)${C.reset}`)}
${row('Waiting Queue       ', `READY ${C.dim}— linked queue (front + rear, FIFO)${C.reset}`)}
${row('Action Stack        ', `READY ${C.dim}— linked stack (LIFO, undo)${C.reset}`)}
${row('Search Module       ', `READY ${C.dim}— Linear Search, O(n)${C.reset}`)}
${row('Sort Module         ', `READY ${C.dim}— Insertion Sort, in-place relink${C.reset}`)}
${row('Train               ', `${C.bold}${trainNo}${C.reset} · ${totalSeats} berths · WL cap ${maxWaiting}`)}
${row('API + Frontend      ', C.underline + url + C.reset)}
${C.cyan}${line}${C.reset}
${C.dim}  Open the URL above in a browser — every operation you perform there
  is logged here in real time as it executes on the data structures.${C.reset}\n`);
  }
}

module.exports = Logger;
```

---

#### `backend/core/linkedList.js`

```js
'use strict';

/* ============================================================
 *  CO1 — SINGLY LINKED LIST ADT
 *  Used for: confirmed reservations (head + tail) and the
 *  activity timeline. O(1) insertion at the tail.
 * ============================================================ */

/** A node wraps a payload (`data`) and a `next` pointer —
 *  the direct equivalent of the C struct: struct Passenger { …; struct Passenger *next; } */
class ListNode {
  constructor(data) { this.data = data; this.next = null; }
}

class LinkedList {
  constructor() { this.head = null; this.tail = null; this.size = 0; }

  isEmpty() { return this.head === null; }

  /** Append a node (or wrap raw data) at the TAIL — O(1). */
  insertTail(dataOrNode) {
    const node = dataOrNode instanceof ListNode ? dataOrNode : new ListNode(dataOrNode);
    node.next = null;
    if (this.tail === null) { this.head = this.tail = node; }          // empty list
    else { this.tail.next = node; this.tail = node; }                  // general case
    this.size++;
    return node;
  }

  /**
   * Remove and return the first node whose data satisfies `match(data)`.
   * Correctly handles: empty list, single node, head, middle and tail.
   * O(n) time, O(1) space. Returns null when nothing matches.
   */
  remove(match) {
    let prev = null, cur = this.head;
    while (cur !== null) {
      if (match(cur.data)) {
        if (prev === null) this.head = cur.next;   // deleting the head
        else prev.next = cur.next;                 // middle / tail
        if (cur === this.tail) this.tail = prev;   // deleting the tail
        cur.next = null;
        this.size--;
        return cur;
      }
      prev = cur; cur = cur.next;
    }
    return null;
  }

  /** Sequential traversal — O(n). */
  forEach(fn) {
    let cur = this.head, i = 0;
    while (cur !== null) { fn(cur.data, i, cur); cur = cur.next; i++; }
  }

  find(match) {
    let cur = this.head;
    while (cur !== null) { if (match(cur.data)) return cur; cur = cur.next; }
    return null;
  }

  toArray() { const out = []; this.forEach((d) => out.push(d)); return out; }
}

module.exports = { LinkedList, ListNode };
```

---

#### `backend/core/queue.js`

```js
'use strict';

/* ============================================================
 *  CO2 — LINKED-LIST QUEUE ADT (FIFO)
 *  Used for: the waiting list. front + rear pointers give
 *  O(1) enqueue (rear) and O(1) dequeue (front), with no
 *  pre-declared capacity (unlike an array-based queue).
 * ============================================================ */

const { ListNode } = require('./linkedList');

class LinkedQueue {
  constructor() { this.front = null; this.rear = null; this.size = 0; }

  isEmpty() { return this.front === null; }

  /** Enqueue at the REAR — O(1). */
  enqueue(dataOrNode) {
    const node = dataOrNode instanceof ListNode ? dataOrNode : new ListNode(dataOrNode);
    node.next = null;
    if (this.rear === null) { this.front = this.rear = node; }   // empty queue
    else { this.rear.next = node; this.rear = node; }
    this.size++;
    return node;
  }

  /** Dequeue from the FRONT — O(1). Returns the node (or null). */
  dequeue() {
    if (this.front === null) return null;
    const node = this.front;
    this.front = node.next;
    if (this.front === null) this.rear = null;                   // queue became empty
    node.next = null;
    this.size--;
    return node;
  }

  peek() { return this.front ? this.front.data : null; }

  /** Remove a node matching `match(data)` from ANYWHERE in the queue.
   *  Used when a WAITING passenger cancels. Returns { node, index } or null. O(n). */
  remove(match) {
    let prev = null, cur = this.front, idx = 0;
    while (cur !== null) {
      if (match(cur.data)) {
        if (prev === null) this.front = cur.next; else prev.next = cur.next;
        if (cur === this.rear) this.rear = prev;
        cur.next = null;
        this.size--;
        return { node: cur, index: idx };
      }
      prev = cur; cur = cur.next; idx++;
    }
    return null;
  }

  /** Insert an existing node at a 0-based position — used by UNDO to restore
   *  a passenger to their exact FIFO position. O(n). */
  insertAt(index, node) {
    node.next = null;
    if (this.front === null || index <= 0) {
      node.next = this.front;
      this.front = node;
      if (this.rear === null) this.rear = node;
    } else {
      let prev = this.front, i = 0;
      while (prev.next !== null && i < index - 1) { prev = prev.next; i++; }
      node.next = prev.next;
      prev.next = node;
      if (node.next === null) this.rear = node;
    }
    this.size++;
    return node;
  }

  /** 1-based waiting position of a passenger (0 = not waiting). O(n). */
  indexOf(match) {
    let cur = this.front, i = 0;
    while (cur !== null) { if (match(cur.data)) return i; cur = cur.next; i++; }
    return -1;
  }

  forEach(fn) {
    let cur = this.front, i = 0;
    while (cur !== null) { fn(cur.data, i, cur); cur = cur.next; i++; }
  }

  toArray() { const out = []; this.forEach((d) => out.push(d)); return out; }
}

module.exports = { LinkedQueue };
```

---

#### `backend/core/stack.js`

```js
'use strict';

/* ============================================================
 *  CO2 — LINKED-LIST STACK ADT (LIFO)
 *  Used for: the booking / cancellation action history.
 *  The most recent action sits on TOP → O(1) push & pop.
 * ============================================================ */

class StackNode {
  constructor(data) { this.data = data; this.next = null; }
}

class LinkedStack {
  constructor() { this.top = null; this.size = 0; }

  isEmpty() { return this.top === null; }

  /** Push onto the TOP — O(1). Returns the node (so the caller can enrich it later). */
  push(data) {
    const node = new StackNode(data);
    node.next = this.top;
    this.top = node;
    this.size++;
    return node;
  }

  /** Pop from the TOP — O(1). Returns the data (or null). */
  pop() {
    if (this.top === null) return null;
    const node = this.top;
    this.top = node.next;
    node.next = null;
    this.size--;
    return node.data;
  }

  peek() { return this.top ? this.top.data : null; }

  /** Top-first snapshot — this is exactly what the History UI renders. */
  toArray() {
    const out = [];
    let cur = this.top;
    while (cur !== null) { out.push(cur.data); cur = cur.next; }
    return out;
  }
}

module.exports = { LinkedStack };
```

---

#### `backend/core/search.js`

```js
'use strict';

/* ============================================================
 *  CO3 — LINEAR (SEQUENTIAL) SEARCH
 *  The correct search for linked structures, which have no
 *  random access. O(n) worst-case time, O(1) extra space.
 *
 *  `trail` records every node visited so the UI can visualise
 *  the actual traversal: HEAD → … → MATCH.
 * ============================================================ */

/**
 * @param {Array<{name:string, start:object}>} containers e.g. [{name:'confirmed list', start: list.head}]
 * @param {Function} match   receives node data → boolean
 * @param {Function} label   receives node data → short chip label for the trail
 */
function linearSearch(containers, match, label) {
  const trail = [];
  for (const container of containers) {
    let cur = container.start, index = 0;
    while (cur !== null) {
      trail.push(label(cur.data));
      if (match(cur.data)) {
        return { found: true, container: container.name, index, data: cur.data, trail };
      }
      cur = cur.next;
      index++;
    }
  }
  return { found: false, container: null, index: -1, data: null, trail };
}

module.exports = { linearSearch };
```

---

#### `backend/core/sort.js`

```js
'use strict';

/* ============================================================
 *  CO3 — INSERTION SORT on a singly linked list
 *
 *  Builds an ordered chain by taking each node out of the
 *  original list and inserting it into its correct position.
 *  Nodes are RELINKED in place → O(1) extra space (no array).
 *
 *  Two fast paths keep the common cases cheap:
 *    • node ≥ sorted TAIL  → append  (already-sorted bookings → ~1 comparison/node → ~O(n))
 *    • node < sorted HEAD  → prepend (reverse-sorted input)
 *  Worst case (scrambled order) is O(n²) comparisons — still O(1) space.
 *  Stable: equal keys keep their original relative order.
 * ============================================================ */

/**
 * @param {LinkedList} list  the list to sort (mutated in place)
 * @param {Function} keyFn   extracts the comparable key from node data
 * @returns {{comparisons:number, nodesProcessed:number}}
 */
function insertionSortList(list, keyFn) {
  if (!list.head || !list.head.next) return { comparisons: 0, nodesProcessed: list.size };

  let sorted = null;       // head of the growing sorted chain
  let sortedTail = null;   // tail of the sorted chain (fast-append path)
  let comparisons = 0;
  let nodesProcessed = 0;

  let cur = list.head;
  while (cur !== null) {
    const next = cur.next;              // remember the rest of the original chain
    nodesProcessed++;

    if (sorted === null) {              // first node starts the sorted chain
      cur.next = null;
      sorted = sortedTail = cur;
    } else {
      comparisons++;                    // compare with the sorted TAIL first
      if (keyFn(cur.data) >= keyFn(sortedTail.data)) {
        cur.next = null;                // append — best case for sorted input
        sortedTail.next = cur;
        sortedTail = cur;
      } else {
        comparisons++;                  // compare with the sorted HEAD
        if (keyFn(cur.data) < keyFn(sorted.data)) {
          cur.next = sorted;            // prepend — best case for reverse input
          sorted = cur;
        } else {                        // middle: walk to the insertion point
          let s = sorted;
          while (s.next !== null && keyFn(s.next.data) <= keyFn(cur.data)) {
            comparisons++;
            s = s.next;
          }
          comparisons++;
          cur.next = s.next;
          s.next = cur;
        }
      }
    }
    cur = next;
  }

  list.head = sorted;
  list.tail = sortedTail;               // repair the tail pointer in O(1)
  return { comparisons, nodesProcessed };
}

module.exports = { insertionSortList };
```

---

#### `backend/reservationSystem.js`

```js
'use strict';

/* ============================================================
 *  TRWL — Reservation System core (the REAL data structures)
 * ============================================================
 *  Confirmed reservations : Singly Linked List (head + tail)   → CO1
 *  Waiting list           : Linked Queue      (front + rear)  → CO2
 *  Action history / undo  : Linked Stack      (top)           → CO2
 *  Lookups                : Linear Search                      → CO3
 *  Ordered reports        : Insertion Sort (node relinking)    → CO3
 *
 *  The backend OWNS the state — the frontend only renders
 *  snapshots returned by snapshot() after every operation.
 * ============================================================ */

const { LinkedList, ListNode } = require('./core/linkedList');
const { LinkedQueue } = require('./core/queue');
const { LinkedStack } = require('./core/stack');
const { linearSearch } = require('./core/search');
const { insertionSortList } = require('./core/sort');

/* ---------- typed errors (map cleanly to HTTP status codes) ---------- */
class AppError extends Error {
  constructor(message, status = 400) { super(message); this.name = this.constructor.name; this.status = status; }
}
class ValidationError extends AppError { constructor(m) { super(m, 400); } }
class NotFoundError extends AppError { constructor(m) { super(m, 404); } }

const clone = (p) => ({ ...p });
const nowISO = () => new Date().toISOString();

class ReservationSystem {
  constructor({ trainNo = 12658, totalSeats = 5, maxWaiting = 10, logger = null } = {}) {
    this.trainNo = trainNo;
    this.totalSeats = totalSeats;
    this.maxWaiting = maxWaiting;
    this.logger = logger || { log() {} };
    this.startedAt = Date.now();
    this.activityCap = 40;
    this._init();
  }

  _init() {
    this.confirmed = new LinkedList();   // CO1 — singly linked list (head + tail)
    this.waiting = new LinkedQueue();    // CO2 — FIFO queue  (front + rear)
    this.history = new LinkedStack();    // CO2 — LIFO stack  (undo history)
    this.activity = new LinkedList();    // append-only event timeline (capped linked list)
    this.bookingClock = 0;               // monotonically increasing booking token
    this.pnrCounter = 0;                 // PNR = 1000 + counter → 1001, 1002, …
  }

  log(tag, msg) { this.logger.log(tag, msg); }

  _pushAction(type, passenger, detail, queuePosition = null) {
    this.history.push({
      type,                                   // 'BOOK' | 'CANCEL'
      at: nowISO(),
      passenger: clone(passenger),            // snapshot copy — safe to restore later
      detail,
      promoted: null,                         // filled in when a cancel triggers promotion
      queuePosition                           // original FIFO position (waiting-list cancels)
    });
  }

  _activity(type, message, pnr = null) {
    this.activity.insertTail({ type, message, pnr, at: nowISO() });
    while (this.activity.size > this.activityCap) {   // drop the oldest event — O(1)
      const oldest = this.activity.head;
      this.activity.head = oldest.next;
      if (this.activity.head === null) this.activity.tail = null;
      this.activity.size--;
    }
  }

  /* ===================== BOOKING ===================== */

  book({ name, age, gender, trainNo } = {}) {
    /* ---- validation: the backend never trusts the frontend ---- */
    name = String(name == null ? '' : name).trim();
    if (!name) throw new ValidationError('Passenger name is required.');
    if (name.length > 49) throw new ValidationError('Passenger name is too long (max 49 characters).');

    age = Number(age);
    if (!Number.isInteger(age) || age < 1 || age > 120) {
      throw new ValidationError('Age must be a whole number between 1 and 120.');
    }

    gender = String(gender == null ? '' : gender).trim().toUpperCase();
    if (!['M', 'F', 'O'].includes(gender)) throw new ValidationError("Gender must be 'M', 'F' or 'O'.");

    trainNo = (trainNo === undefined || trainNo === null || trainNo === '') ? this.trainNo : Number(trainNo);
    if (!Number.isInteger(trainNo) || trainNo <= 0) throw new ValidationError('Train number must be a positive integer.');
    if (trainNo !== this.trainNo) throw new ValidationError(`This counter manages Train ${this.trainNo} only.`);

    this.log('BOOK', `New reservation request received — "${name}", age ${age}, gender ${gender}`);

    /* ---- create the passenger record ---- */
    const passenger = {
      pnr: 1000 + (++this.pnrCounter),   // auto-generated unique PNR
      name,
      trainNo,
      age,
      gender,
      bookingTime: ++this.bookingClock,  // FIFO / sorting token
      status: 0,                         // 1 = CONFIRMED, 0 = WAITING
      bookedAt: nowISO()
    };
    this.log('BOOK', `Generated PNR: ${passenger.pnr}`);
    this.log('CHECK', `Confirmed seats: ${this.confirmed.size}/${this.totalSeats}`);

    if (this.confirmed.size < this.totalSeats) {
      /* ---- seat available → append to the confirmed linked list (O(1) at tail) ---- */
      passenger.status = 1;
      this.confirmed.insertTail(new ListNode(passenger));
      this.log('LIST', `Node appended at TAIL — PNR ${passenger.pnr} (list size ${this.confirmed.size})`);
      this._pushAction('BOOK', passenger, 'Berth confirmed directly');
      this.log('STACK', 'PUSH BOOK action');
      this._activity('BOOK', `${name} booked — PNR ${passenger.pnr} — CONFIRMED`, passenger.pnr);
      this.log('RESULT', `Reservation status: CONFIRMED (PNR ${passenger.pnr})`);
      return { status: 'CONFIRMED', passenger: clone(passenger) };
    }

    /* ---- no seat → enqueue onto the waiting queue (O(1) at rear) ---- */
    if (this.waiting.size >= this.maxWaiting) {
      this.log('ERROR', `Waiting list full (${this.waiting.size}/${this.maxWaiting}) — booking rejected`);
      throw new ValidationError(`Waiting list is full (${this.maxWaiting}). This booking cannot be accepted.`);
    }
    this.log('QUEUE', 'No confirmed seat available');
    this.waiting.enqueue(new ListNode(passenger));
    this.log('QUEUE', `Enqueue PNR ${passenger.pnr} at REAR (queue size ${this.waiting.size})`);
    this._pushAction('BOOK', passenger, `Joined the waiting list at position ${this.waiting.size}`);
    this.log('STACK', 'PUSH BOOK action');
    this._activity('BOOK', `${name} booked — PNR ${passenger.pnr} — WAITING #${this.waiting.size}`, passenger.pnr);
    this.log('QUEUE', `Waiting position: ${this.waiting.size}`);
    this.log('RESULT', `Reservation status: WAITING (position ${this.waiting.size})`);
    return { status: 'WAITING', position: this.waiting.size, passenger: clone(passenger) };
  }

  /* ============ CANCELLATION (+ AUTOMATIC PROMOTION) ============ */

  cancel(pnr) {
    pnr = Number(pnr);
    if (!Number.isInteger(pnr)) throw new ValidationError('A valid numeric PNR is required (e.g. 1001).');
    this.log('CANCEL', `Cancellation request: PNR ${pnr}`);
    this.log('SEARCH', 'Linear search started — confirmed list → waiting queue');

    const found = this._findByPnr(pnr);
    if (!found) {
      this.log('SEARCH', `PNR ${pnr} not found in any structure`);
      this.log('RESULT', `Cancellation rejected — PNR ${pnr} does not exist`);
      throw new NotFoundError(`PNR ${pnr} was not found.`);
    }

    if (found.where === 'confirmed list') {
      /* ---- confirmed passenger: unlink the node, free the berth ---- */
      this.log('SEARCH', `PNR ${pnr} found in confirmed list (node #${found.index + 1})`);
      const node = this.confirmed.remove((p) => p.pnr === pnr);
      const cancelled = node.data;
      this.log('LIST', `Node unlinked — PNR ${pnr} (list size ${this.confirmed.size})`);
      this.log('STACK', 'PUSH CANCEL action');
      this.log('SEAT', 'Seat released');
      this._activity('CANCEL', `PNR ${pnr} (${cancelled.name}) — cancelled a CONFIRMED berth`, pnr);

      /* Push the CANCEL record BEFORE promoting, then attach the promoted snapshot
         so a SINGLE undo can reverse the whole composite action. */
      const action = this.history.push({
        type: 'CANCEL', at: nowISO(), passenger: clone(cancelled),
        detail: 'Confirmed berth cancelled', promoted: null, queuePosition: null
      }).data;

      const promoted = this._promoteFront(`berth freed by PNR ${pnr}`);
      if (promoted) action.promoted = clone(promoted);

      this.log('RESULT', promoted
        ? `Cancellation complete — PNR ${promoted.pnr} auto-promoted to CONFIRMED`
        : 'Cancellation complete — no waiting passengers to promote');
      return { cancelled: clone(cancelled), promoted: promoted ? clone(promoted) : null };
    }

    /* ---- waiting passenger: remove from the queue (no berth freed) ---- */
    this.log('SEARCH', `PNR ${pnr} found in waiting queue (position ${found.index + 1})`);
    const removed = this.waiting.remove((p) => p.pnr === pnr);
    const cancelled = removed.node.data;
    this.log('QUEUE', `Node removed from position ${removed.index + 1} (queue size ${this.waiting.size})`);
    this._pushAction('CANCEL', cancelled, `Waiting-list cancellation (was position ${removed.index + 1})`, removed.index);
    this.log('STACK', 'PUSH CANCEL action');
    this._activity('CANCEL', `PNR ${pnr} (${cancelled.name}) — removed from the WAITING list`, pnr);
    this.log('RESULT', 'No seat freed — no promotion triggered');
    return { cancelled: clone(cancelled), promoted: null };
  }

  /* ---- the heart of the system: FIFO promotion from the waiting queue ---- */
  _promoteFront(reason) {
    if (this.waiting.isEmpty()) {
      this.log('QUEUE', 'Waiting queue empty — the berth stays available');
      return null;
    }
    this.log('QUEUE', 'Checking waiting queue for promotion');
    this.log('QUEUE', `Front passenger: PNR ${this.waiting.peek().pnr} (${this.waiting.peek().name})`);
    const node = this.waiting.dequeue();       // O(1) — remove from FRONT (FIFO)
    this.log('QUEUE', `DEQUEUE PNR ${node.data.pnr}`);
    node.data.status = 1;                      // WAITING → CONFIRMED
    this.confirmed.insertTail(node);           // the SAME node physically moves into the linked list
    this.log('PROMOTE', `PNR ${node.data.pnr} → CONFIRMED (list size ${this.confirmed.size})`);
    this._activity('PROMOTION', `PNR ${node.data.pnr} (${node.data.name}) — WAITING → CONFIRMED (${reason})`, node.data.pnr);
    return node.data;
  }

  /* ===================== UNDO (linked stack, LIFO) ===================== */

  undo() {
    this.log('UNDO', 'POP requested from the action stack');
    if (this.history.isEmpty()) {
      this.log('UNDO', 'Stack is empty — nothing to undo');
      throw new ValidationError('Nothing to undo — the action stack is empty.');
    }
    const action = this.history.pop();         // O(1) pop from TOP
    this.log('UNDO', `Action: ${action.type} — PNR ${action.passenger.pnr}`);
    const message = action.type === 'BOOK' ? this._undoBook(action) : this._undoCancel(action);
    this._activity('UNDO', message, action.passenger.pnr);
    this.log('RESULT', message);
    return { undone: action.type, pnr: action.passenger.pnr, message };
  }

  _undoBook(action) {
    const { pnr, name } = action.passenger;
    const found = this._findByPnr(pnr);
    if (!found) return `Undo BOOK: PNR ${pnr} no longer exists — nothing to reverse.`; // defensive
    if (found.where === 'confirmed list') {
      this.confirmed.remove((p) => p.pnr === pnr);
      this.log('LIST', `Node removed — booking of PNR ${pnr} reversed`);
      // keep the system invariant: a free berth is offered to the waiting queue
      const promoted = this._promoteFront(`undo of PNR ${pnr}'s booking`);
      this.log('STACK', 'POP BOOK action');
      return `Undo: booking of PNR ${pnr} (${name}) reversed` +
        (promoted ? ` — PNR ${promoted.pnr} promoted to keep berths full.` : '.');
    }
    this.waiting.remove((p) => p.pnr === pnr);
    this.log('QUEUE', `Node removed from waiting queue — PNR ${pnr}`);
    this.log('STACK', 'POP BOOK action');
    return `Undo: waiting-list booking of PNR ${pnr} (${name}) reversed.`;
  }

  _undoCancel(action) {
    const p = action.passenger;                // snapshot — rebuild a fresh record
    this.log('UNDO', 'Restoring reservation');
    this.log('UNDO', 'Updating linked structures');

    /* 1) If the cancellation had promoted someone, return that passenger to the
          FRONT of the waiting queue — the exact position they were dequeued from. */
    if (action.promoted) {
      const found = this._findByPnr(action.promoted.pnr);
      if (found && found.where === 'confirmed list') {
        const node = this.confirmed.remove((x) => x.pnr === action.promoted.pnr);
        if (node) {
          node.data.status = 0;
          this.waiting.insertAt(0, node);
          this.log('QUEUE', `PNR ${action.promoted.pnr} returned to FRONT of waiting queue`);
          this._activity('PROMOTION', `PNR ${action.promoted.pnr} — CONFIRMED → WAITING (undo reversal)`, action.promoted.pnr);
        }
      }
    }

    /* 2) Re-insert the cancelled passenger. */
    const restored = { ...p };
    if (restored.status === 1) {
      if (this.confirmed.size < this.totalSeats) {
        this.confirmed.insertTail(new ListNode(restored));
        this.log('LIST', `Node re-inserted at TAIL — PNR ${restored.pnr} → CONFIRMED`);
      } else {
        restored.status = 0;
        this.waiting.insertAt(0, new ListNode(restored));
        this.log('QUEUE', `No free berth — PNR ${restored.pnr} restored to FRONT of waiting queue`);
      }
    } else {
      const pos = Math.min(action.queuePosition ?? 0, this.waiting.size);
      this.waiting.insertAt(pos, new ListNode(restored));
      this.log('QUEUE', `Node re-inserted at waiting position ${pos + 1} — PNR ${restored.pnr}`);
    }
    this.log('STACK', 'POP CANCEL action');
    return `Undo: cancellation of PNR ${restored.pnr} (${restored.name}) reversed — status ` +
      (restored.status === 1 ? 'CONFIRMED.' : 'WAITING.');
  }

  /* ===================== SEARCH (linear) ===================== */

  search(type, value) {
    this.log('SEARCH', 'Algorithm: Linear Search (sequential traversal — linked structures have no random access)');
    let r;
    if (type === 'pnr') {
      const pnr = Number(value);
      if (!Number.isInteger(pnr)) throw new ValidationError('PNR must be a number, e.g. 1001.');
      this.log('SEARCH', `Target PNR: ${pnr}`);
      r = this._runSearch((d) => d.pnr === pnr, (d) => `P${d.pnr}`);
    } else if (type === 'name') {
      const name = String(value == null ? '' : value).trim();
      if (!name) throw new ValidationError('Enter a passenger name to search for.');
      const target = name.toLowerCase();
      this.log('SEARCH', `Target name: "${name}" (case-insensitive exact match)`);
      r = this._runSearch((d) => d.name.toLowerCase() === target, (d) => d.name);
    } else {
      throw new ValidationError("Search type must be 'pnr' or 'name'.");
    }

    if (r.found) {
      this.log('SEARCH', `Match found in the ${r.container} (node #${r.index + 1}, ${r.trail.length} node(s) visited)`);
      const status = r.data.status === 1 ? 'CONFIRMED' : 'WAITING';
      const position = r.container === 'waiting queue' ? r.index + 1 : null;
      this.log('RESULT', `Status: ${status}${position ? ` — waiting position ${position}` : ''}`);
      return {
        found: true, passenger: clone(r.data), where: r.container,
        waitingPosition: position, trail: r.trail, nodesVisited: r.trail.length
      };
    }
    this.log('SEARCH', 'Reached the end of both structures — not found');
    this.log('RESULT', 'Status: NOT FOUND');
    return { found: false, passenger: null, where: null, waitingPosition: null, trail: r.trail, nodesVisited: r.trail.length };
  }

  _runSearch(match, label) {
    return linearSearch(
      [
        { name: 'confirmed list', start: this.confirmed.head },
        { name: 'waiting queue', start: this.waiting.front }
      ],
      match, label
    );
  }

  _findByPnr(pnr) {
    const r = this._runSearch((d) => d.pnr === pnr, (d) => `P${d.pnr}`);
    return r.found ? { where: r.container, data: r.data, index: r.index } : null;
  }

  /* ===================== SORT (insertion, in-place) ===================== */

  sortConfirmed(key = 'pnr') {
    const KEYS = {
      pnr:         { fn: (d) => d.pnr, label: 'PNR' },
      bookingTime: { fn: (d) => d.bookingTime, label: 'booking time' },
      name:        { fn: (d) => d.name.toLowerCase(), label: 'passenger name' }
    };
    const k = KEYS[key];
    if (!k) throw new ValidationError("Sort key must be 'pnr', 'bookingTime' or 'name'.");

    const before = this.confirmed.toArray();
    this.log('SORT', 'Algorithm: Insertion Sort (linked-list node relinking)');
    this.log('SORT', `Criterion: ${k.label}`);
    this.log('SORT', `Sorting confirmed reservation list (${before.length} nodes)`);
    const stats = insertionSortList(this.confirmed, k.fn);
    const after = this.confirmed.toArray();
    this.log('SORT', `Sorting completed — ${stats.comparisons} key comparisons, ${after.length} nodes relinked in place`);
    this.log('RESULT', 'Ordered records ready');
    this._activity('SORT', `Confirmed list sorted by ${k.label} (Insertion Sort)`);
    return { key, keyLabel: k.label, before, after, comparisons: stats.comparisons };
  }

  /* ===================== UPDATE ===================== */

  update(pnr, { age, gender } = {}) {
    pnr = Number(pnr);
    if (!Number.isInteger(pnr)) throw new ValidationError('A valid numeric PNR is required (e.g. 1001).');
    const found = this._findByPnr(pnr);
    if (!found) throw new NotFoundError(`PNR ${pnr} was not found.`);
    const p = found.data;
    const changed = [];

    if (age !== undefined && age !== null && age !== '') {
      const a = Number(age);
      if (!Number.isInteger(a) || a < 1 || a > 120) throw new ValidationError('Age must be a whole number between 1 and 120.');
      p.age = a; changed.push(`age → ${a}`);
    }
    if (gender !== undefined && gender !== null && gender !== '') {
      const g = String(gender).toUpperCase();
      if (!['M', 'F', 'O'].includes(g)) throw new ValidationError("Gender must be 'M', 'F' or 'O'.");
      p.gender = g; changed.push(`gender → ${g}`);
    }
    if (!changed.length) throw new ValidationError('Nothing to update — provide age and/or gender.');

    this.log('UPDATE', `PNR ${pnr} (${p.name}) — ${changed.join(', ')}`);
    this._activity('UPDATE', `PNR ${pnr} (${p.name}) — ${changed.join(', ')}`, pnr);
    return { passenger: clone(p), where: found.where };
  }

  /* ===================== state / demo ===================== */

  availability() {
    return {
      trainNo: this.trainNo,
      totalSeats: this.totalSeats,
      confirmed: this.confirmed.size,
      available: Math.max(0, this.totalSeats - this.confirmed.size),
      waiting: this.waiting.size,
      maxWaiting: this.maxWaiting
    };
  }

  snapshot() {
    const acts = this.activity.toArray();
    const rev = [...acts].reverse();
    return {
      trainNo: this.trainNo,
      totalSeats: this.totalSeats,
      maxWaiting: this.maxWaiting,
      confirmedCount: this.confirmed.size,
      waitingCount: this.waiting.size,
      availableSeats: Math.max(0, this.totalSeats - this.confirmed.size),
      totalReservations: this.confirmed.size + this.waiting.size,
      historySize: this.history.size,
      bookingClock: this.bookingClock,
      uptimeSec: Math.floor((Date.now() - this.startedAt) / 1000),
      confirmed: this.confirmed.toArray(),   // head → tail
      waiting: this.waiting.toArray(),       // front → rear
      stack: this.history.toArray(),         // top → bottom (LIFO order)
      activity: rev,                         // newest-first timeline
      lastBooking: rev.find((a) => a.type === 'BOOK') || null,
      lastCancellation: rev.find((a) => a.type === 'CANCEL') || null
    };
  }

  reset() {
    this._init();
    this.log('SYS', 'All structures re-initialised (confirmed list, waiting queue, action stack)');
    this._activity('SYSTEM', 'System reset — all reservations cleared');
    return this.snapshot();
  }

  /** One-click viva demo: fills the coach and queues three waiting passengers. */
  loadDemo() {
    this.reset();
    this.log('DEMO', 'Loading demonstration scenario (5 confirmed + 3 waiting passengers)');
    const people = [
      ['Ramesh Kumar', 34, 'M'], ['Suriya Prakash', 29, 'M'], ['Meena Loganathan', 41, 'F'],
      ['Arjun Verma', 23, 'M'], ['Divya Sri', 20, 'F'],           // fills all 5 berths
      ['Karthik Raj', 22, 'M'], ['Nandhini R', 21, 'F'], ['Yuvaraj B', 24, 'M']  // WL #1..#3
    ];
    for (const [name, age, gender] of people) this.book({ name, age, gender, trainNo: this.trainNo });
    this.log('DEMO', 'Demo data ready — cancel PNR 1001 to watch FIFO promotion, then undo it');
    return this.snapshot();
  }
}

module.exports = { ReservationSystem, ValidationError, NotFoundError, AppError };
```

---

#### `tests/run-tests.js`

```js
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
```

---

#### `frontend/index.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="theme-color" content="#132a5e">
  <title>TRWL · Train Reservation Waiting List System</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <noscript><div style="padding:20px;font-family:sans-serif">This application needs JavaScript enabled.</div></noscript>

  <div class="app">
    <!-- ================= SIDEBAR ================= -->
    <aside class="sidebar" id="sidebar">
      <div class="brand">
        <span class="brand-mark">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="13" rx="3"/><path d="M5 10h14M9 20l-2-4M15 20l2-4"/><circle cx="9.5" cy="6.5" r="1" fill="currentColor" stroke="none"/><circle cx="14.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>
        </span>
        <div class="brand-text">
          <strong>TRWL</strong>
          <span>Reservation Control</span>
        </div>
      </div>

      <nav class="nav" aria-label="Main navigation">
        <button class="nav-item active" data-view="dashboard" type="button">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/></svg>
          Dashboard
        </button>
        <button class="nav-item" data-view="book" type="button">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><path d="M12 15h5"/></svg>
          Book Reservation
        </button>
        <button class="nav-item" data-view="confirmed" type="button">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 5.5l1 1 2-2M4 11.5l1 1 2-2M4 17.5l1 1 2-2"/></svg>
          Confirmed
        </button>
        <button class="nav-item" data-view="waiting" type="button">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="9" width="5" height="6" rx="1"/><rect x="10" y="9" width="5" height="6" rx="1"/><rect x="17" y="9" width="4" height="6" rx="1"/></svg>
          Waiting Queue
        </button>
        <button class="nav-item" data-view="search" type="button">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M20.5 20.5L16 16"/></svg>
          Search
        </button>
        <button class="nav-item" data-view="sort" type="button">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 5v14"/><path d="M5 16l3 3 3-3"/><path d="M16 19V5"/><path d="M13 8l3-3 3 3"/></svg>
          Sort
        </button>
        <button class="nav-item" data-view="history" type="button">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/></svg>
          Action History
        </button>
        <button class="nav-item" data-view="ds" type="button">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="7" height="7" rx="1.5"/><rect x="14" y="4" width="7" height="7" rx="1.5"/><path d="M10 7.5h4"/><rect x="8" y="14" width="7" height="7" rx="1.5"/></svg>
          Data Structures
        </button>
        <button class="nav-item" data-view="system" type="button">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.2v.1"/></svg>
          System
        </button>
      </nav>

      <div class="sidebar-foot">
        <span class="conn"><i class="dot" id="connDot"></i><span id="connText">Connecting…</span></span>
        <span class="ver">v1.0 · Data Structures PBL</span>
      </div>
    </aside>

    <!-- ================= MAIN ================= -->
    <main class="main">
      <header class="topbar">
        <button class="hamburger" id="hamburger" aria-label="Toggle navigation">☰</button>
        <div class="topbar-title">
          <h1 id="viewTitle">Dashboard</h1>
          <p id="viewSubtitle">Live overview of berths, queue and activity</p>
        </div>
        <div class="topbar-pills">
          <span class="pill">Train <b id="pillTrain">—</b></span>
          <span class="pill">Berths <b id="pillSeats">—</b></span>
          <span class="pill">Waiting <b id="pillWaiting">—</b></span>
        </div>
      </header>

      <div class="content">

        <!-- ========== DASHBOARD ========== -->
        <section class="view active" id="view-dashboard">
          <div class="stat-grid" id="statGrid"></div>

          <div class="grid-2">
            <div class="card">
              <div class="card-head"><h2>Berth Occupancy</h2><span class="chip" id="occChip">—</span></div>
              <div class="seat-gauge" id="seatGauge"></div>
              <p class="hint">A berth freed by a cancellation is offered immediately to the longest-waiting passenger (strict FIFO).</p>
            </div>
            <div class="card">
              <div class="card-head"><h2>Train Information</h2></div>
              <dl class="kv" id="trainInfo"></dl>
            </div>
          </div>

          <div class="grid-2">
            <div class="card">
              <div class="card-head"><h2>Confirmed Reservations</h2><button class="link" data-goto="confirmed" type="button">View all →</button></div>
              <div class="table-wrap" id="dashConfirmed"></div>
            </div>
            <div class="card">
              <div class="card-head"><h2>Waiting Queue (FIFO)</h2><button class="link" data-goto="waiting" type="button">View all →</button></div>
              <div class="queue-mini" id="dashQueue"></div>
            </div>
          </div>

          <div class="card">
            <div class="card-head"><h2>Recent Activity</h2><button class="link" data-goto="history" type="button">Full timeline →</button></div>
            <ul class="timeline" id="dashActivity"></ul>
          </div>
        </section>

        <!-- ========== BOOK ========== -->
        <section class="view" id="view-book">
          <div class="grid-2">
            <form class="card form" id="bookForm">
              <div class="card-head"><h2>Book Reservation</h2><span class="chip">auto PNR · auto status</span></div>
              <label for="bName">Passenger name
                <input id="bName" maxlength="49" placeholder="e.g. Ramesh Kumar" autocomplete="off" required>
              </label>
              <div class="form-row">
                <label for="bAge">Age
                  <input id="bAge" type="number" min="1" max="120" placeholder="34" required>
                </label>
                <label for="bGender">Gender
                  <select id="bGender" required>
                    <option value="" selected disabled>Select…</option>
                    <option value="M">M</option>
                    <option value="F">F</option>
                    <option value="O">O</option>
                  </select>
                </label>
              </div>
              <label for="bTrain">Train number
                <input id="bTrain" type="number" min="1" value="12658" required>
              </label>
              <p class="hint">PNRs are generated automatically (1001, 1002, …). If every berth is taken you will be placed on the FIFO waiting list and promoted automatically when a berth frees.</p>
              <button class="btn btn-primary" id="bookBtn" type="submit">Book Reservation</button>
            </form>
            <div class="card">
              <div class="card-head"><h2>Booking Result</h2></div>
              <div id="bookResult">
                <div class="empty"><div class="empty-icon">✦</div><p>Submit the form to book a passenger.<br>The backend decides CONFIRMED vs WAITING based on live berth availability.</p></div>
              </div>
            </div>
          </div>
        </section>

        <!-- ========== CONFIRMED ========== -->
        <section class="view" id="view-confirmed">
          <div class="card">
            <div class="card-head"><h2>Confirmed Reservations</h2><span class="chip" id="confCount">—</span></div>
            <p class="hint">Singly linked list — the newest booking is appended at the tail in O(1). Use “Sort” to order this list by PNR, booking time or name.</p>
            <div class="table-wrap" id="confirmedTable"></div>
          </div>
        </section>

        <!-- ========== WAITING ========== -->
        <section class="view" id="view-waiting">
          <div class="card">
            <div class="card-head"><h2>Waiting List — Linked Queue (FIFO)</h2><span class="chip" id="waitCount">—</span></div>
            <p class="hint">Passengers leave from the <b>FRONT</b> when a berth frees; new passengers join at the <b>REAR</b>. Position #1 is always promoted first.</p>
            <div class="queue-visual" id="queueVisual"></div>
          </div>
        </section>

        <!-- ========== SEARCH ========== -->
        <section class="view" id="view-search">
          <div class="card">
            <div class="card-head"><h2>Search Reservations</h2><span class="chip">Linear Search · O(n)</span></div>
            <div class="seg" id="searchSeg">
              <button class="seg-btn active" data-mode="pnr" type="button">By PNR</button>
              <button class="seg-btn" data-mode="name" type="button">By Name</button>
            </div>
            <form class="search-form" id="searchForm">
              <input id="searchInput" placeholder="e.g. 1006" autocomplete="off" required aria-label="Search value">
              <button class="btn btn-primary" type="submit">Search</button>
            </form>
            <div id="searchResult"></div>
            <div id="searchTrail"></div>
          </div>
        </section>

        <!-- ========== SORT ========== -->
        <section class="view" id="view-sort">
          <div class="card">
            <div class="card-head"><h2>Sort Confirmed Reservations</h2><span class="chip">Insertion Sort · relinks nodes in place</span></div>
            <div class="form-row">
              <label for="sortKey">Sort by
                <select id="sortKey">
                  <option value="pnr">PNR</option>
                  <option value="bookingTime">Booking time</option>
                  <option value="name">Passenger name</option>
                </select>
              </label>
              <div class="sort-actions"><button class="btn btn-primary" id="sortBtn" type="button">Apply Insertion Sort</button></div>
            </div>
            <p class="hint" id="sortStats">The list is relinked node-by-node into a sorted chain — no array copy, O(1) extra space. Nearly-sorted input (the natural order of bookings) runs close to O(n).</p>
            <div class="grid-2" id="sortCompare"></div>
          </div>
        </section>

        <!-- ========== HISTORY ========== -->
        <section class="view" id="view-history">
          <div class="card">
            <div class="card-head">
              <h2>Action History — Undo Stack (LIFO)</h2>
              <button class="btn btn-danger" id="undoBtn" type="button">Undo Last Action</button>
            </div>
            <p class="hint">The top of the stack is the next action to be undone. Undoing a cancellation restores the reservation and reverses any promotion it triggered.</p>
            <div class="stack-visual" id="stackVisual"></div>
          </div>
          <div class="card">
            <div class="card-head"><h2>Activity Timeline</h2></div>
            <ul class="timeline" id="activityFull"></ul>
          </div>
        </section>

        <!-- ========== DATA STRUCTURES ========== -->
        <section class="view" id="view-ds">
          <div class="card">
            <div class="card-head"><h2>Confirmed Reservations — Singly Linked List</h2><span class="chip">HEAD · TAIL · O(1) tail insert</span></div>
            <div class="ds-visual" id="dsList"></div>
            <p class="hint">Each node stores a passenger record and a <span class="mono">next</span> pointer. Bookings are appended at the tail; cancellations unlink head, middle or tail nodes.</p>
          </div>
          <div class="card">
            <div class="card-head"><h2>Waiting List — Linked Queue (FIFO)</h2><span class="chip">FRONT · REAR · O(1) enqueue/dequeue</span></div>
            <div class="ds-visual" id="dsQueue"></div>
            <p class="hint">Enqueue at the REAR, dequeue from the FRONT — the passenger who has waited the longest is promoted first.</p>
          </div>
          <div class="card">
            <div class="card-head"><h2>Action History — Linked Stack (LIFO)</h2><span class="chip">TOP · O(1) push/pop</span></div>
            <div class="ds-visual" id="dsStack"></div>
            <p class="hint">The most recent BOOK/CANCEL sits on the TOP and is the one undone first.</p>
          </div>
          <div class="card">
            <div class="card-head"><h2>Algorithms &amp; Complexity (actual implementation)</h2></div>
            <div class="table-wrap" id="complexityTable"></div>
          </div>
          <div class="grid-3" id="coCards"></div>
        </section>

        <!-- ========== SYSTEM ========== -->
        <section class="view" id="view-system">
          <div class="grid-2">
            <div class="card">
              <div class="card-head"><h2>Backend Status</h2><span class="chip" id="sysChip">—</span></div>
              <dl class="kv" id="sysStatus"></dl>
            </div>
            <div class="card">
              <div class="card-head"><h2>Configuration &amp; Demo</h2></div>
              <dl class="kv" id="sysConfig"></dl>
              <div class="btn-row">
                <button class="btn" id="demoBtn" type="button">Load Demo Scenario</button>
                <button class="btn btn-danger" id="resetBtn" type="button">Reset System</button>
              </div>
              <p class="hint">Demo: 5 confirmed passengers + 3 waiting. Cancel PNR 1001 and watch the front of the queue (PNR 1006) get promoted automatically — then undo it.</p>
            </div>
          </div>
          <div class="card">
            <div class="card-head"><h2>About This Project</h2></div>
            <p class="about">
              <b>Train Reservation Waiting List (TRWL)</b> is a Data Structures project-based-learning
              application. The backend genuinely implements a <b>singly linked list</b> (confirmed
              reservations), a <b>linked-list queue</b> (FIFO waiting list), a <b>linked-list stack</b>
              (action history &amp; undo), <b>linear search</b> and <b>insertion sort</b>. The frontend
              renders snapshots returned by the API — it never holds its own copy of the data.
            </p>
            <p class="about">Course: Data Structures · II Year / III Semester · KPR Institute of Engineering and Technology (Autonomous), Coimbatore.</p>
          </div>
        </section>

      </div>
    </main>
  </div>

  <!-- ================= TOASTS + MODAL ================= -->
  <div class="toasts" id="toasts" aria-live="polite"></div>

  <div class="modal-backdrop" id="modalBackdrop" hidden>
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
      <div class="modal-head">
        <h3 id="modalTitle"></h3>
        <button class="modal-x" id="modalClose" aria-label="Close dialog" type="button">×</button>
      </div>
      <div class="modal-body" id="modalBody"></div>
    </div>
  </div>

  <script src="js/app.js"></script>
</body>
</html>
```

---

#### `frontend/css/style.css`

```css
/* ============================================================
   TRWL — design system (light, railway-ops inspired)
   navy #132a5e · saffron #d96a1f · signal green / amber / red
   ============================================================ */

:root {
  --bg: #edf1f7;
  --surface: #ffffff;
  --surface-2: #f5f8fc;
  --ink: #0f1d33;
  --muted: #5a6b85;
  --faint: #93a1b8;
  --navy: #132a5e;
  --navy-2: #0c1c44;
  --accent: #d96a1f;
  --ok: #177a4d;      --ok-bg: #e2f4ea;    --ok-line: #b5e0c6;
  --warn: #8f6400;    --warn-bg: #fdf3d7;  --warn-line: #ecd9a0;
  --danger: #b3261e;  --danger-bg: #fdeceb;--danger-line: #f3c2be;
  --info: #1c5fae;    --info-bg: #e8f1fb;  --info-line: #bcd4ee;
  --line: #dde4ef;
  --radius: 12px;
  --shadow: 0 1px 2px rgba(15,29,51,.06), 0 6px 18px rgba(15,29,51,.07);
  --font: "Segoe UI", "Inter", system-ui, -apple-system, Roboto, "Helvetica Neue", Arial, sans-serif;
  --mono: "Cascadia Code", "JetBrains Mono", "SF Mono", Consolas, "Courier New", monospace;
}

* { box-sizing: border-box; }
body { margin: 0; font-family: var(--font); background: var(--bg); color: var(--ink); font-size: 14.5px; line-height: 1.5; }
button { font-family: inherit; }
:focus-visible { outline: 3px solid rgba(28,95,174,.35); outline-offset: 1px; }

/* ---------- layout ---------- */
.app { display: grid; grid-template-columns: 250px 1fr; min-height: 100vh; }
.main { min-width: 0; }
.content { padding: 22px 26px 44px; max-width: 1240px; }
.view { display: none; }
.view.active { display: block; animation: fadeIn .25s ease; }

/* ---------- sidebar ---------- */
.sidebar { display: flex; flex-direction: column; background: linear-gradient(180deg, #142c60, #0c1c44); color: #c7d3ea; padding: 18px 14px; position: sticky; top: 0; height: 100vh; }
.brand { display: flex; gap: 10px; align-items: center; padding: 6px 8px 16px; border-bottom: 1px solid rgba(255,255,255,.12); }
.brand-mark { width: 38px; height: 38px; border-radius: 10px; background: rgba(255,255,255,.12); display: flex; align-items: center; justify-content: center; color: #fff; flex: none; }
.brand-text strong { display: block; color: #fff; font-size: 15px; letter-spacing: .5px; }
.brand-text span { font-size: 11px; color: #9db0d4; }
.nav { display: flex; flex-direction: column; gap: 4px; margin-top: 14px; }
.nav-item { display: flex; gap: 10px; align-items: center; padding: 10px 12px; border: 0; background: transparent; color: #b9c7e4; font-size: 13.5px; font-weight: 600; border-radius: 9px; cursor: pointer; text-align: left; width: 100%; transition: background .15s, color .15s; }
.nav-item svg { flex: none; }
.nav-item:hover { background: rgba(255,255,255,.07); color: #fff; }
.nav-item.active { background: rgba(255,255,255,.13); color: #fff; box-shadow: inset 3px 0 0 0 var(--accent); }
.sidebar-foot { margin-top: auto; padding: 12px 8px 4px; display: flex; flex-direction: column; gap: 6px; font-size: 11.5px; color: #8fa3cc; }
.conn { display: flex; gap: 7px; align-items: center; }
.dot { width: 9px; height: 9px; border-radius: 50%; background: #f2b8b5; flex: none; }
.dot.ok { background: #63d297; box-shadow: 0 0 0 3px rgba(99,210,151,.22); }

/* ---------- topbar ---------- */
.topbar { position: sticky; top: 0; z-index: 20; display: flex; align-items: center; gap: 16px; padding: 14px 26px; background: rgba(255,255,255,.93); backdrop-filter: blur(8px); border-bottom: 1px solid var(--line); }
.topbar-title h1 { margin: 0; font-size: 18px; letter-spacing: -.2px; }
.topbar-title p { margin: 2px 0 0; font-size: 12.5px; color: var(--muted); }
.topbar-pills { margin-left: auto; display: flex; gap: 8px; }
.pill { background: var(--surface-2); border: 1px solid var(--line); padding: 6px 12px; border-radius: 999px; font-size: 12.5px; color: var(--muted); }
.pill b { color: var(--ink); font-family: var(--mono); }
.hamburger { display: none; border: 1px solid var(--line); background: #fff; width: 38px; height: 38px; border-radius: 9px; font-size: 17px; cursor: pointer; color: var(--ink); }

/* ---------- cards / grids ---------- */
.card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--shadow); padding: 18px 20px; margin-bottom: 16px; }
.card.inner { background: var(--surface-2); box-shadow: none; }
.card-head { display: flex; align-items: center; justify-content: space-between; gap: 10; margin-bottom: 14px; flex-wrap: wrap; }
.card-head h2 { margin: 0; font-size: 15px; letter-spacing: -.1px; }
.grid-2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(330px, 1fr)); gap: 16px; margin-bottom: 16px; }
.grid-3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; }

/* ---------- stats ---------- */
.stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin-bottom: 16px; }
.stat { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 14px 16px; box-shadow: var(--shadow); }
.stat-label { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: .6px; color: var(--muted); margin-bottom: 6px; }
.stat-value { display: block; font-size: 24px; font-weight: 700; letter-spacing: -.5px; font-family: var(--mono); }
.stat-value.ok { color: var(--ok); }
.stat-value.warn { color: var(--warn); }
.stat-sub { display: block; margin-top: 4px; font-size: 12px; color: var(--faint); }

/* ---------- berth gauge ---------- */
.seat-row { display: flex; gap: 6px; margin: 6px 0 12px; }
.berth { flex: 1; height: 26px; border-radius: 6px; background: #e7edf5; border: 1px solid var(--line); }
.berth.filled { background: linear-gradient(180deg, #2e5fae, #1c3f7c); border-color: #1c3f7c; }
.seat-legend { display: flex; gap: 16px; font-size: 12px; color: var(--muted); }
.seat-legend i { width: 10px; height: 10px; border-radius: 3px; display: inline-block; margin-right: 5px; vertical-align: -1px; background: #e7edf5; border: 1px solid var(--line); }
.seat-legend i.filled { background: #2e5fae; border-color: #1c3f7c; }

/* ---------- chips / badges / kv ---------- */
.chip { display: inline-flex; align-items: center; gap: 6px; background: var(--surface-2); border: 1px solid var(--line); border-radius: 999px; padding: 4px 11px; font-size: 11.5px; font-weight: 600; color: var(--muted); white-space: nowrap; }
.chip.ok { background: var(--ok-bg); color: var(--ok); border-color: var(--ok-line); }
.badge { display: inline-flex; align-items: center; gap: 6px; padding: 3px 9px; border-radius: 6px; font-size: 11px; font-weight: 700; letter-spacing: .4px; border: 1px solid transparent; }
.badge::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: currentColor; opacity: .7; }
.badge.ok { background: var(--ok-bg); color: var(--ok); border-color: var(--ok-line); }
.badge.warn { background: var(--warn-bg); color: var(--warn); border-color: var(--warn-line); }
.badge.danger { background: var(--danger-bg); color: var(--danger); border-color: var(--danger-line); }
.badge.muted { background: var(--surface-2); color: var(--muted); border-color: var(--line); }
.pos { display: inline-block; margin-left: 6px; font-size: 11px; font-weight: 700; color: var(--warn); background: var(--warn-bg); padding: 1px 7px; border-radius: 6px; border: 1px solid var(--warn-line); }
.mono { font-family: var(--mono); }
.kv { margin: 0; }
.kv-row { display: flex; justify-content: space-between; gap: 14px; padding: 7px 0; border-bottom: 1px dashed var(--line); font-size: 13px; }
.kv-row:last-child { border-bottom: 0; }
.kv-row dt { color: var(--muted); font-weight: 600; }
.kv-row dd { margin: 0; font-weight: 600; text-align: right; }
.hint { font-size: 12.5px; color: var(--muted); margin: 10px 0 0; line-height: 1.55; }
.link { border: 0; background: none; color: var(--info); font-size: 12.5px; font-weight: 700; cursor: pointer; padding: 0; font-family: inherit; }
.link:hover { text-decoration: underline; }
.mini-title { font-size: 12px; text-transform: uppercase; letter-spacing: .5px; color: var(--muted); margin: 14px 0 8px; }
.about { font-size: 13.5px; color: var(--muted); line-height: 1.65; margin: 8px 0; }

/* ---------- tables ---------- */
.table-wrap { overflow-x: auto; }
.tbl { width: 100%; border-collapse: collapse; font-size: 13.5px; }
.tbl th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .5px; color: var(--muted); padding: 8px 10px; border-bottom: 2px solid var(--line); white-space: nowrap; }
.tbl td { padding: 9px 10px; border-bottom: 1px solid #edf1f7; vertical-align: middle; }
.tbl tbody tr:hover { background: var(--surface-2); }
.tbl tbody tr:last-child td { border-bottom: 0; }
.td-actions, .th-actions { text-align: right; white-space: nowrap; }
tr.flash { animation: flashRow 1.6s ease; }

/* ---------- buttons ---------- */
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 10px 18px; border-radius: 9px; border: 1.5px solid var(--line); background: var(--surface-2); color: var(--ink); font-size: 13.5px; font-weight: 700; cursor: pointer; transition: all .15s; }
.btn:hover { border-color: #b9c3d6; background: #eef2f8; }
.btn:disabled { opacity: .55; cursor: progress; }
.btn-primary { background: var(--navy); border-color: var(--navy); color: #fff; }
.btn-primary:hover { background: var(--navy-2); border-color: var(--navy-2); }
.btn-danger { background: var(--danger-bg); border-color: var(--danger-line); color: var(--danger); }
.btn-danger:hover { background: var(--danger); border-color: var(--danger); color: #fff; }
.btn-row { display: flex; gap: 10px; margin-top: 14px; flex-wrap: wrap; }
.btn-mini { padding: 4px 10px; font-size: 12px; font-weight: 600; border-radius: 7px; border: 1px solid var(--line); background: #fff; color: var(--ink); cursor: pointer; margin-left: 6px; }
.btn-mini.danger { color: var(--danger); border-color: var(--danger-line); background: var(--danger-bg); }
.btn-mini:hover { border-color: var(--muted); }
.form .btn-primary { width: 100%; }
.sort-actions { display: flex; align-items: flex-end; }

/* ---------- forms ---------- */
.form label { display: flex; flex-direction: column; gap: 6px; font-size: 12.5px; font-weight: 700; margin-bottom: 12px; }
.form-row { display: flex; gap: 12px; align-items: end; }
.form-row > * { flex: 1; }
input, select { padding: 10px 12px; border: 1.5px solid var(--line); border-radius: 8px; font: inherit; background: #fff; color: var(--ink); width: 100%; }
input:focus, select:focus { border-color: var(--navy); box-shadow: 0 0 0 3px rgba(19,42,94,.12); outline: none; }
.search-form { display: flex; gap: 10px; margin: 12px 0; }
.search-form input { flex: 1; }
.seg { display: inline-flex; background: var(--surface-2); border: 1px solid var(--line); border-radius: 9px; padding: 3px; gap: 2px; }
.seg-btn { border: 0; background: transparent; padding: 7px 16px; border-radius: 7px; font-size: 13px; font-weight: 600; color: var(--muted); cursor: pointer; }
.seg-btn.active { background: #fff; color: var(--ink); box-shadow: 0 1px 3px rgba(15,29,51,.12); }

/* ---------- queue visualisation ---------- */
.queue-visual { display: flex; align-items: stretch; gap: 8px; overflow-x: auto; padding: 6px 2px 10px; }
.q-cap { flex: none; width: 54px; border-radius: 9px; background: var(--navy); color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 10px; font-weight: 800; letter-spacing: .5px; text-align: center; line-height: 1.4; padding: 4px; }
.q-cap.rear { background: var(--accent); }
.q-cap small { font-weight: 600; opacity: .8; letter-spacing: 0; font-size: 9px; }
.q-node { flex: none; width: 140px; background: var(--info-bg); border: 1.5px solid var(--info-line); border-radius: 10px; padding: 10px 12px; display: flex; flex-direction: column; gap: 4px; align-items: center; text-align: center; animation: pop .25s ease; }
.q-pos { font-size: 10.5px; font-weight: 700; color: var(--warn); background: var(--warn-bg); border: 1px solid var(--warn-line); padding: 1px 8px; border-radius: 999px; letter-spacing: .4px; }
.q-node b { font-family: var(--mono); font-size: 15px; }
.q-name { font-size: 13px; font-weight: 600; }
.q-meta { font-size: 11.5px; color: var(--muted); }
.queue-mini .q-chip { display: inline-flex; margin: 3px 4px 3px 0; padding: 5px 11px; border-radius: 999px; background: var(--info-bg); border: 1px solid var(--info-line); font-size: 12px; font-weight: 600; }
.q-chip.more { background: var(--surface-2); color: var(--muted); }

/* ---------- arrows / node diagrams ---------- */
.link-arrow { flex: none; align-self: center; width: 24px; min-width: 12px; height: 2px; background: #b7c3d8; position: relative; }
.link-arrow::after { content: ''; position: absolute; right: -1px; top: -3.5px; width: 7px; height: 7px; border-top: 2px solid #98a6bd; border-right: 2px solid #98a6bd; transform: rotate(45deg); }
.ds-visual { display: flex; align-items: center; gap: 6px; overflow-x: auto; padding: 8px 2px; }
.ptr-chip { flex: none; font-size: 10.5px; font-weight: 800; letter-spacing: .6px; color: #fff; background: var(--navy); padding: 6px 10px; border-radius: 7px; white-space: nowrap; }
.ptr-chip.null { background: var(--muted); }
.ptr-chip.small { font-size: 9px; padding: 4px 8px; }
.dsnode { flex: none; display: grid; grid-template-columns: 116px 40px; border: 1.5px solid var(--navy); border-radius: 8px; overflow: hidden; background: #fff; box-shadow: var(--shadow); }
.dsnode.q { border-color: var(--info); }
.dsnode .cell { padding: 7px 10px; display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.dsnode .cell b { font-family: var(--mono); font-size: 13.5px; }
.dsnode .ds-name { font-size: 11.5px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100px; }
.dsnode .next { border-left: 1.5px dashed var(--line); display: flex; align-items: center; justify-content: center; font-size: 9.5px; color: var(--faint); background: var(--surface-2); }

/* ---------- stack visualisation ---------- */
.stack-visual { max-width: 580px; }
.stack-top-label, .stack-bottom-label { font-size: 11px; font-weight: 700; letter-spacing: .5px; color: var(--muted); text-transform: uppercase; margin: 2px 0; }
.stk-item { display: flex; justify-content: space-between; align-items: center; gap: 12px; border: 1px solid var(--line); border-left: 4px solid var(--muted); border-radius: 9px; padding: 10 14; padding: 10px 14px; margin: 6px 0; background: var(--surface-2); animation: fadeUp .25s ease; }
.stk-item.BOOK { border-left-color: var(--ok); }
.stk-item.CANCEL { border-left-color: var(--danger); }
.stk-item.top { outline: 2px solid var(--accent); background: #fffaf3; }
.stk-main { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.stk-name { font-weight: 600; }
.stk-side { text-align: right; display: flex; flex-direction: column; gap: 2px; }
.stk-detail { font-size: 12px; color: var(--muted); max-width: 330px; }
.stack-col { display: flex; flex-direction: column; gap: 6px; }
.stk-mini { display: flex; justify-content: space-between; align-items: center; gap: 10px; border: 1px solid var(--line); border-left: 3px solid var(--muted); border-radius: 8px; padding: 7px 12px; background: #fff; font-size: 12.5px; }
.stk-mini.BOOK { border-left-color: var(--ok); }
.stk-mini.CANCEL { border-left-color: var(--danger); }
.stk-mini b { font-size: 10.5px; letter-spacing: .5px; }

/* ---------- timeline ---------- */
.timeline { list-style: none; margin: 0; padding: 0; }
.tl-item { display: flex; gap: 12px; padding: 10px 2px; border-bottom: 1px dashed var(--line); animation: fadeUp .25s ease; }
.tl-item:last-child { border-bottom: 0; }
.tl-badge { flex: none; width: 48px; height: 34px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 9.5px; font-weight: 800; letter-spacing: .4px; }
.tl-badge.ok { background: var(--ok-bg); color: var(--ok); }
.tl-badge.danger { background: var(--danger-bg); color: var(--danger); }
.tl-badge.info { background: var(--info-bg); color: var(--info); }
.tl-badge.warn { background: var(--warn-bg); color: var(--warn); }
.tl-badge.muted { background: var(--surface-2); color: var(--muted); }
.tl-body p { margin: 0; font-size: 13px; }
.tl-time { font-size: 11.5px; color: var(--faint); }
.tl-empty { color: var(--muted); font-size: 13px; padding: 6px 0; }

/* ---------- search traversal / sort chains ---------- */
.trail-wrap { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; padding: 6px 0; }
.trail-chip { font-family: var(--mono); font-size: 12.5px; font-weight: 600; padding: 5px 10px; border-radius: 7px; background: var(--surface-2); border: 1px solid var(--line); }
.trail-chip.wq { background: var(--info-bg); border-color: var(--info-line); }
.trail-chip.match { background: var(--ok); border-color: var(--ok); color: #fff; }

/* ---------- results / empty / processing ---------- */
.result { border: 1px solid var(--line); border-top: 4px solid var(--muted); border-radius: var(--radius); padding: 22px; text-align: center; animation: fadeUp .3s ease; }
.result h3 { margin: 8px 0 4px; font-size: 17px; }
.result.ok { border-top-color: var(--ok); background: linear-gradient(180deg, #f4fbf7, #fff); }
.result.wait { border-top-color: #d9a514; background: linear-gradient(180deg, #fffaf0, #fff); }
.result.err { border-top-color: var(--danger); }
.result.none { border-top-color: var(--faint); }
.result-icon { width: 46px; height: 46px; margin: 0 auto; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 800; }
.result.ok .result-icon { background: var(--ok-bg); color: var(--ok); }
.result.wait .result-icon { background: var(--warn-bg); color: #b78900; }
.pnr-big { font-family: var(--mono); font-size: 26px; font-weight: 800; color: var(--navy); margin: 6px 0 12px; letter-spacing: 1px; }
.result .kv { text-align: left; margin: 0 auto; max-width: 380px; }
.empty { border: 1.5px dashed var(--line); border-radius: 10px; padding: 26px 16px; text-align: center; color: var(--muted); font-size: 13px; background: var(--surface-2); }
.empty-icon { font-size: 20px; margin-bottom: 6px; color: var(--faint); }
.processing { text-align: center; color: var(--muted); padding: 30px 0; }
.processing .spin { margin-bottom: 10px; }
.spin { width: 15px; height: 15px; border-radius: 50%; border: 2px solid rgba(255,255,255,.35); border-top-color: #fff; animation: spin .7s linear infinite; display: inline-block; }
.spin.dark { border-color: rgba(19,42,94,.25); border-top-color: var(--navy); }

/* ---------- CO cards ---------- */
.co-code { display: inline-block; background: var(--accent); color: #fff; font-size: 11px; font-weight: 800; letter-spacing: .5px; padding: 3px 10px; border-radius: 999px; margin-bottom: 10px; }
.co-card h3 { margin: 0 0 8px; font-size: 15px; }
.co-card p { font-size: 13px; color: var(--muted); line-height: 1.6; margin: 0 0 8px; }
.co-ops { font-size: 12.5px; }

/* ---------- modal ---------- */
.modal-backdrop { position: fixed; inset: 0; background: rgba(10,18,38,.5); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 18px; }
.modal-backdrop[hidden] { display: none; }
.modal { background: #fff; border-radius: 14px; width: min(540px, 94vw); max-height: 88vh; overflow: auto; box-shadow: 0 24px 60px rgba(10,18,38,.3); animation: pop .22s ease; }
.modal-head { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--line); position: sticky; top: 0; background: #fff; }
.modal-head h3 { margin: 0; font-size: 15.5px; }
.modal-x { border: 0; background: transparent; font-size: 20px; cursor: pointer; color: var(--muted); padding: 4px 8px; border-radius: 6px; }
.modal-x:hover { background: var(--surface-2); color: var(--ink); }
.modal-body { padding: 18px 20px; }
.modal-form { border-top: 1px solid var(--line); margin-top: 16px; padding-top: 14px; }
.modal-form h4 { margin: 0 0 10px; font-size: 12px; text-transform: uppercase; letter-spacing: .5px; color: var(--muted); }
.confirm-body p { margin: 0 0 4px; line-height: 1.65; }

/* ---------- toasts ---------- */
.toasts { position: fixed; top: 16px; right: 16px; z-index: 200; display: flex; flex-direction: column; gap: 10px; width: min(340px, calc(100vw - 32px)); }
.toast { background: #101d3a; color: #fff; border-radius: 11px; border-left: 4px solid var(--info); box-shadow: 0 10px 30px rgba(10,18,38,.35); padding: 12px 16px; animation: slideIn .25s ease; transition: opacity .3s, transform .3s; }
.toast strong { display: block; font-size: 13.5px; }
.toast span { display: block; font-size: 12.5px; color: #b9c7e4; margin-top: 3px; }
.toast.success { border-left-color: #2ec27e; }
.toast.error { border-left-color: #ff7b72; }
.toast.info { border-left-color: var(--accent); }
.toast.out { opacity: 0; transform: translateX(12px); }

/* ---------- animations ---------- */
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes fadeIn { from { opacity: 0; } }
@keyframes fadeUp { from { opacity: 0; transform: translateY(7px); } }
@keyframes pop { from { opacity: 0; transform: scale(.96); } }
@keyframes slideIn { from { opacity: 0; transform: translateY(-8px); } }
@keyframes flashRow { 0%, 100% { background: transparent; } 20%, 60% { background: #fff1c9; } }

/* ---------- responsive ---------- */
@media (max-width: 960px) {
  .app { grid-template-columns: 1fr; }
  .sidebar { position: fixed; left: 0; top: 0; bottom: 0; width: 248px; z-index: 60; transform: translateX(-102%); transition: transform .25s ease; }
  .sidebar.open { transform: none; box-shadow: 0 0 40px rgba(10,18,38,.35); }
  .hamburger { display: inline-flex; }
  .topbar { padding: 12px 16px; }
  .topbar-pills { display: none; }
  .content { padding: 16px 14px 36px; }
  .form-row { flex-direction: column; align-items: stretch; }
  .queue-visual { padding-bottom: 14px; }
}
```

---

#### `frontend/js/app.js`

```js
'use strict';

/* ============================================================
   TRWL frontend — talks to the backend API only.
   The backend owns the linked list, queue and stack; this UI
   renders snapshots from /api/state after every action.
   ============================================================ */

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? '' : s)
  .replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const API = {
  async request(path, method = 'GET', body = null) {
    const opts = { method, headers: {} };
    if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    const res = await fetch(path, opts);
    let data = null;
    try { data = await res.json(); } catch { /* non-JSON */ }
    if (!res.ok || (data && data.ok === false)) {
      throw new Error((data && data.error) || `Request failed (${res.status})`);
    }
    return data;
  },
  get(path) { return this.request(path); },
  post(path, body) { return this.request(path, 'POST', body || {}); }
};

let state = null;
let wasConnected = false;
let searchMode = 'pnr';

const VIEWS = {
  dashboard: ['Dashboard', 'Live overview of berths, queue and activity'],
  book: ['Book Reservation', 'Add a passenger — CONFIRMED or WAITING decided automatically'],
  confirmed: ['Confirmed Reservations', 'Singly linked list of berth holders'],
  waiting: ['Waiting Queue', 'FIFO linked queue — the front is promoted first'],
  search: ['Search', 'Linear search by PNR or passenger name'],
  sort: ['Sort', 'Insertion sort on the confirmed linked list'],
  history: ['Action History & Undo', 'LIFO stack of booking / cancellation actions'],
  ds: ['Data Structures', 'Live visualisation of list, queue and stack'],
  system: ['System', 'Backend status, configuration and demo controls']
};

/* ============================ boot ============================ */

document.addEventListener('DOMContentLoaded', () => {
  bindNavigation();
  bindActions();
  renderStaticDS();
  refresh();
  setInterval(() => { if (!document.hidden) refresh(); }, 8000);
});

async function refresh() {
  try {
    const data = await API.get('/api/state');
    state = data.state;
    wasConnected = true;
    setConnection(true);
    renderAll();
  } catch (e) {
    setConnection(false);
    if (wasConnected) { toast('error', 'Backend unreachable', 'Retrying automatically…'); wasConnected = false; }
  }
}

function setConnection(ok) {
  $('connDot').classList.toggle('ok', ok);
  $('connText').textContent = ok ? 'Backend connected' : 'Backend offline';
}

function renderAll() {
  if (!state) return;
  renderPills();
  renderDashboard();
  renderConfirmed();
  renderWaiting();
  renderStackAndActivity();
  renderDataStructures();
  renderSystem();
}

/* ============================ navigation ============================ */

function bindNavigation() {
  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      switchView(btn.dataset.view);
      $('sidebar').classList.remove('open');
    });
  });
  document.querySelectorAll('[data-goto]').forEach((b) =>
    b.addEventListener('click', () => switchView(b.dataset.goto)));
  $('hamburger').addEventListener('click', () => $('sidebar').classList.toggle('open'));
}

function switchView(name) {
  document.querySelectorAll('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + name));
  const [t, s] = VIEWS[name] || ['—', ''];
  $('viewTitle').textContent = t;
  $('viewSubtitle').textContent = s;
}

/* ============================ actions ============================ */

function bindActions() {
  $('bookForm').addEventListener('submit', onBook);
  $('searchForm').addEventListener('submit', onSearch);
  $('searchSeg').querySelectorAll('.seg-btn').forEach((b) => {
    b.addEventListener('click', () => {
      $('searchSeg').querySelectorAll('.seg-btn').forEach((x) => x.classList.toggle('active', x === b));
      searchMode = b.dataset.mode;
      $('searchInput').placeholder = searchMode === 'pnr' ? 'e.g. 1006' : 'e.g. Meena Loganathan';
    });
  });
  $('sortBtn').addEventListener('click', onSort);
  $('undoBtn').addEventListener('click', onUndo);
  $('demoBtn').addEventListener('click', async () => {
    try {
      await API.post('/api/demo');
      toast('success', 'Demo scenario loaded', '5 confirmed + 3 waiting. Cancel PNR 1001 to watch FIFO promotion.');
      await refresh();
    } catch (e) { toast('error', 'Failed', e.message); }
  });
  $('resetBtn').addEventListener('click', () =>
    confirmDialog('Reset system', 'This clears every reservation, the waiting queue and the undo stack. Continue?', async () => {
      try { await API.post('/api/reset'); toast('info', 'System reset', 'All structures re-initialised.'); await refresh(); }
      catch (e) { toast('error', 'Reset failed', e.message); }
    }));
  $('confirmedTable').addEventListener('click', handleRowActions);
  $('queueVisual').addEventListener('click', handleRowActions);
  $('modalClose').addEventListener('click', closeModal);
  $('modalBackdrop').addEventListener('click', (e) => { if (e.target === $('modalBackdrop')) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
}

function handleRowActions(e) {
  const btn = e.target.closest('button');
  if (!btn) return;
  if (btn.dataset.viewPnr) openDetail(Number(btn.dataset.viewPnr));
  if (btn.dataset.cancelPnr) confirmCancel(Number(btn.dataset.cancelPnr));
}

/* ============================ booking ============================ */

let bookBusy = false;

async function onBook(e) {
  e.preventDefault();
  if (bookBusy) return;
  bookBusy = true;
  const btn = $('bookBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span> Processing…';
  $('bookResult').innerHTML = '<div class="processing"><span class="spin dark"></span><p>Checking berth availability…</p></div>';
  try {
    const { result } = await API.post('/api/book', {
      name: $('bName').value, age: $('bAge').value,
      gender: $('bGender').value, trainNo: $('bTrain').value
    });
    await refresh();
    renderBookResult(result);
    toast(result.status === 'CONFIRMED' ? 'success' : 'info',
      result.status === 'CONFIRMED' ? 'Reservation confirmed' : 'Added to waiting list',
      `PNR ${result.passenger.pnr} — ${esc(result.passenger.name)}`);
    $('bookForm').reset();
    $('bTrain').value = state.trainNo;
  } catch (err) {
    $('bookResult').innerHTML = `<div class="result err"><h3>Booking failed</h3><p>${esc(err.message)}</p></div>`;
    toast('error', 'Booking failed', esc(err.message));
  } finally {
    bookBusy = false;
    btn.disabled = false;
    btn.textContent = 'Book Reservation';
  }
}

function renderBookResult(r) {
  const p = r.passenger;
  if (r.status === 'CONFIRMED') {
    $('bookResult').innerHTML = `
      <div class="result ok">
        <div class="result-icon">✓</div>
        <h3>Reservation Confirmed</h3>
        <div class="pnr-big">PNR ${p.pnr}</div>
        <dl class="kv">${kv([
          ['Passenger', esc(p.name)], ['Train', p.trainNo],
          ['Age / Gender', `${p.age} / ${p.gender}`],
          ['Status', badge('CONFIRMED')],
          ['Berths remaining', state.availableSeats]
        ])}</dl>
      </div>`;
  } else {
    $('bookResult').innerHTML = `
      <div class="result wait">
        <div class="result-icon">⏳</div>
        <h3>Added to Waiting List</h3>
        <div class="pnr-big">PNR ${p.pnr}</div>
        <dl class="kv">${kv([
          ['Passenger', esc(p.name)],
          ['Waiting position', `WL #${r.position} of ${state.waitingCount}`],
          ['Confirmed berths', `${state.confirmedCount} of ${state.totalSeats}`],
          ['Status', badge('WAITING')]
        ])}</dl>
        <p class="hint">You will be promoted automatically — in strict FIFO order — as soon as a berth is freed by a cancellation.</p>
      </div>`;
  }
}

/* ============================ cancel / undo ============================ */

function confirmCancel(pnr) {
  const p = findPassenger(pnr);
  confirmDialog('Cancel reservation',
    `Cancel PNR <b class="mono">${pnr}</b>${p ? ` — <b>${esc(p.name)}</b>` : ''}?<br>
     A freed berth will be offered to the longest-waiting passenger automatically.`,
    async () => {
      try {
        const { result } = await API.post('/api/cancel', { pnr });
        toast('success', 'Reservation cancelled', result.promoted
          ? `PNR ${result.promoted.pnr} (${esc(result.promoted.name)}) promoted to CONFIRMED.`
          : 'No waiting passengers to promote.');
        await refresh();
        if (result.promoted) flashRow(result.promoted.pnr);
      } catch (err) { toast('error', 'Cancellation failed', esc(err.message)); }
    });
}

async function onUndo() {
  try {
    const { result } = await API.post('/api/undo');
    toast('info', 'Action reversed', esc(result.message));
    await refresh();
  } catch (err) { toast('error', 'Undo failed', esc(err.message)); }
}

function flashRow(pnr) {
  const row = document.querySelector(`tr[data-pnr="${pnr}"]`);
  if (row) { row.classList.add('flash'); setTimeout(() => row.classList.remove('flash'), 1700); }
}

/* ============================ search ============================ */

async function onSearch(e) {
  e.preventDefault();
  const value = $('searchInput').value.trim();
  if (!value) return;
  $('searchResult').innerHTML = '<div class="processing"><span class="spin dark"></span><p>Running linear search…</p></div>';
  $('searchTrail').innerHTML = '';
  try {
    const { result } = await API.post('/api/search', { type: searchMode, value });
    if (result.found) {
      const p = result.passenger;
      $('searchResult').innerHTML = `<div class="result ok">
        <h3>Match found</h3>
        <dl class="kv">${kv([
          ['PNR', p.pnr], ['Passenger', esc(p.name)], ['Train', p.trainNo],
          ['Age / Gender', `${p.age} / ${p.gender}`],
          ['Found in', result.where === 'confirmed list' ? 'Confirmed linked list' : 'Waiting queue'],
          ['Status', badge(p.status === 1 ? 'CONFIRMED' : 'WAITING') +
            (result.waitingPosition ? ` <span class="pos">WL #${result.waitingPosition}</span>` : '')],
          ['Nodes visited', result.nodesVisited]
        ])}</dl></div>`;
    } else {
      $('searchResult').innerHTML = `<div class="result none"><h3>Not found</h3>
        <p>No reservation matches <b>${esc(value)}</b> in the confirmed list or the waiting queue.</p>
        <p class="hint">Linear search visited ${result.nodesVisited} node(s) before reaching the end of both structures.</p></div>`;
    }
    renderTrail(result);
  } catch (err) {
    $('searchResult').innerHTML = `<div class="result err"><h3>Search failed</h3><p>${esc(err.message)}</p></div>`;
  }
}

function renderTrail(result) {
  const trail = result.trail || [];
  const confCount = state ? state.confirmed.length : 0;
  if (!trail.length) {
    $('searchTrail').innerHTML = `<h3 class="mini-title">Traversal</h3>
      <div class="trail-wrap"><span class="ptr-chip">HEAD</span><span class="ptr-chip null">NULL</span></div>
      <p class="hint">Both structures were empty — zero nodes visited.</p>`;
    return;
  }
  let html = `<h3 class="mini-title">Linear-search traversal · ${result.nodesVisited} node(s) visited</h3>
    <div class="trail-wrap"><span class="ptr-chip">HEAD</span>`;
  trail.forEach((label, i) => {
    if (i === confCount && trail.length > confCount) {
      html += '<span class="ptr-chip null small">→ WAITING QUEUE</span>';
    }
    const isMatch = result.found && i === trail.length - 1;
    html += `<span class="trail-chip${isMatch ? ' match' : ''}${i >= confCount ? ' wq' : ''}">${isMatch ? '✔ ' : ''}${esc(label)}</span>`;
  });
  html += `<span class="ptr-chip null">${result.found ? 'MATCH' : 'NULL'}</span></div>`;
  $('searchTrail').innerHTML = html;
}

/* ============================ sort ============================ */

async function onSort() {
  const key = $('sortKey').value;
  const btn = $('sortBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span> Sorting…';
  try {
    const { result } = await API.post('/api/sort', { key });
    $('sortStats').textContent =
      `Insertion sort by ${result.keyLabel} — ${result.comparisons} key comparisons, ` +
      `${result.after.length} nodes relinked in place (O(1) extra space).`;
    $('sortCompare').innerHTML = `
      <div class="card inner"><h3 class="mini-title">Before</h3>${chipList(result.before, key)}</div>
      <div class="card inner"><h3 class="mini-title">After</h3>${chipList(result.after, key)}</div>`;
    await refresh();
    toast('success', 'Sort complete', `Confirmed list ordered by ${result.keyLabel}.`);
  } catch (err) {
    toast('error', 'Sort failed', esc(err.message));
  } finally {
    btn.disabled = false;
    btn.textContent = 'Apply Insertion Sort';
  }
}

function keyLabel(p, key) {
  if (key === 'name') return p.name;
  if (key === 'bookingTime') return '#' + p.bookingTime;
  return String(p.pnr);
}

function chipList(rows, key) {
  if (!rows.length) return '<div class="empty"><p>List is empty.</p></div>';
  return '<div class="trail-wrap">' +
    rows.map((p) => `<span class="trail-chip">${esc(keyLabel(p, key))}</span>`).join('<span class="link-arrow"></span>') +
    '</div>';
}

/* ============================ renderers ============================ */

function renderPills() {
  $('pillTrain').textContent = state.trainNo;
  $('pillSeats').textContent = `${state.confirmedCount}/${state.totalSeats}`;
  $('pillWaiting').textContent = state.waitingCount;
}

function renderDashboard() {
  const lb = state.lastBooking, lc = state.lastCancellation;
  $('statGrid').innerHTML = [
    statCard('Confirmed Berths', `${state.confirmedCount}`, `of ${state.totalSeats} total`, state.confirmedCount ? 'ok' : 'muted'),
    statCard('Available Berths', `${state.availableSeats}`, 'ready to allocate', 'muted'),
    statCard('Waiting Passengers', `${state.waitingCount}`, `FIFO queue · max ${state.maxWaiting}`, state.waitingCount ? 'warn' : 'muted'),
    statCard('Total Reservations', `${state.totalReservations}`, 'confirmed + waiting', 'muted'),
    statCard('Latest Booking', lb ? `<span class="mono">${lb.pnr}</span>` : '—', lb ? timeAgo(lb.at) : 'no bookings yet', 'muted'),
    statCard('Latest Cancellation', lc ? `<span class="mono">${lc.pnr}</span>` : '—', lc ? timeAgo(lc.at) : 'no cancellations yet', 'muted')
  ].join('');

  let segs = '';
  for (let i = 0; i < state.totalSeats; i++) segs += `<span class="berth${i < state.confirmedCount ? ' filled' : ''}"></span>`;
  $('seatGauge').innerHTML =
    `<div class="seat-row">${segs}</div>
     <div class="seat-legend"><span><i class="filled"></i>reserved</span><span><i></i>free</span></div>`;
  $('occChip').textContent = `${state.confirmedCount} of ${state.totalSeats} berths reserved`;

  $('trainInfo').innerHTML = kv([
    ['Train number', state.trainNo],
    ['Total berths', state.totalSeats],
    ['Waiting capacity', state.maxWaiting],
    ['Booking tokens issued', state.bookingClock],
    ['Actions on undo stack', state.historySize],
    ['System uptime', fmtDuration(state.uptimeSec)]
  ]);

  $('dashConfirmed').innerHTML = passengerTable(state.confirmed.slice(0, 5),
    { compact: true, emptyText: 'No confirmed reservations yet.' });

  $('dashQueue').innerHTML = state.waiting.length
    ? state.waiting.slice(0, 6).map((p, i) =>
        `<span class="q-chip">WL ${i + 1} · ${p.pnr} · ${esc(p.name)}</span>`).join('') +
      (state.waiting.length > 6 ? `<span class="q-chip more">+${state.waiting.length - 6} more</span>` : '')
    : '<div class="empty"><p>Waiting queue is empty.</p></div>';

  $('dashActivity').innerHTML = timeline(state.activity.slice(0, 6));
}

function renderConfirmed() {
  $('confirmedTable').innerHTML = passengerTable(state.confirmed,
    { emptyText: 'No confirmed reservations — book a passenger to fill the first berth.' });
  $('confCount').textContent = `${state.confirmedCount} of ${state.totalSeats} berths`;
}

function renderWaiting() {
  $('waitCount').textContent = `${state.waitingCount} waiting · max ${state.maxWaiting}`;
  const el = $('queueVisual');
  if (!state.waiting.length) {
    el.innerHTML = '<div class="empty"><div class="empty-icon">⌀</div><p>Waiting queue is empty — every waiting passenger has been promoted.</p></div>';
    return;
  }
  const nodes = state.waiting.map((p, i) => `
    <div class="q-node">
      <span class="q-pos">WL #${i + 1}</span>
      <b class="mono">${p.pnr}</b>
      <span class="q-name">${esc(p.name)}</span>
      <span class="q-meta">${p.age} · ${p.gender}</span>
      <div><button class="btn-mini" data-view-pnr="${p.pnr}" type="button">View</button>
      <button class="btn-mini danger" data-cancel-pnr="${p.pnr}" type="button">Cancel</button></div>
    </div>`).join('<span class="link-arrow"></span>');
  el.innerHTML =
    `<span class="q-cap">FRONT<small>dequeue</small></span>${nodes}<span class="q-cap rear">REAR<small>enqueue</small></span>`;
}

function renderStackAndActivity() {
  const stack = state.stack;
  $('stackVisual').innerHTML = !stack.length
    ? '<div class="empty"><p>Action stack is empty — nothing to undo.</p></div>'
    : '<div class="stack-top-label">TOP — most recent action (next to undo)</div>' +
      stack.map((a, i) => `
        <div class="stk-item ${a.type}${i === 0 ? ' top' : ''}">
          <div class="stk-main">
            <span class="badge ${a.type === 'BOOK' ? 'ok' : 'danger'}">${a.type}</span>
            <b class="mono">PNR ${a.passenger.pnr}</b>
            <span class="stk-name">${esc(a.passenger.name)}</span>
          </div>
          <div class="stk-side">
            <span class="stk-detail">${esc(a.detail || '')}${a.promoted ? ` · promoted PNR ${a.promoted.pnr}` : ''}</span>
            <span class="tl-time">${timeAgo(a.at)}</span>
          </div>
        </div>`).join('') +
      `<div class="stack-bottom-label">bottom of stack (${stack.length} action${stack.length > 1 ? 's' : ''})</div>`;
  $('activityFull').innerHTML = timeline(state.activity);
}

function renderDataStructures() {
  const conf = state.confirmed, wait = state.waiting, st = state.stack;
  $('dsList').innerHTML = conf.length
    ? '<span class="ptr-chip">HEAD</span>' +
      conf.map((p) => `<div class="dsnode"><div class="cell"><b class="mono">${p.pnr}</b><span class="ds-name">${esc(p.name)}</span></div><div class="next">next</div></div>`).join('<span class="link-arrow"></span>') +
      '<span class="ptr-chip null">TAIL → NULL</span>'
    : '<div class="empty"><p>HEAD → NULL (empty list)</p></div>';
  $('dsQueue').innerHTML = wait.length
    ? '<span class="ptr-chip">FRONT</span>' +
      wait.map((p) => `<div class="dsnode q"><div class="cell"><b class="mono">${p.pnr}</b><span class="ds-name">${esc(p.name)}</span></div><div class="next">next</div></div>`).join('<span class="link-arrow"></span>') +
      '<span class="ptr-chip">REAR</span>'
    : '<div class="empty"><p>FRONT = REAR = NULL (empty queue)</p></div>';
  $('dsStack').innerHTML = st.length
    ? '<span class="ptr-chip">TOP</span><div class="stack-col">' +
      st.map((a) => `<div class="stk-mini ${a.type}"><b>${a.type}</b><span class="mono">PNR ${a.passenger.pnr}</span></div>`).join('') +
      '</div><span class="ptr-chip null">BASE</span>'
    : '<div class="empty"><p>TOP → NULL (empty stack)</p></div>';
}

function renderSystem() {
  $('sysChip').textContent = 'CONNECTED';
  $('sysChip').className = 'chip ok';
  $('sysStatus').innerHTML = kv([
    ['Backend', 'CONNECTED — HTTP API responding'],
    ['Confirmed linked list', `ACTIVE — ${state.confirmedCount} node(s)`],
    ['Waiting queue', `ACTIVE — ${state.waitingCount} node(s)`],
    ['Action stack', `ACTIVE — ${state.historySize} action(s)`],
    ['Search module', 'READY — linear search'],
    ['Sort module', 'READY — insertion sort'],
    ['Uptime', fmtDuration(state.uptimeSec)]
  ]);
  $('sysConfig').innerHTML = kv([
    ['Train number', state.trainNo],
    ['Berth capacity', state.totalSeats],
    ['Waiting capacity', state.maxWaiting],
    ['PNRs generated', state.bookingClock]
  ]);
}

function renderStaticDS() {
  $('complexityTable').innerHTML = `
    <table class="tbl"><thead><tr><th>Operation</th><th>Data structure</th><th>Time</th><th>Space</th></tr></thead><tbody>
      <tr><td>Book (berth free)</td><td>Singly linked list — tail insert</td><td class="mono">O(1)</td><td class="mono">O(1)</td></tr>
      <tr><td>Book (waiting)</td><td>Linked queue — enqueue at rear</td><td class="mono">O(1)</td><td class="mono">O(1)</td></tr>
      <tr><td>Cancel + auto-promote</td><td>Linear search + unlink + dequeue</td><td class="mono">O(n)</td><td class="mono">O(1)</td></tr>
      <tr><td>Undo last action</td><td>Linked stack — pop (O(1)) + possible O(n) re-insert</td><td class="mono">O(1)*</td><td class="mono">O(1)</td></tr>
      <tr><td>Search by PNR / name</td><td>Linear (sequential) search</td><td class="mono">O(n)</td><td class="mono">O(1)</td></tr>
      <tr><td>Sort confirmed list</td><td>Insertion sort (node relinking)</td><td class="mono">O(n) best / O(n²) worst</td><td class="mono">O(1)</td></tr>
      <tr><td>Traverse / display</td><td>Linked list / queue</td><td class="mono">O(n)</td><td class="mono">O(1)</td></tr>
    </tbody></table>
    <p class="hint">* The pop itself is O(1); reversing the action may re-insert a passenger at a recorded queue position, which is a single O(n) traversal.</p>`;

  $('coCards').innerHTML = [
    coCard('CO1', 'ADT & Linked Lists',
      'Confirmed reservations live in a singly linked list with head and tail pointers. Booking appends at the tail in O(1); cancellation unlinks head, middle or tail nodes correctly. A second linked list keeps the activity timeline.',
      'insert · delete · traverse · search · update'),
    coCard('CO2', 'Stack & Queue',
      'The waiting list is a linked queue (front/rear, FIFO) so the longest-waiting passenger is always promoted first. The action history is a linked stack (LIFO) powering one-click undo, including reversing promotions.',
      'enqueue · dequeue · push · pop · peek'),
    coCard('CO3', 'Searching & Sorting',
      'Linear search locates reservations by PNR or name — sequential traversal is the correct choice for linked storage with no random access. Insertion sort relinks the confirmed list into order with O(1) extra space.',
      'linear search · insertion sort')
  ].join('');
}

/* ============================ detail modal ============================ */

function openDetail(pnr) {
  const p = findPassenger(pnr);
  if (!p) return toast('error', 'Not found', `PNR ${pnr} no longer exists.`);
  const waiting = p.status === 0;
  const pos = waiting ? waitingPos(pnr) : null;
  openModal(`Reservation — PNR ${p.pnr}`, `
    <dl class="kv">${kv([
      ['PNR', p.pnr], ['Passenger', esc(p.name)], ['Train', p.trainNo],
      ['Age', p.age], ['Gender', p.gender],
      ['Booking token', '#' + p.bookingTime],
      ['Booked at', p.bookedAt ? new Date(p.bookedAt).toLocaleString() : '—'],
      ['Status', badge(waiting ? 'WAITING' : 'CONFIRMED') + (pos ? ` <span class="pos">WL #${pos}</span>` : '')]
    ])}</dl>
    <div class="modal-form">
      <h4>Update passenger details</h4>
      <div class="form-row">
        <label for="uAge">Age <input type="number" id="uAge" min="1" max="120" value="${p.age}"></label>
        <label for="uGender">Gender
          <select id="uGender">
            <option ${p.gender === 'M' ? 'selected' : ''}>M</option>
            <option ${p.gender === 'F' ? 'selected' : ''}>F</option>
            <option ${p.gender === 'O' ? 'selected' : ''}>O</option>
          </select>
        </label>
      </div>
      <div class="btn-row">
        <button class="btn btn-primary" id="uSave" type="button">Save changes</button>
        <button class="btn btn-danger" id="uCancelRes" type="button">Cancel reservation</button>
      </div>
    </div>`);
  $('uSave').addEventListener('click', async () => {
    try {
      await API.post('/api/update', { pnr, age: $('uAge').value, gender: $('uGender').value });
      toast('success', 'Reservation updated', `PNR ${pnr} details saved.`);
      closeModal();
      await refresh();
    } catch (err) { toast('error', 'Update failed', esc(err.message)); }
  });
  $('uCancelRes').addEventListener('click', () => { closeModal(); confirmCancel(pnr); });
}

/* ============================ modal / toast helpers ============================ */

function openModal(title, bodyHTML) {
  $('modalTitle').innerHTML = title;
  $('modalBody').innerHTML = bodyHTML;
  $('modalBackdrop').hidden = false;
}
function closeModal() { $('modalBackdrop').hidden = true; }

function confirmDialog(title, messageHTML, onConfirm) {
  openModal(title, `
    <div class="confirm-body"><p>${messageHTML}</p>
      <div class="btn-row">
        <button class="btn" id="mCancel" type="button">Keep reservation</button>
        <button class="btn btn-danger" id="mConfirm" type="button">Yes, cancel it</button>
      </div></div>`);
  $('mCancel').addEventListener('click', closeModal);
  $('mConfirm').addEventListener('click', async () => { closeModal(); await onConfirm(); });
}

function toast(type, title, message) {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.innerHTML = `<strong>${esc(title)}</strong>${message ? `<span>${message}</span>` : ''}`;
  $('toasts').appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, 4200);
}

/* ============================ small helpers ============================ */

function findPassenger(pnr) {
  return (state.confirmed.find((p) => p.pnr === pnr)) ||
         (state.waiting.find((p) => p.pnr === pnr)) || null;
}
function waitingPos(pnr) {
  const i = state.waiting.findIndex((p) => p.pnr === pnr);
  return i >= 0 ? i + 1 : null;
}
function badge(text) {
  const cls = text === 'CONFIRMED' ? 'ok' : text === 'WAITING' ? 'warn' : text === 'CANCELLED' ? 'danger' : 'muted';
  return `<span class="badge ${cls}">${text}</span>`;
}
function statCard(label, value, sub, tone) {
  return `<div class="stat"><span class="stat-label">${label}</span>
    <span class="stat-value${tone === 'ok' ? ' ok' : tone === 'warn' ? ' warn' : ''}">${value}</span>
    <span class="stat-sub">${sub}</span></div>`;
}
function kv(pairs) {
  return pairs.map(([k, v]) => `<div class="kv-row"><dt>${k}</dt><dd>${v}</dd></div>`).join('');
}
function passengerTable(rows, opts = {}) {
  const { compact = false, emptyText = 'No records to display.' } = opts;
  if (!rows.length) return `<div class="empty"><div class="empty-icon">▦</div><p>${emptyText}</p></div>`;
  const head = compact
    ? '<tr><th>PNR</th><th>Passenger</th><th>Age</th><th>Status</th></tr>'
    : '<tr><th>PNR</th><th>Passenger</th><th>Train</th><th>Age</th><th>Gender</th><th>Booked</th><th>Status</th><th class="th-actions">Actions</th></tr>';
  const body = rows.map((p) => compact
    ? `<tr data-pnr="${p.pnr}"><td class="mono">${p.pnr}</td><td>${esc(p.name)}</td><td>${p.age}</td><td>${badge('CONFIRMED')}</td></tr>`
    : `<tr data-pnr="${p.pnr}">
         <td class="mono">${p.pnr}</td><td>${esc(p.name)}</td><td class="mono">${p.trainNo}</td>
         <td>${p.age}</td><td>${p.gender}</td>
         <td class="mono" title="${esc(p.bookedAt || '')}">#${p.bookingTime}</td>
         <td>${badge('CONFIRMED')}</td>
         <td class="td-actions">
           <button class="btn-mini" data-view-pnr="${p.pnr}" type="button">View</button>
           <button class="btn-mini danger" data-cancel-pnr="${p.pnr}" type="button">Cancel</button>
         </td></tr>`).join('');
  return `<table class="tbl"><thead>${head}</thead><tbody>${body}</tbody></table>`;
}
function timeline(items) {
  if (!items || !items.length) return '<li class="tl-empty">No activity yet.</li>';
  const cls = { BOOK: 'ok', CANCEL: 'danger', PROMOTION: 'info', UNDO: 'warn', SYSTEM: 'muted', SORT: 'info', UPDATE: 'info' };
  return items.map((a) => `
    <li class="tl-item">
      <span class="tl-badge ${cls[a.type] || 'muted'}">${esc(a.type.slice(0, 5))}</span>
      <div class="tl-body"><p>${esc(a.message)}</p><span class="tl-time">${timeAgo(a.at)}</span></div>
    </li>`).join('');
}
function coCard(code, title, text, ops) {
  return `<div class="card co-card"><span class="co-code">${code}</span><h3>${title}</h3>
    <p>${text}</p><p class="co-ops"><b>Key operations:</b> ${ops}</p></div>`;
}
function timeAgo(iso) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 10) return 'just now';
  if (s < 60) return s + 's ago';
  const m = Math.floor(s / 60);
  if (m < 60) return m + ' min ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  return new Date(iso).toLocaleDateString();
}
function fmtDuration(sec) {
  sec = Number(sec) || 0;
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}h ${m}m` : (m ? `${m}m ${s}s` : `${s}s`);
}
```

---

#### `README.md`

````markdown
<div align="center">

# 🚆 TRWL — Train Reservation Waiting List

**Dynamic passenger booking & waiting-list management, powered by *real* data structures**

`Singly Linked List` · `Linked-List Queue (FIFO)` · `Linked-List Stack (LIFO)` · `Linear Search` · `Insertion Sort`

![Node.js](https://img.shields.io/badge/Node.js-16%2B-339933?logo=nodedotjs&logoColor=white)
![Dependencies](https://img.shields.io/badge/dependencies-none-2ea44f)
![Tests](https://img.shields.io/badge/tests-22%20automated-1c5fae)
![Course](https://img.shields.io/badge/Data%20Structures-PBL%20Project-e56a1e)
![License](https://img.shields.io/badge/license-MIT-6a737d)

*A classic railway-counter problem — rebuilt as a full-stack, viva-ready system where every
button, badge and terminal log line is driven by the actual linked list, queue and stack
running in the backend.*

</div>

---

## ✨ Why this is not a “fake UI” project

- ✅ The **confirmed list, waiting queue, undo stack and activity timeline are genuine linked structures** living in the backend — nodes are `malloc`-style objects with real `next` pointers that get **relinked, unlinked and moved between structures**.
- ✅ When a berth frees, the passenger at the **FRONT of the queue is dequeued and the *same node* is appended to the linked list** — exactly like the textbook workflow.
- ✅ **Undo** pops the LIFO stack and reverses the *whole composite action*: a cancelled passenger is restored **and** the passenger who was promoted is returned to the **front** of the waiting queue (exact FIFO position).
- ✅ **Linear search** returns the real node-traversal trail (`HEAD → P1001 → P1002 → MATCH`), rendered in the UI.
- ✅ **Insertion sort** relinks the actual nodes in place — O(1) extra space — with before/after comparison and a comparison counter.
- ✅ The backend is the **single source of truth**; the frontend only renders API snapshots.

---

## 🚀 Quick Start (60 seconds)

```bash
# 1. No dependencies at all — nothing to install.
node server.js

# 2. Open the URL printed in the terminal:
#    http://localhost:5000
```

Run the automated test suite (16 core + 6 API integration tests):

```bash
npm test        # or: node tests/run-tests.js
```

> Requirements: [Node.js 16+](https://nodejs.org) (Node 18+ recommended for the HTTP integration tests).
> Change the port with `PORT=3000 node server.js`.

---

## 🧠 The data structures

| Structure | Where it lives | Why it was chosen | Key operations |
|---|---|---|---|
| **Singly Linked List** (`backend/core/linkedList.js`) | Confirmed reservations (head + tail), activity timeline | Passenger count is unknown in advance; O(1) insertion/deletion once the node is located | `insertTail`, `remove` (head/middle/tail), `traverse`, `find` |
| **Linked Queue** (`backend/core/queue.js`) | Waiting list (front + rear) | Strict **FIFO**: the longest-waiting passenger must be promoted first; no pre-declared capacity | `enqueue`, `dequeue`, `peek`, `remove` (any position), `insertAt` (undo) |
| **Linked Stack** (`backend/core/stack.js`) | Action history (top) | **LIFO**: the most recent booking/cancellation is the one to undo; O(1) push/pop | `push`, `pop`, `peek`, `toArray` |
| **Linear Search** (`backend/core/search.js`) | PNR / name lookup | Linked structures have **no random access** — sequential traversal is the correct algorithm; returns the visited-node trail | O(n) time, O(1) space |
| **Insertion Sort** (`backend/core/sort.js`) | Ordered reports by PNR / booking time / name | Bookings arrive nearly time-sorted — insertion sort exploits that (~O(n)); relinks nodes in place (O(1) space) | best ≈ O(n), worst O(n²) |

---

## 🔄 The heart of the system — automatic FIFO promotion

```
 CANCEL PNR 1002 (confirmed)
        │
        ▼
 [LIST]  node unlinked  ·  berth released  ·  CANCEL pushed to stack
        │
        ▼
 [QUEUE] waiting queue non-empty? ── no ──▶ berth stays available
        │ yes
        ▼
 [QUEUE] DEQUEUE front  (the passenger who waited longest)
        │
        ▼
 [LIST]  same node appended at tail  ·  status → CONFIRMED ✅
        │
        ▼
 [STACK] undo later ⇒ promoted passenger returns to FRONT,
         cancelled passenger restored — the exact previous state
```

---

## 🏗️ Architecture

```
┌──────────────────────────── Browser ────────────────────────────┐
│  frontend/ (vanilla HTML + CSS + JS · dashboard, queue & stack   │
│  visualisations, toasts, modals, responsive)                     │
└─────────────────────────── fetch JSON ───────────────────────────┘
                            │  /api/*
┌─────────────────────────── ▼ ───────────────────────────────────┐
│  server.js — zero-dependency Node HTTP server (API + static)    │
│  backend/reservationSystem.js — domain core (source of truth)   │
│  backend/core/* — pure ADTs: linkedList · queue · stack ·        │
│                  search · sort      backend/logger.js — live     │
│                  colour-coded terminal logs                      │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🔌 API Reference

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/health` | Liveness, uptime, structure statuses |
| `GET` | `/api/state` | **Full system snapshot** (confirmed, waiting, stack, activity, stats) |
| `GET` | `/api/availability` | Berths confirmed / available / waiting |
| `GET` | `/api/confirmed` · `/api/waiting` · `/api/history` · `/api/activity` | Focused views |
| `POST` | `/api/book` | New reservation `{name, age, gender, trainNo}` → CONFIRMED / WAITING |
| `POST` | `/api/cancel` | Cancel by `{pnr}` — triggers automatic FIFO promotion |
| `POST` | `/api/search` | `{type:"pnr"\|"name", value}` → linear search + traversal trail |
| `POST` | `/api/sort` | `{key:"pnr"\|"bookingTime"\|"name"}` → insertion sort, before/after |
| `POST` | `/api/undo` | Undo the most recent action (reverses promotions too) |
| `POST` | `/api/update` | Update passenger age / gender by PNR |
| `POST` | `/api/demo` · `/api/reset` | Load the one-click demo scenario / reset everything |

All validation happens **in the backend** — invalid input returns clean `400`/`404` JSON, never a crash.

---

## 🖥️ Backend terminal experience

Every log corresponds to a **real** operation — open `server.js` and the core next to it and watch:

```
==================================================================
        TRAIN RESERVATION WAITING LIST SYSTEM (TRWL backend)
==================================================================
...
09:21:04  [API    ] POST /api/cancel
09:21:04  [CANCEL ] Cancellation request: PNR 1002
09:21:04  [SEARCH ] Linear search started — confirmed list → waiting queue
09:21:04  [SEARCH ] PNR 1002 found in confirmed list (node #2)
09:21:04  [LIST   ] Node unlinked — PNR 1002 (list size 4)
09:21:04  [STACK  ] PUSH CANCEL action
09:21:04  [SEAT   ] Seat released
09:21:04  [QUEUE  ] Checking waiting queue for promotion
09:21:04  [QUEUE  ] Front passenger: PNR 1006 (Karthik Raj)
09:21:04  [QUEUE  ] DEQUEUE PNR 1006
09:21:04  [PROMOTE] PNR 1006 → CONFIRMED (list size 5)
09:21:04  [RESULT ] Cancellation complete — PNR 1006 auto-promoted to CONFIRMED
```

---

## 🎬 10-minute viva demo script

1. `node server.js` — show the startup banner (all modules READY).
2. Open **Dashboard** → *Load Demo Scenario* (System page): 5 confirmed + 3 waiting, instantly.
3. **Book** one more passenger → result card: *WAITING #4*.
4. Show the **Waiting Queue** page — FRONT → REAR, FIFO arrows.
5. **Cancel PNR 1001** → toast + activity timeline show *PNR 1006 promoted*; the confirmed row flashes.
6. Open the **Data Structures** page — show the linked list, queue and stack *after* the promotion.
7. **Search** PNR 1006 → linear-search traversal visualisation (`HEAD → … → MATCH`).
8. **Sort** by passenger name → before/after chains + comparison count.
9. **Action History** → show the LIFO stack, then **Undo** — the cancellation is reversed and PNR 1006 returns to the *front* of the queue.
10. Point at the terminal — every step above is logged live. Run `npm test` to finish with 22 green checks.

---

## ⏱️ Complexity (matches the actual implementation)

| Operation | Data structure | Time | Space |
|---|---|---|---|
| Book (berth free) | Linked list — tail insert | O(1) | O(1) |
| Book (waiting) | Queue — enqueue at rear | O(1) | O(1) |
| Cancel + promote | Linear search + unlink + dequeue | O(n) | O(1) |
| Undo | Stack pop (+ possible O(n) re-insert) | O(1)* | O(1) |
| Search PNR/name | Linear search | O(n) | O(1) |
| Sort | Insertion sort (node relinking) | ≈O(n) best / O(n²) worst | O(1) |
| Display/traverse | List / queue | O(n) | O(1) |

\* the pop itself is O(1); restoring a waiting passenger to a recorded position is one O(n) traversal.

---

## ✅ Testing

`node tests/run-tests.js` executes 16 core test cases (TC01–TC16, covering the report's TC01–TC13
plus undo-of-booking, input validation and name search) **and** 6 live HTTP integration checks
against the real server — then prints a pass/fail table and sets the exit code.

Highlights: FIFO promotion order, undo of a promotion (exact front-of-queue restore), best-case
sort comparison count (`n − 1`), waiting-list boundary rejection, tail-pointer repair after sorting.

---

## 📁 Project structure

```
train-reservation-waiting-list/
├── server.js                  # entry point — HTTP API + static frontend
├── package.json
├── backend/
│   ├── logger.js              # colour-coded terminal logging + startup banner
│   ├── reservationSystem.js   # domain core (booking, cancel, promote, undo…)
│   └── core/                  # the pure ADTs & algorithms (viva gold)
│       ├── linkedList.js      # CO1 — singly linked list (head + tail)
│       ├── queue.js           # CO2 — linked queue (front + rear, FIFO)
│       ├── stack.js           # CO2 — linked stack (LIFO)
│       ├── search.js          # CO3 — linear search
│       └── sort.js            # CO3 — insertion sort (in-place relinking)
├── frontend/
│   ├── index.html
│   ├── css/style.css
│   └── js/app.js
├── tests/
│   └── run-tests.js           # TC01–TC16 + HTTP API integration
└── README.md
```

---

## 🎨 UI tour

- **Dashboard** — stat cards, berth occupancy gauge, mini tables, live activity timeline.
- **Booking** — professional form → processing spinner → CONFIRMED ✓ / WAITING ⏳ result card.
- **Waiting Queue** — FRONT → REAR visual queue with FIFO arrows and WL positions.
- **Search** — result card + the *actual* traversal chain with MATCH highlight.
- **Sort** — before/after chains and a comparison counter.
- **History** — LIFO stack view (top = next undo) + full timeline.
- **Data Structures** — live node diagrams (`[data|next]` boxes) for list, queue and stack.
- Toast notifications, confirmation dialogs, empty/loading/error states, fully responsive
  (sidebar collapses to a hamburger on mobile), colour + icon + text status badges.

---

## 🛠️ Troubleshooting

| Problem | Fix |
|---|---|
| `EADDRINUSE` (port busy) | `PORT=5001 node server.js` |
| UI shows “Backend offline” | Is the terminal with `node server.js` still running? |
| HTTP tests skipped | They need Node 18+ (global `fetch`); core tests still run on Node 16. |

---

## 👥 Team

**KPR Institute of Engineering and Technology (Autonomous), Coimbatore — Dept. of Information Technology**
*Data Structures · II Year / III Semester · Academic Year 2026–27 · Assignment I (PBL)*

| | |
|---|---|
| Mowshik G | 25AM075 |
| Rohitha S | 25AM101 |


**References:** Lipschutz (Schaum's Data Structures) · Horowitz, Sahni & Anderson-Freed (*Fundamentals of Data Structures in C*) · Thareja (*Data Structures Using C*) · IRCTC PNR/RAC public documentation.

---

<div align="center">

**⭐ If this project helped you, star the repo — and cancel a berth to make someone's day. 🚆**

*Zero dependencies · MIT License*

</div>
````

---

## ✅ Final verification checklist (run these after assembling)

1. `node server.js` → banner appears, no errors.
2. Open `http://localhost:5000` → dashboard renders, "Backend connected" (green dot).
3. **System → Load Demo Scenario** → 5 confirmed, 3 waiting.
4. Cancel **PNR 1001** → toast says PNR 1006 promoted; confirmed row flashes; queue shrinks.
5. **Undo** → PNR 1001 restored, PNR 1006 back at WL #1.
6. Search `1006`, sort by name, check the **Data Structures** page diagrams.
7. `npm test` → 22/22 PASS.

One honest note: I couldn't execute the code from here, so run `npm test` once locally — the suite is written to catch any issue quickly, and the README's troubleshooting section covers the two common hiccups (port in use, Node version). Want me to also generate a matching condensed **project report .md** (to replace/update the PDF sections with the final implementation details), or add screenshots placeholders for the README?