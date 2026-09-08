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