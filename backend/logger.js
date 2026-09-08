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