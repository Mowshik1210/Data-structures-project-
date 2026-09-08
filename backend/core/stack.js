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