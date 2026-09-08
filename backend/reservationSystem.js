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

module.exports = ReservationSystem;
module.exports.ReservationSystem = ReservationSystem;
module.exports.ValidationError = ValidationError;
module.exports.NotFoundError = NotFoundError;
module.exports.AppError = AppError;